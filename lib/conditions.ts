/**
 * Unified health conditions list — single source of truth for the entire app.
 * Used in: signup, profile, dashboard, about page, conditions guide.
 */
export const ALL_CONDITIONS: string[] = [
  // Metabolic
  "Type 2 Diabetes",
  "Type 1 Diabetes",
  "Prediabetes",
  "Obesity",
  "Metabolic Syndrome",
  "High Cholesterol",
  "Hypertriglyceridemia",
  // Cardiovascular
  "Hypertension",
  "Heart Disease",
  "Heart Failure",
  "Coronary Artery Disease",
  "Stroke",
  "Peripheral Artery Disease",
  // Kidney & Liver
  "Chronic Kidney Disease",
  "Kidney Stones",
  "Liver Disease",
  "NAFLD",
  "Liver Cirrhosis",
  // Gastrointestinal
  "GERD",
  "IBS",
  "Crohn's Disease",
  "Ulcerative Colitis",
  "Celiac Disease",
  "Diverticulitis",
  "Chronic Pancreatitis",
  "Gallbladder Disease",
  // Hormonal & Endocrine
  "Thyroid Disorder",
  "Hypothyroidism",
  "Hyperthyroidism",
  "PCOS",
  "Endometriosis",
  // Musculoskeletal
  "Gout",
  "Osteoporosis",
  "Rheumatoid Arthritis",
  "Osteoarthritis",
  // Other
  "Anemia",
  "Lactose Intolerance",
  "Migraine",
  "Chronic Fatigue Syndrome",
  "Chronic Pancreatitis",
]

/** Deduplicated and sorted version for display */
export const CONDITIONS = [...new Set(ALL_CONDITIONS)].sort()

/** Short display label mapping (for compact UX like dashboard chips) */
export const CONDITION_SHORT_LABELS: Record<string, string> = {
  "Type 2 Diabetes":     "Diabetes T2",
  "Type 1 Diabetes":     "Diabetes T1",
  "Chronic Kidney Disease": "Kidney Disease",
  "Coronary Artery Disease": "Heart Disease",
}

export function getConditionLabel(condition: string): string {
  return CONDITION_SHORT_LABELS[condition] ?? condition
}
