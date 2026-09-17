"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Activity,
  Target,
  Heart,
  Flame,
  ChefHat,
  Calendar,
  ShoppingBasket,
  X,
  Plus,
  Edit3,
  Scale,
  CheckCircle2,
  Sparkles,
  ChevronRight
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useUser } from "@/contexts/user-context"
import { apiUpdateProfile } from "@/lib/api"
import { calcBMI, bmiCategory, calcDailyCalories, calcSmartTarget } from "@/lib/calc"

// ── Onboarding Banner ──────────────────────────────────────────────────────────
function OnboardingBanner({ conditionsDone }: { conditionsDone: boolean }) {
  const [dismissed, setDismissed] = useState(false)
  const [planDone, setPlanDone] = useState(false)
  const [recipesVisited, setRecipesDone] = useState(false)

  useEffect(() => {
    const d = localStorage.getItem("nutridine-onboarding-dismissed")
    if (d === "true") setDismissed(true)
    const p = localStorage.getItem("nutridine-plan-generated")
    if (p === "true") setPlanDone(true)
    const r = localStorage.getItem("nutridine-recipes-visited")
    if (r === "true") setRecipesDone(true)
  }, [])

  const allDone = conditionsDone && planDone && recipesVisited

  const dismiss = () => {
    localStorage.setItem("nutridine-onboarding-dismissed", "true")
    setDismissed(true)
  }

  if (dismissed || allDone) return null

  const steps = [
    {
      num: 1,
      title: "Set your health conditions",
      desc: "Tell us your conditions so every recipe is safe for you",
      done: conditionsDone,
      href: "/dashboard",
      action: "Edit conditions",
    },
    {
      num: 2,
      title: "Generate your meal plan",
      desc: "Get a personalized multi-week plan with zero unsafe meals",
      done: planDone,
      href: "/meal-plan",
      action: "Generate now",
    },
    {
      num: 3,
      title: "Explore recipes",
      desc: "Browse 3,275+ recipes filtered to your conditions & taste",
      done: recipesVisited,
      href: "/recipes",
      action: "Browse recipes",
    },
  ]

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-orange-50/50 to-amber-50/50 p-5 relative">
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-primary" />
        <p className="text-sm font-semibold text-primary">Get started with NutriDine</p>
        <span className="ml-auto text-xs text-muted-foreground pr-6">
          {steps.filter(s => s.done).length} of {steps.length} done
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step) => (
          <Link href={step.href} key={step.num}>
            <div className={`rounded-xl border p-4 transition-all cursor-pointer ${step.done
              ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900"
              : "bg-card border-border hover:border-primary/40 hover:shadow-sm"
              }`}>
              <div className="flex items-center gap-2 mb-2">
                {step.done
                  ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  : <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground">{step.num}</span>
                  </div>
                }
                <p className={`text-sm font-semibold ${step.done ? "text-green-700 dark:text-green-400 line-through opacity-70" : "text-foreground"
                  }`}>{step.title}</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{step.desc}</p>
              {!step.done && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  {step.action} <ChevronRight className="w-3 h-3" />
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, updateUser, isLoggedIn } = useUser()

  const [conditions, setConditions] = useState<string[]>([])
  const [goal, setGoal] = useState("")
  const [targetWeight, setTargetWeight] = useState(70)
  const [likes, setLikes] = useState<string[]>([])
  const [dislikes, setDislikes] = useState<string[]>([])
  const [newLike, setNewLike] = useState("")
  const [newDislike, setNewDislike] = useState("")

  // Initialize state from user context
  useEffect(() => {
    if (user) {
      setConditions(user.conditions)
      // Normalise to lowercase-kebab so comparisons work regardless of how the
      // goal was stored ("Maintenance" from signup vs "maintenance" from dialog)
      setGoal((user.goal ?? "").toLowerCase().replace(/\s+/g, "-"))
      setTargetWeight(user.targetWeight)
      setLikes(user.likes)
      setDislikes(user.dislikes)
    }
  }, [user])

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn && typeof window !== "undefined") {
      const storedUser = localStorage.getItem("nutridine-user")
      if (!storedUser) {
        router.push("/")
      }
    }
  }, [isLoggedIn, router])

  if (!user) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const bmi          = calcBMI(user.weight, user.height)
  const bmiMeta      = bmiCategory(bmi)
  const dailyCalories = calcDailyCalories(user)
  // Normalise once for all JSX comparisons (handles "Maintenance" and "maintenance")
  const goalKey = (user.goal ?? "").toLowerCase().replace(/\s+/g, "-")

  const addLike = async () => {
    if (newLike.trim() && !likes.includes(newLike.trim())) {
      const newLikes = [...likes, newLike.trim()]
      setLikes(newLikes)
      updateUser({ likes: newLikes })
      setNewLike("")
      try { await apiUpdateProfile({ likes: newLikes }) } catch { }
    }
  }

  const addDislike = async () => {
    if (newDislike.trim() && !dislikes.includes(newDislike.trim())) {
      const newDislikes = [...dislikes, newDislike.trim()]
      setDislikes(newDislikes)
      updateUser({ dislikes: newDislikes })
      setNewDislike("")
      try { await apiUpdateProfile({ dislikes: newDislikes }) } catch { }
    }
  }

  const removeLike = async (food: string) => {
    const newLikes = likes.filter(f => f !== food)
    setLikes(newLikes)
    updateUser({ likes: newLikes })
    try { await apiUpdateProfile({ likes: newLikes }) } catch { }
  }

  const removeDislike = async (food: string) => {
    const newDislikes = dislikes.filter(f => f !== food)
    setDislikes(newDislikes)
    updateUser({ dislikes: newDislikes })
    try { await apiUpdateProfile({ dislikes: newDislikes }) } catch { }
  }

  const updateConditions = async (newConditions: string[]) => {
    setConditions(newConditions)
    updateUser({ conditions: newConditions })
    try { await apiUpdateProfile({ conditions: newConditions }) } catch { }
  }

  const updateGoal = async (newGoal: string, newTargetWeight: number) => {
    setGoal(newGoal)
    setTargetWeight(newTargetWeight)
    updateUser({ goal: newGoal, targetWeight: newTargetWeight })
    try { await apiUpdateProfile({ goal: newGoal, targetWeight: newTargetWeight }) } catch { }
  }


  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Onboarding Banner */}
      <OnboardingBanner conditionsDone={conditions.length > 0} />

      {/* Welcome Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground">
          Welcome, {user.name.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground">
          Here&apos;s your personalized health overview
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">BMI</p>
                <p className="text-2xl font-bold text-foreground">{bmi}</p>
                <p className={`text-xs ${bmiMeta.color}`}>{bmiMeta.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Current Goal</p>
                <p className="text-2xl font-bold text-foreground">
                  {user.goal ? user.goal.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Not set"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {user.goal === "maintenance" || goalKey === "maintenance"
                    ? `Maintaining at ${user.weight}kg`
                    : user.targetWeight
                    ? `${user.targetWeight}kg target`
                    : "No target set"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conditions</p>
                <p className="text-2xl font-bold text-foreground">{conditions.length}</p>
                <p className="text-xs text-muted-foreground">Being monitored</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Flame className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Daily Calories</p>
                <p className="text-2xl font-bold text-foreground">{dailyCalories}</p>
                <p className="text-xs text-muted-foreground">kcal target</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editable Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Conditions */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Health Conditions</CardTitle>
              <CardDescription>Manage your health conditions</CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Edit3 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Health Conditions</DialogTitle>
                  <DialogDescription>
                    Select or remove your health conditions
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-wrap gap-2 py-4 max-h-80 overflow-y-auto">
                  {[
                    "Type 2 Diabetes", "Type 1 Diabetes", "Obesity", "Metabolic Syndrome", "Hyperuricemia (High Uric Acid)",
                    "Hypertension (High Blood Pressure)", "Coronary Heart Disease", "High Cholesterol", "Heart Failure",
                    "Irritable Bowel Syndrome (IBS)", "Crohn's Disease", "Ulcerative Colitis", "Coeliac Disease",
                    "GERD (Acid Reflux)", "Gallbladder Disease", "Chronic Pancreatitis",
                    "Non-Alcoholic Fatty Liver Disease (NAFLD)", "Diverticular Disease", "Liver Disease (Cirrhosis)",
                    "Lactose Intolerance", "Chronic Kidney Disease (CKD)", "Kidney Stones",
                    "PCOS", "Hypothyroidism", "Hyperthyroidism",
                    "Osteoporosis", "Rheumatoid Arthritis", "Osteoarthritis", "Gout",
                    "Iron Deficiency Anaemia", "Vitamin B12 Deficiency Anaemia",
                    "Migraine", "Epilepsy", "Alzheimer's Disease",
                    "Depression", "Anxiety Disorders", "Asthma",
                    "Psoriasis", "Eczema", "Menopause", "Endometriosis",
                  ].map((condition) => (
                    <Badge
                      key={condition}
                      variant={conditions.includes(condition) ? "default" : "outline"}
                      className="cursor-pointer transition-all hover:scale-105"
                      onClick={() => {
                        const newConditions = conditions.includes(condition)
                          ? conditions.filter(c => c !== condition)
                          : [...conditions, condition]
                        updateConditions(newConditions)
                      }}
                    >
                      {condition}
                    </Badge>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {conditions.length > 0 ? (
                conditions.map((condition) => (
                  <Badge key={condition} variant="secondary" className="gap-1">
                    {condition}
                    <X
                      className="w-3 h-3 cursor-pointer"
                      onClick={() => updateConditions(conditions.filter(c => c !== condition))}
                    />
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No conditions added</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fitness Goal */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Fitness Goal</CardTitle>
              <CardDescription>Update your target</CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Edit3 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Fitness Goal</DialogTitle>
                  <DialogDescription>
                    Set your fitness goal and target weight
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Goal</Label>
                    <Select
                      value={goal}
                      onValueChange={(v) => {
                        setGoal(v)
                        // Auto-calculate a BMI-based healthy target when goal changes
                        setTargetWeight(calcSmartTarget(v, user.weight, user.height))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weight-loss">Weight Loss</SelectItem>
                        <SelectItem value="muscle-gain">Muscle Gain</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* BMI-aware warning inside dialog */}
                    {goal === "weight-loss" && bmi > 0 && bmi < 18.5 && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900">
                        <span className="text-red-500">⚠</span>
                        <span className="text-xs text-red-700 dark:text-red-400">
                          Your BMI ({bmi}) is <strong>Underweight</strong>. Weight Loss is not recommended.
                        </span>
                      </div>
                    )}
                  </div>
                  {goal !== "maintenance" ? (
                    <div className="space-y-1">
                      <Label>Target Weight (kg)</Label>
                      <Input
                        type="number"
                        value={targetWeight}
                        onChange={(e) => setTargetWeight(Number(e.target.value))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Recommended based on your BMI — you can adjust manually.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                      <span>✓</span>
                      <span>Target weight auto-set to your current weight ({user.weight}kg)</span>
                    </div>
                  )}
                  <Button onClick={() => updateGoal(goal, targetWeight)} className="w-full">
                    Save Changes
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Scale className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {user.goal ? user.goal.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "Not set"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {goalKey === "maintenance"
                    ? `Maintaining at ${user.weight}kg`
                    : `Target: ${user.targetWeight}kg (Current: ${user.weight}kg)`}
                </p>
              </div>
            </div>

            {/* BMI-goal contradiction check */}
            {(() => {
              const bmiUnderweight = bmi > 0 && bmi < 18.5
              const bmiObese       = bmi >= 30
              if (bmiUnderweight && goalKey === "weight-loss") return (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900">
                  <span className="text-red-500 text-base">⚠</span>
                  <span className="text-xs text-red-700 dark:text-red-400">
                    BMI {bmi} is <strong>Underweight</strong>. Weight Loss is not recommended — consider <strong>Muscle Gain</strong>.
                  </span>
                </div>
              )
              if (bmiUnderweight && goalKey === "maintenance") return (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                  <span className="text-orange-500 text-base">⚠</span>
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    BMI {bmi} is <strong>Underweight</strong>. Maintaining at this weight isn’t ideal — consider switching to <strong>Muscle Gain</strong>.
                  </span>
                </div>
              )
              if (bmiObese && goalKey === "maintenance") return (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                  <span className="text-orange-500 text-base">⚠</span>
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    BMI {bmi} is <strong>Obese</strong>. Consider switching to <strong>Weight Loss</strong> for better health outcomes.
                  </span>
                </div>
              )
              return null
            })()}

            {/* Progress bar — only shown for weight-loss / muscle-gain goals */}
            {goalKey !== "maintenance" ? (() => {
              // Detect direction conflict: weight-loss should have target < current, muscle-gain target > current
              const conflictWL = goalKey === "weight-loss" && user.targetWeight >= user.weight
              const conflictMG = goalKey === "muscle-gain" && user.targetWeight <= user.weight
              const conflict   = conflictWL || conflictMG
              // Skip direction conflict if already showing BMI warning
              const bmiConflict = bmi > 0 && bmi < 18.5 && goalKey === "weight-loss"
              if (conflict && !bmiConflict) return (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                  <span className="text-orange-500 text-base">⚠</span>
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    Target ({user.targetWeight}kg) conflicts with your {goalKey === "weight-loss" ? "Weight Loss" : "Muscle Gain"} goal — tap ✏ to fix.
                  </span>
                </div>
              )

              return (
                <div className="space-y-1.5">
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: (() => {
                          if (!user.targetWeight || user.weight === user.targetWeight) return "100%"
                          const gap = Math.abs(user.weight - user.targetWeight)
                          const maxGap = Math.max(gap, 30)
                          const progress = Math.max(5, Math.min(100, (1 - gap / maxGap) * 100))
                          return `${progress}%`
                        })()
                      }}
                    />
                  </div>
                  {user.targetWeight && user.weight !== user.targetWeight && (
                    <p className="text-xs text-muted-foreground text-right">
                      {Math.abs(user.weight - user.targetWeight)}kg&nbsp;
                      {goalKey === "weight-loss" ? "to lose" : "to gain"}
                    </p>
                  )}
                </div>
              )
            })() : (
              // Maintenance badge — only praise if BMI is actually healthy
              (() => {
                const bmiUnderweight = bmi > 0 && bmi < 18.5
                const bmiObese = bmi >= 30
                if (bmiUnderweight) return (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                    <span className="text-orange-500">⚠</span>
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      Goal set but BMI ({bmi}) is <strong>Underweight</strong>. Consider switching to <strong>Muscle Gain</strong>.
                    </span>
                  </div>
                )
                if (bmiObese) return (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                    <span className="text-orange-500">⚠</span>
                    <span className="text-xs text-orange-600 dark:text-orange-400">
                      Goal set but BMI ({bmi}) is <strong>Obese</strong>. Consider switching to <strong>Weight Loss</strong>.
                    </span>
                  </div>
                )
                return (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/8 border border-primary/20">
                    <span className="text-base">✓</span>
                    <span className="text-xs text-primary font-medium">You&apos;re at a healthy goal weight — keep it up!</span>
                  </div>
                )
              })()
            )}
          </CardContent>
        </Card>

        {/* Food Preferences */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Preferences</CardTitle>
              <CardDescription>Likes & dislikes</CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="icon">
                  <Edit3 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Update Food Preferences</DialogTitle>
                  <DialogDescription>
                    Add or remove foods you like or dislike
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-3">
                    <Label>Foods You Like</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a food"
                        value={newLike}
                        onChange={(e) => setNewLike(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addLike()}
                      />
                      <Button size="icon" onClick={addLike}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {likes.map((food) => (
                        <Badge key={food} variant="secondary" className="gap-1">
                          {food}
                          <X
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => removeLike(food)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Foods You Dislike</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a food"
                        value={newDislike}
                        onChange={(e) => setNewDislike(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addDislike()}
                      />
                      <Button size="icon" variant="destructive" onClick={addDislike}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dislikes.map((food) => (
                        <Badge key={food} variant="destructive" className="gap-1">
                          {food}
                          <X
                            className="w-3 h-3 cursor-pointer"
                            onClick={() => removeDislike(food)}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">LIKES</p>
              <div className="flex flex-wrap gap-1">
                {likes.length > 0 ? (
                  <>
                    {likes.slice(0, 3).map((food) => (
                      <Badge key={food} variant="secondary" className="text-xs">
                        {food}
                      </Badge>
                    ))}
                    {likes.length > 3 && (
                      <Badge variant="outline" className="text-xs">+{likes.length - 3}</Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">None added</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">DISLIKES</p>
              <div className="flex flex-wrap gap-1">
                {dislikes.length > 0 ? (
                  dislikes.map((food) => (
                    <Badge key={food} variant="destructive" className="text-xs">
                      {food}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">None added</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/meal-plan">
          <Card className="border-border/50 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Calendar className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Generate Meal Plan
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Get your weekly plan
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/recipes">
          <Card className="border-border/50 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <ChefHat className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    View Recipes
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Explore personalized recipes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/food-ingredients">
          <Card className="border-border/50 shadow-sm hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <ShoppingBasket className="w-7 h-7 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    Find Ingredients
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Order food & groceries
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
