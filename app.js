
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🟩 پروژه خودتان
const SUPABASE_URL = "https://nunewaqgfniuzesbnjol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bmV3YXFnZm5pdXplc2Juam9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTAwNzYsImV4cCI6MjA3MTQ2NjA3Nn0.9qhDTlVwsQGIOYuZVt6BrDt2YpR2DoJU44UCN2myrwg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- helpers ----
const statusEl = document.getElementById("status");
async function refreshStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    statusEl.textContent = user ? `Signed in as: ${user.email}` : "Signed out";
    return user;
}

// ✅ A-Number: اجازه 7 تا 12 رقم، خروجی استاندارد با A
function normalizeANumber(raw, min = 7, max = 12) {
    if (!raw) return null;
    let v = raw.toUpperCase().trim().replace(/[^A0-9]/g, ''); // فقط A و رقم
    if (v.startsWith('A')) v = v.slice(1);                    // A اول را بردار
    v = v.replace(/\D/g, '');                                  // فقط رقم
    if (v.length < min || v.length > max) return null;         // 7..12 رقم
    return 'A' + v;                                            // ذخیره استاندارد
}

function requireAuth(user) {
    if (!user) { alert("اول وارد حساب شوید (Sign In)."); throw new Error("not-authenticated"); }
}

// ---- AUTH ----
document.getElementById("signinBtn").onclick = async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    await refreshStatus();
};

document.getElementById("signoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    await refreshStatus();
    alert("Signed out.");
};

// ---- DB: INSERT clients ----
document.getElementById("addClientForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
        const user = await refreshStatus();
        requireAuth(user);

        const aRaw = document.getElementById("aNumber").value;
        const aNorm = normalizeANumber(aRaw, 7, 12); // 👈 هماهنگ با DB
        if (aRaw && !aNorm) {
            alert("Invalid A-Number. Use A + 7–12 digits.");
            return;
        }

        const ageVal = document.getElementById("age").value;
        const payload = {
            name: document.getElementById("name").value || null,
            email: document.getElementById("email2").value,
            age: ageVal ? Number(ageVal) : null,
            phone: document.getElementById("phone").value || null,
            a_number: aNorm || null
        };

        console.log("INSERT payload:", payload);
        const { error } = await supabase.from("clients").insert(payload);
        if (error) { console.error(error); alert(error.message); return; }

        alert("Record added.");
        e.target.reset();
    } catch (err) {
        if (err?.message !== "not-authenticated") console.error(err);
    }
};

// ---- DB: SELECT clients ----
document.getElementById("loadBtn").onclick = async () => {
    const user = await refreshStatus();
    requireAuth(user);

    const { data, error } = await supabase
        .from("clients")
        .select("id,name,email,age,phone,a_number,created_at")
        .order("id", { ascending: true });

    if (error) { console.error(error); alert(error.message); return; }

    const ul = document.getElementById("list");
    ul.innerHTML = "";
    data.forEach(r => {
        const li = document.createElement("li");
        li.textContent = `#${r.id} | ${r.name ?? "-"} | ${r.email} | age=${r.age ?? "-"} | phone=${r.phone ?? "-"} | A#=${r.a_number ?? "-"}`;
        ul.appendChild(li);
    });
};

// init
await refreshStatus();