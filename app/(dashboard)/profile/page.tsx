"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  User, Mail, Calendar, Ruler, Scale, Target,
  Heart, Edit3, Save, X, Plus, CheckCircle, AlertCircle, Loader2
} from "lucide-react"
import { useUser, UserProfile } from "@/contexts/user-context"
import { apiUpdateProfile } from "@/lib/api"
import { calcBMI, bmiCategory as getBMICategory, calcSmartTarget } from "@/lib/calc"

const healthConditions = [
  // Metabolic
  "Type 2 Diabetes", "Type 1 Diabetes", "Obesity", "Metabolic Syndrome", "Hyperuricemia (High Uric Acid)",
  // Cardiovascular
  "Hypertension (High Blood Pressure)", "Coronary Heart Disease", "High Cholesterol", "Heart Failure",
  // Digestive
  "Irritable Bowel Syndrome (IBS)", "Crohn's Disease", "Ulcerative Colitis", "Coeliac Disease",
  "GERD (Acid Reflux)", "Gallbladder Disease", "Chronic Pancreatitis",
  "Non-Alcoholic Fatty Liver Disease (NAFLD)", "Diverticular Disease", "Liver Disease (Cirrhosis)",
  "Lactose Intolerance",
  // Kidney
  "Chronic Kidney Disease (CKD)", "Kidney Stones",
  // Hormonal
  "PCOS", "Hypothyroidism", "Hyperthyroidism",
  // Bone & Joint
  "Osteoporosis", "Rheumatoid Arthritis", "Osteoarthritis", "Gout",
  // Blood
  "Iron Deficiency Anaemia", "Vitamin B12 Deficiency Anaemia",
  // Neurological
  "Migraine", "Epilepsy", "Alzheimer's Disease",
  // Mental Health
  "Depression", "Anxiety Disorders",
  // Respiratory
  "Asthma",
  // Skin
  "Psoriasis", "Eczema",
  // Women's Health
  "Menopause", "Endometriosis",
]



// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  const { user, updateUser, isLoggedIn } = useUser()

  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<UserProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle")
  const [newLike, setNewLike] = useState("")
  const [newDislike, setNewDislike] = useState("")

  useEffect(() => {
    if (user) {
      // Normalize preference: old saves used short codes ("veg","non-veg","vegan");
      // backend ML expects full strings ("Vegetarian","Non-Vegetarian","Vegan")
      const PREF_MAP: Record<string, string> = {
        "veg": "Vegetarian", "non-veg": "Non-Vegetarian", "vegan": "Vegan",
      }
      const normPref = PREF_MAP[user.preference] ?? user.preference

      setEditedProfile({
        ...user,
        // Normalise goal to lowercase-kebab so the Select always preselects correctly
        goal: (user.goal ?? "").toLowerCase().replace(/\s+/g, "-"),
        preference: normPref,
      })
    }
  }, [user])

  useEffect(() => {
    if (!isLoggedIn && typeof window !== "undefined") {
      const stored = localStorage.getItem("nutridine-user")
      if (!stored) router.push("/")
    }
  }, [isLoggedIn, router])

  // ── Save to backend ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!editedProfile) return
    setSaving(true)
    setSaveStatus("idle")
    try {
      await apiUpdateProfile({
        name: editedProfile.name,
        age: editedProfile.age,
        height: editedProfile.height,
        weight: editedProfile.weight,
        gender: editedProfile.gender,
        goal: editedProfile.goal,
        targetWeight: editedProfile.targetWeight,
        conditions: editedProfile.conditions,
        preference: editedProfile.preference,
        cuisinePreference: editedProfile.cuisinePreference,
        likes: editedProfile.likes,
        dislikes: editedProfile.dislikes,
      })
      updateUser(editedProfile)
      setIsEditing(false)
      setSaveStatus("success")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } catch {
      setSaveStatus("error")
      setTimeout(() => setSaveStatus("idle"), 3000)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    if (user) setEditedProfile({ ...user })
    setIsEditing(false)
    setSaveStatus("idle")
  }

  const toggleCondition = (condition: string) => {
    if (!editedProfile) return
    const has = editedProfile.conditions.includes(condition)
    setEditedProfile({
      ...editedProfile,
      conditions: has
        ? editedProfile.conditions.filter(c => c !== condition)
        : [...editedProfile.conditions, condition],
    })
  }

  const addLike = () => {
    if (!editedProfile || !newLike.trim()) return
    if (!editedProfile.likes.includes(newLike.trim()))
      setEditedProfile({ ...editedProfile, likes: [...editedProfile.likes, newLike.trim()] })
    setNewLike("")
  }

  const addDislike = () => {
    if (!editedProfile || !newDislike.trim()) return
    if (!editedProfile.dislikes.includes(newDislike.trim()))
      setEditedProfile({ ...editedProfile, dislikes: [...editedProfile.dislikes, newDislike.trim()] })
    setNewDislike("")
  }

  if (!user || !editedProfile) {
    return (
      <div className="p-6 lg:p-8 space-y-8 animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="h-9 bg-muted rounded-lg w-32" />
            <div className="h-4 bg-muted rounded w-64" />
          </div>
          <div className="h-10 bg-muted rounded-lg w-28" />
        </div>
        {/* Avatar + stats skeleton */}
        <div className="rounded-xl border bg-card p-6 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-3 w-full">
            <div className="h-6 bg-muted rounded w-40" />
            <div className="h-4 bg-muted rounded w-56" />
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3].map(i => <div key={i} className="h-6 bg-muted rounded-full w-20" />)}
            </div>
          </div>
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border bg-card p-6 space-y-4">
              <div className="h-5 bg-muted rounded w-36" />
              <div className="space-y-3">
                {[1, 2, 3].map(j => <div key={j} className="h-10 bg-muted rounded-lg" />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const bmi = calcBMI(user.weight, user.height)
  const bmiCategory = getBMICategory(bmi)
  // Live BMI from editedProfile — updates as user types weight/height in edit mode
  const liveBmi = isEditing && editedProfile
    ? calcBMI(editedProfile.weight, editedProfile.height)
    : bmi
  const liveBmiCat = getBMICategory(liveBmi)

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Manage your personal information and preferences</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Save status */}
          {saveStatus === "success" && (
            <div className="flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle className="w-4 h-4" /> Saved to database!
            </div>
          )}
          {saveStatus === "error" && (
            <div className="flex items-center gap-1.5 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" /> Save failed
            </div>
          )}
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)} className="gap-2">
              <Edit3 className="w-4 h-4" /> Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} className="gap-2" disabled={saving}>
                <X className="w-4 h-4" /> Cancel
              </Button>
              <Button onClick={handleSave} className="gap-2" disabled={saving}>
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save Changes</>
                }
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Profile card ── */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {user.name.split(" ").filter(Boolean).map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <h2 className="text-xl font-semibold mt-4">{user.name}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>

              <div className="mt-6 w-full space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">BMI</span>
                  <div className="text-right">
                    <span className="font-semibold">{liveBmi}</span>
                    <p className={`text-xs ${liveBmiCat.color}`}>{liveBmiCat.label}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Goal</span>
                  <Badge variant="secondary">
                    {user.goal
                      ? user.goal.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                      : "Not set"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Diet</span>
                  <Badge variant="outline">
                    {(() => {
                      const PREF_MAP: Record<string, string> = {
                        "veg": "Vegetarian", "non-veg": "Non-Vegetarian", "vegan": "Vegan",
                      }
                      return PREF_MAP[user.preference] ?? user.preference ?? "Not set"
                    })()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Cuisine</span>
                  <Badge variant="outline">{user.cuisinePreference || "International"}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm text-muted-foreground">Conditions</span>
                  <Badge variant="secondary">{user.conditions.length}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Right: Details ── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Personal Information
              </CardTitle>
              <CardDescription>Your basic profile details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  {isEditing
                    ? <Input value={editedProfile.name} onChange={e => setEditedProfile({ ...editedProfile, name: e.target.value })} />
                    : <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"><User className="w-4 h-4 text-muted-foreground" />{user.name}</div>
                  }
                </div>
                {/* Email */}
                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Mail className="w-4 h-4 text-muted-foreground" />{user.email}
                  </div>
                </div>
                {/* Age */}
                <div className="space-y-2">
                  <Label>Age</Label>
                  {isEditing
                    ? <Input type="number" value={editedProfile.age} onChange={e => setEditedProfile({ ...editedProfile, age: Number(e.target.value) })} />
                    : <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"><Calendar className="w-4 h-4 text-muted-foreground" />{user.age} years</div>
                  }
                </div>
                {/* Gender */}
                <div className="space-y-2">
                  <Label>Gender</Label>
                  {isEditing
                    ? <Select value={editedProfile.gender} onValueChange={v => setEditedProfile({ ...editedProfile, gender: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    : <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"><User className="w-4 h-4 text-muted-foreground" />{user.gender || "Not set"}</div>
                  }
                </div>
                {/* Height */}
                <div className="space-y-2">
                  <Label>Height (cm)</Label>
                  {isEditing
                    ? <Input type="number" value={editedProfile.height} onChange={e => {
                      const newHeight = Number(e.target.value)
                      // Cascade: height change affects BMI → recalculate smart target
                      const newTarget = editedProfile.goal !== "maintenance"
                        ? (newHeight >= 100 && newHeight <= 250
                          ? calcSmartTarget(editedProfile.goal, editedProfile.weight, newHeight)
                          : editedProfile.targetWeight)
                        : editedProfile.weight
                      setEditedProfile({ ...editedProfile, height: newHeight, targetWeight: newTarget })
                    }} />
                    : <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"><Ruler className="w-4 h-4 text-muted-foreground" />{user.height} cm</div>
                  }
                </div>
                {/* Weight */}
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  {isEditing
                    ? <Input type="number" value={editedProfile.weight} onChange={e => {
                      const newWeight = Number(e.target.value)
                      // Cascade: weight change affects BMI → recalculate smart target
                      const newTarget = editedProfile.goal !== "maintenance"
                        ? (newWeight >= 20 && newWeight <= 300
                          ? calcSmartTarget(editedProfile.goal, newWeight, editedProfile.height)
                          : editedProfile.targetWeight)
                        : newWeight  // maintenance: target always mirrors current weight
                      setEditedProfile({ ...editedProfile, weight: newWeight, targetWeight: newTarget })
                    }} />
                    : <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"><Scale className="w-4 h-4 text-muted-foreground" />{user.weight} kg</div>
                  }
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Health & Goals */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" /> Health & Goals
              </CardTitle>
              <CardDescription>Your fitness goals and health conditions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Goal */}
                <div className="space-y-2">
                  <Label>Fitness Goal</Label>
                  ? <>
                    <Select
                      value={editedProfile.goal}
                      onValueChange={v => setEditedProfile({
                        ...editedProfile,
                        goal: v,
                        // Auto-calculate a BMI-based healthy target when goal changes
                        targetWeight: calcSmartTarget(v, editedProfile.weight, editedProfile.height),
                      })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weight-loss">Weight Loss</SelectItem>
                        <SelectItem value="muscle-gain">Muscle Gain</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                      </SelectContent>
                    </Select>
                    {editedProfile.goal === "weight-loss" && liveBmi > 0 && liveBmi < 18.5 && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900 col-span-2">
                        <span className="text-red-500">⚠</span>
                        <span className="text-xs text-red-700 dark:text-red-400">
                          BMI {liveBmi} is <strong>Underweight</strong>. Weight Loss is not recommended — consider <strong>Muscle Gain</strong>.
                        </span>
                      </div>
                    )}
                    {editedProfile.goal === "maintenance" && liveBmi > 0 && liveBmi < 18.5 && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900 col-span-2">
                        <span className="text-orange-500">⚠</span>
                        <span className="text-xs text-orange-600 dark:text-orange-400">
                          BMI {liveBmi} is <strong>Underweight</strong>. Maintaining isn’t ideal — consider <strong>Muscle Gain</strong>.
                        </span>
                      </div>
                    )}
                    {editedProfile.goal === "maintenance" && liveBmi >= 30 && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900 col-span-2">
                        <span className="text-orange-500">⚠</span>
                        <span className="text-xs text-orange-600 dark:text-orange-400">
                          BMI {liveBmi} is <strong>Obese</strong>. Consider switching to <strong>Weight Loss</strong>.
                        </span>
                      </div>
                    )}
                  </>
                  : <>
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      {user.goal
                        ? user.goal.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                        : "Not set"}
                    </div>
                    {(() => {
                      const gk = (user.goal ?? "").toLowerCase().replace(/\s+/g, "-")
                      const underweight = bmi > 0 && bmi < 18.5
                      const obese = bmi >= 30
                      if (gk === "weight-loss" && underweight) return (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-900">
                          <span className="text-red-500 text-xs">⚠</span>
                          <span className="text-xs text-red-700 dark:text-red-400">BMI {bmi} (Underweight) — Weight Loss not recommended</span>
                        </div>
                      )
                      if (gk === "maintenance" && underweight) return (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                          <span className="text-orange-500 text-xs">⚠</span>
                          <span className="text-xs text-orange-600 dark:text-orange-400">BMI {bmi} (Underweight) — consider <strong>Muscle Gain</strong></span>
                        </div>
                      )
                      if (gk === "maintenance" && obese) return (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                          <span className="text-orange-500 text-xs">⚠</span>
                          <span className="text-xs text-orange-600 dark:text-orange-400">BMI {bmi} (Obese) — consider <strong>Weight Loss</strong></span>
                        </div>
                      )
                      return null
                    })()}
                  </>
                </div>
                {/* Target weight */}
                <div className="space-y-2">
                  <Label>Target Weight (kg)</Label>
                  {isEditing
                    ? editedProfile.goal !== "maintenance"
                      ? <div className="space-y-1">
                        <Input
                          type="number"
                          value={editedProfile.targetWeight || ""}
                          onChange={e => setEditedProfile({ ...editedProfile, targetWeight: Number(e.target.value) })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Recommended based on your BMI — you can adjust manually.
                        </p>
                      </div>
                      : <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-xs text-muted-foreground">
                        <span>✓</span>
                        <span>Auto-set to current weight ({editedProfile.weight}kg)</span>
                      </div>
                    : (() => {
                      const gk = (user.goal ?? "").toLowerCase().replace(/\s+/g, "-")
                      const isMaint = gk === "maintenance"
                      const conflictWL = gk === "weight-loss" && user.targetWeight >= user.weight
                      const conflictMG = gk === "muscle-gain" && user.targetWeight <= user.weight
                      if (isMaint) return (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <Scale className="w-4 h-4 text-muted-foreground" />
                          {user.weight} kg (maintaining)
                        </div>
                      )
                      if (conflictWL || conflictMG) return (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-900">
                          <span className="text-orange-500">⚠</span>
                          <span className="text-xs text-orange-600 dark:text-orange-400">
                            {user.targetWeight}kg conflicts with {gk === "weight-loss" ? "Weight Loss" : "Muscle Gain"} — tap Edit to fix
                          </span>
                        </div>
                      )
                      return (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                          <Scale className="w-4 h-4 text-muted-foreground" />
                          {user.targetWeight ? `${user.targetWeight} kg` : "Not set"}
                        </div>
                      )
                    })()
                  }
                </div>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                <Label>Health Conditions</Label>
                {isEditing ? (
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-input bg-background">
                    {healthConditions.map(condition => (
                      <Badge
                        key={condition}
                        variant={editedProfile.conditions.includes(condition) ? "default" : "outline"}
                        className="cursor-pointer transition-all hover:scale-105"
                        onClick={() => toggleCondition(condition)}
                      >
                        {condition}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-muted/50 min-h-[48px]">
                    {user.conditions.length > 0
                      ? user.conditions.map(c => (
                        <Badge key={c} variant="secondary" className="gap-1">
                          <Heart className="w-3 h-3" />{c}
                        </Badge>
                      ))
                      : <span className="text-muted-foreground text-sm">No conditions specified</span>
                    }
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Food Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-primary" /> Food Preferences
              </CardTitle>
              <CardDescription>Your dietary preference and food likes/dislikes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Dietary preference */}
              <div className="space-y-2">
                <Label>Dietary Preference</Label>
                {isEditing
                  ? <Select
                    value={editedProfile.preference}
                    onValueChange={v => setEditedProfile({ ...editedProfile, preference: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="Non-Vegetarian">Non-Vegetarian</SelectItem>
                      <SelectItem value="Vegan">Vegan</SelectItem>
                    </SelectContent>
                  </Select>
                  : <div className="p-2 rounded-lg bg-muted/50">
                    {(() => {
                      const PREF_MAP: Record<string, string> = {
                        "veg": "Vegetarian", "non-veg": "Non-Vegetarian", "vegan": "Vegan",
                      }
                      return PREF_MAP[user.preference] ?? user.preference ?? "Not set"
                    })()}
                  </div>
                }
              </div>

              {/* Cuisine Preference */}
              <div className="space-y-2">
                <Label>Cuisine Preference</Label>
                <p className="text-xs text-muted-foreground">Meal plans will use recipes from this cuisine region</p>
                {isEditing
                  ? <Select value={editedProfile.cuisinePreference} onValueChange={v => setEditedProfile({ ...editedProfile, cuisinePreference: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="International"> International (All cuisines)</SelectItem>
                      <SelectItem value="Indian">Indian</SelectItem>
                      <SelectItem value="South Asian">South Asian</SelectItem>
                      <SelectItem value="Asian">Asian</SelectItem>
                      <SelectItem value="Mediterranean">Mediterranean</SelectItem>
                      <SelectItem value="Western">Western</SelectItem>
                    </SelectContent>
                  </Select>
                  : <div className="p-2 rounded-lg bg-muted/50">{user.cuisinePreference || "International"}</div>
                }
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Likes */}
                <div className="space-y-2">
                  <Label>Foods You Like</Label>
                  {isEditing && (
                    <div className="flex gap-2">
                      <Input placeholder="Add food" value={newLike} onChange={e => setNewLike(e.target.value)} onKeyDown={e => e.key === "Enter" && addLike()} />
                      <Button size="icon" onClick={addLike}><Plus className="w-4 h-4" /></Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 min-h-[52px]">
                    {(isEditing ? editedProfile : user).likes.length > 0
                      ? (isEditing ? editedProfile : user).likes.map(food => (
                        <Badge key={food} className="bg-green-100 text-green-800 gap-1">
                          {food}
                          {isEditing && <X className="w-3 h-3 cursor-pointer" onClick={() => setEditedProfile({ ...editedProfile, likes: editedProfile.likes.filter(f => f !== food) })} />}
                        </Badge>
                      ))
                      : <span className="text-sm text-muted-foreground">None added</span>
                    }
                  </div>
                </div>

                {/* Dislikes */}
                <div className="space-y-2">
                  <Label>Foods You Dislike</Label>
                  {isEditing && (
                    <div className="flex gap-2">
                      <Input placeholder="Add food" value={newDislike} onChange={e => setNewDislike(e.target.value)} onKeyDown={e => e.key === "Enter" && addDislike()} />
                      <Button size="icon" variant="destructive" onClick={addDislike}><Plus className="w-4 h-4" /></Button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 min-h-[52px]">
                    {(isEditing ? editedProfile : user).dislikes.length > 0
                      ? (isEditing ? editedProfile : user).dislikes.map(food => (
                        <Badge key={food} className="bg-red-100 text-red-800 gap-1">
                          {food}
                          {isEditing && <X className="w-3 h-3 cursor-pointer" onClick={() => setEditedProfile({ ...editedProfile, dislikes: editedProfile.dislikes.filter(f => f !== food) })} />}
                        </Badge>
                      ))
                      : <span className="text-sm text-muted-foreground">None added</span>
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}