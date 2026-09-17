export interface Ingredient {
  name: string
  amount: string
  unit: string
  substitutes?: string[]
}

export interface NutritionInfo {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
}

export interface Recipe {
  id: string
  name: string
  description: string
  prepTime: number
  cookTime: number
  servings: number
  difficulty: "Easy" | "Medium" | "Hard"
  cuisine: string
  mealType: "Breakfast" | "Lunch" | "Dinner" | "Snack"
  ingredients: Ingredient[]
  steps: string[]
  nutrition: NutritionInfo
  tags: string[]
  conditionBenefits: {
    condition: string
    explanation: string
  }[]
  isCompliant: boolean
  safetyNotes?: string
}

export interface MealPlanDay {
  day: string
  date?: string
  breakfast: Recipe
  lunch: Recipe
  dinner: Recipe
  snack?: Recipe
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
}

export interface WeeklyMealPlan {
  id: string
  generatedAt: string
  targetCalories: number
  days: MealPlanDay[]
  shoppingList: ShoppingItem[]
  weeklyNutritionSummary: NutritionInfo
}

export interface ShoppingItem {
  ingredient: string
  totalAmount: string
  unit: string
  category: "Vegetables" | "Fruits" | "Grains" | "Protein" | "Dairy" | "Spices" | "Other"
  sourcingLinks?: {
    platform: string
    url: string
  }[]
}

export interface SubstitutionResult {
  originalIngredient: string
  reason: string
  substitutes: {
    name: string
    amount: string
    unit: string
    notes: string
  }[]
}

export interface RecommendRequest {
  user: {
    age: number
    weight: number
    height: number
    gender: string
    goal: string
    targetWeight: number
    conditions: string[]
    preference: string
    likes: string[]
    dislikes: string[]
  }
  requestType: "recipes" | "mealplan" | "substitution" | "explanation"
  filters?: {
    mealType?: string
    maxPrepTime?: number
    count?: number
  }
  ingredientToSubstitute?: string
  recipeContext?: string
}

export interface RecommendResponse {
  success: boolean
  requestType: string
  recipes?: Recipe[]
  mealPlan?: WeeklyMealPlan
  substitutions?: SubstitutionResult
  error?: string
}