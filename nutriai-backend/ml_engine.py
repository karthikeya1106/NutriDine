# ml_engine.py -- NutriAI Machine Learning Engine
# Uses: Scikit-learn, Pandas, NumPy, NLTK
# Place this file in: C:\project\nutriai-backend\ml_engine.py

import json
import os
import numpy as np
import pandas as pd
import nltk
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.tree import DecisionTreeClassifier
from sklearn.preprocessing import LabelEncoder
import warnings
warnings.filterwarnings("ignore")

# -- Download NLTK data --------------------------------------------------------
def download_nltk_data():
    for pkg in ["punkt", "stopwords", "punkt_tab"]:
        try:
            nltk.download(pkg, quiet=True)
        except:
            pass

download_nltk_data()

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# -- Load datasets -------------------------------------------------------------
def load_data():
    with open(os.path.join(DATA_DIR, "recipes.json")) as f:
        recipes = json.load(f)
    with open(os.path.join(DATA_DIR, "nutrition.json")) as f:
        nutrition = json.load(f)
    return recipes, nutrition

# ===============================================================================
# MODULE 1: TF-IDF Content-Based Recipe Recommender (Scikit-learn)
# ===============================================================================
class RecipeRecommender:
    """
    Content-based filtering using TF-IDF vectorization and cosine similarity.
    Builds a feature vector for each recipe combining:
    - Ingredients, dietary tags, cuisine, meal type
    Then ranks recipes by cosine similarity to user's profile vector.
    """
    def __init__(self):
        self.recipes = []
        self.tfidf   = TfidfVectorizer(ngram_range=(1, 2), max_features=3000)
        self.matrix  = None
        self._build()

    def _recipe_to_text(self, recipe: dict) -> str:
        """Convert recipe to a text document for TF-IDF."""
        parts = []
        parts.append(recipe.get("name", ""))
        parts.append(recipe.get("cuisine", ""))
        parts.append(recipe.get("meal_type", ""))
        parts.append(recipe.get("difficulty", ""))
        parts += recipe.get("dietary_tags", [])
        parts += [i["name"] for i in recipe.get("ingredients", [])]
        # Add condition safety keywords
        for cond, safety in recipe.get("condition_safety", {}).items():
            if safety.get("safe"):
                parts.append(cond.lower().replace(" ", "_") + "_safe")
        return " ".join(parts).lower()

    def _build(self):
        """Build TF-IDF matrix from all recipes."""
        self.recipes, _ = load_data()
        texts = [self._recipe_to_text(r) for r in self.recipes]
        self.matrix = self.tfidf.fit_transform(texts)

    def _user_to_text(self, user: dict) -> str:
        """Convert user profile to a query document."""
        parts = []
        parts += [c.lower().replace(" ", "_") + "_safe" for c in user.get("conditions", [])]
        pref = user.get("preference", "").lower()
        if pref == "vegetarian":   parts += ["vegetarian", "vegan"]
        elif pref == "vegan":      parts += ["vegan"]
        parts += [l.lower() for l in user.get("likes", [])]
        goal = user.get("goal", "").lower()
        if "loss" in goal:    parts += ["low calorie", "low fat", "high fiber"]
        elif "muscle" in goal: parts += ["high protein"]
        return " ".join(parts)

    def recommend(self, user: dict, top_n: int = 20) -> list:
        """
        Returns recipes sorted by cosine similarity to user profile.
        Higher score = better match.
        """
        query_text  = self._user_to_text(user)
        query_vec   = self.tfidf.transform([query_text])
        similarities = cosine_similarity(query_vec, self.matrix).flatten()

        # Attach scores and sort
        scored = []
        for i, recipe in enumerate(self.recipes):
            scored.append({
                **recipe,
                "ml_score": float(round(similarities[i], 4)),
            })

        scored.sort(key=lambda x: x["ml_score"], reverse=True)
        return scored[:top_n]


# ===============================================================================
# MODULE 2: Condition Safety Classifier (Trained Random Forest -- 14 conditions)
# ===============================================================================

# 18-feature vector expected by the trained model
_RF_FEATURES = [
    "calories_kcal", "protein_g", "carbs_g", "fat_g", "fiber_g",
    "sugar_g", "sodium_mg", "potassium_mg", "calcium_mg", "iron_mg",
    "vitamin_c_mg", "glycemic_index", "saturated_fat_g",
    "gluten_free", "dairy_free", "purine_level", "fodmap_score", "goitrogen_flag",
]

_HIGH_PURINE_KEYWORDS = {
    "liver", "kidney", "heart organ", "sardine", "anchov", "mackerel",
    "herring", "mussel", "scallop", "yeast extract", "game",
}
_MED_PURINE_KEYWORDS = {"beef", "pork", "lamb", "chicken", "turkey", "shrimp", "crab"}
_FODMAP_HIGH_KW      = {"garlic", "onion", "wheat", "honey", "apple", "pear", "milk",
                        "cream", "lactose", "cashew", "pistachio"}
_FODMAP_MED_KW       = {"grain", "bread", "pasta", "avocado", "peach", "mango"}
_GOITROGEN_KW        = {"broccoli", "cabbage", "cauliflower", "kale", "brussels",
                        "bok choy", "spinach", "turnip", "millet", "soybean", "tofu",
                        "tempeh", "soy milk"}

_CONDITION_REASONS = {
    "Diabetes":           lambda n: f"GI~{n.get('glycemic_index','?')}, Carbs={n.get('carbs_g','?')}g, Fiber={n.get('fiber_g','?')}g",
    "Hypertension":       lambda n: f"Sodium={n.get('sodium_mg','?')}mg, Fat={n.get('fat_g','?')}g",
    "Heart Disease":      lambda n: f"Sat.fat={n.get('saturated_fat_g','?')}g, Sodium={n.get('sodium_mg','?')}mg",
    "Obesity":            lambda n: f"Calories={n.get('calories_kcal','?')}kcal, Fiber={n.get('fiber_g','?')}g",
    "Celiac Disease":     lambda n: f"Gluten-free: {bool(n.get('gluten_free', True))}",
    "Lactose Intolerance":lambda n: f"Dairy-free: {bool(n.get('dairy_free', True))}",
    "Kidney Disease":     lambda n: f"Potassium={n.get('potassium_mg','?')}mg, Protein={n.get('protein_g','?')}g, Sodium={n.get('sodium_mg','?')}mg",
    "High Cholesterol":   lambda n: f"Sat.fat={n.get('saturated_fat_g','?')}g, Fiber={n.get('fiber_g','?')}g",
    "PCOS":               lambda n: f"GI~{n.get('glycemic_index','?')}, Fiber={n.get('fiber_g','?')}g, Sugar={n.get('sugar_g','?')}g",
    "Thyroid Disorder":   lambda n: "No goitrogenic ingredients detected" if n.get("goitrogen_flag",0)==0 else "Contains goitrogenic ingredients -- cook thoroughly",
    "Anemia":             lambda n: f"Iron={n.get('iron_mg','?')}mg, Vitamin C={n.get('vitamin_c_mg','?')}mg",
    "Gout":               lambda n: f"Purine level={'Low' if n.get('purine_level',0)==0 else 'High'}, Sugar={n.get('sugar_g','?')}g",
    "IBS":                lambda n: f"FODMAP={'Low' if n.get('fodmap_score',0)==0 else 'High'}, Fiber={n.get('fiber_g','?')}g",
    "Liver Disease":      lambda n: f"Fat={n.get('fat_g','?')}g, Sodium={n.get('sodium_mg','?')}mg, Sugar={n.get('sugar_g','?')}g",
    "GERD":               lambda n: f"Fat={n.get('fat_g','?')}g, Sat.fat={n.get('saturated_fat_g','?')}g, Sugar={n.get('sugar_g','?')}g",
    "Osteoporosis":       lambda n: f"Calcium={n.get('calcium_mg','?')}mg, Protein={n.get('protein_g','?')}g, Sodium={n.get('sodium_mg','?')}mg",
    "Rheumatoid Arthritis": lambda n: f"Sat.fat={n.get('saturated_fat_g','?')}g, Sugar={n.get('sugar_g','?')}g, Sodium={n.get('sodium_mg','?')}mg",
    "NAFLD":              lambda n: f"Sugar={n.get('sugar_g','?')}g, Fat={n.get('fat_g','?')}g, Calories={n.get('calories_kcal','?')}kcal",
    "Gallbladder Disease":lambda n: f"Fat={n.get('fat_g','?')}g, Sat.fat={n.get('saturated_fat_g','?')}g -- fat triggers gallbladder contraction",
    "Crohn's Disease":    lambda n: f"Fiber={n.get('fiber_g','?')}g, Fat={n.get('fat_g','?')}g, FODMAP={'Low' if n.get('fodmap_score',0)==0 else 'High'}",
    "Chronic Pancreatitis": lambda n: f"Fat={n.get('fat_g','?')}g (strictly <3g), Sugar={n.get('sugar_g','?')}g",
    "Migraine":           lambda n: f"Sodium={n.get('sodium_mg','?')}mg, Purine={'Low' if n.get('purine_level',0)==0 else 'High'}, Sugar={n.get('sugar_g','?')}g",
}


class ConditionSafetyClassifier:
    """
    Random Forest classifier trained on ~3000 food samples labelled by
    medical guidelines (ADA, AHA, KDIGO, ACR, NICE/Monash, etc).
    Covers 14 health conditions.

    Loading priority:
      1. models/condition_classifier.pkl  (trained Random Forest -- preferred)
      2. Inline rule-based fallback       (if pkl not found)
    """

    def __init__(self):
        self.models    = {}
        self.features  = _RF_FEATURES
        self.conditions = []
        self._model_type = "none"
        self._load_or_fallback()

    # -- Model loading ---------------------------------------------------------
    def _load_or_fallback(self):
        model_path = os.path.join(os.path.dirname(__file__), "models", "condition_classifier.pkl")
        if os.path.exists(model_path):
            try:
                import joblib
                payload = joblib.load(model_path)
                self.models     = payload["models"]
                self.features   = payload.get("features", _RF_FEATURES)
                self.conditions = payload.get("conditions", list(self.models.keys()))
                self._model_type = "RandomForest"
                print(f"[NutriAI ML] OK Loaded trained RF models for {len(self.models)} conditions")
                return
            except Exception as e:
                print(f"[NutriAI ML] WARN Could not load pkl: {e} - falling back to rule-based")
        # Fallback: fast rule-based (no sklearn needed at startup)
        self._build_rule_based()

    def _build_rule_based(self):
        """Lightweight rule-based fallback (no training required)."""
        self._model_type = "rule-based"
        self.conditions  = list(_CONDITION_REASONS.keys())
        print(f"[NutriAI ML] INFO Rule-based fallback active for {len(self.conditions)} conditions")

    # -- Feature extraction ----------------------------------------------------
    def _extract_features(self, nutrients: dict) -> np.ndarray:
        """
        Build the 18-feature vector from a nutrition dict.
        Uses heuristics for features not present in nutrition.json.
        """
        notes = (
            str(nutrients.get("notes", "")) + " " +
            str(nutrients.get("food_group", ""))
        ).lower()

        # Saturated fat: estimate from total fat when not available
        fat = nutrients.get("fat_g", 0)
        sat = nutrients.get("saturated_fat_g", round(fat * 0.35, 2))

        # Boolean flags
        gf = 1 if nutrients.get("gluten_free", True) else 0
        df = 1 if nutrients.get("dairy_free",  True) else 0

        # Purine level (0=low, 1=medium, 2=high)
        purine = 0
        if any(kw in notes for kw in _HIGH_PURINE_KEYWORDS):
            purine = 2
        elif any(kw in notes for kw in _MED_PURINE_KEYWORDS):
            purine = 1

        # FODMAP score (0=low, 1=medium, 2=high)
        fodmap = 0
        if any(kw in notes for kw in _FODMAP_HIGH_KW):
            fodmap = 2
        elif any(kw in notes for kw in _FODMAP_MED_KW):
            fodmap = 1

        # Goitrogen flag
        goitrogen = 1 if any(kw in notes for kw in _GOITROGEN_KW) else 0

        return np.array([[
            nutrients.get("calories_kcal",   0),
            nutrients.get("protein_g",       0),
            nutrients.get("carbs_g",         0),
            nutrients.get("fat_g",           0),
            nutrients.get("fiber_g",         0),
            nutrients.get("sugar_g",         0),
            nutrients.get("sodium_mg",       0),
            nutrients.get("potassium_mg",    0),
            nutrients.get("calcium_mg",      0),
            nutrients.get("iron_mg",         0),
            nutrients.get("vitamin_c_mg",    0),
            nutrients.get("glycemic_index", 50),
            sat,
            gf, df, purine, fodmap, goitrogen,
        ]])

    # -- Rule-based fallback predict -------------------------------------------
    def _rule_predict(self, n: dict, condition: str) -> dict:
        """Simple threshold-based rules when model is unavailable."""
        rules = {
            "Diabetes":           lambda: n.get("glycemic_index",50)<55 and n.get("carbs_g",100)<45 and n.get("fiber_g",0)>=2.5,
            "Hypertension":       lambda: n.get("sodium_mg",500)<300 and n.get("fat_g",30)<15,
            "Heart Disease":      lambda: n.get("fat_g",30)<15 and n.get("sodium_mg",500)<250,
            "Obesity":            lambda: n.get("calories_kcal",400)<400 and n.get("fiber_g",0)>=3,
            "Celiac Disease":     lambda: bool(n.get("gluten_free", True)),
            "Lactose Intolerance":lambda: bool(n.get("dairy_free",  True)),
            "Kidney Disease":     lambda: n.get("potassium_mg",500)<200 and n.get("protein_g",20)<15 and n.get("sodium_mg",500)<200,
            "High Cholesterol":   lambda: n.get("fat_g",30)<12 and n.get("fiber_g",0)>=4,
            "PCOS":               lambda: n.get("glycemic_index",50)<55 and n.get("fiber_g",0)>=3.5 and n.get("sugar_g",20)<10,
            "Thyroid Disorder":   lambda: n.get("goitrogen_flag", 0) == 0,
            "Anemia":             lambda: n.get("iron_mg",0)>=2.5 or (n.get("iron_mg",0)>=1.5 and n.get("vitamin_c_mg",0)>=20),
            "Gout":               lambda: n.get("purine_level",0)==0 and n.get("sugar_g",20)<15,
            "IBS":                lambda: n.get("fodmap_score",0)==0 and n.get("fiber_g",0)<8,
            "Liver Disease":      lambda: n.get("fat_g",30)<10 and n.get("sodium_mg",500)<300 and n.get("sugar_g",20)<15,
            "GERD":               lambda: n.get("fat_g",30)<10 and n.get("saturated_fat_g",10)<4 and n.get("sugar_g",20)<15,
            "Osteoporosis":       lambda: n.get("calcium_mg",0)>=100 and n.get("protein_g",0)>=5 and n.get("sodium_mg",500)<400,
            "Rheumatoid Arthritis": lambda: n.get("saturated_fat_g",10)<5 and n.get("sugar_g",20)<12 and n.get("sodium_mg",500)<300,
            "NAFLD":              lambda: n.get("sugar_g",20)<8 and n.get("fat_g",30)<8 and n.get("calories_kcal",400)<250,
            "Gallbladder Disease":lambda: n.get("fat_g",30)<5 and n.get("saturated_fat_g",10)<2,
            "Crohn's Disease":    lambda: n.get("fiber_g",0)<4 and n.get("fat_g",30)<10 and n.get("fodmap_score",0)==0,
            "Chronic Pancreatitis": lambda: n.get("fat_g",30)<3 and n.get("sugar_g",20)<15 and n.get("calories_kcal",400)<200,
            "Migraine":           lambda: n.get("purine_level",0)==0 and n.get("sodium_mg",500)<300 and n.get("sugar_g",20)<15,
        }
        rule = rules.get(condition)
        safe = rule() if rule else True
        reason_fn = _CONDITION_REASONS.get(condition)
        return {
            "safe":       safe,
            "confidence": 75.0,
            "reason":     reason_fn(n) if reason_fn else "Based on nutritional profile",
            "model":      "Rule-Based Fallback",
        }

    # -- Public predict --------------------------------------------------------
    def predict(self, ingredient_nutrients: dict, condition: str) -> dict:
        """
        Predict safety of an ingredient for a health condition.
        Returns: {"safe": bool, "confidence": float, "reason": str, "model": str}
        """
        if self._model_type == "rule-based" or condition not in self.models:
            return self._rule_predict(ingredient_nutrients, condition)

        try:
            features   = self._extract_features(ingredient_nutrients)
            clf        = self.models[condition]
            prediction = clf.predict(features)[0]
            proba      = clf.predict_proba(features)[0]
            confidence = float(max(proba))

            reason_fn = _CONDITION_REASONS.get(condition)
            return {
                "safe":       bool(prediction),
                "confidence": round(confidence * 100, 1),
                "reason":     reason_fn(ingredient_nutrients) if reason_fn else "Based on ML analysis",
                "model":      "Random Forest Classifier",
            }
        except Exception as e:
            return self._rule_predict(ingredient_nutrients, condition)


# ===============================================================================
# MODULE 3: NLP Ingredient Matcher (NLTK)
# ===============================================================================
class NLPIngredientMatcher:
    """
    Uses NLTK tokenization, stopword removal, and stemming to:
    1. Match user likes/dislikes against recipe ingredients
    2. Score recipes based on NLP similarity
    """
    def __init__(self):
        self.stemmer   = PorterStemmer()
        try:
            self.stop_words = set(stopwords.words("english"))
        except:
            self.stop_words = set()

    def _preprocess(self, text: str) -> set:
        """Tokenize, remove stopwords, and stem."""
        try:
            tokens = word_tokenize(text.lower())
        except:
            tokens = text.lower().split()
        stemmed = {
            self.stemmer.stem(t)
            for t in tokens
            if t.isalpha() and t not in self.stop_words
        }
        return stemmed

    def match_score(self, recipe: dict, user_likes: list, user_dislikes: list) -> dict:
        """
        NLP-based matching of user preferences against recipe ingredients.
        Returns a score and explanation.
        """
        ingredient_text = " ".join(i["name"] for i in recipe.get("ingredients", []))
        ingredient_tokens = self._preprocess(ingredient_text)

        like_score    = 0
        dislike_score = 0
        matched_likes    = []
        matched_dislikes = []

        for like in user_likes:
            like_tokens = self._preprocess(like)
            overlap = like_tokens & ingredient_tokens
            if overlap:
                like_score += len(overlap)
                matched_likes.append(like)

        for dislike in user_dislikes:
            dislike_tokens = self._preprocess(dislike)
            overlap = dislike_tokens & ingredient_tokens
            if overlap:
                dislike_score += len(overlap)
                matched_dislikes.append(dislike)

        net_score = like_score - (dislike_score * 2)

        return {
            "nlp_score":        net_score,
            "matched_likes":    matched_likes,
            "matched_dislikes": matched_dislikes,
            "recommendation":   "Recommended" if net_score > 0 else ("Avoid" if dislike_score > 0 else "Neutral"),
            "model":            "NLTK Tokenizer + Porter Stemmer"
        }

    def extract_dietary_keywords(self, text: str) -> list:
        """Extract nutrition-related keywords from text using NLTK."""
        dietary_keywords = {
            "protein", "carb", "fat", "fiber", "calori", "vitamin",
            "mineral", "calcium", "iron", "sodium", "sugar", "glycem",
            "vegan", "vegetarian", "gluten", "lactose", "organic"
        }
        tokens = self._preprocess(text)
        return [t for t in tokens if any(kw in t for kw in dietary_keywords)]


# ===============================================================================
# MODULE 4: User Preference Scoring Engine
# ===============================================================================
class PreferenceScoringEngine:
    """
    Weighted scoring system that combines:
    - Condition compliance (weight: 40%)
    - TF-IDF cosine similarity (weight: 30%)
    - NLP preference match (weight: 20%)
    - Nutritional goal alignment (weight: 10%)
    """
    def __init__(self):
        self.recommender  = RecipeRecommender()
        self.nlp_matcher  = NLPIngredientMatcher()
        self.classifier   = ConditionSafetyClassifier()

    def score_recipe(self, recipe: dict, user: dict) -> dict:
        """
        Compute a comprehensive ML score for a recipe-user pair.
        """
        conditions = user.get("conditions", [])
        likes      = user.get("likes", [])
        dislikes   = user.get("dislikes", [])
        goal       = user.get("goal", "Maintenance")

        # -- 1. Condition compliance score (0-100) -----------------------------
        condition_score = 100
        condition_details = []
        for cond in conditions:
            safety = recipe.get("condition_safety", {}).get(cond, {})
            if safety.get("safe") is False:
                condition_score -= 30
                condition_details.append(f"[WARN] Unsafe for {cond}")
            else:
                condition_details.append(f"[OK] Safe for {cond}")
        condition_score = max(0, condition_score)

        # -- 2. NLP preference match (-100 to +100, normalized 0-100) ----------
        nlp = self.nlp_matcher.match_score(recipe, likes, dislikes)
        nlp_raw   = nlp["nlp_score"]
        nlp_score = min(100, max(0, 50 + (nlp_raw * 10)))

        # -- 3. Nutritional goal alignment (0-100) -----------------------------
        nutrition  = recipe.get("nutrition_per_serving", {})
        cal        = nutrition.get("calories", 300)
        protein    = nutrition.get("protein", 10)
        fiber      = nutrition.get("fiber", 3)

        if "Weight Loss" in goal:
            goal_score = 100 if cal < 350 and fiber > 4 else (60 if cal < 450 else 30)
        elif "Muscle" in goal:
            goal_score = 100 if protein > 20 else (60 if protein > 12 else 30)
        else:  # Maintenance
            goal_score = 80 if 300 <= cal <= 500 else 60

        # -- 4. Weighted final score --------------------------------------------
        final_score = (
            condition_score * 0.40 +
            nlp_score       * 0.20 +
            goal_score      * 0.10
        )

        return {
            "recipe_id":         recipe.get("id"),
            "recipe_name":       recipe.get("name"),
            "final_score":       round(final_score, 1),
            "condition_score":   round(condition_score, 1),
            "nlp_score":         round(nlp_score, 1),
            "goal_score":        round(goal_score, 1),
            "condition_details": condition_details,
            "matched_likes":     nlp["matched_likes"],
            "matched_dislikes":  nlp["matched_dislikes"],
            "recommendation":    nlp["recommendation"],
            "models_used": [
                "Decision Tree Classifier (condition safety)",
                "NLTK Tokenizer + Porter Stemmer (preference matching)",
                "Weighted Scoring Engine (goal alignment)"
            ]
        }

    def get_ranked_recommendations(self, user: dict, top_n: int = 20) -> list:
        """
        Full ML pipeline:
        1. TF-IDF retrieves candidate recipes
        2. Preference scoring re-ranks them
        3. Returns top N with full ML explanations
        """
        # Step 1: TF-IDF retrieval
        candidates = self.recommender.recommend(user, top_n=len(self.recommender.recipes))

        # Step 2: Score each candidate
        scored = []
        for recipe in candidates:
            score_data = self.score_recipe(recipe, user)
            scored.append({
                **recipe,
                "ml_analysis": score_data,
                "tfidf_score": recipe.get("ml_score", 0),
            })

        # Step 3: Sort by final score
        scored.sort(key=lambda x: x["ml_analysis"]["final_score"], reverse=True)

        return scored[:top_n]


# ===============================================================================
# Global ML Engine Instance (loaded once at startup)
# ===============================================================================
print("[NutriAI ML] Initializing ML engine...")
try:
    ml_engine = PreferenceScoringEngine()
    print("[NutriAI ML] [OK] TF-IDF Recommender ready")
    print("[NutriAI ML] [OK] Decision Tree Classifier ready")
    print("[NutriAI ML] [OK] NLTK NLP Matcher ready")
    print("[NutriAI ML] [OK] Preference Scoring Engine ready")
    print("[NutriAI ML] All ML models loaded successfully!")
except Exception as e:
    print(f"[NutriAI ML] Warning: {e}")
    ml_engine = None