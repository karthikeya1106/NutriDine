"use client"

import { useEffect, useState, useRef } from "react"
import {
  Search, Heart, ChevronRight, ExternalLink,
  CheckCircle2, XCircle, AlertCircle, Sparkles, Info,
  Brain, Activity
} from "lucide-react"

const BACKEND = "" // Routed via Next.js proxy rewrites → 127.0.0.1:8000


/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
interface ConditionSummary {
  slug: string
  name: string
  category: string
  prevalence: string
  overview: string
  ml_supported: boolean
  authority: string
}

interface ConditionDetail extends ConditionSummary {
  icd10: string
  why_diet_matters: string
  foods: { eat_freely: string[]; limit: string[]; avoid: string[] }
  key_nutrients: { focus_on: string[]; limit: string[] }
  meal_tips: string[]
  lifestyle_tips: string[]
  authority_url: string
  related: string[]
}

/* ─────────────────────────────────────────────────────────────
   Category colour map
───────────────────────────────────────────────────────────── */
const CAT_COLORS: Record<string, string> = {
  "Metabolic":     "#6366f1",
  "Cardiovascular":"#ef4444",
  "Digestive":     "#f59e0b",
  "Kidney":        "#06b6d4",
  "Hormonal":      "#ec4899",
  "Bone & Joint":  "#8b5cf6",
  "Blood":         "#dc2626",
  "Neurological":  "#0ea5e9",
  "Mental Health": "#10b981",
  "Respiratory":   "#64748b",
  "Skin":          "#f97316",
  "Women's Health":"#a855f7",
}
const catColor = (cat: string) => CAT_COLORS[cat] || "#6b7280"

/* ─────────────────────────────────────────────────────────────
   Condition card
───────────────────────────────────────────────────────────── */
function ConditionCard({ c, onClick }: { c: ConditionSummary; onClick: () => void }) {
  const color = catColor(c.category)
  return (
    <button className="cond-card" onClick={onClick} style={{ "--cat": color } as any}>
      <div className="cond-card-top">
        <span className="cond-cat-pill" style={{ background: `${color}18`, color }}>
          {c.category}
        </span>
        {c.ml_supported && (
          <span className="cond-ml-badge" title="AI-powered meal safety for this condition">
            <Brain size={10} /> AI Safety
          </span>
        )}
      </div>
      <h3 className="cond-card-name">{c.name}</h3>
      <p className="cond-card-prev">{c.prevalence}</p>
      <p className="cond-card-overview">{c.overview}</p>
      <div className="cond-card-footer">
        <span className="cond-card-auth">{c.authority.split(" / ")[0]}</span>
        <ChevronRight size={15} className="cond-card-arrow" />
      </div>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
   Detail drawer
───────────────────────────────────────────────────────────── */
function DetailDrawer({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [data, setData] = useState<ConditionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    const controller = new AbortController()
    fetch(`${BACKEND}/api/conditions/${slug}`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(err => {
        if (err.name !== "AbortError") setLoading(false)
      })
    return () => controller.abort()
  }, [slug])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="cond-drawer-overlay">
      <div className="cond-drawer" ref={ref}>
        {loading ? (
          <div className="cond-drawer-loading">
            <div className="cond-spinner" />
            <span>Loading condition details…</span>
          </div>
        ) : data ? (
          <>
            {/* Header */}
            <div className="cond-drawer-header" style={{ "--cat": catColor(data.category) } as any}>
              <div>
                <span className="cond-cat-pill" style={{ background: `${catColor(data.category)}20`, color: catColor(data.category) }}>
                  {data.category}
                </span>
                {data.icd10 && <span className="cond-icd">ICD-10: {data.icd10}</span>}
              </div>
              <h2 className="cond-drawer-title">{data.name}</h2>
              <p className="cond-drawer-prev">{data.prevalence}</p>
            </div>

            <div className="cond-drawer-body">
              {/* Overview */}
              <p className="cond-drawer-overview">{data.overview.replace("...", "")}</p>

              {/* Why diet matters */}
              <div className="cond-section">
                <div className="cond-section-label">
                  <Activity size={15} /> Why diet matters
                </div>
                <p className="cond-why">{data.why_diet_matters}</p>
              </div>

              {/* Food traffic light */}
              <div className="cond-section">
                <div className="cond-section-label">
                  <Heart size={15} /> Food guide
                </div>
                <div className="cond-foods-grid">
                  <div className="cond-food-col cond-food-free">
                    <div className="cond-food-col-header">
                      <CheckCircle2 size={14} /> Eat freely
                    </div>
                    <ul>
                      {(data.foods?.eat_freely ?? []).map(f => <li key={f}>{f}</li>)}
                    </ul>
                  </div>
                  <div className="cond-food-col cond-food-limit">
                    <div className="cond-food-col-header">
                      <AlertCircle size={14} /> Limit
                    </div>
                    <ul>
                      {(data.foods?.limit ?? []).map(f => <li key={f}>{f}</li>)}
                    </ul>
                  </div>
                  <div className="cond-food-col cond-food-avoid">
                    <div className="cond-food-col-header">
                      <XCircle size={14} /> Avoid
                    </div>
                    <ul>
                      {(data.foods?.avoid ?? []).map(f => <li key={f}>{f}</li>)}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Key nutrients */}
              <div className="cond-section">
                <div className="cond-section-label">
                  <Sparkles size={15} /> Key nutrients
                </div>
                <div className="cond-nutrients-grid">
                  <div>
                    <div className="cond-nut-sub cond-nut-focus">Focus on</div>
                    {(data.key_nutrients?.focus_on ?? []).map(n => (
                      <div key={n} className="cond-nut-item cond-nut-item-focus">{n}</div>
                    ))}
                  </div>
                  <div>
                    <div className="cond-nut-sub cond-nut-limit">Limit</div>
                    {(data.key_nutrients?.limit ?? []).map(n => (
                      <div key={n} className="cond-nut-item cond-nut-item-limit">{n}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Meal tips */}
              <div className="cond-section">
                <div className="cond-section-label">
                  <CheckCircle2 size={15} /> Meal tips
                </div>
                <ul className="cond-tips-list">
                  {(data.meal_tips ?? []).map(t => <li key={t}>{t}</li>)}
                </ul>
              </div>

              {/* Lifestyle tips */}
              <div className="cond-section">
                <div className="cond-section-label">
                  <Activity size={15} /> Lifestyle tips
                </div>
                <ul className="cond-tips-list cond-lifestyle-tips">
                  {(data.lifestyle_tips ?? []).map(t => <li key={t}>{t}</li>)}
                </ul>
              </div>

              {/* Related */}
              {data.related?.length > 0 && (
                <div className="cond-section">
                  <div className="cond-section-label">Related conditions</div>
                  <div className="cond-related">
                    {data.related.map(r => (
                      <span key={r} className="cond-related-pill">{r}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Authority */}
              <div className="cond-authority-block">
                <Info size={14} />
                <span>Guidelines from: <strong>{data.authority}</strong></span>
                {data.authority_url && (
                  <a href={data.authority_url} target="_blank" rel="noopener noreferrer" className="cond-authority-link">
                    Visit source <ExternalLink size={12} />
                  </a>
                )}
              </div>

              {/* ML badge */}
              {data.ml_supported && (
                <div className="cond-ml-notice">
                  <Brain size={14} />
                  NutriDine's AI engine provides real-time meal safety checks for this condition in your Recipes and Meal Plan.
                </div>
              )}
            </div>

            <button className="cond-drawer-close" onClick={onClose}>Close</button>
          </>
        ) : (
          <div className="cond-drawer-loading">Could not load condition details.</div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────── */
export default function ConditionsPage() {
  const [all, setAll] = useState<ConditionSummary[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState("All")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${BACKEND}/api/conditions`)
      .then(r => r.json())
      .then(d => {
        setAll(d.conditions || [])
        setCategories(["All", ...(d.categories || [])])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = all.filter(c => {
    const matchCat = activeCategory === "All" || c.category === activeCategory
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.overview.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="cond-page">
      {/* Header */}
      <div className="cond-page-header">
        <div>
          <h1 className="cond-page-title">Health Conditions Guide</h1>
          <p className="cond-page-sub">
            Dietary guidance for {all.length}+ health conditions — based on published medical authority guidelines.
          </p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="cond-toolbar">
        <div className="cond-search-box">
          <Search size={16} className="cond-search-icon" />
          <input
            className="cond-search-input"
            placeholder="Search conditions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="cond-cat-tabs">
          {categories.map(cat => (
            <button
              key={cat}
              className={`cond-cat-tab ${activeCategory === cat ? "active" : ""}`}
              style={activeCategory === cat && cat !== "All" ? { background: `${catColor(cat)}15`, borderColor: catColor(cat), color: catColor(cat) } : {}}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="cond-results-count">
        {loading ? "Loading conditions…" : `${filtered.length} condition${filtered.length !== 1 ? "s" : ""}`}
        {activeCategory !== "All" && ` in ${activeCategory}`}
        {search && ` matching "${search}"`}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="cond-loading-grid">
          {[...Array(8)].map((_, i) => <div key={i} className="cond-skeleton" />)}
        </div>
      ) : (
        <div className="cond-grid">
          {filtered.map(c => (
            <ConditionCard key={c.slug} c={c} onClick={() => setSelected(c.slug)} />
          ))}
        </div>
      )}

      {filtered.length === 0 && !loading && (
        <div className="cond-empty">
          <Heart size={40} className="cond-empty-icon" />
          <p>No conditions found{search ? ` for "${search}"` : ""}.</p>
          <button onClick={() => { setSearch(""); setActiveCategory("All") }}>Clear filters</button>
        </div>
      )}

      {/* Disclaimer */}
      <div className="cond-disclaimer">
        <Info size={14} />
        <p>This guide is for educational purposes only. Always consult your doctor or a registered dietitian before making dietary changes based on a medical condition.</p>
      </div>

      {/* Detail drawer */}
      {selected && <DetailDrawer slug={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
