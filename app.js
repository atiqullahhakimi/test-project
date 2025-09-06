import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nunewaqgfniuzesbnjol.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51bmV3YXFnZm5pdXplc2Juam9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4OTAwNzYsImV4cCI6MjA3MTQ2NjA3Nn0.9qhDTlVwsQGIOYuZVt6BrDt2YpR2DoJU44UCN2myrwg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const AUTO_RESEND_AFTER_SIGNUP = true;

// ---------- UI helpers ----------
const statusEl = document.getElementById("status");
async function refreshStatus() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) console.warn("getUser:", error.message);
  statusEl.textContent = user ? `Signed in as: ${user.email}` : "Signed out";
  return user;
}
supabase.auth.onAuthStateChange(() => refreshStatus());
window.addEventListener("load", refreshStatus);

function buildRedirectURL() {
  // روی GH Pages به ریشه‌ی مسیر پروژه (مثلاً /test-project/) برمی‌گردد
  return new URL("./", window.location.href).href;
}
function validateEmailPassword(email, password) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert("Enter a valid email."); return false; }
  if (!password || password.length < 6) { alert("Password must be at least 6 characters."); return false; }
  return true;
}

// ---------- خیلی مهم: ساخت خودکار سشن وقتی از لینک ایمیل برگشتیم ----------
(async function finalizeAuthFromRedirect() {
  try {
    const qs = new URLSearchParams(window.location.search);
    // حالت ?code=...
    if (qs.has("code")) {
      const { error } = await supabase.auth.exchangeCodeForSession(window.location.search);
      if (error) console.warn("exchangeCodeForSession:", error.message);
      // تمیزکردن URL
      history.replaceState({}, "", window.location.pathname);
    }

    // حالت #access_token=...
    if (window.location.hash.includes("access_token")) {
      const h = new URLSearchParams(window.location.hash.slice(1));
      const access_token = h.get("access_token");
      const refresh_token = h.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) console.warn("setSession:", error.message);
      }
      window.location.hash = "";
    }
  } catch (e) {
    console.warn("finalizeAuthFromRedirect unexpected:", e);
  } finally {
    await refreshStatus();
  }
})();

// ---------- AUTH ----------
document.getElementById("signupBtn").onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  if (!validateEmailPassword(email, password)) return;

  const redirectTo = buildRedirectURL();
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: redirectTo }
  });
  console.log("signUp:", { redirectTo, userId: data?.user?.id, error });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("user already")) {
      const { error: reErr } = await supabase.auth.resend({ type: "signup", email });
      if (reErr) alert("Resend error: " + reErr.message);
      else alert("User exists. New confirmation link sent. Check Inbox/Spam.");
      return;
    }
    alert("SignUp error: " + error.message);
    return;
  }

  if (!data?.session) {
    if (AUTO_RESEND_AFTER_SIGNUP) {
      const { error: reErr } = await supabase.auth.resend({ type: "signup", email });
      if (reErr) console.warn("auto-resend failed:", reErr.message);
    }
    alert("Signup successful. Please confirm your email, then Sign In.");
  } else {
    alert("Signed up & signed in.");
  }
  await refreshStatus();
};

document.getElementById("signinBtn").onclick = async () => {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  const { data: { user: current } } = await supabase.auth.getUser();
  if (current && current.email === email) {
    alert(`Already signed in as ${current.email}`);
    await refreshStatus();
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  console.log("signInWithPassword:", { error, hasSession: !!data?.session });
  if (error) {
    const m = (error.message || "").toLowerCase();
    if (m.includes("email not confirmed")) alert("Email not confirmed. Check Inbox/Spam or click Resend.");
    else if (m.includes("invalid login credentials")) alert("Wrong email or password.");
    else alert(error.message);
  } else {
    alert("Signed in.");
  }
  await refreshStatus();
};

document.getElementById("signoutBtn").onclick = async () => {
  await supabase.auth.signOut();
  await refreshStatus();
  alert("Signed out.");
};

// اختیاری: ارسال دوباره ایمیل تأیید
const resendBtn = document.getElementById("resendBtn");
if (resendBtn) {
  resendBtn.onclick = async () => {
    const email = document.getElementById("email").value.trim();
    if (!email) { alert("Enter email first."); return; }
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) alert("Resend error: " + error.message);
    else alert("Confirmation email sent.");
  };
}

// ---------- DB: Insert / Select شما (بدون تغییر) ----------
document.getElementById("addClientForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const user = await refreshStatus();
    if (!user) { alert("Please sign in first (Sign In)."); throw new Error("not-authenticated"); }

    const aRaw = document.getElementById("aNumber").value;
    const aNorm = (function (raw, min=7, max=12){ if(!raw)return null; let v=raw.toUpperCase().trim().replace(/[^A0-9]/g,''); if(v.startsWith('A')) v=v.slice(1); v=v.replace(/\D/g,''); if(v.length<min||v.length>max) return null; return 'A'+v; })(aRaw);

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
    alert("Record added."); e.target.reset();
  } catch (err) {
    if (err?.message !== "not-authenticated") console.error(err);
  }
};

document.getElementById("loadBtn").onclick = async () => {
  const user = await refreshStatus();
  if (!user) { alert("Please sign in first (Sign In)."); throw new Error("not-authenticated"); }

  const { data, error } = await supabase
    .from("clients").select("id,name,email,age,phone,a_number,created_at")
    .order("id", { ascending: true });

  if (error) { console.error(error); alert(error.message); return; }
  const ul = document.getElementById("list"); ul.innerHTML = "";
  data.forEach(r => {
    const li = document.createElement("li");
    li.textContent = `#${r.id} | ${r.name ?? "-"} | ${r.email} | age=${r.age ?? "-"} | phone=${r.phone ?? "-"} | A#=${r.a_number ?? "-"}`;
    ul.appendChild(li);
  });
};
