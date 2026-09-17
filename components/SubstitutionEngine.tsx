"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  RefreshCw, AlertCircle, ShieldCheck, ShieldX,
  ChevronRight, ArrowRightLeft, Heart, Info,
} from "lucide-react"
import { getToken } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────
interface Substitute {
  name: string
  amount?: string
  unit?: string
  notes: string
}

interface SubstitutionResult {
  ingredient: string
  mode?: "health" | "preference"
  category?: string
  reason: string
  substitutes: Substitute[]
  condition_specific: boolean
  conditions?: string[]
}

interface SubstitutionEngineProps {
  ingredients: { name: string; amount: number; unit: string }[]
  recipeName: string
}

const BACKEND = "" // Routed via Next.js proxy rewrites → 127.0.0.1:8000
type Mode = "health" | "preference"

// ── Main Component ────────────────────────────────────────────────────────────
export default function SubstitutionEngine({ ingredients, recipeName }: SubstitutionEngineProps) {
  const [open, setOpen]         = useState(false)
  const [mode, setMode]         = useState<Mode>("health")
  const [selected, setSelected] = useState<string | null>(null)
  const [result, setResult]     = useState<SubstitutionResult | null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")

  const fetchSubstitution = async (ingredientName: string, currentMode: Mode) => {
    setSelected(ingredientName)
    setLoading(true)
    setError("")
    setResult(null)
    try {
      const token = getToken()
      const res = await fetch(
        `${BACKEND}/api/substitution/${encodeURIComponent(ingredientName)}?mode=${currentMode}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (!res.ok) throw new Error("Failed")
      setResult(await res.json())
    } catch {
      setError("Could not load substitutions. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode)
    setSelected(null)
    setResult(null)
    setError("")
  }

  const isPreference = mode === "preference"

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 w-full mt-2"
        onClick={() => setOpen(true)}
      >
        <ArrowRightLeft className="w-4 h-4 text-primary" />
        Ingredient Substitution Engine
      </Button>

      {/* max-w-lg keeps it narrow enough to never clip on most screens */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg w-[92vw] max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>

          {/* Title + subtitle — DialogContent already has pt-6 built in */}
          <DialogHeader className="pr-6">
            <DialogTitle className="text-base leading-snug">
              Ingredient Substitution Engine
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Recipe: <span className="font-semibold text-foreground">{recipeName}</span>
            </p>
          </DialogHeader>

          {/* ── Mode tabs ─────────────────────────────────────────────── */}
          <div className="flex gap-1.5 p-1 rounded-lg bg-muted/50 border">
            {(["health", "preference"] as Mode[]).map((m) => {
              const active = mode === m
              return (
                <button
                  key={m}
                  onClick={() => handleModeSwitch(m)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition-all ${
                    active
                      ? "bg-background shadow border border-border text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "health"
                    ? <><ShieldCheck className={`w-3.5 h-3.5 ${active ? "text-green-500" : ""}`} />Health-Based</>
                    : <><Heart       className={`w-3.5 h-3.5 ${active ? "text-rose-500"  : ""}`} />Your Preference</>
                  }
                </button>
              )
            })}
          </div>

          {/* ── Context hint ───────────────────────────────────────────── */}
          <div className={`flex items-start gap-2 p-3 rounded-lg text-xs leading-relaxed ${
            isPreference
              ? "bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300"
              : "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-300"
          }`}>
            <Info className="w-3 h-3 shrink-0 mt-0.5" />
            <span>
              {isPreference
                ? "Don't have an ingredient, don't like it, or want something different? Select any ingredient below for a swap."
                : "Select an ingredient to see health-safe alternatives filtered for your conditions."}
            </span>
          </div>

          {/* ── Ingredient list ────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {isPreference ? "Choose ingredient to swap" : "Select an ingredient"}
            </p>
            <div className="space-y-1.5">
              {ingredients.map((ing) => {
                const isActive = selected === ing.name
                return (
                  <button
                    key={ing.name}
                    onClick={() => fetchSubstitution(ing.name, mode)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-all text-left ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium capitalize truncate">{ing.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0">
                        {ing.amount} {ing.unit}
                      </span>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ml-1 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Result section ─────────────────────────────────────────── */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
              {isPreference ? "Alternative options" : "Safe alternatives"}
            </p>

            {/* Empty state */}
            {!selected && !loading && !error && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground border-2 border-dashed rounded-xl gap-2">
                {isPreference
                  ? <Heart className="w-7 h-7 opacity-20" />
                  : <ShieldCheck className="w-7 h-7 opacity-20" />
                }
                <p className="text-sm font-medium">
                  {isPreference ? "Select an ingredient to swap" : "Select an ingredient above"}
                </p>
                <p className="text-xs opacity-50 max-w-[200px]">
                  {isPreference
                    ? "Alternatives from the same food category"
                    : "Filtered for your health conditions"}
                </p>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm">Finding alternatives…</span>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Result */}
            {result && !loading && (
              <div className="space-y-2.5">

                {/* Reason banner */}
                <div className={`p-3 rounded-xl text-xs space-y-2 ${
                  isPreference
                    ? "bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900"
                    : result.condition_specific
                      ? "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900"
                      : "bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900"
                }`}>
                  <p className={`flex items-center gap-1.5 font-semibold text-sm ${
                    isPreference ? "text-rose-800 dark:text-rose-300"
                      : result.condition_specific ? "text-amber-800 dark:text-amber-300"
                      : "text-green-800 dark:text-green-300"
                  }`}>
                    {isPreference
                      ? <><ArrowRightLeft className="w-3.5 h-3.5" /> Preference Swap</>
                      : result.condition_specific
                        ? <><ShieldX       className="w-3.5 h-3.5" /> Health Caution</>
                        : <><ShieldCheck   className="w-3.5 h-3.5" /> Why substitute?</>
                    }
                  </p>
                  <p className={`leading-relaxed ${
                    isPreference ? "text-rose-700 dark:text-rose-400"
                      : result.condition_specific ? "text-amber-700 dark:text-amber-400"
                      : "text-green-700 dark:text-green-400"
                  }`}>
                    {result.reason}
                  </p>
                  {isPreference && result.category && (
                    <Badge variant="outline" className="text-[10px] border-rose-300 text-rose-700 dark:border-rose-700">
                      Category: {result.category}
                    </Badge>
                  )}
                  {!isPreference && result.conditions && result.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {result.conditions.map(c => (
                        <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Substitute cards */}
                {result.substitutes.map((sub, i) => (
                  <div key={i} className="px-4 py-3 rounded-xl border bg-card space-y-1 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-sm">{sub.name}</span>
                      {sub.amount && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {sub.amount}{sub.unit ? ` ${sub.unit}` : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{sub.notes}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </DialogContent>
      </Dialog>
    </>
  )
}