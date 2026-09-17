"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw, Flame, Utensils, Coffee, Sun,
  Cookie, Moon, ChevronDown, ChevronUp,
  Sparkles, ShieldCheck, ShieldX, AlertCircle,
  ShoppingCart, ExternalLink, Calendar,
  TrendingUp, Award, Download, CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { apiGenerateMealPlan, apiSaveMealPlan, apiGetMealPlanHistory, apiLoadSavedMealPlan, apiAddFoodLog, apiGetFoodLog } from "@/lib/api"
import { useUser } from "@/contexts/user-context"

// ── Types ─────────────────────────────────────────────────────────────────────
interface BackendRecipe {
  id: string
  name: string
  description: string
  cuisine: string
  meal_type: string
  prep_time: number
  cook_time: number
  difficulty: string
  dietary_tags: string[]
  ingredients: { name: string; amount: number; unit: string }[]
  steps: string[]
  nutrition_per_serving: {
    calories: number; protein: number; carbs: number
    fat: number; fiber: number; sodium: number
  }
  is_compliant: boolean
  condition_notes: { condition: string; safe: boolean; reason: string }[]
}

interface DayPlan {
  day: string
  week: number
  day_index: number
  breakfast: BackendRecipe | null
  lunch: BackendRecipe | null
  dinner: BackendRecipe | null
  snack: BackendRecipe | null
  total_calories: number
}

interface WeekPlan {
  week: number
  label: string
  days: DayPlan[]
  avg_daily_calories: number
}

interface PlanSummary {
  avg_daily_calories: number
  avg_daily_protein: number
  total_meals: number
  compliant_days: number
  total_days: number
}

interface PoolStats {
  safe_breakfasts: number
  safe_lunches: number
  safe_dinners: number
  safe_snacks: number
  bottleneck_meal: string
  bottleneck_count: number
  max_unique_weeks: number
  generated_weeks: number
}

const MEAL_ICONS = {
  breakfast: Coffee,
  lunch: Sun,
  snack: Cookie,
  dinner: Moon,
}

const MEAL_LABELS = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snack",
  dinner: "Dinner",
}

const MEAL_COLORS = {
  breakfast: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  lunch:     "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  snack:     "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  dinner:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
}



// ── Main Page ─────────────────────────────────────────────────────────────────
const TIMELINE_OPTIONS = [
  { label: "4 wks",  value: 4 },
  { label: "8 wks",  value: 8 },
  { label: "10 wks", value: 10 },
  { label: "12 wks", value: 12 },
  { label: "Auto",   value: 0 },  // 0 = let backend auto-calculate
]

export default function MealPlanPage() {
  const { user } = useUser()
  const [weeks, setWeeks]                   = useState<WeekPlan[]>([])
  const [summary, setSummary]               = useState<PlanSummary | null>(null)
  const [poolStats, setPoolStats]           = useState<PoolStats | null>(null)
  const [activeWeek, setActiveWeek]         = useState(1)
  const [expandedDay, setExpandedDay]       = useState<string | null>(null)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState("")
  const [autoSaving, setAutoSaving]         = useState(false)
  const [lastSavedAt, setLastSavedAt]       = useState<string | null>(null)
  const [isPrinting, setIsPrinting]         = useState(false)
  const [selectedWeeks, setSelectedWeeks]   = useState<number>(0)  // 0 = show all
  const afterPrintRef = useRef<(() => void) | null>(null)

  // Derived: slice the loaded plan to the selected timeline instantly (no backend call)
  const displayedWeeks = selectedWeeks > 0 ? weeks.slice(0, selectedWeeks) : weeks

  // Reset active week if it's now beyond the trimmed range
  useEffect(() => {
    if (displayedWeeks.length > 0 && !displayedWeeks.find(w => w.week === activeWeek)) {
      const first = displayedWeeks[0]
      setActiveWeek(first.week)
      setExpandedDay(first.days[0] ? `${first.days[0].week}-${first.days[0].day}` : null)
    }
  }, [displayedWeeks.length]) // eslint-disable-line
  // ── "Mark as Eaten" state ──────────────────────────────────────────
  // Key format: "${recipe_id}_${mealType}"  e.g.  "abc123_Breakfast"
  // Seeded from TODAY's backend food log on mount (source of truth),
  // plus localStorage for instant optimistic UI without waiting for the fetch.
  const todayLocalKey = (() => {
    const d = new Date()
    return `nutridine-logged-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
  })()

  const [loggedMeals, setLoggedMeals] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(todayLocalKey)
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set()
    } catch { return new Set() }
  })
  const [logLoading, setLogLoading] = useState<string | null>(null)

  // Clean up afterprint listener on unmount
  useEffect(() => {
    return () => {
      if (afterPrintRef.current) {
        window.removeEventListener("afterprint", afterPrintRef.current)
      }
    }
  }, [])

  // On mount: seed loggedMeals from actual backend food log (today)
  // This is the real source of truth — prevents duplicates even after
  // localStorage clear, new device, or browser refresh.
  useEffect(() => {
    apiGetFoodLog().then(({ entries }) => {
      const fromDb = entries
        .filter(e => e.recipe_id)
        .map(e => `${e.recipe_id}_${e.meal_type}`)
      if (fromDb.length > 0) {
        setLoggedMeals(prev => {
          const merged = new Set([...prev, ...fromDb])
          try { localStorage.setItem(todayLocalKey, JSON.stringify([...merged])) } catch {}
          return merged
        })
      }
    }).catch(() => {}) // Non-critical — localStorage still guards optimistically
  }, []) // eslint-disable-line

  // Logs a single meal to the Food Log for today
  const logMeal = async (meal: BackendRecipe, mealKey: string, mealType: string) => {
    if (loggedMeals.has(mealKey) || logLoading === mealKey) return
    setLogLoading(mealKey)
    try {
      await apiAddFoodLog({
        name:      meal.name,
        calories:  meal.nutrition_per_serving.calories,
        protein:   meal.nutrition_per_serving.protein,
        carbs:     meal.nutrition_per_serving.carbs,
        fat:       meal.nutrition_per_serving.fat,
        meal_type: mealType,
        recipe_id: meal.id,
        // logged_at omitted → backend defaults to today
      })
      setLoggedMeals(prev => {
        const updated = new Set(prev).add(mealKey)
        try { localStorage.setItem(todayLocalKey, JSON.stringify([...updated])) } catch {}
        return updated
      })
    } catch {
      // Silent — button stays active so user can retry
    } finally {
      setLogLoading(null)
    }
  }

  // ── Auto-load last saved plan on mount ─────────────────────────────────────
  useEffect(() => {
    const restorePlan = async () => {
      try {
        const history = await apiGetMealPlanHistory()
        if (history.plans.length > 0) {
          const latest = history.plans[0]
          const saved  = await apiLoadSavedMealPlan(latest.id)
          const w: WeekPlan[] = (saved.plan_data as any)?.weeks ?? []
          if (w.length > 0) {
            setWeeks(w)
            setSummary((saved.plan_data as any)?.summary ?? null)
            setPoolStats((saved.plan_data as any)?.pool_stats ?? null)
            setActiveWeek(1)
            setExpandedDay(w[0]?.days[0] ? `${w[0].days[0].week}-${w[0].days[0].day}` : null)
            setLastSavedAt(latest.created_at)
          }
        }
      } catch {
        // Silent — user just sees empty state and can generate fresh
      }
    }
    restorePlan()
  }, [])

  // ── Export as PDF ──────────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    const prevExpanded = expandedDay
    const prevTitle = document.title
    // 1. Expand ALL days so every meal card is visible in print
    setIsPrinting(true)
    // 2. Set a clean document title — this controls the browser's built-in print header
    document.title = `NutriDine Meal Plan — ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`
    // 3. Wait for React to re-render with all days expanded
    await new Promise(resolve => setTimeout(resolve, 350))
    // 4. Restore state after print dialog closes — tracked via ref for cleanup
    const afterPrint = () => {
      setIsPrinting(false)
      setExpandedDay(prevExpanded)
      document.title = prevTitle
      window.removeEventListener("afterprint", afterPrint)
      afterPrintRef.current = null
    }
    afterPrintRef.current = afterPrint
    window.addEventListener("afterprint", afterPrint)
    window.print()
  }

  // ── Generate plan from backend ─────────────────────────────────────────────
  const generatePlan = async () => {
    setLoading(true)
    setError("")
    try {
      const weeksArg = selectedWeeks > 0 ? selectedWeeks : undefined
      const data = await apiGenerateMealPlan(weeksArg)
      const w: WeekPlan[] = data.weeks ?? []
      setWeeks(w)
      setSummary(data.summary ?? null)
      setPoolStats((data as any).pool_stats ?? null)
      setActiveWeek(1)
      setExpandedDay(w[0]?.days[0] ? `${w[0].days[0].week}-${w[0].days[0].day}` : null)
      localStorage.setItem("nutridine-plan-generated", "true")
      // Auto-save the newly generated plan
      setAutoSaving(true)
      try {
        await apiSaveMealPlan({ weeks: w, summary: data.summary, pool_stats: (data as any).pool_stats })
        setLastSavedAt(new Date().toISOString())
      } catch { /* silent — plan is shown even if save fails */ }
      finally { setAutoSaving(false) }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate meal plan")
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* ── Print Styles ── */}
      <style>{`
        @media print {
          /* ── Hide all app chrome ── */
          nav, aside, header, footer,
          [data-sidebar], [data-radix-popper-content-wrapper],
          .no-print { display: none !important; }

          /* ── Page setup ── */
          @page { margin: 16mm 14mm; size: A4 portrait; }
          body {
            background: white !important;
            color: black !important;
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 11px;
          }

          /* ── Layout resets ── */
          .p-6, .lg\:p-8 { padding: 6px !important; }
          * { box-shadow: none !important; }
          a[href]:after { content: none !important; }

          /* ── Week sections: each starts on a new page ── */
          .print-week { page-break-before: always; break-before: page; }
          .print-week:first-of-type { page-break-before: avoid; break-before: avoid; }

          /* ── Day cards: keep together, no page split mid-card ── */
          .print-day-card { page-break-inside: avoid; break-inside: avoid; margin-bottom: 8px; border: 1px solid #ddd; border-radius: 6px; padding: 8px; }

          /* ── Meal grid: 4 columns in print ── */
          .print-meal-grid { display: grid !important; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 6px; }
          .print-meal-card { border: 1px solid #eee; border-radius: 4px; padding: 8px; font-size: 10px; }
          .print-meal-name { font-weight: 600; font-size: 10px; margin-bottom: 2px; }
          .print-meal-meta { color: #666; font-size: 9px; }
          .print-nutrition { margin-top: 4px; font-size: 9px; color: #444; }

          /* ── Summary strip ── */
          .print-summary { display: flex; gap: 24px; font-size: 10px; color: #444; margin-bottom: 12px; padding: 8px; border: 1px solid #eee; border-radius: 4px; }
          .print-summary strong { color: black; }
        }
      `}</style>
      {/* ── Print header: conditionally rendered only when isPrinting ──
           This is more reliable than CSS display:none/block in Next.js */}
      {isPrinting && (
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🥗 NutriDine — My Personalized Meal Plan</h1>
              {user?.name && <p style={{ fontSize: 11, color: '#555', marginTop: 3 }}>Prepared for: <strong>{user.name}</strong></p>}
              <p style={{ fontSize: 10, color: '#777', marginTop: 2 }}>
                {weeks.length} week{weeks.length !== 1 ? 's' : ''} · {weeks.length * 7} unique days · zero recipe repeats
              </p>
            </div>
            <div style={{ textAlign: 'right', fontSize: 10, color: '#888' }}>
              <p>Generated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              {user?.conditions && user.conditions.length > 0 && (
                <p style={{ marginTop: 3 }}>Health conditions: <strong style={{ color: '#333' }}>{user.conditions.join(', ')}</strong></p>
              )}
            </div>
          </div>
          {summary && (
            <div className="print-summary" style={{ marginTop: 10 }}>
              <span>Avg. Calories: <strong>{summary.avg_daily_calories} kcal/day</strong></span>
              <span>Avg. Protein: <strong>{summary.avg_daily_protein}g/day</strong></span>
              <span>Total Meals: <strong>{summary.total_meals}</strong></span>
              <span>Safe Days: <strong>{summary.compliant_days}/{summary.total_days}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Personalized Meal Plan</h1>
            <p className="text-muted-foreground mt-1">
              {weeks.length > 0
                ? <>{displayedWeeks.length} week{displayedWeeks.length !== 1 ? "s" : ""} &middot; {displayedWeeks.length * 7} unique days &middot; zero recipe repeats
                    {selectedWeeks > 0 && weeks.length > selectedWeeks && (
                      <span className="ml-2 text-xs text-primary font-medium">(trimmed from {weeks.length} wks)</span>
                    )}
                  </>
                : "Auto-generated based on your safe recipe pool"
              }
            </p>
          </div>
          <div className="flex gap-2">
            {weeks.length > 0 && (
              <Button
                onClick={handleExportPDF}
                variant="outline"
                className="gap-2"
                disabled={isPrinting}
              >
                {isPrinting
                  ? <><RefreshCw className="w-4 h-4 animate-spin" /> Preparing...</>
                  : <><Download className="w-4 h-4" /> Export PDF</>
                }
              </Button>
            )}
            <Button onClick={generatePlan} disabled={loading} className="gap-2">
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                : <><Sparkles className="w-4 h-4" /> Generate Plan</>
              }
            </Button>
          </div>
        </div>

        {/* Timeline selector */}
        <div className="flex items-center gap-2 p-3 rounded-xl border bg-muted/30">
          <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-muted-foreground mr-1">Timeline:</span>
          <div className="flex gap-1.5 flex-wrap">
            {TIMELINE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedWeeks(opt.value)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-semibold border transition-all duration-150",
                  selectedWeeks === opt.value
                    ? "bg-primary text-primary-foreground border-primary shadow-sm scale-105"
                    : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">
            {weeks.length === 0
              ? selectedWeeks === 0
                ? "Will generate max unique weeks for your recipe pool"
                : `Will generate exactly ${selectedWeeks} weeks when you hit Generate`
              : selectedWeeks === 0
              ? "Showing all loaded weeks · pick a number to trim the view instantly"
              : selectedWeeks >= weeks.length
              ? `Showing all ${weeks.length} loaded weeks`
              : `Trimmed to ${selectedWeeks} of ${weeks.length} weeks — no re-generation needed`
            }
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={generatePlan} className="ml-auto">Retry</Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && weeks.length === 0 && !error && (
        <div className="text-center py-20 border-2 border-dashed rounded-xl border-border">
          <Calendar className="w-14 h-14 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h3 className="text-lg font-semibold mb-2">No meal plan yet</h3>
          <p className="text-muted-foreground text-sm mb-2 max-w-md mx-auto">
            NutriDine will count how many recipes are safe for you across each meal type,
            then generate exactly that many weeks of unique, non-repeating meals.
          </p>
          {user?.conditions && user.conditions.length > 0 && (
            <p className="text-sm text-muted-foreground mb-6">
              Optimized for: <strong className="text-foreground">{
                user.conditions.length <= 3
                  ? user.conditions.join(", ")
                  : `${user.conditions.slice(0, 3).join(", ")} and ${user.conditions.length - 3} more`
              }</strong>
            </p>
          )}
          <Button onClick={generatePlan} size="lg" className="gap-2">
            <Sparkles className="w-5 h-5" /> Generate My Plan
          </Button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="flex gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-10 bg-muted rounded-lg w-24" />)}
          </div>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-4">
                <div className="h-6 bg-muted rounded w-24" />
                <div className="h-6 bg-muted rounded w-20" />
              </div>
              <div className="grid grid-cols-4 gap-3 mt-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="h-16 bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Plan content */}
      {!loading && weeks.length > 0 && (
        <>
          {/* Summary stats */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: <Flame className="w-5 h-5 text-orange-500" />,  value: summary.avg_daily_calories, label: "Avg. Daily Calories", unit: "kcal" },
                { icon: <Utensils className="w-5 h-5 text-primary" />,  value: summary.total_meals,        label: "Total Meals",        unit: "" },
                { icon: <TrendingUp className="w-5 h-5 text-blue-500" />, value: summary.avg_daily_protein, label: "Avg. Daily Protein",  unit: "g" },
                { icon: <Award className="w-5 h-5 text-green-500" />,   value: summary.compliant_days,     label: "Safe Days",          unit: `/ ${summary.total_days}` },
              ].map((s, i) => (
                <Card key={i}>
                  <CardContent className="p-4 text-center">
                    <div className="flex justify-center mb-2">{s.icon}</div>
                    <p className="text-2xl font-bold">{s.value}<span className="text-sm font-normal text-muted-foreground ml-1">{s.unit}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pool stats explanation banner */}
          {poolStats && (
            <div className="p-4 rounded-xl border bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Your safe recipe pool</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{poolStats.generated_weeks} weeks</span> generated · 1 unique recipe per day · no repeats
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Breakfast", count: poolStats.safe_breakfasts },
                  { label: "Lunch",     count: poolStats.safe_lunches     },
                  { label: "Dinner",    count: poolStats.safe_dinners     },
                  { label: "Snack",     count: poolStats.safe_snacks      },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-background border text-sm">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-foreground">{item.count} safe</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Condition note */}
          {user?.conditions && user.conditions.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
              <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
              <span className="text-sm text-green-800 dark:text-green-300">
                All meals prioritized for: <strong>{
                  user.conditions.length <= 3
                    ? user.conditions.join(", ")
                    : `${user.conditions.slice(0, 3).join(", ")} and ${user.conditions.length - 3} more`
                }</strong>
              </span>
            </div>
          )}

          {/* ── Week Tabs (hidden during print) ── */}
          <div className={cn(
            "gap-3 no-print",
            displayedWeeks.length <= 4
              ? "grid grid-cols-4"
              : displayedWeeks.length <= 6
              ? "grid grid-cols-3"
              : "flex overflow-x-auto pb-1 scrollbar-none"
          )}>
            {displayedWeeks.map(w => {
              const isActive = activeWeek === w.week
              const gradients = [
                { border: "border-b-foreground" },
                { border: "border-b-foreground" },
                { border: "border-b-foreground" },
                { border: "border-b-foreground" },
              ]
              const theme = gradients[(w.week - 1) % gradients.length]
              return (
                <button
                  key={w.week}
                  onClick={() => {
                    setActiveWeek(w.week)
                    setExpandedDay(w.days[0] ? `${w.days[0].week}-${w.days[0].day}` : null)
                  }}
                  className={cn(
                    "group flex flex-col items-center gap-1 p-4 rounded-xl border-2 border-b-4",
                    "transition-all duration-200 ease-out text-center cursor-pointer",
                    "hover:-translate-y-1 hover:shadow-md",
                    isActive
                      ? cn("bg-card shadow-md -translate-y-1 border-border", theme.border)
                      : "bg-card border-transparent hover:border-border hover:border-b-4",
                  )}
                >
                  <span className="text-lg font-bold tracking-tight text-foreground">
                    {w.label}
                  </span>
                  <span className="text-xs text-muted-foreground font-normal">
                    ~{w.avg_daily_calories}
                  </span>
                  <span className="text-[10px] text-muted-foreground/70 font-normal">
                    kcal / day
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Week Content: current week on screen, ALL displayed weeks in print ── */}
          {(isPrinting ? displayedWeeks : displayedWeeks.filter(w => w.week === activeWeek)).map(weekData => (
            <div key={weekData.week} className={`space-y-3 ${isPrinting ? 'print-week' : ''}`}>
              <div className="flex items-center gap-3 pb-3 border-b">
                <h2 className="font-bold text-xl text-foreground">
                  {weekData.label}
                </h2>
                <Badge variant="secondary" className="gap-1 no-print">
                  <Flame className="w-3 h-3 text-orange-500" />
                  {weekData.avg_daily_calories} kcal avg/day
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto no-print">7 days &middot; 28 meals</span>
              </div>

              {weekData.days.map(day => {
                const isExpanded = isPrinting || expandedDay === `${day.week}-${day.day}`
                const meals = [
                  { key: "breakfast", meal: day.breakfast },
                  { key: "lunch",     meal: day.lunch },
                  { key: "snack",     meal: day.snack },
                  { key: "dinner",    meal: day.dinner },
                ] as const
                const allCompliant = meals.filter(m => m.meal).every(m => m.meal?.is_compliant)

                return (
                  <Card key={`${day.week}-${day.day}`} className={cn("transition-all print-day-card", isExpanded && !isPrinting && "ring-2 ring-primary/20")}>
                    <CardHeader
                      className={cn("pb-3", !isPrinting && "cursor-pointer hover:bg-muted/30 transition-colors")}
                      onClick={() => !isPrinting && setExpandedDay(isExpanded ? null : `${day.week}-${day.day}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base w-24">{day.day}</CardTitle>
                          <Badge variant="secondary" className="gap-1">
                            <Flame className="w-3 h-3" />
                            {day.total_calories} kcal
                          </Badge>
                          {allCompliant
                            ? <ShieldCheck className="w-4 h-4 text-green-500" />
                            : <ShieldX className="w-4 h-4 text-amber-500" />
                          }
                        </div>
                        {!isPrinting && (isExpanded
                          ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          : <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Collapsed: compact meal names */}
                      {!isExpanded && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                          {meals.map(({ key, meal }) => {
                            const Icon = MEAL_ICONS[key]
                            return (
                              <div key={key} className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50 text-xs">
                                <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                <span className="truncate">{meal?.name ?? "—"}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardHeader>

                    {/* Expanded meal cards */}
                    {isExpanded && (
                      <CardContent className="pt-0 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print-meal-grid">
                          {meals.map(({ key, meal }) => {
                            const Icon = MEAL_ICONS[key]
                            if (!meal) return (
                              <div key={key} className="rounded-xl border border-dashed p-4 text-center text-muted-foreground text-sm print-meal-card">
                                No {MEAL_LABELS[key]}
                              </div>
                            )
                            return (
                              <div key={key} className="rounded-xl border bg-card p-4 space-y-3 print-meal-card">
                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${MEAL_COLORS[key]}`}>
                                  <Icon className="w-3 h-3" />
                                  {MEAL_LABELS[key]}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm leading-tight print-meal-name">{meal.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5 print-meal-meta">{meal.cuisine} · {meal.difficulty}</p>
                                </div>
                                {(meal.condition_notes ?? []).length > 0 && (
                                  <div className={`p-2 rounded-lg text-xs ${
                                    meal.is_compliant
                                      ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                                      : "bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400"
                                  }`}>
                                    <div className="flex items-center gap-1 font-medium mb-1">
                                      {meal.is_compliant ? <ShieldCheck className="w-3 h-3" /> : <ShieldX className="w-3 h-3" />}
                                      {meal.is_compliant ? "Safe for you" : "Check notes"}
                                    </div>
                                    {(meal.condition_notes ?? []).slice(0, 1).map((n, i) => (
                                      <p key={i} className="line-clamp-2">{n.reason}</p>
                                    ))}
                                  </div>
                                )}
                                <div className="space-y-1 text-xs print-nutrition">
                                  {[
                                    ["Calories", `${meal.nutrition_per_serving.calories} kcal`],
                                    ["Protein",  `${meal.nutrition_per_serving.protein}g`],
                                    ["Carbs",    `${meal.nutrition_per_serving.carbs}g`],
                                    ["Fat",      `${meal.nutrition_per_serving.fat}g`],
                                  ].map(([label, val]) => (
                                    <div key={label} className="flex justify-between">
                                      <span className="text-muted-foreground">{label}</span>
                                      <span className="font-medium">{val}</span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-muted-foreground">⏱ {meal.prep_time + meal.cook_time} min</p>
                                {/* Mark as Eaten button */}
                                {!isPrinting && (() => {
                                  // Key = "recipeId_MealType" — matches backend-seeded loggedMeals
                                  const logKey = `${meal.id}_${MEAL_LABELS[key]}`
                                  const isLogged = loggedMeals.has(logKey)
                                  const isLogging = logLoading === logKey
                                  return (
                                    <button
                                      onClick={e => { e.stopPropagation(); logMeal(meal, logKey, MEAL_LABELS[key]) }}
                                      disabled={isLogged || isLogging}
                                      className={`w-full mt-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        isLogged
                                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 cursor-default"
                                          : isLogging
                                          ? "bg-muted text-muted-foreground cursor-wait"
                                          : "bg-primary/10 text-primary hover:bg-primary/20 active:scale-95"
                                      }`}
                                    >
                                      {isLogged ? (
                                        <><CheckCircle2 className="w-3.5 h-3.5" /> Logged to Food Log</>
                                      ) : isLogging ? (
                                        <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Logging…</>
                                      ) : (
                                        <><Utensils className="w-3.5 h-3.5" /> Mark as Eaten</>
                                      )}
                                    </button>
                                  )
                                })()}
                              </div>
                            )
                          })}
                        </div>

                        {/* Daily summary bar */}
                        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 flex flex-wrap gap-4 text-sm no-print">
                          <span className="font-semibold">Daily Total:</span>
                          <span><Flame className="w-3.5 h-3.5 inline text-orange-500 mr-1" />{day.total_calories} kcal</span>
                          <span className="text-muted-foreground">
                            P: <strong className="text-foreground">
                              {[day.breakfast, day.lunch, day.dinner, day.snack]
                                .filter(Boolean)
                                .reduce((s, m) => s + (m?.nutrition_per_serving.protein ?? 0), 0)}g
                            </strong>
                          </span>
                          <span className="text-muted-foreground">
                            C: <strong className="text-foreground">
                              {[day.breakfast, day.lunch, day.dinner, day.snack]
                                .filter(Boolean)
                                .reduce((s, m) => s + (m?.nutrition_per_serving.carbs ?? 0), 0)}g
                            </strong>
                          </span>
                          <span className="text-muted-foreground">
                            F: <strong className="text-foreground">
                              {[day.breakfast, day.lunch, day.dinner, day.snack]
                                .filter(Boolean)
                                .reduce((s, m) => s + (m?.nutrition_per_serving.fat ?? 0), 0)}g
                            </strong>
                          </span>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                )
              })}
            </div>
          ))}

          {/* Shopping links (hidden in print — not relevant for PDF) */}
          <Card className="border-dashed no-print">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ShoppingCart className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Order Ingredients Online</span>
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { name: "BigBasket",       url: "https://www.bigbasket.com",           color: "bg-green-600" },
                  { name: "Blinkit",         url: "https://blinkit.com",                 color: "bg-yellow-500" },
                  { name: "Swiggy Instamart",url: "https://www.swiggy.com/instamart",    color: "bg-orange-500" },
                  { name: "Zepto",           url: "https://www.zeptonow.com",            color: "bg-purple-600" },
                ].map(platform => (
                  <a
                    key={platform.name}
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium ${platform.color} hover:opacity-90 transition-opacity`}
                  >
                    {platform.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}