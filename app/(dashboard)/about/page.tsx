"use client"

import { useEffect, useRef, useState } from "react"
import {
  Heart, Leaf, ShieldCheck, CalendarCheck,
  BookOpen, CheckCircle2, Info, ChevronDown,
  Star, Utensils, Zap, Lock, Search
} from "lucide-react"

/* ─────────────────────────────────────────────────────────────
   Animated counter
───────────────────────────────────────────────────────────── */
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

function useInView(threshold = 0.2) {
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

/* ─────────────────────────────────────────────────────────────
   Stat Card
───────────────────────────────────────────────────────────── */
function StatCard({ value, suffix = "", label, sub, icon: Icon, color, start }:
  { value: number; suffix?: string; label: string; sub: string; icon: any; color: string; start: boolean }) {
  const count = useCounter(value, 2000, start)
  return (
    <div className="about-stat-card" style={{ "--accent": color } as any}>
      <div className="about-stat-icon">
        <Icon size={20} />
      </div>
      <div className="about-stat-number">{count.toLocaleString()}{suffix}</div>
      <div className="about-stat-label">{label}</div>
      <div className="about-stat-sub">{sub}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   FAQ
───────────────────────────────────────────────────────────── */
const FAQS = [
  {
    q: "Is NutriDine a replacement for my doctor or dietitian?",
    a: "No — and we're upfront about that. NutriDine is a smart companion that helps you make better daily food choices within the guidelines your doctor has already given you. For medical decisions, always consult a qualified healthcare professional."
  },
  {
    q: "How does NutriDine know which foods are safe for my conditions?",
    a: "Every food safety recommendation is built on published guidelines from leading medical organisations like the American Diabetes Association, the Heart Foundation, and the National Kidney Foundation — among others. When you select a condition, NutriDine checks every meal against those official standards."
  },
  {
    q: "What if I have more than one health condition?",
    a: "That's exactly where NutriDine shines. You can select multiple conditions and NutriDine will find meals that work for all of them at once — no more manual cross-referencing of different diet sheets."
  },
  {
    q: "Is my health data kept private?",
    a: "Yes. Your health profile and meal history are stored only on your device and our secure servers. We never share personal health information with third parties or advertisers."
  },
  {
    q: "Can I use NutriDine if I don't have a diagnosed condition?",
    a: "Absolutely. NutriDine works just as well for general healthy eating, weight management, or specific dietary preferences like vegetarian or Indian cuisine — no diagnosis needed."
  },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`about-faq-item ${open ? "open" : ""}`} onClick={() => setOpen(o => !o)}>
      <div className="about-faq-q">
        <span>{q}</span>
        <ChevronDown className={`about-faq-chevron ${open ? "rotated" : ""}`} size={18} />
      </div>
      {open && <div className="about-faq-a">{a}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Benefits
───────────────────────────────────────────────────────────── */
const BENEFITS = [
  {
    icon: ShieldCheck,
    color: "#6366f1",
    title: "No more guessing",
    desc: "Every recipe comes with a clear safety signal for your conditions. Green means go. If something might not suit you, we tell you why — in plain English."
  },
  {
    icon: CalendarCheck,
    color: "#10b981",
    title: "Weekly meals in seconds",
    desc: "One click generates a full week of balanced meals tailored to your health profile, cuisine preference, and dietary style."
  },
  {
    icon: Search,
    color: "#f59e0b",
    title: "Explore 8,700+ ingredients",
    desc: "Curious about a specific food? Look it up instantly and see exactly how it fits — or doesn't fit — your health conditions."
  },
  {
    icon: Zap,
    color: "#ec4899",
    title: "Swap any ingredient",
    desc: "Need to substitute something? Our smart swap engine suggests alternatives that maintain safety, taste, and nutrition balance."
  },
  {
    icon: Utensils,
    color: "#8b5cf6",
    title: "Cuisine you actually enjoy",
    desc: "From Indian to Mediterranean to North American — NutriDine adapts to the food culture you love, not the bland diet food you dread."
  },
  {
    icon: Lock,
    color: "#06b6d4",
    title: "Your data stays yours",
    desc: "We store only what we need to personalise your experience. No selling, no profiling, no ads. Your health information is private."
  },
]

/* ─────────────────────────────────────────────────────────────
   Conditions
───────────────────────────────────────────────────────────── */
const CONDITIONS = [
  "Type 2 Diabetes", "Type 1 Diabetes", "Prediabetes",
  "Hypertension", "Heart Disease", "Obesity", "High Cholesterol",
  "Celiac Disease", "Lactose Intolerance", "Chronic Kidney Disease", "Kidney Stones",
  "PCOS", "Thyroid Disorder", "Hypothyroidism", "Hyperthyroidism",
  "Anemia", "Gout", "IBS", "Liver Disease", "NAFLD",
  "GERD", "Osteoporosis", "Rheumatoid Arthritis", "Osteoarthritis",
  "Crohn's Disease", "Ulcerative Colitis",
  "Chronic Pancreatitis", "Migraine", "Endometriosis",
  "Metabolic Syndrome", "Diverticulitis", "Stroke", "Gallbladder Disease",
]

/* ─────────────────────────────────────────────────────────────
   Trust badges
───────────────────────────────────────────────────────────── */
const AUTHORITIES = [
  "American Diabetes Association",
  "American Heart Association",
  "National Kidney Foundation",
  "National Osteoporosis Foundation",
  "Celiac Disease Foundation",
  "American College of Gastroenterology",
  "Arthritis Foundation",
  "American Migraine Foundation",
  "Crohn's & Colitis Foundation",
  "Endocrine Society",
  "World Health Organisation",
  "American College of Rheumatology",
]

/* ─────────────────────────────────────────────────────────────
   How it works (user language)
───────────────────────────────────────────────────────────── */
const HOW_STEPS = [
  { num: "1", title: "Tell us about yourself", desc: "Select your health conditions, preferred cuisine, and dietary style. Takes about 60 seconds." },
  { num: "2", title: "NutriDine does the work",  desc: "We check every meal and ingredient against official medical diet guidelines for your conditions." },
  { num: "3", title: "Get your safe meal plan", desc: "Receive a personalised weekly plan with only meals that fit your health needs — fully explained." },
  { num: "4", title: "Adjust as you like",      desc: "Swap ingredients, explore recipes, and refine your plan anytime. NutriDine adapts with you." },
]

/* ─────────────────────────────────────────────────────────────
   Page
───────────────────────────────────────────────────────────── */
export default function AboutPage() {
  const { ref: statsRef, inView: statsInView } = useInView()

  return (
    <div className="about-page">

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="about-hero">
        <div className="about-hero-bg" />
        <div className="about-hero-content">
          <div className="about-hero-badge">
            <Leaf size={13} />
            <span>Your personal nutrition guide</span>
          </div>
          <h1 className="about-hero-title">
            Eating well with a health<br />
            condition <span className="about-hero-gradient">shouldn't be this hard</span>
          </h1>
          <p className="about-hero-sub">
            Managing diabetes, heart disease, IBS, or any of 41 chronic conditions means navigating
            endless conflicting food advice. NutriDine cuts through the noise — giving you a clear,
            personalised answer to the question everyone with a health condition asks every day:
            <em> "Can I actually eat this?"</em>
          </p>
        </div>
      </section>

      {/* ── The problem (story-driven) ──────────────────────── */}
      <section className="about-story-section">
        <div className="about-story-card">
          <div className="about-story-quote">"</div>
          <p className="about-story-text">
            When you live with a chronic condition, every meal becomes a question. Is this too much
            sodium for my blood pressure? Will this spike my blood sugar? Can I eat this with my
            kidney disease? Most apps give you generic meal plans and leave you to figure out the rest.
            NutriDine was built differently — to give you a real, condition-specific answer, backed by
            the same medical guidelines your doctor follows.
          </p>
          <div className="about-story-sig">
            <Leaf size={14} className="about-story-leaf" />
            <span>The NutriDine mission</span>
          </div>
        </div>
      </section>

      {/* ── Benefits ───────────────────────────────────────── */}
      <section className="about-benefits-section">
        <div className="about-section-label">What you get</div>
        <h2 className="about-section-title">Built around your needs</h2>
        <div className="about-benefits-grid">
          {BENEFITS.map(b => (
            <div key={b.title} className="about-benefit-card">
              <div className="about-benefit-icon" style={{ background: `${b.color}18`, color: b.color }}>
                <b.icon size={22} />
              </div>
              <h3 className="about-benefit-title">{b.title}</h3>
              <p className="about-benefit-desc">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works  ──────────────────────────────────── */}
      <section className="about-how-section">
        <div className="about-section-label">The process</div>
        <h2 className="about-section-title">Getting started takes minutes</h2>
        <div className="about-how-grid-simple">
          {HOW_STEPS.map((s) => (
            <div key={s.num} className="about-how-simple-card">
              <div className="about-how-simple-num">{s.num}</div>
              <h3 className="about-how-simple-title">{s.title}</h3>
              <p className="about-how-simple-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────────────── */}
      <section className="about-stats-section" ref={statsRef}>
        <div className="about-section-label">Coverage</div>
        <h2 className="about-section-title">Numbers that matter to you</h2>
        <div className="about-stats-grid">
          <StatCard value={41}   label="Health conditions covered" sub="from Diabetes to Migraine"  icon={Heart}         color="#6366f1" start={statsInView} />
          <StatCard value={8715} label="Foods & ingredients"       sub="analysed for your safety"    icon={Search}        color="#10b981" start={statsInView} />
          <StatCard value={3275} label="Curated recipes"           sub="across all cuisines & diets" icon={Utensils}      color="#f59e0b" start={statsInView} />
          <StatCard value={12}   label="Medical authorities"       sub="whose guidelines we follow"  icon={BookOpen}      color="#06b6d4" start={statsInView} />
        </div>
      </section>

      {/* ── Conditions covered ─────────────────────────────── */}
      <section className="about-conditions-section">
        <div className="about-section-label">Conditions we support</div>
        <h2 className="about-section-title">Is your condition on this list?</h2>
        <p className="about-section-sub">
          You can select one or several conditions. NutriDine finds meals that work for <strong>all of them at once</strong>.
        </p>
        <div className="about-conditions-grid">
          {CONDITIONS.map((c, i) => (
            <div key={c} className="about-condition-badge" style={{ animationDelay: `${i * 0.04}s` }}>
              <CheckCircle2 size={12} />
              <span>{c}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Trust / authorities ────────────────────────────── */}
      <section className="about-trust-section">
        <div className="about-section-label">Evidence-based</div>
        <h2 className="about-section-title">Recommendations you can trust</h2>
        <p className="about-section-sub">
          Every safety rule in NutriDine is built on published diet guidelines from recognised
          medical organisations — the same sources your healthcare team uses.
        </p>
        <div className="about-authorities-grid">
          {AUTHORITIES.map(a => (
            <div key={a} className="about-authority-badge">
              <Star size={11} className="about-authority-star" />
              <span>{a}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section className="about-faq-section">
        <div className="about-section-label">Common questions</div>
        <h2 className="about-section-title">Frequently asked</h2>
        <div className="about-faq-list">
          {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── Disclaimer ─────────────────────────────────────── */}
      <section className="about-disclaimer">
        <Info size={16} />
        <p>
          NutriDine is not a medical device and does not provide medical advice. Content is for
          informational purposes only and is not a substitute for professional medical guidance.
          Always consult your doctor or a registered dietitian before making significant changes
          to your diet, particularly if you have an active health condition.
        </p>
      </section>

    </div>
  )
}
