"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { X, AlertCircle, Loader2, Eye, EyeOff, ChevronRight, ChevronLeft, CheckCircle2, Mail, Leaf, ShieldCheck, Utensils, Search, Zap } from "lucide-react"
import { useUser, UserProfile } from "@/contexts/user-context"
import { apiLogin, apiSignup, setToken } from "@/lib/api"
import { calcSmartTarget } from "@/lib/calc"
import { useGoogleLogin } from "@react-oauth/google"

// ── Animated counter (same as About page) ────────────────────────────────────
function useCounter(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function useInView(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return { ref, inView }
}

// ── Animated stat item ────────────────────────────────────────────────────────
function AnimStat({ value, suffix = "", label, color, start }: {
  value: number; suffix?: string; label: string; color: string; start: boolean
}) {
  const count = useCounter(value, 2000, start)
  return (
    <div>
      <p className="text-3xl font-bold" style={{ color }}>
        {count.toLocaleString()}{suffix}
      </p>
      <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{label}</p>
    </div>
  )
}

// Use relative URL so Next.js proxy rewrites handle routing to the backend
const BACKEND = ""

function validateEmail(email: string): string {
  if (!email.trim()) return "Email is required"
  const re = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/
  if (!re.test(email.trim())) return "Enter a valid email address (e.g. name@example.com)"
  return ""
}

function validatePassword(password: string): string {
  if (!password)              return "Password is required"
  if (password.length < 8)   return "At least 8 characters required"
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter (A-Z)"
  if (!/[0-9]/.test(password)) return "Add at least one number (0-9)"
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one special character (!@#$%)"
  return ""
}

function getStrength(pw: string) {
  if (!pw) return { label: "", color: "#e5e7eb", width: "0%", score: 0 }
  let s = 0
  if (pw.length >= 8)            s++
  if (/[A-Z]/.test(pw))         s++
  if (/[0-9]/.test(pw))         s++
  if (/[^A-Za-z0-9]/.test(pw))  s++
  if (pw.length >= 12)           s++
  if (s <= 1) return { label: "Weak",        color: "#ef4444", width: "20%",  score: s }
  if (s <= 2) return { label: "Fair",        color: "#f97316", width: "40%",  score: s }
  if (s <= 3) return { label: "Good",        color: "#eab308", width: "65%",  score: s }
  if (s <= 4) return { label: "Strong",      color: "#22c55e", width: "85%",  score: s }
  return             { label: "Very Strong", color: "#16a34a", width: "100%", score: s }
}

const CONDITIONS = [
  // Metabolic
  "Type 2 Diabetes", "Type 1 Diabetes", "Obesity", "Metabolic Syndrome", "Hyperuricemia (High Uric Acid)",
  // Cardiovascular
  "Hypertension (High Blood Pressure)", "Coronary Heart Disease", "High Cholesterol", "Heart Failure",
  // Digestive
  "Irritable Bowel Syndrome (IBS)", "Crohn's Disease", "Ulcerative Colitis", "Coeliac Disease",
  "GERD (Acid Reflux)", "Gallbladder Disease", "Chronic Pancreatitis",
  "Non-Alcoholic Fatty Liver Disease (NAFLD)", "Diverticular Disease",
  "Liver Disease (Cirrhosis)", "Lactose Intolerance",
  // Kidney
  "Chronic Kidney Disease (CKD)", "Kidney Stones",
  // Hormonal
  "PCOS", "Hypothyroidism", "Hyperthyroidism",
  // Bone & Joint
  "Osteoporosis", "Rheumatoid Arthritis", "Osteoarthritis", "Gout",
  // Blood
  "Iron Deficiency Anaemia", "Vitamin B12 Deficiency Anaemia",
  // Neurological
  "Migraine", "Epilepsy", "Alzheimer's Disease",
  // Mental Health
  "Depression", "Anxiety Disorders",
  // Respiratory
  "Asthma",
  // Skin
  "Psoriasis", "Eczema",
  // Women's Health
  "Menopause", "Endometriosis",
]

const FEATURES = [
  { icon: ShieldCheck, color: "#6366f1", title: "Health-Safe Meals",   desc: "Every dish cleared for your conditions" },
  { icon: Utensils,    color: "#10b981", title: "3,275 Recipes",       desc: "Across all cuisines and diets"           },
  { icon: Search,      color: "#f59e0b", title: "8,715 Ingredients",   desc: "Each analysed for your safety"           },
  { icon: Zap,         color: "#e94560", title: "AI-Powered Swaps",    desc: "Smart ingredient substitutions"          },
]

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return (
    <p className="flex items-center gap-1 text-xs mt-1" style={{ color: "#ef4444" }}>
      <AlertCircle className="w-3 h-3" /> {msg}
    </p>
  )
}

// ── Google Sign-In Button ─────────────────────────────────────────────────────
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
      className="w-full h-12 rounded-xl font-semibold text-sm flex items-center justify-center gap-3 transition-all hover:shadow-md active:scale-[0.98]"
      style={{ background: "white", border: "1.5px solid #e5e7eb", color: "#374151" }}
    >
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

function Divider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs text-gray-400 font-medium">OR</span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}

export default function AuthPage() {
  const router    = useRouter()
  const { setUser } = useUser()

  const [tab, setTab]         = useState<"login"|"signup">("login")
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [gLoading, setGLoading] = useState(false)
  const [error, setError]     = useState("")
  const [showPass, setShowPass] = useState(false)
  const [fe, setFe]           = useState<Record<string,string>>({})

  // OTP state
  const [showOTP, setShowOTP]         = useState(false)
  const [otpValue, setOtpValue]       = useState("")
  const [otpLoading, setOtpLoading]   = useState(false)
  const [otpError, setOtpError]       = useState("")
  const [otpSending, setOtpSending]   = useState(false)
  const [resendTimer, setResendTimer] = useState(0)

  // Login
  const [loginEmail,    setLoginEmail]    = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  // Forgot password
  const [fpOpen,     setFpOpen]     = useState(false)
  const [fpStep,     setFpStep]     = useState<1|2|3>(1)
  const [fpEmail,    setFpEmail]    = useState("")
  const [fpOtp,      setFpOtp]      = useState("")
  const [fpToken,    setFpToken]    = useState("")
  const [fpPass,     setFpPass]     = useState("")
  const [fpConfirm,  setFpConfirm]  = useState("")
  const [fpLoading,  setFpLoading]  = useState(false)
  const [fpError,    setFpError]    = useState("")
  const [fpTimer,    setFpTimer]    = useState(0)
  const [fpShowPass, setFpShowPass] = useState(false)

  // Signup
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
      name: u.name, email: u.email, age: u.age,
      height: u.height, weight: u.weight, gender: u.gender,
      goal: u.goal, targetWeight: u.targetWeight,
      conditions: u.conditions, preference: u.preference,
      cuisinePreference: u.cuisinePreference ?? "International",
      likes: u.likes, dislikes: u.dislikes, avatar: "",
    }
  }

  // ── Send OTP ───────────────────────────────────────────────────────────────
  const sendOTP = async () => {
    setOtpSending(true); setOtpError("")
    try {
      const res = await fetch(`${BACKEND}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sEmail.trim(), name: sName.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to send OTP")
      setShowOTP(true)
      // Start 60s resend timer
      setResendTimer(60)
      const interval = setInterval(() => {
        setResendTimer(t => { if (t <= 1) { clearInterval(interval); return 0 } return t - 1 })
      }, 1000)
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Failed to send OTP")
    } finally { setOtpSending(false) }
  }

  // ── Verify OTP ─────────────────────────────────────────────────────────────
  const verifyOTP = async () => {
    if (otpValue.length !== 6) { setOtpError("Please enter the 6-digit code"); return }
    setOtpLoading(true); setOtpError("")
    try {
      const res = await fetch(`${BACKEND}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sEmail.trim(), otp: otpValue })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Invalid OTP")
      setShowOTP(false)
      // Auto proceed to signup
      await completeSignup()
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Invalid OTP")
    } finally { setOtpLoading(false) }
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    const emailErr = validateEmail(loginEmail)
    if (emailErr)       { err("loginEmail", emailErr); return }
    if (!loginPassword) { err("loginPass", "Password is required"); return }
    setLoading(true); setError("")
    try {
      const r = await apiLogin(loginEmail.trim(), loginPassword)
      setToken(r.token); setUser(toProfile(r.user)); router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed. Check your credentials.")
    } finally { setLoading(false) }
  }

  // ── Forgot password handlers ───────────────────────────────────────────────
  const openFP = () => { setFpOpen(true); setFpStep(1); setFpEmail(loginEmail); setFpOtp(""); setFpToken(""); setFpPass(""); setFpConfirm(""); setFpError("") }
  const closeFP = () => { setFpOpen(false); setFpError("") }

  const fpSendOtp = async () => {
    const emailErr = validateEmail(fpEmail)
    if (emailErr) { setFpError(emailErr); return }
    setFpLoading(true); setFpError("")
    try {
      const res = await fetch(`${BACKEND}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Failed to send code")
      setFpStep(2)
      setFpTimer(60)
      const iv = setInterval(() => setFpTimer(t => { if (t <= 1) { clearInterval(iv); return 0 } return t - 1 }), 1000)
    } catch (e) { setFpError(e instanceof Error ? e.message : "Failed to send code") }
    finally { setFpLoading(false) }
  }

  const fpVerifyOtp = async () => {
    if (fpOtp.length !== 6) { setFpError("Please enter the 6-digit code"); return }
    setFpLoading(true); setFpError("")
    try {
      const res = await fetch(`${BACKEND}/api/auth/verify-reset-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail.trim(), otp: fpOtp }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Invalid code")
      setFpToken(data.token)
      setFpStep(3)
    } catch (e) { setFpError(e instanceof Error ? e.message : "Invalid code") }
    finally { setFpLoading(false) }
  }

  const fpResetPassword = async () => {
    const pErr = validatePassword(fpPass)
    if (pErr) { setFpError(pErr); return }
    if (fpPass !== fpConfirm) { setFpError("Passwords do not match"); return }
    setFpLoading(true); setFpError("")
    try {
      const res = await fetch(`${BACKEND}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: fpToken, new_password: fpPass }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Reset failed")
      closeFP()
      setLoginEmail(fpEmail)
      setError("")
      // Show success inline
      switchTab("login")
    } catch (e) { setFpError(e instanceof Error ? e.message : "Reset failed") }
    finally { setFpLoading(false) }
  }

  // ── Step 1 validation ──────────────────────────────────────────────────────
  const validateStep1 = () => {
    let ok = true
    if (!sName.trim())                                          { err("name",   "Name is required");          ok=false }
    const eErr = validateEmail(sEmail); if (eErr)              { err("email",  eErr);                        ok=false }
    const pErr = validatePassword(sPass); if (pErr)            { err("pass",   pErr);                        ok=false }
    const a=parseInt(sAge); if(!sAge||a<10||a>100)            { err("age",    "Valid age: 10–100");          ok=false }
    const h=parseFloat(sHeight); if(!sHeight||h<100||h>250)   { err("height", "Valid height: 100–250 cm");  ok=false }
    const w=parseFloat(sWeight); if(!sWeight||w<20||w>300)    { err("weight", "Valid weight: 20–300 kg");   ok=false }
    if (!sGender)                                              { err("gender", "Please select a gender");    ok=false }
    return ok
  }

  // ── Complete Signup ────────────────────────────────────────────────────────
  const completeSignup = async () => {
    setLoading(true); setError("")
    const gm: Record<string,string> = { "weight-loss":"Weight Loss","muscle-gain":"Muscle Gain","maintenance":"Maintenance" }
    const pm: Record<string,string> = { "veg":"Vegetarian","non-veg":"Non-Vegetarian","vegan":"Vegan" }
    const gn: Record<string,string> = { "male":"Male","female":"Female","other":"Other" }
    const w  = parseFloat(sWeight) || 70
    const h  = parseFloat(sHeight)  || 170
    // Use BMI-based smart target: underweight+muscle-gain→BMI 20, overweight+weight-loss→BMI 22, else ±5
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
      setError(e instanceof Error ? e.message : "Signup failed. Please try again.")
    } finally { setLoading(false) }
  }

  // ── Google Sign-In/Up ──────────────────────────────────────────────────────
  const handleGoogleAuth = async (accessToken: string, email: string, name: string) => {
    setGLoading(true); setError("")
    try {
      const res = await fetch(`${BACKEND}/api/auth/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken, email, name })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || "Google auth failed")
      setToken(data.token); setUser(toProfile(data.user)); router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Google sign-in failed")
    } finally { setGLoading(false) }
  }

  const switchTab = (t: "login"|"signup") => {
    setTab(t); setError(""); setStep(1); setFe({})
    setShowOTP(false); setOtpValue(""); setOtpError("")
  }
  const signupStrength = getStrength(sPass)

  const { ref: statsRef, inView: statsInView } = useInView()

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', 'Georgia', serif" }}>
      <style>{`
        /* ── Lockscreen hover effects ── */
        .ls-input {
          background: #ffffff !important;
          color: #1a1a2e !important;
          border: 1.5px solid #d1d5db !important;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .ls-input::placeholder {
          color: #9ca3af !important;
          opacity: 1 !important;
        }
        .ls-input:focus {
          border-color: #e94560 !important;
          box-shadow: 0 0 0 3px rgba(233,69,96,0.15) !important;
          outline: none;
          background: #ffffff !important;
          color: #1a1a2e !important;
        }
        /* Kill browser autofill background (chrome/safari grey/yellow tint) */
        .ls-input:-webkit-autofill,
        .ls-input:-webkit-autofill:hover,
        .ls-input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0px 1000px #ffffff inset !important;
          -webkit-text-fill-color: #1a1a2e !important;
          caret-color: #1a1a2e !important;
          border-color: #d1d5db !important;
        }
        .ls-btn-primary {
          transition: transform 0.18s, box-shadow 0.18s, filter 0.18s;
        }
        .ls-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(233,69,96,0.4);
          filter: brightness(1.08);
        }
        .ls-btn-primary:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 8px rgba(233,69,96,0.3);
        }
        .ls-feature-card {
          transition: background 0.2s, border-color 0.2s, transform 0.2s;
        }
        .ls-feature-card:hover {
          background: rgba(255,255,255,0.1) !important;
          border-color: rgba(233,69,96,0.4) !important;
          transform: translateY(-2px);
        }
        .ls-stat {
          transition: transform 0.2s;
        }
        .ls-stat:hover {
          transform: scale(1.05);
        }
        .ls-tab-btn {
          transition: transform 0.2s, box-shadow 0.2s, color 0.2s, background 0.2s;
          cursor: pointer;
        }
        .ls-tab-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 14px rgba(233,69,96,0.18);
          color: #e94560 !important;
        }
        .ls-tab-btn[data-active="true"]:hover {
          box-shadow: 0 6px 20px rgba(233,69,96,0.35);
        }
        .ls-condition-chip {
          transition: background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s;
        }
        .ls-condition-chip:hover {
          background: rgba(233,69,96,0.15) !important;
          border-color: rgba(233,69,96,0.5) !important;
          color: #e94560 !important;
          transform: translateY(-1px);
        }
        .ls-link {
          transition: opacity 0.15s, text-decoration 0.15s;
        }
        .ls-btn-secondary {
          transition: background 0.18s, transform 0.18s, box-shadow 0.18s;
        }
        .ls-btn-secondary:hover:not(:disabled) {
          background: #f3f4f6;
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .ls-eye-btn {
          transition: color 0.15s;
        }
        .ls-eye-btn:hover {
          color: #e94560 !important;
        }
        /* Select triggers on light panel */
        .ls-select {
          background: #ffffff !important;
          color: #1a1a2e !important;
          border: 1.5px solid #d1d5db !important;
        }
        .ls-select[data-state="open"] {
          border-color: #e94560 !important;
          box-shadow: 0 0 0 3px rgba(233,69,96,0.15) !important;
        }
        .ls-select [data-placeholder] {
          color: #9ca3af !important;
        }
        .ls-logo {
          transition: transform 0.2s;
        }
        .ls-logo:hover {
          transform: scale(1.06);
        }
      `}</style>

      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden flex-col justify-between p-12"
        style={{ background: "linear-gradient(160deg,#0f172a 0%,#1a1a2e 40%,#0f3460 100%)" }}>

        {/* Decorative orbs */}
        <div className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full opacity-[0.12]"
          style={{ background: "radial-gradient(circle,#e94560,transparent 70%)" }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-72 h-72 rounded-full opacity-[0.12]"
          style={{ background: "radial-gradient(circle,#6366f1,transparent 70%)" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.04]"
          style={{ background: "radial-gradient(circle,#10b981,transparent 70%)" }} />

        {/* Logo */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <img src="/nutridine-logoorg.png" alt="NutriDine Logo" className="ls-logo w-12 h-12 rounded-2xl object-cover" />
            <span className="text-white text-3xl font-bold tracking-tight">NutriDine</span>
          </div>
          {/* About-style badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ background: "rgba(233,69,96,0.15)", border: "1px solid rgba(233,69,96,0.35)", color: "#e94560" }}>
            <Leaf size={12} />
            <span>Your personal nutrition guide</span>
          </div>
        </div>

        {/* Hero copy */}
        <div className="space-y-6">
          <h1 className="text-5xl font-bold leading-[1.15] text-white">
            Eating well with a<br />
            health condition<br />
            <span style={{ color: "#e94560" }}>shouldn't be hard.</span>
          </h1>
          <p className="text-base leading-relaxed" style={{ color: "#94a3b8" }}>
            Managing diabetes, heart disease, IBS, or any of 41
            chronic conditions? NutriDine gives you a clear, personalised answer to
            the question everyone asks every day: <em style={{ color: "#cbd5e1" }}>"Can I actually eat this?"</em>
          </p>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map(f => (
              <div key={f.title} className="ls-feature-card px-4 py-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-white text-sm font-semibold">{f.title}</p>
                <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Animated stats — same style as About page */}
        <div ref={statsRef} className="grid grid-cols-4 gap-4 pt-6"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="ls-stat"><AnimStat value={41}   suffix=""  label="Health conditions" color="#e94560" start={statsInView} /></div>
          <div className="ls-stat"><AnimStat value={8715} suffix="" label="Ingredients"        color="#10b981" start={statsInView} /></div>
          <div className="ls-stat"><AnimStat value={3275} suffix="" label="Recipes"            color="#f59e0b" start={statsInView} /></div>
          <div className="ls-stat"><AnimStat value={12}   suffix=""  label="Medical authorities" color="#6366f1" start={statsInView} /></div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 overflow-y-auto bg-white">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <img src="/nutridine-logoorg.png" alt="NutriDine Logo" className="w-9 h-9 rounded-xl object-cover" />
            <span className="text-xl font-bold">NutriDine</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900">
              {tab==="login" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-gray-500 mt-1 text-sm">
              {tab==="login" ? "Sign in to your nutrition dashboard"
                : step===1 ? "Step 1 of 3 — Personal details"
                : step===2 ? "Step 2 of 3 — Health & goals"
                : "Step 3 of 3 — Food preferences"}
            </p>
          </div>

          {/* Tab */}
          <div className="flex rounded-xl p-1 mb-8" style={{ background: "#f3f4f6" }}>
            {(["login","signup"] as const).map(t => (
              <button key={t} onClick={() => switchTab(t)}
                data-active={tab===t ? "true" : "false"}
                className="ls-tab-btn flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: tab===t ? "white" : "transparent",
                  color: tab===t ? "#1a1a2e" : "#9ca3af",
                  boxShadow: tab===t ? "0 1px 3px rgba(0,0,0,0.1)" : "none"
                }}>
                {t==="login" ? "Sign In" : "Sign Up"}
              </button>
            ))}
          </div>

          {/* Global error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-5 rounded-xl text-sm"
              style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* ── OTP POPUP ── */}
          {showOTP && (
            <div className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
              <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                    style={{ background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }}>
                    <Mail className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Check your email</h3>
                  <p className="text-sm text-gray-500 mt-2">
                    We sent a 6-digit code to<br/>
                    <strong className="text-gray-800">{sEmail}</strong>
                  </p>
                </div>

                {/* OTP Input */}
                <div className="space-y-2 mb-4">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Enter verification code:
                  </Label>
                  <Input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    value={otpValue}
                    onChange={e => { setOtpValue(e.target.value.replace(/\D/g,"")); setOtpError("") }}
                    className="h-14 text-center text-3xl tracking-[0.5em] rounded-xl border-gray-200 font-mono"
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
                  {otpLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</> : <>Verify & Create Account</>}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button onClick={() => { setShowOTP(false); setOtpValue(""); setOtpError("") }}
                    className="text-gray-400 hover:text-gray-600">
                    ← Back
                  </button>
                  <button
                    onClick={sendOTP}
                    disabled={resendTimer > 0 || otpSending}
                    className="font-semibold disabled:opacity-40"
                    style={{ color: resendTimer>0 ? "#9ca3af" : "#e94560" }}>
                    {resendTimer>0 ? `Resend in ${resendTimer}s` : otpSending ? "Sending…" : "Resend OTP"}
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* ── LOGIN ── */}
          {tab==="login" && (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email address</Label>
                <Input type="email" placeholder="you@gmail.com"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); derr("loginEmail") }}
                  onBlur={() => { const m=validateEmail(loginEmail); if(m) err("loginEmail",m) }}
                  className={`ls-input h-12 rounded-xl ${fe.loginEmail?"border-red-400":"border-gray-200"}`} />
                <FieldError msg={fe.loginEmail} />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Password</Label>
                  <button
                    type="button"
                    onClick={openFP}
                    className="ls-link text-xs font-semibold"
                    style={{ color: "#e94560" }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input type={showPass?"text":"password"} placeholder="Your password"
                    value={loginPassword}
                    onChange={e => { setLoginPassword(e.target.value); derr("loginPass") }}
                    onBlur={() => { if(!loginPassword) err("loginPass","Password is required") }}
                    onKeyDown={e => e.key==="Enter" && handleLogin()}
                    className={`ls-input h-12 rounded-xl pr-12 ${fe.loginPass?"border-red-400":"border-gray-200"}`} />
                  <button onClick={() => setShowPass(!showPass)}
                    className="ls-eye-btn absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FieldError msg={fe.loginPass} />
              </div>

              <button onClick={handleLogin} disabled={loading}
                className="ls-btn-primary w-full h-12 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#e94560,#f5a623)"}}>
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : <>Sign In <ChevronRight className="w-4 h-4" /></>}
              </button>

              {/* Google — after Sign In, before sign-up link */}
              <div>
                <Divider />
                {gLoading
                  ? <div className="w-full h-12 rounded-xl flex items-center justify-center gap-2 text-sm text-gray-500 border border-gray-200">
                      <Loader2 className="w-4 h-4 animate-spin" /> Signing in with Google…
                    </div>
                  : <GoogleBtn text="Continue with Google" onSuccess={handleGoogleAuth} />
                }
              </div>

              <p className="text-center text-sm text-gray-500">
                Don't have an account?{" "}
                <button onClick={() => switchTab("signup")} className="ls-link font-semibold" style={{ color: "#e94560" }}>
                  Sign up free
                </button>
              </p>
            </div>
          )}

          {/* ── FORGOT PASSWORD MODAL ── */}
          {fpOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
              <div className="bg-white rounded-2xl p-8 w-full max-w-sm mx-4 shadow-2xl relative">

                {/* Close */}
                <button onClick={closeFP}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>

                {/* Step indicator */}
                <div className="flex gap-2 mb-6">
                  {[1,2,3].map(s => (
                    <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-300"
                      style={{ background: s <= fpStep ? "linear-gradient(90deg,#e94560,#f5a623)" : "#e5e7eb" }} />
                  ))}
                </div>

                {/* Step 1 — Email */}
                {fpStep === 1 && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
                        style={{ background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }}>
                        <Mail className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Forgot password?</h3>
                      <p className="text-sm text-gray-500 mt-1">Enter your registered email and we'll send you a reset code.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email address</Label>
                      <Input type="email" placeholder="you@gmail.com"
                        value={fpEmail}
                        onChange={e => { setFpEmail(e.target.value); setFpError("") }}
                        onKeyDown={e => e.key === "Enter" && fpSendOtp()}
                        className="h-12 rounded-xl border-gray-200" />
                    </div>
                    {fpError && <p className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />{fpError}</p>}
                    <button onClick={fpSendOtp} disabled={fpLoading}
                      className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                      {fpLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : <>Send Reset Code <ChevronRight className="w-4 h-4" /></>}
                    </button>
                    <button onClick={closeFP} className="w-full text-sm text-gray-400 hover:text-gray-600 text-center">← Back to Sign In</button>
                  </div>
                )}

                {/* Step 2 — OTP */}
                {fpStep === 2 && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
                        style={{ background: "linear-gradient(135deg,#1a1a2e,#0f3460)" }}>
                        <Mail className="w-7 h-7 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Check your email</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        We sent a 6-digit code to<br />
                        <strong className="text-gray-800">{fpEmail}</strong>
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Enter reset code</Label>
                      <Input type="text" maxLength={6} placeholder="000000"
                        value={fpOtp}
                        onChange={e => { setFpOtp(e.target.value.replace(/\D/g,"")); setFpError("") }}
                        onKeyDown={e => e.key === "Enter" && fpVerifyOtp()}
                        className="h-14 text-center text-3xl tracking-[0.5em] rounded-xl border-gray-200 font-mono"
                        style={{ letterSpacing: "0.5em" }} />
                    </div>
                    {fpError && <p className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />{fpError}</p>}
                    <button onClick={fpVerifyOtp} disabled={fpLoading || fpOtp.length !== 6}
                      className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                      {fpLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</> : <>Verify Code <ChevronRight className="w-4 h-4" /></>}
                    </button>
                    <div className="flex justify-between text-sm">
                      <button onClick={() => { setFpStep(1); setFpOtp(""); setFpError("") }} className="text-gray-400 hover:text-gray-600">← Back</button>
                      <button onClick={fpSendOtp} disabled={fpTimer > 0 || fpLoading}
                        className="font-semibold disabled:opacity-40"
                        style={{ color: fpTimer > 0 ? "#9ca3af" : "#e94560" }}>
                        {fpTimer > 0 ? `Resend in ${fpTimer}s` : "Resend code"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3 — New password */}
                {fpStep === 3 && (
                  <div className="space-y-5">
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3"
                        style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                        🔑
                      </div>
                      <h3 className="text-xl font-bold text-gray-900">Set new password</h3>
                      <p className="text-sm text-gray-500 mt-1">Choose a strong new password for your account.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">New password</Label>
                      <div className="relative">
                        <Input type={fpShowPass?"text":"password"} placeholder="Min 8 chars, uppercase, number, special"
                          value={fpPass}
                          onChange={e => { setFpPass(e.target.value); setFpError("") }}
                          className="h-12 rounded-xl border-gray-200 pr-12" />
                        <button onClick={() => setFpShowPass(!fpShowPass)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                          {fpShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {fpPass && (() => { const s = getStrength(fpPass); return (
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-400">Strength</span>
                            <span style={{ color: s.color }} className="font-semibold">{s.label}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: s.width, background: s.color }} />
                          </div>
                        </div>
                      )})()}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Confirm password</Label>
                      <Input type={fpShowPass?"text":"password"} placeholder="Re-enter new password"
                        value={fpConfirm}
                        onChange={e => { setFpConfirm(e.target.value); setFpError("") }}
                        onKeyDown={e => e.key === "Enter" && fpResetPassword()}
                        className={`h-12 rounded-xl border-gray-200 ${fpConfirm && fpPass !== fpConfirm ? "border-red-400" : ""}`} />
                      {fpConfirm && fpPass !== fpConfirm && (
                        <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3" />Passwords don't match</p>
                      )}
                    </div>
                    {fpError && <p className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3 h-3" />{fpError}</p>}
                    <button onClick={fpResetPassword} disabled={fpLoading || !fpPass || !fpConfirm}
                      className="w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                      {fpLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Resetting…</> : <><CheckCircle2 className="w-4 h-4" />Reset Password</>}
                    </button>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ── SIGNUP ── */}
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
                        className={`ls-input h-11 rounded-xl ${fe.name?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.name} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Age</Label>
                      <Input type="number" placeholder="21" value={sAge}
                        onChange={e => { setSAge(e.target.value); derr("age") }}
                        onBlur={() => { const a=parseInt(sAge); if(!sAge||a<10||a>100) err("age","Valid age: 10-100") }}
                        className={`ls-input h-11 rounded-xl ${fe.age?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.age} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Email</Label>
                    <Input type="email" placeholder="you@gmail.com" value={sEmail}
                      onChange={e => { setSEmail(e.target.value); derr("email") }}
                      onBlur={() => { const m=validateEmail(sEmail); if(m) err("email",m) }}
                      className={`ls-input h-11 rounded-xl ${fe.email?"border-red-400":"border-gray-200"}`} />
                    <FieldError msg={fe.email} />
                    {sEmail && !fe.email && validateEmail(sEmail)==="" && (
                      <p className="flex items-center gap-1 text-xs mt-1 text-green-600">
                        <CheckCircle2 className="w-3 h-3" /> Valid email format
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Height (cm)</Label>
                      <Input type="number" placeholder="175" value={sHeight}
                        onChange={e => { setSHeight(e.target.value); derr("height") }}
                        onBlur={() => { const h=parseFloat(sHeight); if(!sHeight||h<100||h>250) err("height","100-250 cm") }}
                        className={`ls-input h-11 rounded-xl ${fe.height?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.height} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Weight (kg)</Label>
                      <Input type="number" placeholder="70" value={sWeight}
                        onChange={e => { setSWeight(e.target.value); derr("weight") }}
                        onBlur={() => { const w=parseFloat(sWeight); if(!sWeight||w<20||w>300) err("weight","20-300 kg") }}
                        className={`ls-input h-11 rounded-xl ${fe.weight?"border-red-400":"border-gray-200"}`} />
                      <FieldError msg={fe.weight} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Gender</Label>
                    <Select value={sGender} onValueChange={v => { setSGender(v); derr("gender") }}>
                      <SelectTrigger className={`ls-select h-11 rounded-xl ${fe.gender?"border-red-400":"border-gray-200"}`}>
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
                        className={`ls-input h-11 rounded-xl pr-12 ${fe.pass?"border-red-400":"border-gray-200"}`} />
                      <button onClick={() => setShowPass(!showPass)}
                        className="ls-eye-btn absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {sPass && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">Strength</span>
                          <span style={{ color: signupStrength.color }} className="font-semibold">{signupStrength.label}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-300"
                            style={{ width: signupStrength.width, background: signupStrength.color }} />
                        </div>
                        <div className="grid grid-cols-2 gap-1 mt-2">
                          {[
                            ["8+ characters",        sPass.length>=8],
                            ["Uppercase letter",      /[A-Z]/.test(sPass)],
                            ["Number (0-9)",          /[0-9]/.test(sPass)],
                            ["Special char (!@#$%)", /[^A-Za-z0-9]/.test(sPass)],
                          ].map(([label, passed]) => (
                            <div key={label as string} className="flex items-center gap-1 text-xs"
                              style={{ color: passed ? "#16a34a" : "#9ca3af" }}>
                              {passed
                                ? <CheckCircle2 className="w-3 h-3" />
                                : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                              {label as string}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <FieldError msg={fe.pass} />
                  </div>

                  <button onClick={() => { if(validateStep1()) { setError(""); setStep(2) } }}
                    className="ls-btn-primary w-full h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Step 2 */}
              {step===2 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Health Conditions</Label>
                    <p className="text-xs text-gray-400">Select all that apply to you</p>
                    <div className="flex flex-wrap gap-2">
                      {CONDITIONS.map(c => (
                        <button key={c}
                          onClick={() => setConditions(prev => prev.includes(c) ? prev.filter(x=>x!==c) : [...prev,c])}
                          className="ls-condition-chip px-3 py-1.5 rounded-full text-xs font-medium border"
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
                      <SelectTrigger className="ls-select h-11 rounded-xl border-gray-200"><SelectValue placeholder="What's your goal?" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weight-loss"> Weight Loss</SelectItem>
                        <SelectItem value="muscle-gain"> Muscle Gain</SelectItem>
                        <SelectItem value="maintenance"> Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Food Preference</Label>
                    <Select value={sPref} onValueChange={setSPref}>
                      <SelectTrigger className="ls-select h-11 rounded-xl border-gray-200"><SelectValue placeholder="Dietary preference" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="veg">Vegetarian</SelectItem>
                        <SelectItem value="non-veg">Non-Vegetarian</SelectItem>
                        <SelectItem value="vegan">Vegan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)}
                      className="ls-btn-secondary flex-1 h-12 rounded-xl font-semibold text-sm border border-gray-200 flex items-center justify-center gap-2 text-gray-600">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button onClick={() => {
                      if (!sGoal) { setError("Please select a fitness goal"); return }
                      if (!sPref) { setError("Please select a food preference"); return }
                      setError(""); setStep(3)
                    }}
                      className="ls-btn-primary flex-1 h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2"
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
                        onKeyDown={e => { if(e.key==="Enter"&&likeIn.trim()) { if(!likes.includes(likeIn.trim())) setLikes([...likes,likeIn.trim()]); setLikeIn("") }}}
                        className="ls-input h-10 rounded-xl border-gray-200 flex-1" />
                      <button onClick={() => { if(likeIn.trim()&&!likes.includes(likeIn.trim())) setLikes([...likes,likeIn.trim()]); setLikeIn("") }}
                        className="ls-btn-primary px-4 h-10 rounded-xl text-white text-sm font-medium" style={{ background: "#e94560" }}>Add</button>
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
                        onKeyDown={e => { if(e.key==="Enter"&&disIn.trim()) { if(!dislikes.includes(disIn.trim())) setDislikes([...dislikes,disIn.trim()]); setDisIn("") }}}
                        className="ls-input h-10 rounded-xl border-gray-200 flex-1" />
                      <button onClick={() => { if(disIn.trim()&&!dislikes.includes(disIn.trim())) setDislikes([...dislikes,disIn.trim()]); setDisIn("") }}
                        className="ls-btn-secondary px-4 h-10 rounded-xl text-white text-sm font-medium" style={{ background: "#6b7280" }}>Add</button>
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

                  {/* Summary */}
                  <div className="p-4 rounded-xl" style={{ background: "rgba(233,69,96,0.06)", border: "1px solid rgba(233,69,96,0.2)" }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: "#1a1a2e" }}>📋 Your profile summary</p>
                    <div className="grid grid-cols-2 gap-1 text-xs" style={{ color: "#374151" }}>
                      <span> {sName}</span>
                      <span> {sWeight}kg · {sHeight}cm</span>
                      <span> {sGoal || "Not set"}</span>
                      <span> {sPref || "Not set"}</span>
                      {conditions.length>0 && <span className="col-span-2">❤️ {conditions.join(", ")}</span>}
                    </div>
                  </div>

                  {/* Email verification notice */}
                  <div className="flex items-start gap-2 p-3 rounded-xl text-xs"
                    style={{ background: "#dbeafe", border: "1px solid #93c5fd", color: "#1e40af" }}>
                    <Mail className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#1e40af" }} />
                    <span>We'll send a 6-digit verification code to <strong style={{ color: "#1e3a8a" }}>{sEmail}</strong> to confirm your email.</span>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)}
                      className="ls-btn-secondary flex-1 h-12 rounded-xl font-semibold text-sm border border-gray-200 flex items-center justify-center gap-2 text-gray-600">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button onClick={async () => { setError(""); await sendOTP() }}
                      disabled={otpSending || loading}
                      className="ls-btn-primary flex-1 h-12 rounded-xl text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#e94560,#f5a623)" }}>
                      {otpSending
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Sending OTP…</>
                        : <>Verify Email </>}
                    </button>
                  </div>
                </div>
              )}

              {step===1 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  Already have an account?{" "}
                  <button onClick={() => switchTab("login")} className="ls-link font-semibold" style={{ color: "#e94560" }}>Sign in</button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
