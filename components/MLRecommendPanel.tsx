"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck, ShieldX, Star, ThumbsUp,
  ThumbsDown, Target, Sparkles, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react"
import { getToken } from "@/lib/api"

interface MLAnalysis {
  final_score: number
  condition_score: number
  nlp_score: number
  goal_score: number
  condition_details: string[]
  matched_likes: string[]
  matched_dislikes: string[]
  recommendation: string
}

const BACKEND = "" // Routed via Next.js proxy rewrites → 127.0.0.1:8000

async function fetchMLAnalysis(recipeId: string): Promise<MLAnalysis | null> {
  try {
    const token = getToken()
    const res = await fetch(`${BACKEND}/api/ml/analyze/${recipeId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.analysis
  } catch { return null }
}

function getMatchLabel(score: number): { label: string; color: string; stars: number } {
  if (score >= 75) return { label: "Excellent match",  color: "text-green-600 dark:text-green-400",  stars: 5 }
  if (score >= 55) return { label: "Good match",       color: "text-blue-600 dark:text-blue-400",    stars: 4 }
  if (score >= 40) return { label: "Moderate match",   color: "text-amber-600 dark:text-amber-400",  stars: 3 }
  return               { label: "Low match",           color: "text-red-600 dark:text-red-400",      stars: 2 }
}

export default function MLRecommendPanel({ recipeId }: { recipeId: string }) {
  const [analysis, setAnalysis] = useState<MLAnalysis | null>(null)
  const [loading, setLoading]   = useState(false)
  const [shown, setShown]       = useState(false)

  const toggle = async () => {
    if (shown) { setShown(false); return }
    setLoading(true)
    const data = await fetchMLAnalysis(recipeId)
    setAnalysis(data)
    setLoading(false)
    setShown(true)
  }

  const match = analysis ? getMatchLabel(analysis.final_score) : null

  return (
    <div className="rounded-xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between p-3 bg-primary/5 hover:bg-primary/10 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Sparkles className="w-4 h-4" />
          Why we recommend this for you
        </div>
        {loading
          ? <RefreshCw className="w-4 h-4 animate-spin text-muted-foreground" />
          : shown
          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        }
      </button>

      {/* Content — unavailable fallback */}
      {shown && !loading && !analysis && (
        <div className="p-4 bg-background text-sm text-muted-foreground flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0 opacity-40" />
          AI analysis is not available for this recipe right now.
        </div>
      )}

      {/* Content */}
      {shown && analysis && !loading && (
        <div className="p-4 space-y-4 bg-background">

          {/* Match score — user friendly */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className={`font-semibold text-base ${match?.color}`}>
                {match?.label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Based on your health profile
              </p>
            </div>
            <div className="text-right">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${
                      i < (match?.stars ?? 0)
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {analysis.final_score}% overall match
              </p>
            </div>
          </div>

          {/* Health conditions check */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Health check
            </p>
            {analysis.condition_details.length === 0 ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                No health conditions configured — visit your Profile to personalise.
              </div>
            ) : (
              analysis.condition_details.map((detail, i) => {
                const isSafe = detail.startsWith("✓")
                // Safely extract condition name — strip known prefixes, fall back to raw text
                const conditionName = detail
                  .replace(/^[✓⚠]\s*(Safe for\s*|Unsafe for\s*)?/u, "")
                  .trim() || detail
                return (
                  <div key={i} className={`flex items-center gap-2 text-sm p-2.5 rounded-lg ${
                    isSafe
                      ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400"
                      : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400"
                  }`}>
                    {isSafe
                      ? <ShieldCheck className="w-4 h-4 shrink-0" />
                      : <ShieldX className="w-4 h-4 shrink-0" />
                    }
                    {isSafe
                      ? `Safe for your ${conditionName}`
                      : `May not suit your ${conditionName}`
                    }
                  </div>
                )
              })
            )}
          </div>

          {/* Goal alignment */}
          <div className={`flex items-center gap-3 p-2.5 rounded-lg text-sm ${
            analysis.goal_score >= 70
              ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400"
              : "bg-muted/50 text-muted-foreground"
          }`}>
            <Target className="w-4 h-4 shrink-0" />
            {analysis.goal_score >= 70
              ? "Great choice for your fitness goal"
              : "Acceptable for your fitness goal"
            }
          </div>

          {/* Food preferences */}
          {(analysis.matched_likes.length > 0 || analysis.matched_dislikes.length > 0) && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Your preferences
              </p>
              {analysis.matched_likes.length > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <ThumbsUp className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-green-700 dark:text-green-400">
                      Contains ingredients you like:
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.matched_likes.map(like => (
                        <Badge key={like} className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                          {like}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {analysis.matched_dislikes.length > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <ThumbsDown className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-700 dark:text-red-400">
                      Contains ingredients you dislike:
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {analysis.matched_dislikes.map(d => (
                        <Badge key={d} className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No preferences matched */}
          {analysis.matched_likes.length === 0 && analysis.matched_dislikes.length === 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-sm text-muted-foreground">
              <ThumbsUp className="w-4 h-4 shrink-0" />
              No specific food preference conflicts found
            </div>
          )}
        </div>
      )}
    </div>
  )
}