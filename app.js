import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🟩 Your project
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

// ✅ A-Number normalizer
function normalizeANumber(raw, min = 7, max = 12) {
    if (!raw) return null;
    let v = raw.toUpperCase().trim().replace(/[^A0-9]/g, '');
    if (v.startsWith('A')) v = v.slice(1);
    v = v.replace(/\D/g, '');
    if (v.length < min || v.length > max) return null;
    return 'A' + v;
}

function requireAuth(user) {
    if (!user) { alert("Please sign in first (Sign In)."); throw new Error("not-authenticated"); }
}

// ---- AUTH ----

// (New) Sign Up: create a new user account
document.getElementById("signupBtn").onclick = async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        // Redirect URL after email confirmation — must be allowed in Supabase
        options: { emailRedirectTo: "https://atiqullahhakimi.github.io/" }
    });

    if (error) {
        alert("SignUp error: " + error.message);
        return;
    }

    // By default, no session is created until the email is confirmed.
    if (!data?.session) {
        alert("Signup successful. Please confirm your email, then Sign In.");
    } else {
        alert("Signed up & signed in.");
    }
    await refreshStatus();
};

// Sign In
document.getElementById("signinBtn").onclick = async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    await refreshStatus();
};

// Sign Out
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
        const aNorm = normalizeANumber(aRaw, 7, 12);
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

