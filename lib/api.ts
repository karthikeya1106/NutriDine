// Use relative URL so Next.js proxy rewrites handle routing to the backend
// This avoids IPv6/CORS issues on Windows (localhost resolves to ::1 but uvicorn binds 127.0.0.1)
const BACKEND = ""

const TOKEN_KEY = "nutridine-token"

export function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  requiresAuth = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (requiresAuth) {
    const token = getToken()
    if (!token) throw new Error("Not authenticated")
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BACKEND}${path}`, { ...options, headers })

  // 401 = token expired or revoked — clear session and redirect to login
  if (res.status === 401) {
    clearToken()
    if (typeof window !== "undefined") {
      window.location.href = "/"
    }
    throw new Error("Session expired. Please log in again.")
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Unknown error" }))
    throw new Error(error.detail ?? `API error ${res.status}`)
  }

  return res.json()
}

export interface BackendUser {
  id: number
  name: string
  email: string
  age: number
  height: number
  weight: number
  gender: string
  goal: string
  targetWeight: number
  conditions: string[]
  preference: string
  cuisinePreference: string
  likes: string[]
  dislikes: string[]
}

export async function apiSignup(data: {
  name: string; email: string; password: string
  age: number; height: number; weight: number; gender: string
  goal: string; target_weight: number; conditions: string[]
  preference: string; cuisine_preference?: string; likes: string[]; dislikes: string[]
}): Promise<{ token: string; user: BackendUser }> {
  return apiFetch<{ token: string; user: BackendUser }>(
    "/api/auth/signup",
    { method: "POST", body: JSON.stringify(data) },
    false
  )
}

export async function apiLogin(
  email: string,
  password: string
): Promise<{ token: string; user: BackendUser }> {
  return apiFetch<{ token: string; user: BackendUser }>(
    "/api/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    false
  )
}

export async function apiLogout(): Promise<void> {
  await apiFetch("/api/auth/logout", { method: "POST" })
  clearToken()
}

export async function apiGetProfile(): Promise<BackendUser> {
  return apiFetch<BackendUser>("/api/user/profile")
}

export async function apiUpdateProfile(
  updates: Partial<BackendUser & { cuisinePreference?: string; targetWeight?: number }>
): Promise<{ success: boolean }> {
  const { cuisinePreference, targetWeight, ...rest } = updates as any
  const payload: any = { ...rest }
  // Convert camelCase → snake_case for FastAPI
  if (cuisinePreference !== undefined) payload.cuisine_preference = cuisinePreference
  if (targetWeight !== undefined) payload.target_weight = targetWeight
  return apiFetch("/api/user/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  })
}

export async function apiGetRecipes(params?: {
  meal_type?: string
  max_time?: number
  page?: number
  limit?: number
  all_cuisines?: boolean
  cuisine_filter?: string
  dietary_tags?: string[]    // AND logic: all must be present
}): Promise<{ total: number; compliant_count: number; total_pages: number; page: number; recipes: any[] }> {
  const qs = new URLSearchParams()
  if (params?.meal_type)                  qs.set("meal_type",     params.meal_type)
  if (params?.max_time)                   qs.set("max_time",      String(params.max_time))
  if (params?.page)                       qs.set("page",          String(params.page))
  if (params?.limit)                      qs.set("limit",         String(params.limit))
  if (params?.all_cuisines)               qs.set("all_cuisines",  "true")
  if (params?.cuisine_filter && params.cuisine_filter !== "All")
                                          qs.set("cuisine_filter", params.cuisine_filter)
  if (params?.dietary_tags?.length)       qs.set("dietary_tags",  params.dietary_tags.join(","))
  return apiFetch(`/api/recipes?${qs.toString()}`)
}

export async function apiSearchRecipes(query: string, params?: {
  page?: number
  limit?: number
}): Promise<{ total: number; total_pages: number; page: number; recipes: any[] }> {
  const qs = new URLSearchParams()
  if (params?.page)  qs.set("page",  String(params.page))
  if (params?.limit) qs.set("limit", String(params.limit))
  return apiFetch(`/api/recipes/search/${encodeURIComponent(query)}?${qs.toString()}`)
}

export async function apiGenerateMealPlan(weeks?: number): Promise<{
  success: boolean
  plan_type: string
  total_weeks: number
  total_days: number
  weeks: { week: number; label: string; days: any[]; avg_daily_calories: number }[]
  days: any[]
  summary: {
    avg_daily_calories: number
    avg_daily_protein: number
    total_meals: number
    compliant_days: number
    total_days: number
  }
}> {
  const qs = weeks != null ? `?weeks=${weeks}` : ""
  return apiFetch(`/api/mealplan/generate${qs}`)
}

export async function apiSaveMealPlan(
  planData: object
): Promise<{ success: boolean; plan_id: number }> {
  return apiFetch("/api/mealplan/save", {
    method: "POST",
    body: JSON.stringify(planData),
  })
}

export async function apiGetMealPlanHistory(): Promise<{
  plans: { id: number; created_at: string }[]
}> {
  return apiFetch("/api/mealplan/history")
}

export async function apiLoadSavedMealPlan(planId: number): Promise<{
  id: number
  created_at: string
  plan_data: { weeks: any[]; days: any[] }
}> {
  return apiFetch(`/api/mealplan/${planId}`)
}

export async function apiAddFavourite(recipeId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/favourites/${recipeId}`, { method: "POST" })
}

export async function apiRemoveFavourite(recipeId: string): Promise<{ success: boolean }> {
  return apiFetch(`/api/favourites/${recipeId}`, { method: "DELETE" })
}

export async function apiGetFavourites(): Promise<{ favourites: any[] }> {
  return apiFetch("/api/favourites")
}

export async function apiGetDashboardStats(): Promise<{
  bmi: number
  bmi_category: string
  current_weight: number
  target_weight: number
  goal: string
  daily_calorie_target: number
  conditions_count: number
  conditions: string[]
  compliant_recipes_count: number
}> {
  return apiFetch("/api/dashboard/stats")
}

export async function apiGetNutrition(): Promise<{
  ingredients: Record<string, object>
  condition_guidelines: Record<string, object>
}> {
  return apiFetch("/api/nutrition", {}, false)
}

export async function apiGetConditionGuidelines(condition: string): Promise<object> {
  return apiFetch(`/api/nutrition/condition/${encodeURIComponent(condition)}`, {}, false)
}

export async function apiSearchNutrition(q: string, limit = 30): Promise<{
  query: string
  total: number
  results: Record<string, object>
}> {
  return apiFetch(`/api/nutrition/search?q=${encodeURIComponent(q)}&limit=${limit}`, {}, false)
}

export async function apiGetCuisineIngredients(): Promise<{
  cuisine_preference: string
  buckets: Record<string, {
    name: string
    nutrition: Record<string, number | boolean | string> | null
    found_in_db: boolean
  }[]>
  total_ingredients: number
}> {
  return apiFetch("/api/nutrition/cuisine-ingredients")
}

// ── Food Log ─────────────────────────────────────────────────────────────────

export interface FoodLogEntry {
  id: number
  recipe_id: string | null
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  meal_type: string
  logged_at: string
}

export async function apiGetFoodLog(date?: string): Promise<{
  date: string
  entries: FoodLogEntry[]
  totals: { calories: number; protein: number; carbs: number; fat: number }
}> {
  const qs = date ? `?date=${date}` : ""
  return apiFetch(`/api/food-log${qs}`)
}

export async function apiAddFoodLog(entry: {
  name: string
  calories: number
  protein?: number
  carbs?: number
  fat?: number
  meal_type?: string
  recipe_id?: string
  logged_at?: string
}): Promise<{ success: boolean; id: number; logged_at: string }> {
  return apiFetch("/api/food-log", {
    method: "POST",
    body: JSON.stringify(entry),
  })
}

export async function apiDeleteFoodLog(id: number): Promise<{ success: boolean }> {
  return apiFetch(`/api/food-log/${id}`, { method: "DELETE" })
}

export async function apiFoodLogHistory(days = 7): Promise<{
  history: {
    logged_at: string
    calories: number
    protein: number
    carbs: number
    fat: number
    meals: number
  }[]
}> {
  return apiFetch(`/api/food-log/history?days=${days}`)
}