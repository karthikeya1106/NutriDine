/**
 * Shared calorie & BMI calculation utilities
 * Used by dashboard, food-log, and any other page needing consistent numbers.
 */

export interface UserMetrics {
  weight: number   // kg
  height: number   // cm
  age: number
  gender: string
  goal?: string
}

/**
 * Mifflin-St Jeor BMR with a moderate activity factor (1.4).
 * Adjusted for weight-loss (−500 kcal) or muscle-gain (+300 kcal).
 */
/**
 * Calculates a medically-sensible target weight based on the user's goal and BMI.
 *
 * - Underweight + Muscle Gain  → target to reach BMI 20 (healthy midpoint)
 * - Overweight/Obese + Weight Loss → target to reach BMI 22 (healthy midpoint)
 * - Normal BMI → modest ±5 kg adjustment
 * - Maintenance → current weight (no movement)
 */
export function calcSmartTarget(
  goal: string,
  weight: number,
  height: number
): number {
  if (!height || !weight) return weight
  const h2 = (height / 100) ** 2
  const bmi = parseFloat((weight / h2).toFixed(1))
  const g   = goal.toLowerCase().replace(/\s+/g, "-")

  if (g === "maintenance") return weight

  if (g === "muscle-gain") {
    // If underweight: aim for BMI 20 (entry into mid-healthy range)
    if (bmi < 18.5) return Math.round(20 * h2)
    // Already healthy or above: modest +5 kg
    return Math.round(weight + 5)
  }

  if (g === "weight-loss") {
    // If overweight or obese: aim for BMI 22 (mid-healthy range)
    if (bmi >= 25) return Math.round(22 * h2)
    // Already healthy: modest -5 kg
    return Math.max(Math.round(weight - 5), 40)
  }

  return weight
}

export function calcDailyCalories(user: UserMetrics): number {
  let bmr = 10 * user.weight + 6.25 * user.height - 5 * user.age
  bmr += user.gender === "Female" ? -161 : 5

  const goal = (user.goal ?? "").toLowerCase().replace(/\s/g, "-")
  if (goal === "weight-loss")  return Math.round(bmr * 1.4 - 500)
  if (goal === "muscle-gain")  return Math.round(bmr * 1.4 + 300)
  return Math.round(bmr * 1.4)  // Maintenance / default
}

export function calcBMI(weight: number, height: number): number {
  if (!height || !weight) return 0
  const h = height / 100
  return parseFloat((weight / (h * h)).toFixed(1))
}

export function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "text-yellow-600" }
  if (bmi < 25)   return { label: "Normal",      color: "text-green-600"  }
  if (bmi < 30)   return { label: "Overweight",  color: "text-orange-600" }
  return                 { label: "Obese",        color: "text-red-600"    }
}
