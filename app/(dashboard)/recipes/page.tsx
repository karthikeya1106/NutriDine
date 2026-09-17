"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Search, Clock, Flame, ChevronRight, X,
  ShieldCheck, ShieldX, Leaf, Heart, HeartOff,
  RefreshCw, AlertCircle, ChefHat, Filter,
  ChevronDown, Loader2
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { useUser } from "@/contexts/user-context"
import { apiGetRecipes, apiSearchRecipes, apiAddFavourite, apiRemoveFavourite, apiGetFavourites } from "@/lib/api"
import SubstitutionEngine from "@/components/SubstitutionEngine"
import MLRecommendPanel from "@/components/MLRecommendPanel"

// ── Types ─────────────────────────────────────────────────────────────────────
interface BackendRecipe {
  id: string
  name: string
  description: string
  cuisine: string
  meal_type: string
  prep_time: number
  cook_time: number
  servings: number
  difficulty: string
  dietary_tags: string[]
  ingredients: { name: string; amount: number; unit: string }[]
  steps: string[]
  nutrition_per_serving: {
    calories: number; protein: number; carbs: number
    fat: number; fiber: number; sodium: number
  }
  condition_safety: Record<string, { safe: boolean; reason: string }>
  is_compliant: boolean
  condition_notes: { condition: string; safe: boolean; reason: string }[]
}


const MEAL_TYPES = ["All", "Breakfast", "Lunch", "Dinner", "Snack"]

const CUISINES = [
  "All", "Indian", "Chinese", "Mediterranean", "American",
  "Italian", "Mexican", "Japanese", "Thai", "Middle Eastern",
]

const DIETARY_TAGS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Low-Carb", "High-Protein", "Dairy-Free",
]

const MEAL_COLOR: Record<string, string> = {
  Breakfast: "bg-amber-400",
  Lunch:     "bg-green-500",
  Dinner:    "bg-blue-500",
  Snack:     "bg-purple-400",
}

const DIFFICULTY_COLOR: Record<string, string> = {
  Easy:   "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  Hard:   "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
}

const LIMIT = 100  // recipes per page fetch

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RecipesPage() {
  const { user } = useUser()

  const [recipes, setRecipes]               = useState<BackendRecipe[]>([])
  const [totalCount, setTotalCount]         = useState(0)
  const [compliantTotal, setCompliantTotal] = useState(0)
  const [currentPage, setCurrentPage]       = useState(1)
  const [totalPages, setTotalPages]         = useState(1)
  const [loading, setLoading]               = useState(true)
  const [loadingMore, setLoadingMore]       = useState(false)
  const [error, setError]                   = useState("")
  const [searchQuery, setSearchQuery]       = useState("")
  const [searchDebounce, setSearchDebounce] = useState("")
  const [mealFilter, setMealFilter]         = useState("All")
  const [cuisineFilter, setCuisineFilter]   = useState("All")
  const [dietaryFilter, setDietaryFilter]   = useState<string[]>([])
  const [selectedRecipe, setSelectedRecipe] = useState<BackendRecipe | null>(null)
  const [favourites, setFavourites]         = useState<Set<string>>(new Set())
  const [favLoading, setFavLoading]         = useState<string | null>(null)
  const [searchResults, setSearchResults]   = useState<BackendRecipe[] | null>(null)
  const [searchTotal, setSearchTotal]       = useState(0)
  const [searching, setSearching]           = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // ── Fetch a page of recipes ────────────────────────────────────────────────
  const fetchRecipes = useCallback(async (
    mealType: string,
    cuisine: string,
    dietary: string[],
    page: number,
    append: boolean
  ) => {
    if (page === 1) setLoading(true)
    else setLoadingMore(true)
    setError("")
    try {
      const data = await apiGetRecipes({
        meal_type:      mealType !== "All" ? mealType : undefined,
        page,
        limit:          100,
        all_cuisines:   cuisine === "All",  // let backend handle cuisine filter
        cuisine_filter: cuisine !== "All" ? cuisine : undefined,
        dietary_tags:   dietary.length > 0 ? dietary : undefined,
      })
      setTotalCount(data.total)
      setCompliantTotal(data.compliant_count)
      setTotalPages(data.total_pages)
      setCurrentPage(page)
      if (append) {
        setRecipes(prev => [...prev, ...data.recipes])
      } else {
        setRecipes(data.recipes)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  // ── Backend search (debounced 400ms) ───────────────────────────────────────
  // Fuzzy cuisine map mirrors the backend
  const CUISINE_MAP: Record<string, string[]> = {
    "indian":         ["indian", "south asian"],
    "chinese":        ["chinese"],
    "mediterranean":  ["mediterranean", "greek", "italian", "turkish", "lebanese"],
    "american":       ["american"],
    "italian":        ["italian"],
    "mexican":        ["mexican"],
    "japanese":       ["japanese"],
    "thai":           ["thai"],
    "middle eastern": ["middle eastern", "arabic", "lebanese", "persian"],
  }

  const doSearch = useCallback(async (
    q: string,
    mealType: string,
    cuisine: string,
    dietary: string[]
  ) => {
    if (!q.trim()) { setSearchResults(null); setSearchTotal(0); return }
    setSearching(true)
    try {
      const data = await apiSearchRecipes(q, { limit: 100 })
      let filtered: BackendRecipe[] = data.recipes
      // Apply active filter chips on top of full-text results
      if (mealType !== "All")
        filtered = filtered.filter(r => r.meal_type === mealType)
      if (cuisine !== "All") {
        const terms = CUISINE_MAP[cuisine.toLowerCase()] || [cuisine.toLowerCase()]
        filtered = filtered.filter(r => {
          const rc = (r.cuisine ?? "").toLowerCase()
          return terms.some(t => rc.includes(t))
        })
      }
      if (dietary.length > 0) {
        // Normalize UI labels → DB tag variants (mirrors backend alias map)
        const DIETARY_ALIAS: Record<string, string[]> = {
          "gluten-free":  ["gluten free", "gluten-free"],
          "low-carb":     ["low carb", "low-carb"],
          "high-protein": ["high protein", "high-protein"],
          "dairy-free":   ["lactose free", "dairy free", "dairy-free"],
          "vegetarian":   ["vegetarian"],
          "vegan":        ["vegan"],
        }
        filtered = filtered.filter(r => {
          const recipeTags = (r.dietary_tags ?? []).map((t: string) => t.toLowerCase())
          return dietary.every(uiTag => {
            const aliases = DIETARY_ALIAS[uiTag.toLowerCase()] ?? [uiTag.toLowerCase()]
            return aliases.some(alias => recipeTags.includes(alias))
          })
        })
      }
      setSearchResults(filtered)
      setSearchTotal(filtered.length)
    } catch {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setSearchDebounce(searchQuery)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery])

  useEffect(() => {
    doSearch(searchDebounce, mealFilter, cuisineFilter, dietaryFilter)
  }, [searchDebounce, mealFilter, cuisineFilter, dietaryFilter, doSearch])

  // Re-fetch whenever user's health profile changes so backend re-applies ML filtering
  // (conditions, dietary preference, cuisine preference all affect recipe compliance scores)
  const userPreferenceKey    = user?.preference ?? ""
  const userConditionsKey    = user?.conditions?.slice().sort().join(",") ?? ""
  const userCuisineKey       = user?.cuisinePreference ?? ""

  useEffect(() => {
    setCurrentPage(1)
    setRecipes([])
    fetchRecipes(mealFilter, cuisineFilter, dietaryFilter, 1, false)
    fetchFavourites()
    localStorage.setItem("nutridine-recipes-visited", "true")
  }, [userPreferenceKey, userConditionsKey, userCuisineKey]) // eslint-disable-line

  const handleMealFilter = (mt: string) => {
    setMealFilter(mt)
    setSearchResults(null)
    setSearchQuery("")
    setSearchDebounce("")
    fetchRecipes(mt, cuisineFilter, dietaryFilter, 1, false)
  }

  const handleCuisineFilter = (c: string) => {
    setCuisineFilter(c)
    setSearchResults(null)
    setSearchQuery("")
    setSearchDebounce("")
    fetchRecipes(mealFilter, c, dietaryFilter, 1, false)
  }

  const handleDietaryFilter = (tag: string, active: boolean) => {
    const next = active ? dietaryFilter.filter(t => t !== tag) : [...dietaryFilter, tag]
    setDietaryFilter(next)
    setSearchResults(null)
    setSearchQuery("")
    setSearchDebounce("")
    fetchRecipes(mealFilter, cuisineFilter, next, 1, false)
  }

  const handleLoadMore = () => {
    if (currentPage < totalPages) {
      fetchRecipes(mealFilter, cuisineFilter, dietaryFilter, currentPage + 1, true)
    }
  }

  const handleRefresh = () => {
    setSearchQuery("")
    setSearchResults(null)
    setSearchDebounce("")
    fetchRecipes(mealFilter, cuisineFilter, dietaryFilter, 1, false)
  }

  const fetchFavourites = async () => {
    try {
      const data = await apiGetFavourites()
      setFavourites(new Set(data.favourites.map((r: BackendRecipe) => r.id)))
    } catch { /* ignore */ }
  }

  const toggleFavourite = async (e: React.MouseEvent, recipeId: string) => {
    e.stopPropagation()
    setFavLoading(recipeId)
    try {
      if (favourites.has(recipeId)) {
        await apiRemoveFavourite(recipeId)
        setFavourites(prev => { const s = new Set(prev); s.delete(recipeId); return s })
      } else {
        await apiAddFavourite(recipeId)
        setFavourites(prev => new Set(prev).add(recipeId))
      }
    } catch { /* ignore */ }
    finally { setFavLoading(null) }
  }

  // Backend already applies all filters — just read results directly
  const displayRecipes  = searchResults !== null ? searchResults : recipes
  const compliantCount  = displayRecipes.filter(r => r.is_compliant).length
  const isSearchMode    = searchResults !== null

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Personalized Recipes</h1>
          <p className="text-muted-foreground mt-1">
            {totalCount > 0
              ? <>Browsing <strong>{totalCount.toLocaleString()}</strong> recipes tailored to your health conditions</>
              : "Recipes tailored to your health conditions and preferences"
            }
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="gap-2 self-start" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      

      {/* Search */}
      <div className="relative max-w-2xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search across all 3000+ recipes by name, ingredient, cuisine..."
          className="pl-12 h-12 rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setSearchQuery(""); setSearchResults(null); setSearchDebounce("") }}
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {searching && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Meal type filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {MEAL_TYPES.map(t => (
          <button
            key={t}
            onClick={() => handleMealFilter(t)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              mealFilter === t
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Cuisine filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Cuisine</span>
        {CUISINES.map(c => (
          <button
            key={c}
            onClick={() => handleCuisineFilter(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              cuisineFilter === c
                ? "bg-amber-500 text-white border-amber-500"
                : "border-border text-muted-foreground hover:border-amber-400/60"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Dietary filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-16">Dietary</span>
        {DIETARY_TAGS.map(tag => {
          const active = dietaryFilter.includes(tag)
          return (
            <button
              key={tag}
              onClick={() => handleDietaryFilter(tag, active)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                active
                  ? "bg-green-600 text-white border-green-600"
                  : "border-border text-muted-foreground hover:border-green-500/60"
              }`}
            >
              {tag}
            </button>
          )
        })}
        {(cuisineFilter !== "All" || dietaryFilter.length > 0) && (
          <button
            onClick={() => {
              setCuisineFilter("All")
              setDietaryFilter([])
              fetchRecipes(mealFilter, "All", [], 1, false)
            }}
            className="px-3 py-1.5 rounded-full text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
          >
            × Clear filters
          </button>
        )}
      </div>

      {/* Compliance banner */}
      {user?.conditions && user.conditions.length > 0 && !loading && displayRecipes.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
          <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800 dark:text-green-300">
            {isSearchMode ? (
              <><strong>{compliantCount}</strong> of <strong>{searchTotal.toLocaleString()}</strong> matching recipes are safe &mdash; showing {displayRecipes.length} results for &ldquo;{searchDebounce}&rdquo;</>
            ) : (
              <><strong>{compliantTotal.toLocaleString()}</strong> of <strong>{totalCount.toLocaleString()}</strong> total recipes are fully safe for your conditions:&nbsp;
              <strong>{
                user.conditions.length <= 3
                  ? user.conditions.join(", ")
                  : `${user.conditions.slice(0, 3).join(", ")} and ${user.conditions.length - 3} more`
              }</strong> &mdash; showing {recipes.length} of {totalCount.toLocaleString()}</>
            )}
          </span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-medium">Failed to load recipes</p>
            <p className="text-sm">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="ml-auto">Retry</Button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card animate-pulse">
              <div className="h-2 bg-muted rounded-t-xl" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && displayRecipes.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <ChefHat className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{isSearchMode ? `No recipes found for "${searchDebounce}"` : "No recipes found"}</p>
          <Button variant="ghost" size="sm" className="mt-3"
            onClick={handleRefresh}>
            Clear filters
          </Button>
        </div>
      )}

      {/* Recipe grid */}
      {!loading && displayRecipes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayRecipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              isFavourite={favourites.has(recipe.id)}
              favLoading={favLoading === recipe.id}
              onFavourite={toggleFavourite}
              onClick={() => setSelectedRecipe(recipe)}
            />
          ))}
        </div>
      )}

      {/* Load More button */}
      {!loading && !isSearchMode && currentPage < totalPages && (
        <div className="flex flex-col items-center gap-2 pt-4">
          <p className="text-sm text-muted-foreground">
            Showing <strong>{recipes.length}</strong> of <strong>{totalCount.toLocaleString()}</strong> recipes
          </p>
          <Button
            variant="outline"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="gap-2 min-w-[200px]"
          >
            {loadingMore
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading more...</>
              : <><ChevronDown className="w-4 h-4" /> Load More Recipes</>
            }
          </Button>
        </div>
      )}

      {/* Already loaded all message */}
      {!loading && !isSearchMode && currentPage >= totalPages && totalCount > 0 && (
        <p className="text-center text-sm text-muted-foreground pt-2">
          All <strong>{totalCount.toLocaleString()}</strong> recipes loaded
        </p>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selectedRecipe} onOpenChange={o => !o && setSelectedRecipe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          {selectedRecipe && (
            <RecipeDetail
              recipe={selectedRecipe}
              isFavourite={favourites.has(selectedRecipe.id)}
              favLoading={favLoading === selectedRecipe.id}
              onFavourite={toggleFavourite}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ── Recipe Card ───────────────────────────────────────────────────────────────
function RecipeCard({ recipe, isFavourite, favLoading, onFavourite, onClick }: {
  recipe: BackendRecipe
  isFavourite: boolean
  favLoading: boolean
  onFavourite: (e: React.MouseEvent, id: string) => void
  onClick: () => void
}) {
  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 group overflow-hidden"
      onClick={onClick}
    >
      <div className={`h-2 w-full ${MEAL_COLOR[recipe.meal_type] ?? "bg-primary"}`} />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-base leading-tight group-hover:text-primary transition-colors flex-1">
            {recipe.name}
          </h3>
          <div className="flex items-center gap-1 shrink-0">
            {recipe.is_compliant
              ? <ShieldCheck className="w-4 h-4 text-green-500" />
              : <ShieldX className="w-4 h-4 text-red-400" />
            }
            <button
              onClick={e => onFavourite(e, recipe.id)}
              disabled={favLoading}
              className="p-1 hover:text-red-500 transition-colors"
            >
              {isFavourite
                ? <Heart className="w-4 h-4 fill-red-500 text-red-500" />
                : <HeartOff className="w-4 h-4 text-muted-foreground" />
              }
            </button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2">{recipe.description}</p>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{recipe.prep_time + recipe.cook_time}m</span>
          <span className="flex items-center gap-1"><Flame className="w-3 h-3 text-orange-500" />{recipe.nutrition_per_serving.calories} kcal</span>
          <span className="flex items-center gap-1"><ChefHat className="w-3 h-3" />{recipe.cuisine}</span>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>P: {recipe.nutrition_per_serving.protein}g</span>
          <span>C: {recipe.nutrition_per_serving.carbs}g</span>
          <span>F: {recipe.nutrition_per_serving.fat}g</span>
          <span>Fiber: {recipe.nutrition_per_serving.fiber}g</span>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">{recipe.meal_type}</Badge>
          <Badge className={`text-xs ${DIFFICULTY_COLOR[recipe.difficulty]}`}>{recipe.difficulty}</Badge>
          {(recipe.dietary_tags ?? []).slice(0, 2).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
          ))}
        </div>

        {(recipe.condition_notes ?? []).length > 0 && (
          <div className={`flex items-start gap-1.5 p-2 rounded-md text-xs ${
            recipe.is_compliant
              ? "bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300"
              : "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
          }`}>
            <Leaf className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <p className="line-clamp-2">{recipe.condition_notes[0].reason}</p>
          </div>
        )}

        <Button variant="ghost" className="w-full group-hover:bg-primary/10 text-sm h-8 gap-1">
          View Recipe <ChevronRight className="w-4 h-4" />
        </Button>
      </CardContent>
    </Card>
  )
}


// ── Recipe Detail ─────────────────────────────────────────────────────────────
function RecipeDetail({ recipe, isFavourite, favLoading, onFavourite }: {
  recipe: BackendRecipe
  isFavourite: boolean
  favLoading: boolean
  onFavourite: (e: React.MouseEvent, id: string) => void
}) {
  const total = recipe.nutrition_per_serving.protein + recipe.nutrition_per_serving.carbs + recipe.nutrition_per_serving.fat
  const safeTotal = total || 1  // guard against division by zero
  const pPct = Math.round(recipe.nutrition_per_serving.protein / safeTotal * 100)
  const cPct = Math.round(recipe.nutrition_per_serving.carbs   / safeTotal * 100)
  const fPct = Math.round(recipe.nutrition_per_serving.fat     / safeTotal * 100)

  return (
    <div className="space-y-5">
      <DialogHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <DialogTitle className="text-xl">{recipe.name}</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">{recipe.description}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary">{recipe.meal_type}</Badge>
              <Badge variant="outline">{recipe.cuisine}</Badge>
              <Badge className={DIFFICULTY_COLOR[recipe.difficulty]}>{recipe.difficulty}</Badge>
            </div>
          </div>
          <button
            onClick={e => onFavourite(e, recipe.id)}
            disabled={favLoading}
            className="p-2 hover:text-red-500 transition-colors shrink-0"
          >
            {isFavourite
              ? <Heart className="w-5 h-5 fill-red-500 text-red-500" />
              : <HeartOff className="w-5 h-5 text-muted-foreground" />
            }
          </button>
        </div>
      </DialogHeader>

      {/* Meta row */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Time", value: `${recipe.prep_time + recipe.cook_time} min` },
          { label: "Calories",   value: `${recipe.nutrition_per_serving.calories} kcal` },
          { label: "Servings",   value: `${recipe.servings}` },
        ].map(m => (
          <div key={m.label} className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-xs text-muted-foreground">{m.label}</div>
            <div className="text-sm font-semibold mt-0.5">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Condition safety */}
      {(recipe.condition_notes ?? []).length > 0 && (
        <div className={`rounded-lg border p-4 space-y-2 ${
          recipe.is_compliant
            ? "border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/20"
            : "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20"
        }`}>
          <div className={`flex items-center gap-2 font-medium text-sm ${
            recipe.is_compliant ? "text-green-800 dark:text-green-300" : "text-red-800 dark:text-red-300"
          }`}>
            {recipe.is_compliant
              ? <><ShieldCheck className="w-4 h-4" /> Safe for your conditions</>
              : <><ShieldX className="w-4 h-4" /> Check condition notes</>
            }
          </div>
          {(recipe.condition_notes ?? []).map((note, i) => (
            <div key={i} className={`flex gap-2 text-xs ${
              note.safe ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
            }`}>
              <span className="shrink-0">{note.safe ? "✓" : "✗"}</span>
              <span><strong>{note.condition}:</strong> {note.reason}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── ML ANALYSIS PANEL ── */}
      <MLRecommendPanel recipeId={recipe.id} />

      {/* Nutrition breakdown */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm">
          <Flame className="w-4 h-4 text-orange-500" /> Nutrition per serving
        </h3>
        <div className="flex gap-1 h-3 rounded-full overflow-hidden mb-2">
          <div className="bg-blue-500" style={{ width: `${pPct}%` }} />
          <div className="bg-amber-400" style={{ width: `${cPct}%` }} />
          <div className="bg-red-400"  style={{ width: `${fPct}%` }} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs mb-2">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" />Protein {recipe.nutrition_per_serving.protein}g</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-400" />Carbs {recipe.nutrition_per_serving.carbs}g</div>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-400" />Fat {recipe.nutrition_per_serving.fat}g</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <span>Fiber: {recipe.nutrition_per_serving.fiber}g</span>
          <span>Sodium: {recipe.nutrition_per_serving.sodium}mg</span>
          <span>Serves: {recipe.servings}</span>
        </div>
      </div>

      {/* Ingredients */}
      <div>
        <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-500" /> Ingredients
        </h3>
        <div className="space-y-1.5">
          {(recipe.ingredients ?? []).map((ing, i) => (
            <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border text-sm hover:bg-muted/30 transition-colors">
              <span className="text-muted-foreground">{ing.name}</span>
              <span className="font-medium">{ing.amount} {ing.unit}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div>
        <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
          <ChefHat className="w-4 h-4" /> Preparation steps
        </h3>
        <ol className="space-y-3">
          {(recipe.steps ?? []).map((step, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-xs">
                {i + 1}
              </span>
              <span className="text-muted-foreground pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Substitution Engine */}
      <SubstitutionEngine
        ingredients={recipe.ingredients ?? []}
        recipeName={recipe.name}
      />

      {/* Dietary tags */}
      {(recipe.dietary_tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          {(recipe.dietary_tags ?? []).map(tag => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}