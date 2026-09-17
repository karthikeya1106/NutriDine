"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, AlertCircle, Loader2, Eye, EyeOff, ChevronRight, ChevronLeft, CheckCircle2, Mail } from "lucide-react"
import { useUser, UserProfile } from "@/contexts/user-context"
import { apiLogin, apiSignup, setToken } from "@/lib/api"
import { calcSmartTarget } from "@/lib/calc"
import { useGoogleLogin } from "@react-oauth/google"

const BACKEND = "" // Routed via Next.js proxy rewrites → 127.0.0.1:8000

// ── Validation ────────────────────────────────────────────────────────────────
function validateEmail(email: string): string {
  if (!email.trim()) return "Email is required"
  const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
  if (!re.test(email.trim())) return "Enter a valid email (e.g. name@gmail.com)"
  const domain = email.split("@")[1]?.toLowerCase()
  const allowed = [
    "gmail.com","googlemail.com",
    "outlook.com","hotmail.com","live.com","msn.com",
    "yahoo.com","yahoo.in","yahoo.co.in","ymail.com",
    "icloud.com","me.com","mac.com",
    "rediffmail.com","sify.com",
    "protonmail.com","zoho.com","tutanota.com","aol.com","mail.com",
  ]
  const isEdu = domain.endsWith(".edu") || domain.endsWith(".ac.in") || domain.endsWith(".edu.in") || domain.endsWith(".org")
  if (!allowed.includes(domain) && !isEdu)
    return "Please use a valid email provider (Gmail, Outlook, Yahoo etc.)"
  return ""
}

function validatePassword(pw: string): string {
  if (!pw)              return "Password is required"
  if (pw.length < 8)   return "At least 8 characters required"
  if (!/[A-Z]/.test(pw)) return "Add at least one uppercase letter (A-Z)"
  if (!/[0-9]/.test(pw)) return "Add at least one number (0-9)"
  if (!/[^A-Za-z0-9]/.test(pw)) return "Add at least one special character (!@#$%)"
  return ""
}

function getStrength(pw: string) {
  if (!pw) return { label: "", color: "#e5e7eb", width: "0%" }
  let s = 0
  if (pw.length >= 8)           s++
  if (/[A-Z]/.test(pw))        s++
  if (/[0-9]/.test(pw))        s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (pw.length >= 12)          s++
  if (s <= 1) return { label: "Weak",        color: "#ef4444", width: "20%" }
  if (s <= 2) return { label: "Fair",        color: "#f97316", width: "40%" }
  if (s <= 3) return { label: "Good",        color: "#eab308", width: "65%" }
  if (s <= 4) return { label: "Strong",      color: "#22c55e", width: "85%" }
  return             { label: "Very Strong", color: "#16a34a", width: "100%" }
}

const CONDITIONS = [
  "Diabetes","Hypertension","Heart Disease","Obesity",
  "Celiac Disease","Lactose Intolerance","PCOS","Thyroid Disorder","Kidney Disease",
]

const FEATURES = [
  { emoji: "🧠", title: "AI-Powered",        desc: "Smart ML recommendations"   },
  { emoji: "🛡️", title: "Health First",      desc: "Condition-aware meal plans" },
  { emoji: "🎯", title: "Goal-Oriented",      desc: "Personalised for your body" },
  { emoji: "🥗", title: "20+ Indian Recipes", desc: "Safe for your conditions"   },
]

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="flex items-center gap-1 text-xs mt-1" style={{ color: "#ef4444" }}>
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  )
}

// ── Google Button ─────────────────────────────────────────────────────────────
function GoogleBtn({ text, onSuccess }: { text: string; onSuccess: (token: string, email: string, name: string) => void }) {
  const login = useGoogleLogin({
    onSuccess: async (res) => {
      try {
        const info = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${res.access_token}` }
        }).then(r => r.json())
        onSuccess(res.access_token, info.email, info.name)
      } catch { alert("Google login failed. Please try again.") }
    },
    onError: () => alert("Google login failed. Please try again."),
  })

  return (
    <button
      onClick={() => login()}
      className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 transition-all hover:shadow-md"
      style={{ background: "white", border: "1.5px solid #e5e7eb", color: "#374151" }}
    >
      {/* Google SVG icon */}
      <svg width="18" height="18" viewBox="0 0 48 48">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
      {text}
    </button>
  )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium">OR</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AuthPage() {
  const router      = useRouter()
  const { setUser } = useUser()

  const [tab, setTab]           = useState<"login"|"signup">("login")
  const [step, setStep]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [error, setError]       = useState("")
  const [showPass, setShowPass] = useState(false)
  const [fe, setFe]             = useState<Record<string,string>>({})

  // OTP state
  const [showOTP, setShowOTP]         = useState(false)
  const [otpValue, setOtpValue]       = useState("")
  const [otpLoading, setOtpLoading]   = useState(false)
  const [otpError, setOtpError]       = useState("")
  const [otpSending, setOtpSending]   = useState(false)
  const [resendTimer, setResendTimer] = useState(0)
  const [otpMode, setOtpMode]         = useState<"signup"|"login">("signup")

  // Login fields
  const [loginEmail,    setLoginEmail]    = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Signup fields
  const [sName,   setSName]   = useState("")
  const [sEmail,  setSEmail]  = useState("")
  const [sPass,   setSPass]   = useState("")
  const [sAge,    setSAge]    = useState("")
  const [sHeight, setSHeight] = useState("")
  const [sWeight, setSWeight] = useState("")
  const [sGender, setSGender] = useState("")
  const [sGoal,   setSGoal]   = useState("")
  const [sPref,   setSPref]   = useState("")
  const [conditions, setConditions] = useState<string[]>([])
  const [likes,    setLikes]   = useState<string[]>([])
  const [dislikes, setDislikes] = useState<string[]>([])
  const [likeIn,   setLikeIn]  = useState("")
  const [disIn,    setDisIn]   = useState("")

  const err  = (f: string, m: string) => setFe(p => ({ ...p, [f]: m }))
  const derr = (f: string)            => setFe(p => { const n={...p}; delete n[f]; return n })

  function toProfile(u: any): UserProfile {
    return {
      name: u.name, email: u.email, age: u.age ?? 25,
      height: u.height ?? 170, weight: u.weight ?? 70,
      gender: u.gender ?? "Other", goal: u.goal ?? "Maintenance",
      targetWeight: u.targetWeight ?? u.weight ?? 70,
      conditions: u.conditions ?? [], preference: u.preference ?? "Non-Vegetarian",
      cuisinePreference: u.cuisinePreference ?? "International",
      likes: u.likes ?? [], dislikes: u.dislikes ?? [], avatar: u.avatar ?? "",
    }
  }

  // ── OTP helpers ────────────────────────────────────────────────────────────
  const startResendTimer = () => {
    setResendTimer(60)
    const iv = setInterval(() => setResendTimer(t => { if(t<=1){clearInterval(iv);return 0} return t-1 }), 1000)
  }

  const sendOTP = async (email: string, name: string, mode: "signup"|"login") => {
    setOtpSending(true); setOtpError(""); setOtpMode(mode)
    try {
      const endpoint = mode === "signup" ? "/api/auth/send-otp" : "/api/auth/send-login-otp"
      const res  = await fetch(`${BACKEND}${endpoint}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP")
      setShowOTP(true)
      startResendTimer()
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Failed to send OTP")
      setError(e instanceof Error ? e.message : "Failed to send OTP")
    } finally { setOtpSending(false) }
  }

  const verifyOTP = async () => {
    const email = otpMode === "login" ? loginEmail : sEmail
    if (otpValue.length !== 6) { setOtpError("Please enter the 6-digit code"); return }
    setOtpLoading(true); setOtpError("")
    try {
      const res  = await fetch(`${BACKEND}/api/auth/verify-otp`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), otp: otpValue })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Invalid OTP")
      setShowOTP(false); setOtpValue("")
      if (otpMode === "signup") await completeSignup()
      else await completeLogin()
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Invalid OTP")
    } finally { setOtpLoading(false) }
  }

  // ── Login flow ─────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const eErr = validateEmail(loginEmail)
    if (eErr)           { err("loginEmail", eErr); return }
    if (!loginPassword) { err("loginPass",  "Password is required"); return }
    // Send OTP first to verify email exists
    await sendOTP(loginEmail, "", "login")
  }

  const completeLogin = async () => {
    setLoading(true); setError("")
    try {
      const r = await apiLogin(loginEmail.trim(), loginPassword)
      setToken(r.token); setUser(toProfile(r.user)); router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Check your credentials.")
    } finally { setLoading(false) }
  }

  // ── Google Sign-In/Up ──────────────────────────────────────────────────────
  const handleGoogleAuth = async (accessToken: string, email: string, name: string) => {
    setGLoading(true); setError("")
    try {
      // Try login first
      const loginRes = await fetch(`${BACKEND}/api/auth/google`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, email, name })
      })
      const data = await loginRes.json()
      if (!loginRes.ok) throw new Error(data.detail || "Google auth failed")
      setToken(data.token); setUser(toProfile(data.user)); router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed")
    } finally { setGLoading(false) }
  }

  // ── Signup flow ────────────────────────────────────────────────────────────
  const validateStep1 = () => {
    let ok = true
    if (!sName.trim())                                       { err("name",   "Name is required");         ok=false }
    const eE=validateEmail(sEmail);   if(eE)                { err("email",  eE);                         ok=false }
    const pE=validatePassword(sPass); if(pE)                { err("pass",   pE);                         ok=false }
    const a=parseInt(sAge); if(!sAge||a<10||a>100)         { err("age",    "Valid age: 10–100");         ok=false }
    const h=parseFloat(sHeight); if(!sHeight||h<100||h>250){ err("height", "Valid: 100–250 cm");        ok=false }
    const w=parseFloat(sWeight); if(!sWeight||w<20||w>300) { err("weight", "Valid: 20–300 kg");         ok=false }
    if (!sGender)                                           { err("gender", "Please select gender");     ok=false }
    return ok
  }

  const completeSignup = async () => {
    setLoading(true); setError("")
    const gm: Record<string,string> = { "weight-loss":"Weight Loss","muscle-gain":"Muscle Gain","maintenance":"Maintenance" }
    const pm: Record<string,string> = { "veg":"Vegetarian","non-veg":"Non-Vegetarian","vegan":"Vegan" }
    const gn: Record<string,string> = { "male":"Male","female":"Female","other":"Other" }
    const w  = parseFloat(sWeight)||70
    const h  = parseFloat(sHeight)||170
    // BMI-based smart target: underweight+muscle-gain→BMI 20, overweight+weight-loss→BMI 22, else ±5
    const tw = calcSmartTarget(sGoal || "maintenance", w, h)
    try {
      const r = await apiSignup({
        name: sName.trim(), email: sEmail.trim(), password: sPass,
        age: parseInt(sAge)||25, height: parseFloat(sHeight)||170, weight: w,
        gender: gn[sGender]||"Other", goal: gm[sGoal]||"Maintenance", target_weight: tw,
        conditions, preference: pm[sPref]||"Non-Vegetarian", likes, dislikes,
      })
      setToken(r.token); setUser(toProfile(r.user)); router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Signup failed.")
    } finally { setLoading(false) }
  }

  const switchTab = (t: "login"|"signup") => {
    setTab(t); setError(""); setStep(1); setFe({})
    setShowOTP(false); setOtpValue(""); setOtpError("")
  }

  const strength = getStrength(tab==="login" ? loginPassword : sPass)

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Georgia', serif" }}>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{ background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)" }}>
        <div className="absolute top-[-80px] right-[-80px] w-80 h-80 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,#e94560,transparent)" }} />
        <div className="absolute bottom-[-60px] left-[-60px] w-64 h-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle,#0f3460,#e94560)" }} />
        <div>
          <div className="flex items-center gap-3 mb-2">
            <img src="/nutridine-logoorg.png" alt="NutriDine Logo" className="w-12 h-12 rounded-2xl object-cover" />
            <span className="text-white text-3xl font-bold tracking-tight">NutriDine</span>
          </div>
          <p className="text-xs tracking-[0.3em] uppercase mt-1" style={{ color: "#e94560" }}>
            Personalized Nutrition System
          </p>
        </div>
        <div className="space-y-6">
          <h1 className="text-5xl font-bold leading-tight text-white">
            Eat Smart.<br /><span style={{ color: "#e94560" }}>Live Well.</span><br />Feel Great.
          </h1>
          <p className="text-lg leading-relaxed" style={{ color: "#a0aec0" }}>
            AI-powered diet recommendations tailored to your health conditions, goals, and preferences.
          </p>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <span className="text-xl">{f.emoji}</span>
                <div>
                  <p className="text-white text-sm font-semibold">{f.title}</p>
                  <p className="text-xs" style={{ color: "#718096" }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-8">
          {[["20+","Indian Recipes"],["40+","Ingredients"],["9","Health conditions"]].map(([n,l]) => (
            <div key={l}>
              <p className="text-2xl font-bold" style={{ color: "#e94560" }}>{n}</p>
              <p className="text-xs" style={{ color: "#718096" }}>{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-gray-950 overflow-y-auto">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="/nutridine-logoorg.png" alt="NutriDine Logo" className="w-9 h-9 rounded-xl object-cover" />
            <span className="text-xl font-bold">NutriDine</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
              {tab==="login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-gray-500 mt-1 text-sm">
              {tab==="login" ? "Sign in to your nutrition dashboard"
                : step===1 ? "Step 1 of 3 — Personal details"
                : step===2 ? "Step 2 of 3 — Health & goals"
                : "Step 3 of 3 — Food preferences"}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: "#f3f4f6" }}>
            {(["login","signup"] as const).map(t => (
              <button key={t} onClick={() => switchTab(t)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: tab===t ? "white" : "transparent",
                  color: tab===t ? "#1a1a2e" : "#9ca3af",
                  boxShadow: tab===t ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}>
                {t==="login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Google button — show on login or step 1 of signup */}
          {(tab==="login" || (tab==="signup" && step===1)) && (
            <>
              {gLoading
                ? <div className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-500 border border-gray-200">
                    <Loader2 className="w-4 h-4 animate-spin" /> Signing in with Google…
                  </div>
                : <GoogleBtn
                    text={tab==="login" ? "Continue with Google" : "Sign up with Google"}
                    onSuccess={handleGoogleAuth}
                  />
              }
              <Divider />
            </>
          )}

          {/* ── OTP POPUP ── */}
          {showOTP && (
            <div className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
              <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }}>
                    <Mail className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Check your email</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    We sent a 6-digit code to<br />
                    <strong className="text-gray-800">{otpMode==="login" ? loginEmail : sEmail}</strong>
                  </p>
                </div>
                <div className="space-y-2 mb-4">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Verification code</Label>
                  <Input
                    type="text" maxLength={6} placeholder="000000"
                    value={otpValue}
                    onChange={e => { setOtpValue(e.target.value.replace(/\D/,"")); setOtpError("") }}
                    className="h-14 text-center text-3xl rounded-xl border-gray-200 font-mono"
                    style={{ letterSpacing: "0.5em" }}
                  />
                  {otpError && (
                    <p className="flex items-center gap-1 text-xs text-red-500">
                      <AlertCircle className="w-3 h-3" />{otpError}
                    </p>
                  )}
                </div>
                <button onClick={verifyOTP} disabled={otpLoading || otpValue.length!==6}
                  className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 mb-4 disabled:opacity-50"
                  style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                  {otpLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</>
                    : otpMode==="login" ? "Verify & Sign In" : "Verify & Create Account"}
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button onClick={() => { setShowOTP(false); setOtpValue(""); setOtpError("") }}
                    className="text-gray-400 hover:text-gray-600">← Back</button>
                  <button onClick={() => sendOTP(otpMode==="login"?loginEmail:sEmail, sName, otpMode)}
                    disabled={resendTimer>0 || otpSending}
                    className="font-semibold disabled:opacity-40"
                    style={{ color: resendTimer>0 ? "#9ca3af" : "#e94560" }}>
                    {resendTimer>0 ? `Resend in ${resendTimer}s` : otpSending ? "Sending…" : "Resend OTP"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── LOGIN FORM ── */}
          {tab==="login" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email address</Label>
                <Input type="email" placeholder="you@gmail.com" value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); derr("loginEmail") }}
                  onBlur={() => { const m=validateEmail(loginEmail); if(m) err("loginEmail",m) }}
                  className={`h-12 rounded-xl ${fe.loginEmail?"border-red-400":"border-gray-200"}`} />
                <FieldError msg={fe.loginEmail} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</Label>
                <div className="relative">
                  <Input type={showPass?"text":"password"} placeholder="Your password"
                    value={loginPassword}
                    onChange={e => { setLoginPassword(e.target.value); derr("loginPass") }}
                    onBlur={() => { if(!loginPassword) err("loginPass","Password is required") }}
                    onKeyDown={e => e.key==="Enter" && handleLogin()}
                    className={`h-12 rounded-xl pr-12 ${fe.loginPass?"border-red-400":"border-gray-200"}`} />
                  <button onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError msg={fe.loginPass} />
              </div>

              {/* Login OTP notice */}
              <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
                style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
                <Mail className="w-4 h-4 shrink-0" />
                A verification code will be sent to your email before signing in
              </div>

              <button onClick={handleLogin} disabled={loading || otpSending}
                className="w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                {otpSending
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Sending OTP…</>
                  : loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</>
                  : <>Send Verification Code <ChevronRight className="w-4 h-4" /></>}
              </button>
              <p className="text-center text-sm text-gray-500">
                Don't have an account?{" "}
                <button onClick={() => switchTab("signup")} className="font-semibold" style={{ color: "#e94560" }}>
                  Sign up free
                </button>
              </p>
            </div>
          )}

          {/* ── SIGNUP FORM ── */}
          {tab==="signup" && (
            <div>
              <div className="flex gap-2 mb-7">
                {[1,2,3].map(s => (
                  <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                    style={{ background: s<=step ? "linear-gradient(90deg,#e94560,#f5a623)" : "#e5e7eb" }} />
                ))}
              </div>

              {/* Step 1 */}
              {step===1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Full Name</Label>
                      <Input placeholder="Your name" value={sName}
                        onChange={e => { setSName(e.target.value); derr("name") }}
                        onBlur={() => { if(!sName.trim()) err("name","Name is required") }}
                        className={`h-11 rounded-xl ${fe.name?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.name} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Age</Label>
                      <Input type="number" placeholder="21" value={sAge}
                        onChange={e => { setSAge(e.target.value); derr("age") }}
                        onBlur={() => { const a=parseInt(sAge); if(!sAge||a<10||a>100) err("age","Valid: 10-100") }}
                        className={`h-11 rounded-xl ${fe.age?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.age} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</Label>
                    <Input type="email" placeholder="you@gmail.com" value={sEmail}
                      onChange={e => { setSEmail(e.target.value); derr("email") }}
                      onBlur={() => { const m=validateEmail(sEmail); if(m) err("email",m) }}
                      className={`h-11 rounded-xl ${fe.email?"border-red-400":"border-gray-200"}`} />
                    <FieldError msg={fe.email} />
                    {sEmail && !fe.email && validateEmail(sEmail)==="" && (
                      <p className="flex items-center gap-1 text-xs mt-1 text-green-600">
                        <CheckCircle2 className="w-3 h-3" /> Valid email
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Height (cm)</Label>
                      <Input type="number" placeholder="175" value={sHeight}
                        onChange={e => { setSHeight(e.target.value); derr("height") }}
                        onBlur={() => { const h=parseFloat(sHeight); if(!sHeight||h<100||h>250) err("height","100-250 cm") }}
                        className={`h-11 rounded-xl ${fe.height?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.height} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Weight (kg)</Label>
                      <Input type="number" placeholder="70" value={sWeight}
                        onChange={e => { setSWeight(e.target.value); derr("weight") }}
                        onBlur={() => { const w=parseFloat(sWeight); if(!sWeight||w<20||w>300) err("weight","20-300 kg") }}
                        className={`h-11 rounded-xl ${fe.weight?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.weight} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Gender</Label>
                    <Select value={sGender} onValueChange={v => { setSGender(v); derr("gender") }}>
                      <SelectTrigger className={`h-11 rounded-xl ${fe.gender?"border-red-400":"border-gray-200"}`}>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FieldError msg={fe.gender} />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</Label>
                    <div className="relative">
                      <Input type={showPass?"text":"password"}
                        placeholder="Min 8 chars, uppercase, number, special"
                        value={sPass}
                        onChange={e => { setSPass(e.target.value); derr("pass") }}
                        onBlur={() => { const m=validatePassword(sPass); if(m) err("pass",m) }}
                        className={`h-11 rounded-xl pr-12 ${fe.pass?"border-red-400":"border-gray-200"}`} />
                      <button onClick={() => setShowPass(!showPass)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {sPass && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Strength</span>
                          <span style={{ color: strength.color }} className="font-semibold">{strength.label}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: strength.width, background: strength.color }} />
                        </div>
                        <div className="grid grid-cols-2 gap-1 mt-2">
                          {[
                            ["8+ characters",       sPass.length>=8],
                            ["Uppercase letter",     /[A-Z]/.test(sPass)],
                            ["Number (0-9)",         /[0-9]/.test(sPass)],
                            ["Special (!@#$%)",     /[^A-Za-z0-9]/.test(sPass)],
                          ].map(([l,p]) => (
                            <div key={l as string} className="flex items-center gap-1 text-xs"
                              style={{ color: p ? "#16a34a" : "#9ca3af" }}>
                              {p ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                              {l as string}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <FieldError msg={fe.pass} />
                  </div>

                  <button onClick={() => { if(validateStep1()) { setError(""); setStep(2) } }}
                    className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                  <p className="text-center text-sm text-gray-500 mt-2">
                    Already have an account?{" "}
                    <button onClick={() => switchTab("login")} className="font-semibold" style={{ color: "#e94560" }}>Sign in</button>
                  </p>
                </div>
              )}

              {/* Step 2 */}
              {step===2 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Health Conditions</Label>
                    <p className="text-xs text-gray-400">Select all that apply</p>
                    <div className="flex flex-wrap gap-2">
                      {CONDITIONS.map(c => (
                        <button key={c}
                          onClick={() => setConditions(p => p.includes(c)?p.filter(x=>x!==c):[...p,c])}
                          className="px-3 py-1.5 rounded-full text-xs font-medium transition-all border"
                          style={{
                            background: conditions.includes(c) ? "linear-gradient(135deg,#e94560,#f5a623)" : "white",
                            color: conditions.includes(c) ? "white" : "#374151",
                            borderColor: conditions.includes(c) ? "transparent" : "#d1d5db"
                          }}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Fitness Goal</Label>
                    <Select value={sGoal} onValueChange={setSGoal}>
                      <SelectTrigger className="h-11 rounded-xl border-gray-200"><SelectValue placeholder="Your goal?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weight-loss">🏃 Weight Loss</SelectItem>
                        <SelectItem value="muscle-gain">💪 Muscle Gain</SelectItem>
                        <SelectItem value="maintenance">⚖️ Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Food Preference</Label>
                    <Select value={sPref} onValueChange={setSPref}>
                      <SelectTrigger className="h-11 rounded-xl border-gray-200"><SelectValue placeholder="Dietary preference" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="veg">🥦 Vegetarian</SelectItem>
                        <SelectItem value="non-veg">🍗 Non-Vegetarian</SelectItem>
                        <SelectItem value="vegan">🌱 Vegan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)}
                      className="flex-1 h-12 rounded-xl font-semibold text-sm border border-gray-200 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button onClick={() => { setError(""); setStep(3) }}
                      className="flex-1 h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                      Continue <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {step===3 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Foods You Like</Label>
                    <div className="flex gap-2">
                      <Input placeholder="e.g. Paneer, Oats" value={likeIn}
                        onChange={e => setLikeIn(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter"&&likeIn.trim()){if(!likes.includes(likeIn.trim()))setLikes([...likes,likeIn.trim()]);setLikeIn("")}}}
                        className="h-10 rounded-xl border-gray-200 flex-1" />
                      <button onClick={() => { if(likeIn.trim()&&!likes.includes(likeIn.trim()))setLikes([...likes,likeIn.trim()]);setLikeIn("") }}
                        className="px-4 h-10 rounded-xl text-white text-sm font-medium" style={{ background: "#e94560" }}>Add</button>
                    </div>
                    {likes.length>0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {likes.map(f => (
                          <span key={f} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: "#d1fae5", color: "#065f46" }}>
                            {f} <X className="w-3 h-3 cursor-pointer" onClick={() => setLikes(likes.filter(x=>x!==f))} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Foods You Dislike</Label>
                    <div className="flex gap-2">
                      <Input placeholder="e.g. Bitter gourd" value={disIn}
                        onChange={e => setDisIn(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter"&&disIn.trim()){if(!dislikes.includes(disIn.trim()))setDislikes([...dislikes,disIn.trim()]);setDisIn("")}}}
                        className="h-10 rounded-xl border-gray-200 flex-1" />
                      <button onClick={() => { if(disIn.trim()&&!dislikes.includes(disIn.trim()))setDislikes([...dislikes,disIn.trim()]);setDisIn("") }}
                        className="px-4 h-10 rounded-xl text-white text-sm font-medium" style={{ background: "#6b7280" }}>Add</button>
                    </div>
                    {dislikes.length>0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {dislikes.map(f => (
                          <span key={f} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                            style={{ background: "#fee2e2", color: "#991b1b" }}>
                            {f} <X className="w-3 h-3 cursor-pointer" onClick={() => setDislikes(dislikes.filter(x=>x!==f))} />
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="p-4 rounded-xl" style={{ background: "rgba(233,69,96,0.05)", border: "1px solid rgba(233,69,96,0.15)" }}>
                    <p className="text-xs font-semibold text-gray-700 mb-2">📋 Profile summary</p>
                    <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
                      <span>👤 {sName}</span>
                      <span>📊 {sWeight}kg · {sHeight}cm</span>
                      <span>🎯 {sGoal||"Not set"}</span>
                      <span>🥗 {sPref||"Not set"}</span>
                      {conditions.length>0 && <span className="col-span-2">❤️ {conditions.join(", ")}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-3 rounded-xl text-xs"
                    style={{ background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1d4ed8" }}>
                    <Mail className="w-4 h-4 shrink-0" />
                    A 6-digit code will be sent to <strong>{sEmail}</strong> to verify your email
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)}
                      className="flex-1 h-12 rounded-xl font-semibold text-sm border border-gray-200 flex items-center justify-center gap-2 text-gray-600 hover:bg-gray-50">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button onClick={async () => { setError(""); await sendOTP(sEmail, sName, "signup") }}
                      disabled={otpSending}
                      className="flex-1 h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                      {otpSending ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <>Verify Email 📧</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
