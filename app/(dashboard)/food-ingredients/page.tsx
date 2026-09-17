"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Search, ShieldCheck, ShieldX,
  Flame, Beef, Wheat, Droplets, Zap, RefreshCw,
  ChevronDown, X, AlertCircle, Leaf, ShoppingCart,
  ExternalLink, MapPin, ArrowUpDown, SlidersHorizontal,
} from "lucide-react"
import { useUser } from "@/contexts/user-context"
import { apiGetCuisineIngredients, apiSearchNutrition, getToken } from "@/lib/api"

// ── Types ─────────────────────────────────────────────────────────────────────
interface NutritionData {
  calories_kcal: number
  protein_g: number
  carbs_g: number
  fat_g: number
  fiber_g: number
  sodium_mg: number
  glycemic_index: number
  gluten_free: boolean
  dairy_free: boolean
  diabetes_rating: string
  notes: string
}
interface IngredientItem {
  name: string
  nutrition: NutritionData | null
  found_in_db: boolean
}
interface BucketData { [category: string]: IngredientItem[] }

// ── Constants ─────────────────────────────────────────────────────────────────
const PLATFORMS = [
  { name: "BigBasket",        url: "https://www.bigbasket.com/ps/?q=",        color: "bg-green-600" },
  { name: "Blinkit",          url: "https://blinkit.com/s/?q=",               color: "bg-yellow-500" },
  { name: "Swiggy Instamart", url: "https://www.swiggy.com/instamart?query=", color: "bg-orange-500" },
  { name: "Zepto",            url: "https://www.zeptonow.com/search?query=",  color: "bg-purple-600" },
]
const CONDITION_KEYWORDS: Record<string, string[]> = {
  // Metabolic
  "Type 2 Diabetes":           ["sugar", "white rice", "potato", "honey", "maida", "jaggery", "syrup", "refined flour", "semolina", "glucose", "corn syrup"],
  "Type 1 Diabetes":           ["sugar", "white rice", "potato", "honey", "maida", "jaggery", "syrup", "refined flour", "glucose"],
  "Obesity":                   ["sugar", "honey", "butter", "cream", "jaggery", "fried", "maida", "lard", "shortening"],
  "Metabolic Syndrome":        ["sugar", "white rice", "maida", "refined flour", "fructose", "corn syrup", "lard"],
  "Hyperuricemia (High Uric Acid)": ["red meat", "liver", "kidney", "sardine", "anchovy", "shellfish", "alcohol", "beer", "fructose"],
  // Cardiovascular
  "Hypertension (High Blood Pressure)": ["salt", "soy sauce", "pickle", "bacon", "ham", "sodium", "soda", "brine"],
  "Coronary Heart Disease":    ["butter", "ghee", "cream", "bacon", "lard", "coconut oil", "palm oil", "trans fat"],
  "High Cholesterol":          ["butter", "ghee", "cream", "bacon", "lard", "egg yolk", "palm oil", "coconut oil"],
  "Heart Failure":             ["salt", "sodium", "pickle", "soy sauce", "processed meat", "canned", "bacon"],
  // Digestive
  "Irritable Bowel Syndrome (IBS)": ["onion", "garlic", "wheat", "milk", "cream", "apple", "pear", "mango", "honey", "mushroom"],
  "Crohn's Disease":           ["alcohol", "spicy", "fried", "raw vegetables", "seeds", "nuts", "corn", "popcorn"],
  "Ulcerative Colitis":        ["alcohol", "spicy", "fried", "dairy", "raw vegetables", "seeds", "nuts"],
  "Coeliac Disease":           ["wheat", "flour", "pasta", "bread", "semolina", "barley", "rye", "malt"],
  "GERD (Acid Reflux)":        ["tomato", "citrus", "chocolate", "coffee", "alcohol", "spicy", "fried", "mint", "onion", "garlic"],
  "Gallbladder Disease":       ["fried", "butter", "cream", "ghee", "lard", "egg", "pork", "coconut oil"],
  "Chronic Pancreatitis":      ["alcohol", "fried", "butter", "cream", "ghee", "lard", "fatty meat"],
  "Non-Alcoholic Fatty Liver Disease (NAFLD)": ["sugar", "fructose", "alcohol", "fried", "maida", "refined flour", "corn syrup"],
  "Diverticular Disease":      ["seeds", "nuts", "popcorn", "corn", "refined flour", "white rice", "maida"],
  "Liver Disease (Cirrhosis)": ["alcohol", "salt", "sodium", "processed meat", "raw shellfish", "high protein"],
  "Lactose Intolerance":       ["milk", "cream", "butter", "yogurt", "cheese", "paneer", "ghee", "whey", "dairy", "ice cream"],
  // Kidney
  "Chronic Kidney Disease (CKD)": ["salt", "sodium", "potassium", "phosphorus", "banana", "orange", "tomato", "potato", "dairy", "nuts", "seeds", "whole grain"],
  "Kidney Stones":             ["spinach", "nuts", "chocolate", "tea", "salt", "sodium", "animal protein", "red meat"],
  // Hormonal
  "PCOS":                      ["sugar", "white rice", "maida", "refined flour", "fried", "processed", "jaggery", "honey"],
  "Hypothyroidism":            ["soy", "tofu", "cabbage", "broccoli", "cauliflower", "kale", "spinach", "millet", "peanut"],
  "Hyperthyroidism":           ["iodine", "seaweed", "seafood", "dairy", "egg", "caffeine", "alcohol"],
  // Bone & Joint
  "Osteoporosis":              ["alcohol", "caffeine", "salt", "sodium", "high protein", "processed", "soda"],
  "Rheumatoid Arthritis":      ["red meat", "fried", "processed", "sugar", "alcohol", "refined flour", "dairy"],
  "Osteoarthritis":            ["sugar", "fried", "processed", "refined flour", "alcohol", "red meat"],
  "Gout":                      ["red meat", "liver", "kidney", "sardine", "anchovy", "shellfish", "alcohol", "beer", "fructose", "sugar"],
  // Blood
  "Iron Deficiency Anaemia":   ["coffee", "tea", "calcium", "dairy", "phytate", "whole grain", "spinach"],
  "Vitamin B12 Deficiency Anaemia": ["plant-based", "vegan"],
  // Neurological
  "Migraine":                  ["chocolate", "caffeine", "alcohol", "cheese", "processed meat", "MSG", "soy sauce", "vinegar"],
  "Epilepsy":                  ["alcohol", "caffeine", "processed", "artificial sweetener", "aspartame"],
  "Alzheimer's Disease":       ["trans fat", "saturated fat", "sugar", "processed", "fried", "refined flour", "alcohol"],
  // Mental Health
  "Depression":                ["alcohol", "sugar", "fried", "processed", "refined flour", "caffeine"],
  "Anxiety Disorders":         ["caffeine", "alcohol", "sugar", "energy drink", "processed"],
  // Respiratory
  "Asthma":                    ["sulfite", "wine", "dried fruit", "shrimp", "processed meat", "preservative", "artificial color"],
  // Skin
  "Psoriasis":                 ["alcohol", "red meat", "dairy", "gluten", "wheat", "processed", "fried", "sugar"],
  "Eczema":                    ["dairy", "milk", "egg", "gluten", "wheat", "soy", "nuts", "processed", "artificial"],
  // Women's Health
  "Menopause":                 ["alcohol", "caffeine", "spicy", "sugar", "processed", "salt", "sodium"],
  "Endometriosis":             ["red meat", "trans fat", "fried", "processed", "alcohol", "caffeine", "dairy"],
}
const CATEGORY_COLOR: Record<string, string> = {
  "Grains & Flour": "#FBBF24", "Grains & Bread": "#FBBF24", "Grains": "#FBBF24", "Grains & Noodles": "#FBBF24",
  "Lentils & Legumes": "#22C55E", "Legumes": "#22C55E",
  "Vegetables": "#10B981",
  "Spices": "#F87171", "Spices & Aromatics": "#F87171",
  "Herbs & Spices": "#84CC16",
  "Dairy & Alternatives": "#38BDF8", "Dairy & Alt": "#38BDF8", "Dairy": "#38BDF8", "Dairy Alternatives": "#38BDF8",
  "Oils & Fats": "#EAB308", "Oils": "#EAB308",
  "Protein": "#FB7185",
  "Fruits": "#EC4899",
  "Nuts & Seeds": "#FB923C",
  "Sweeteners": "#A78BFA",
  "Sauces & Condiments": "#2DD4BF",
}
function getCatColor(cat: string) { return CATEGORY_COLOR[cat] ?? "#94A3B8" }

function getSafetyInfo(name: string, conditions: string[]) {
  if (!conditions.length) return { safe: true, reasons: [] as string[] }
  const lower = name.toLowerCase()
  const reasons: string[] = []
  for (const c of conditions) {
    if ((CONDITION_KEYWORDS[c] ?? []).some((kw) => lower.includes(kw))) reasons.push(c)
  }
  return { safe: reasons.length === 0, reasons }
}

function cleanName(raw: string) {
  const first = raw.split(",")[0].trim()
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function giLabel(gi: number) {
  if (gi === 0) return { text: "GI N/A", cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" }
  if (gi < 55)  return { text: "Low GI",  cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" }
  if (gi < 70)  return { text: "Mid GI",  cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" }
  return             { text: "High GI", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" }
}

// ── Macro mini-bar ─────────────────────────────────────────────────────────────
function MacroBar({ p, c, f }: { p: number; c: number; f: number }) {
  const total = p + c + f || 1
  return (
    <div className="flex h-1 rounded-full overflow-hidden w-14 bg-muted">
      <div style={{ width: `${(p / total) * 100}%`, background: "#3B82F6" }} />
      <div style={{ width: `${(c / total) * 100}%`, background: "#FBBF24" }} />
      <div style={{ width: `${(f / total) * 100}%`, background: "#F97316" }} />
    </div>
  )
}

// ── Expandable Ingredient Row ─────────────────────────────────────────────────
function IngredientRow({ item, conditions }: { item: IngredientItem; conditions: string[] }) {
  const [open, setOpen] = useState(false)
  const n = item.nutrition
  const name = cleanName(item.name)
  const safety = getSafetyInfo(item.name, conditions)
  const gi = n ? giLabel(n.glycemic_index) : null

  return (
    <div className={`border-b last:border-b-0 transition-colors ${
      open ? "bg-muted/40 dark:bg-muted/20" : "hover:bg-muted/20"
    }`}>
      {/* Row header — always visible */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        {/* Safety dot */}
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${
            conditions.length === 0
              ? "bg-slate-300 dark:bg-slate-600"
              : safety.safe
              ? "bg-green-500"
              : "bg-red-400"
          }`}
          title={
            conditions.length === 0
              ? "Add health conditions in your profile to see safety indicators"
              : safety.safe
              ? "Safe for your health conditions"
              : `Caution for: ${safety.reasons.join(", ")}`
          }
        />

        {/* Name */}
        <span className="flex-1 text-sm font-medium capitalize truncate">{name}</span>

        {/* Calories */}
        {n && (
          <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap hidden sm:block">
            {n.calories_kcal} kcal
          </span>
        )}

        {/* Macro bar */}
        {n && <MacroBar p={n.protein_g} c={n.carbs_g} f={n.fat_g} />}

        {/* GI badge */}
        {gi && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap hidden md:block ${gi.cls}`}>
            {gi.text}
          </span>
        )}

        {/* Dietary tags */}
        <span className="hidden sm:flex items-center gap-1">
          {n?.gluten_free && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">GF</span>
          )}
          {n?.dairy_free && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">DF</span>
          )}
        </span>

        {/* Expand chevron */}
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">
          {/* Safety banner */}
          {!safety.safe && safety.reasons.length > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 text-xs text-red-700 dark:text-red-400">
              <ShieldX className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Caution for: <strong>{safety.reasons.join(", ")}</strong></span>
            </div>
          )}
          {safety.safe && conditions.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40 text-xs text-green-700 dark:text-green-400">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Safe for your conditions</span>
            </div>
          )}

          {n ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Left: nutrition grid */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                  Nutrition per 100 g
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Calories", value: n.calories_kcal, unit: "kcal", icon: <Flame className="w-3 h-3" />, color: "text-orange-500" },
                    { label: "Protein",  value: n.protein_g,    unit: "g",    icon: <Beef className="w-3 h-3" />,  color: "text-blue-500" },
                    { label: "Carbs",    value: n.carbs_g,      unit: "g",    icon: <Wheat className="w-3 h-3" />, color: "text-amber-500" },
                    { label: "Fat",      value: n.fat_g,        unit: "g",    icon: <Droplets className="w-3 h-3" />, color: "text-rose-500" },
                    { label: "Fiber",    value: n.fiber_g,      unit: "g",    icon: <Leaf className="w-3 h-3" />,  color: "text-green-500" },
                    { label: "Sodium",   value: n.sodium_mg ?? 0, unit: "mg", icon: <SlidersHorizontal className="w-3 h-3" />, color: "text-cyan-500" },
                    { label: "GI",       value: n.glycemic_index === 0 ? "N/A" : n.glycemic_index, unit: "", icon: <Zap className="w-3 h-3" />, color: "text-purple-500" },
                  ].map((m) => (
                    <div key={m.label} className="bg-muted/60 rounded-lg p-2 text-center">
                      <div className={`flex justify-center mb-0.5 ${m.color}`}>{m.icon}</div>
                      <div className="text-xs font-bold leading-none">
                        {m.value}
                        <span className="text-[9px] font-normal text-muted-foreground ml-0.5">{m.unit}</span>
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {n.gluten_free && <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300">Gluten Free</Badge>}
                  {n.dairy_free  && <Badge variant="outline" className="text-[10px] text-sky-700 border-sky-300">Dairy Free</Badge>}
                  <Badge variant="outline" className={`text-[10px] capitalize ${
                    n.diabetes_rating === "excellent" ? "text-green-700 border-green-300"
                    : n.diabetes_rating === "good"    ? "text-blue-700 border-blue-300"
                    : n.diabetes_rating === "moderate" ? "text-amber-700 border-amber-300"
                    : "text-red-700 border-red-300"
                  }`}>
                    Diabetes: {n.diabetes_rating}
                  </Badge>
                </div>
                {n.notes && <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{n.notes}</p>}
              </div>

              {/* Right: buy buttons */}
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1">
                  <ShoppingCart className="w-3 h-3" /> Order Online
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PLATFORMS.map((p) => (
                    <a
                      key={p.name}
                      href={`${p.url}${encodeURIComponent(name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg
                        text-white text-xs font-medium ${p.color}
                        hover:opacity-90 hover:scale-105 active:scale-95
                        transition-all duration-150 shadow-sm`}
                    >
                      {p.name} <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No nutrition data available for this ingredient.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FoodIngredientsPage() {
  const { user } = useUser()

  const [buckets, setBuckets]           = useState<BucketData>({})
  const [cuisineLabel, setCuisineLabel] = useState("International")
  const [totalCount, setTotalCount]     = useState(0)
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState("")

  const [searchQuery, setSearchQuery]     = useState("")
  const [searchResults, setSearchResults] = useState<[string, Record<string, number | boolean | string>][]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [isSearchMode, setIsSearchMode]   = useState(false)

  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [filterGF, setFilterGF]   = useState(false)
  const [filterDF, setFilterDF]   = useState(false)
  const [sortBy, setSortBy]       = useState<"name" | "calories" | "safety">("name")



  // Load cuisine ingredients
  useEffect(() => {
    if (!getToken()) { setLoading(false); setError("Please log in to view ingredients."); return }
    let cancelled = false
    const load = async () => {
      setLoading(true); setError("")
      try {
        const data = await apiGetCuisineIngredients()
        if (cancelled) return
        setBuckets(data.buckets as BucketData)
        setCuisineLabel(data.cuisine_preference)
        setTotalCount(data.total_ingredients)
        const cats = Object.keys(data.buckets)
        if (cats.length) setActiveCategory(cats[0])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load ingredients")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [user?.cuisinePreference])

  // Search (debounced)
  useEffect(() => {
    if (!searchQuery.trim()) { setIsSearchMode(false); setSearchResults([]); return }
    setIsSearchMode(true)
    const t = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await apiSearchNutrition(searchQuery.trim(), 40)
        setSearchResults(Object.entries(data.results) as [string, Record<string, number | boolean | string>][])
      } catch { setSearchResults([]) }
      finally { setSearchLoading(false) }
    }, 350)
    return () => clearTimeout(t)
  }, [searchQuery])

  const conditions = user?.conditions ?? []
  const categories = Object.keys(buckets)
  const displayItems = (() => {
    let items = activeCategory ? (buckets[activeCategory] ?? []) : []
    if (filterGF) items = items.filter(i => i.nutrition?.gluten_free)
    if (filterDF) items = items.filter(i => i.nutrition?.dairy_free)
    if (sortBy === "calories") items = [...items].sort((a, b) => (a.nutrition?.calories_kcal ?? 0) - (b.nutrition?.calories_kcal ?? 0))
    else if (sortBy === "safety") items = [...items].sort((a, b) => {
      const sa = getSafetyInfo(a.name, conditions).safe ? 0 : 1
      const sb = getSafetyInfo(b.name, conditions).safe ? 0 : 1
      return sa - sb
    })
    else items = [...items].sort((a, b) => cleanName(a.name).localeCompare(cleanName(b.name)))
    return items
  })()

  return (
    <div className="p-6 lg:p-8 space-y-5 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Food &amp; Ingredients</h1>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            <span className="font-medium text-primary">{cuisineLabel}</span>
            <span>·</span>
            <span>{totalCount}+ ingredients</span>
            {conditions.length > 0 && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                  <ShieldCheck className="w-3 h-3" /> Filtered for {conditions.length} condition{conditions.length > 1 ? "s" : ""}
                </span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          id="ingredient-search"
          placeholder="Search any ingredient — e.g. paneer, oats, quinoa..."
          className="pl-10 pr-9 h-10 text-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 text-red-700 dark:text-red-400">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm flex-1">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => {
            setError("")
            const controller = { cancelled: false }
            ;(async () => {
              setLoading(true)
              try {
                const data = await apiGetCuisineIngredients()
                if (controller.cancelled) return
                setBuckets(data.buckets as BucketData)
                setCuisineLabel(data.cuisine_preference)
                setTotalCount(data.total_ingredients)
              } catch (e) {
                if (!controller.cancelled) setError(e instanceof Error ? e.message : "Failed to load ingredients")
              } finally {
                if (!controller.cancelled) setLoading(false)
              }
            })()
          }}>
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Retry
          </Button>
        </div>
      )}

      {/* Search mode */}
      {isSearchMode ? (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Search header */}
          <div className="px-4 py-3 bg-muted/40 border-b flex items-center gap-2 text-sm text-muted-foreground">
            <Search className="w-3.5 h-3.5" />
            {searchLoading
              ? "Searching…"
              : `${searchResults.length} result${searchResults.length !== 1 ? "s" : ""} for "${searchQuery}"`}
          </div>

          {searchLoading ? (
            <div className="divide-y">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-12 bg-muted/30 animate-pulse" />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No ingredients found for &ldquo;<strong>{searchQuery}</strong>&rdquo;</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {searchResults.map(([name, nutrition]) => (
                <IngredientRow
                  key={name}
                  item={{ name, nutrition: nutrition as unknown as NutritionData, found_in_db: true }}
                  conditions={conditions}
                />
              ))}
            </div>
          )}
        </div>

      ) : loading ? (
        /* Skeleton */
        <div className="rounded-xl border border-border overflow-hidden divide-y">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 flex items-center gap-3 px-4">
              <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
              <div className="h-3 bg-muted rounded animate-pulse flex-1 max-w-[200px]" />
              <div className="h-3 bg-muted rounded animate-pulse w-16 ml-auto" />
            </div>
          ))}
        </div>

      ) : (
        <>
          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((cat) => {
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs
                    font-semibold border transition-all whitespace-nowrap
                    ${isActive
                      ? "bg-primary text-primary-foreground border-primary shadow"
                      : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: getCatColor(cat) }} />
                  {cat}
                  <span className={`text-[10px] font-bold px-1 rounded-full ${
                    isActive ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  }`}>
                    {buckets[cat]?.length ?? 0}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Filters + Sort bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterGF(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filterGF ? "bg-emerald-500 text-white border-emerald-500 shadow" : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}>
              <Leaf className="w-3 h-3" /> Gluten Free
            </button>
            <button
              onClick={() => setFilterDF(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filterDF ? "bg-sky-500 text-white border-sky-500 shadow" : "bg-card border-border text-muted-foreground hover:bg-muted"
              }`}>
              <Droplets className="w-3 h-3" /> Dairy Free
            </button>
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                onClick={() => setSortBy(s => s === "name" ? "calories" : s === "calories" ? "safety" : "name")}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Cycle sort order"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort:</span>
              </button>
              {(["name", "calories", "safety"] as const).map(s => (
                <button key={s} onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all capitalize ${
                    sortBy === s ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground hover:bg-muted"
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          {/* Ingredient list */}
          {activeCategory && (
            <div className="rounded-xl border border-border overflow-hidden">
              {/* List header */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: getCatColor(activeCategory) }} />
                <span className="font-semibold text-sm">{activeCategory}</span>
                <span className="text-xs text-muted-foreground">
                  {displayItems.length} ingredient{displayItems.length !== 1 ? "s" : ""}{(filterGF || filterDF) ? " (filtered)" : ""} · click to expand
                </span>
                <div className="ml-auto hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground">
                  {/* Safety dot legend */}
                  {conditions.length > 0 ? (
                    <>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                        <span>Safe</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <span>Caution</span>
                      </span>
                      <span className="w-px h-3 bg-border" />
                    </>
                  ) : (
                    <>
                      <span className="flex items-center gap-1 italic opacity-70">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span>No conditions set</span>
                      </span>
                      <span className="w-px h-3 bg-border" />
                    </>
                  )}
                  {/* Macro bar legend */}
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Protein
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" /> Carbs
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400" /> Fat
                  </span>
                </div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-border">
                {displayItems.map((item) => (
                  <IngredientRow key={item.name} item={item} conditions={conditions} />
                ))}
              </div>
            </div>
          )}

          {/* Quick shop banner */}
          <div className="rounded-xl border border-dashed border-border p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
              <ShoppingCart className="w-4 h-4 text-primary" />
              Quick Shop
            </div>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => (
                <a
                  key={p.name}
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium
                    ${p.color} hover:opacity-90 hover:scale-105 active:scale-95
                    transition-all duration-150 shadow-sm`}
                >
                  {p.name} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          </div>

          {/* ── Legend / Glossary card ──────────────────────────────────────── */}
          <div className="rounded-2xl border border-border bg-card p-6 space-y-6">

            {/* Title */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-wide text-foreground">How to read this page</span>
              <span className="flex-1 h-px bg-border ml-1" />
            </div>

            {/* Safety dot */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Safety Indicator</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { color: "bg-green-500", label: "Safe", desc: "This ingredient is safe for all your health conditions." },
                  { color: "bg-red-400",   label: "Caution", desc: "Ingredient may be unsuitable for one or more of your conditions." },
                  { color: "bg-slate-400", label: "Not set", desc: "No conditions configured — visit your Profile to personalise." },
                ].map(({ color, label, desc }) => (
                  <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                    <span className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${color}`} />
                    <div>
                      <p className="text-sm font-semibold leading-none mb-1">{label}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* GI */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GI — Glycaemic Index</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Measures how fast a food raises blood sugar. Lower is generally better for steady energy and diabetes management.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { badge: "Low GI",  cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",   range: "< 55",  note: "Slow digestion, steady energy" },
                  { badge: "Mid GI",  cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",   range: "55–69", note: "Moderate blood sugar rise" },
                  { badge: "High GI", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",           range: "≥ 70",  note: "Rapid blood sugar spike" },
                  { badge: "GI N/A",  cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",      range: "—",     note: "Data unavailable" },
                ].map(({ badge, cls, range, note }) => (
                  <div key={badge} className="flex flex-col gap-2 p-3 rounded-xl bg-muted/30">
                    <span className={`self-start px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{badge}</span>
                    <p className="text-base font-bold leading-none">{range}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* GF · DF · Macro bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

              {/* GF */}
              <div className="space-y-2">
                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  GF — Gluten Free
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No gluten present. Safe for people with coeliac disease or gluten sensitivity.
                </p>
              </div>

              {/* DF */}
              <div className="space-y-2">
                <span className="inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                  DF — Dairy Free
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  No dairy present. Safe for people with lactose intolerance or a dairy allergy.
                </p>
              </div>

              {/* Macro bar */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Macro Bar</p>
                <div className="flex h-3 rounded-full overflow-hidden w-full bg-muted">
                  <div className="w-1/3" style={{ background: "#3B82F6" }} />
                  <div className="w-1/3" style={{ background: "#FBBF24" }} />
                  <div className="w-1/3" style={{ background: "#F97316" }} />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#3B82F6" }} />Protein</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#FBBF24" }} />Carbs</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: "#F97316" }} />Fat</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Shows the proportion of each macro in 100 g of the ingredient.
                </p>
              </div>

            </div>
          </div>
        </>
      )}
    </div>
  )
}