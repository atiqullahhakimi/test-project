import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 🟩 Your project
const SUPABASE_URL = "https://nunewaqgfniuzesbnjol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bmV3YXFnZm5pdXplc2Juam9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTAwNzYsImV4cCI6MjA3MTQ2NjA3Nn0.9qhDTlVwsQGIOYuZVt6BrDt2YpR2DoJU44UCN2myrwg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🔧 رفتار: بعد از SignUp (بدون سشن) یک بار Resend هم بزن تا حتماً ایمیل برسد
const AUTO_RESEND_AFTER_SIGNUP = true;

// ---- helpers ----
const statusEl = document.getElementById("status");
async function refreshStatus() {
    const { data: { user } } = await supabase.auth.getUser();
    statusEl.textContent = user ? `Signed in as: ${user.email}` : "Signed out";
    return user;
}
supabase.auth.onAuthStateChange(() => refreshStatus());
window.addEventListener("load", refreshStatus);

// ریشه‌ی همان مسیر فعلی (GH Pages: /test-project/  | لوکال: :5500/)
function buildRedirectURL() {
    return new URL("./", window.location.href).href;
}

function validateEmailPassword(email, password) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Enter a valid email.");
        return false;
    }
    if (!password || password.length < 6) {
        alert("Password must be at least 6 characters.");
        return false;
    }
    return true;
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

// Sign Up (با ریدایرکت صحیح و Resend خودکار)
document.getElementById("signupBtn").onclick = async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!validateEmailPassword(email, password)) return;

    const redirectTo = buildRedirectURL();

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: redirectTo }
        });
        console.log("signUp:", { data, error, redirectTo });

        if (error) {
            const msg = error.message.toLowerCase();
            // کاربر قبلاً ساخته شده
            if (msg.includes("already registered") || msg.includes("user already")) {
                const { error: reErr } = await supabase.auth.resend({ type: "signup", email });
                if (reErr) alert("Resend error: " + reErr.message);
                else alert("User exists. Sent a fresh confirmation email. Check Inbox/Spam.");
                return;
            }
            alert("SignUp error: " + error.message);
            return;
        }

        // معمولاً تا تأیید ایمیل، سشن ساخته نمی‌شود
        if (!data?.session) {
            if (AUTO_RESEND_AFTER_SIGNUP) {
                const { error: reErr } = await supabase.auth.resend({ type: "signup", email });
                if (reErr) console.warn("Auto-resend failed:", reErr.message);
            }
            alert("Signup successful. Please confirm your email, then Sign In.");
        } else {
            alert("Signed up & signed in.");
        }
    } catch (e) {
        console.error(e);
        alert("Network or unexpected error during Sign Up.");
    } finally {
        await refreshStatus();
    }
};

// جلوگیری از ورود تکراری با همان کاربر
document.getElementById("signinBtn").onclick = async () => {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { data: { user: current } } = await supabase.auth.getUser();
    if (current && current.email === email) {
        alert(`Already signed in as ${current.email}`);
        await refreshStatus();
        return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("invalid login credentials")) {
            alert("Wrong email or password (or account not confirmed).");
        } else if (msg.includes("email not confirmed")) {
            alert("Please confirm your email first. Check Inbox/Spam.");
        } else {
            alert(error.message);
        }
    }
    await refreshStatus();
};

// Sign Out
document.getElementById("signoutBtn").onclick = async () => {
    await supabase.auth.signOut();
    await refreshStatus();
    alert("Signed out.");
};

// (اختیاری) Resend دستی
const resendBtn = document.getElementById("resendBtn");
if (resendBtn) {
    resendBtn.onclick = async () => {
        const email = document.getElementById("email").value.trim();
        if (!email) { alert("Enter email first."); return; }
        const { error } = await supabase.auth.resend({ type: "signup", email });
        if (error) alert("Resend error: " + error.message);
        else alert("Confirmation email sent. Check Inbox/Spam.");
    };
}

// ---- DB: INSERT clients ----
document.getElementById("addClientForm").onsubmit = async (e) => {
    e.preventDefault();
    try {
        const user = await refreshStatus();
        requireAuth(user);

        const aRaw = document.getElementById("aNumber").value;
        const aNorm = normalizeANumber(aRaw, 7, 12);
        if (aRaw && !aNorm) { alert("Invalid A-Number. Use A + 7–12 digits."); return; }

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
