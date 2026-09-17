"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ClipboardList, Flame, Beef, Wheat, Droplets,
  Plus, Trash2, ChevronLeft, ChevronRight,
  Coffee, Sun, Cookie, Moon, AlertCircle, RefreshCw,
  CalendarDays, RotateCcw, TriangleAlert
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  apiGetFoodLog, apiAddFoodLog, apiDeleteFoodLog, apiFoodLogHistory,
  FoodLogEntry
} from "@/lib/api"
import { useUser } from "@/contexts/user-context"

const MEAL_TYPES = ["Breakfast", "Lunch", "Snack", "Dinner", "Meal"]
const MEAL_ICONS: Record<string, any> = {
  Breakfast: Coffee, Lunch: Sun, Snack: Cookie, Dinner: Moon, Meal: ClipboardList,
}
const MEAL_COLORS: Record<string, string> = {
  Breakfast: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  Lunch: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Snack: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Dinner: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Meal: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

/** Returns "YYYY-MM-DD" using LOCAL date (avoids UTC timezone shift bug) */
function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function todayStr(): string {
  return formatDate(new Date())
}

function displayDate(iso: string) {
  // Parse as local date to avoid timezone offset shifting the displayed day
  const [y, mo, d] = iso.split("-").map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  })
}

/** Returns the Monday of the week containing the given YYYY-MM-DD string */
function getWeekDays(iso: string): string[] {
  const [y, mo, d] = iso.split("-").map(Number)
  const base = new Date(y, mo - 1, d)
  // day 0=Sun, shift to Mon-based week
  const dow = base.getDay() // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(base)
  monday.setDate(base.getDate() + mondayOffset)
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(monday)
    dd.setDate(monday.getDate() + i)
    return formatDate(dd)
  })
}

function shortDay(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "short" })
}

function dayNum(iso: string): string {
  return iso.split("-")[2].replace(/^0/, "")
}

interface AddEntryState {
  name: string; calories: string; protein: string
  carbs: string; fat: string; meal_type: string
}

const EMPTY_ENTRY: AddEntryState = {
  name: "", calories: "", protein: "", carbs: "", fat: "", meal_type: "Meal",
}

export default function FoodLogPage() {
  const { user } = useUser()
  const [date, setDate] = useState(todayStr())
  const [entries, setEntries] = useState<FoodLogEntry[]>([])
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState<AddEntryState>(EMPTY_ENTRY)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  // Days with data (for week strip dot indicators)
  const [daysWithData, setDaysWithData] = useState<Set<string>>(new Set())


  // Fetch history dots for the week strip
  const fetchHistory = useCallback(async () => {
    try {
      const h = await apiFoodLogHistory(30)
      setDaysWithData(new Set(h.history.filter(d => d.calories > 0).map(d => d.logged_at)))
    } catch {
      // non-critical – ignore
    }
  }, [])

  const fetchLog = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const data = await apiGetFoodLog(date)
      setEntries(data.entries)
      setTotals(data.totals)
    } catch (e: any) {
      setError(e.message ?? "Failed to load food log")
    } finally {
      setLoading(false)
    }
  }, [date])

  useEffect(() => { fetchLog() }, [fetchLog])
  useEffect(() => { fetchHistory() }, [fetchHistory])

  /** Move date by N days (positive = forward, negative = backward) */
  const changeDate = (days: number) => {
    const [y, mo, d] = date.split("-").map(Number)
    const next = new Date(y, mo - 1, d)
    next.setDate(next.getDate() + days)
    const newDate = formatDate(next)
    // disallow future dates
    if (newDate <= todayStr()) setDate(newDate)
  }

  const handleAdd = async () => {
    if (!form.name.trim() || !form.calories) return
    setSaving(true)
    try {
      await apiAddFoodLog({
        name: form.name.trim(),
        calories: parseFloat(form.calories) || 0,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
        meal_type: form.meal_type,
        logged_at: date,
      })
      setForm(EMPTY_ENTRY)
      setAdding(false)
      fetchLog()
      fetchHistory()
    } catch (e: any) {
      setError(e.message ?? "Failed to add entry")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm("Remove this entry from your food log?")) return
    setDeletingId(id)
    try {
      await apiDeleteFoodLog(id)
      fetchLog()
      fetchHistory()
    } catch (e: any) {
      setError(e.message ?? "Failed to delete entry")
    } finally {
      setDeletingId(null)
    }
  }

  /** Delete ALL entries for the selected date — resets the whole day */
  const handleResetDay = async () => {
    if (entries.length === 0 || resetting) return
    setResetting(true)
    try {
      await Promise.all(entries.map(e => apiDeleteFoodLog(e.id)))
      if (isToday) {
        const d = new Date()
        const localKey = `nutridine-logged-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        try { localStorage.removeItem(localKey) } catch { }
      }
      setResetConfirm(false)
      fetchLog()
      fetchHistory()
    } catch (e: any) {
      setError(e.message ?? "Failed to reset day")
    } finally {
      setResetting(false)
    }
  }

  const isToday = date === todayStr()
  const weekDays = getWeekDays(date)

  const grouped = MEAL_TYPES.reduce<Record<string, FoodLogEntry[]>>((acc, mt) => {
    acc[mt] = entries.filter(e => e.meal_type === mt)
    return acc
  }, {})

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Food Log</h1>
          <p className="text-muted-foreground mt-1">Track everything you eat to hit your daily goals</p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" /> Log Food
        </Button>
      </div>

      {/* Date navigation */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => changeDate(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center">
            <p className="font-semibold">{displayDate(date)}</p>
            {isToday
              ? <Badge variant="secondary" className="text-xs mt-0.5">Today</Badge>
              : (
                <button
                  onClick={() => setDate(todayStr())}
                  className="text-xs text-primary hover:underline mt-0.5 inline-block"
                >
                  Back to Today
                </button>
              )
            }
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => changeDate(1)}
            disabled={isToday}
            title={isToday ? "Can't go to a future date" : "Next day"}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Week strip – click any day */}
        <div className="flex items-center justify-between gap-1 bg-muted/40 rounded-xl p-2">
          {weekDays.map(day => {
            const isSelected = day === date
            const isTodayDay = day === todayStr()
            const isFuture = day > todayStr()
            const hasData = daysWithData.has(day)

            return (
              <button
                key={day}
                disabled={isFuture}
                onClick={() => setDate(day)}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg flex-1 transition-all",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow"
                    : isFuture
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:bg-muted cursor-pointer",
                )}
              >
                <span className="text-[10px] font-medium uppercase tracking-wide">
                  {shortDay(day)}
                </span>
                <span className={cn(
                  "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full",
                  isTodayDay && !isSelected && "ring-2 ring-primary ring-offset-1"
                )}>
                  {dayNum(day)}
                </span>
                {/* dot = has logged data */}
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full",
                  hasData
                    ? isSelected ? "bg-primary-foreground" : "bg-primary"
                    : "bg-transparent"
                )} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchLog}><RefreshCw className="w-3 h-3" /></Button>
        </div>
      )}

      {/* Daily macro summary + Reset Day trigger */}
      <div className="flex items-center gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
          {[
            { icon: <Flame className="w-4 h-4 text-orange-500" />, label: "Calories", value: Math.round(totals.calories), unit: "kcal" },
            { icon: <Beef className="w-4 h-4 text-red-500" />, label: "Protein", value: Math.round(totals.protein), unit: "g" },
            { icon: <Wheat className="w-4 h-4 text-yellow-500" />, label: "Carbs", value: Math.round(totals.carbs), unit: "g" },
            { icon: <Droplets className="w-4 h-4 text-blue-500" />, label: "Fat", value: Math.round(totals.fat), unit: "g" },
          ].map(s => (
            <Card key={s.label}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-1">{s.icon}</div>
                <p className="text-xl font-bold">{s.value}<span className="text-xs font-normal text-muted-foreground ml-1">{s.unit}</span></p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {entries.length > 0 && (
          <button
            onClick={() => setResetConfirm(true)}
            title="Reset day"
            className="shrink-0 self-center flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Reset Day confirmation modal */}
      {resetConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => !resetting && setResetConfirm(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Dialog */}
          <div
            className="relative z-10 bg-card border rounded-2xl shadow-2xl p-6 mx-4 max-w-sm w-full space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Icon */}
            <div className="flex justify-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center">
                <TriangleAlert className="w-6 h-6 text-red-500" />
              </div>
            </div>

            {/* Text */}
            <div className="text-center space-y-1">
              <h3 className="text-base font-semibold">Reset {isToday ? "Today's" : ""} Food Log?</h3>

            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setResetConfirm(false)}
                disabled={resetting}
                className="flex-1 py-2 rounded-xl border text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetDay}
                disabled={resetting}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {resetting ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Clearing...</>
                ) : (
                  <><Trash2 className="w-4 h-4" /> Clear All</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add entry form */}
      {adding && (
        <Card className="border-primary/30 ring-2 ring-primary/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add Food Entry – {displayDate(date)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Food / Meal Name *</label>
                <input
                  className="fl-input"
                  placeholder="e.g. Dal Rice, Chicken Salad..."
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleAdd()}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Calories (kcal) *</label>
                <input type="number" min="0" className="fl-input"
                  placeholder="0" value={form.calories} onChange={e => setForm(f => ({ ...f, calories: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground mb-2 block uppercase tracking-wide">Meal Type</label>
                <div className="flex flex-wrap gap-2">
                  {MEAL_TYPES.map(mt => {
                    const Icon = MEAL_ICONS[mt] ?? ClipboardList
                    const isActive = form.meal_type === mt
                    return (
                      <button
                        key={mt}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, meal_type: mt }))}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                          isActive
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
                        )}
                      >
                        <Icon className="w-3 h-3" />
                        {mt}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Protein (g)</label>
                <input type="number" min="0" className="fl-input"
                  placeholder="0" value={form.protein} onChange={e => setForm(f => ({ ...f, protein: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Carbs (g)</label>
                <input type="number" min="0" className="fl-input"
                  placeholder="0" value={form.carbs} onChange={e => setForm(f => ({ ...f, carbs: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block uppercase tracking-wide">Fat (g)</label>
                <input type="number" min="0" className="fl-input"
                  placeholder="0" value={form.fat} onChange={e => setForm(f => ({ ...f, fat: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleAdd} disabled={saving || !form.name.trim() || !form.calories} className="gap-2">
                {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Add Entry
              </Button>
              <Button variant="outline" onClick={() => { setAdding(false); setForm(EMPTY_ENTRY) }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Log entries grouped by meal type */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl border-border">
          <CalendarDays className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="font-semibold">Nothing logged for {isToday ? "today" : displayDate(date)}</p>
          {isToday
            ? <p className="text-sm text-muted-foreground mt-1">Tap "Log Food" to start tracking your meals</p>
            : <p className="text-sm text-muted-foreground mt-1">No meals were recorded on this day</p>
          }
        </div>
      ) : (
        <div className="space-y-4">
          {MEAL_TYPES.map(mt => {
            const group = grouped[mt]
            if (!group.length) return null
            const Icon = MEAL_ICONS[mt] ?? ClipboardList
            const groupCal = group.reduce((s, e) => s + e.calories, 0)
            return (
              <Card key={mt}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium", MEAL_COLORS[mt] ?? MEAL_COLORS.Meal)}>
                        <Icon className="w-3 h-3" />
                        {mt}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(groupCal)} kcal</span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {group.map(entry => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{entry.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {Math.round(entry.calories)} kcal
                          {entry.protein > 0 && ` · P ${Math.round(entry.protein)}g`}
                          {entry.carbs > 0 && ` · C ${Math.round(entry.carbs)}g`}
                          {entry.fat > 0 && ` · F ${Math.round(entry.fat)}g`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={deletingId === entry.id}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40"
                      >
                        {deletingId === entry.id
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
