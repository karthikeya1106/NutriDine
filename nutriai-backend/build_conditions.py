"""
Generate data/conditions.json -- NutriAI Health Conditions Encyclopedia
60+ conditions covering all major categories with full dietary guidance.
"""
import json, os

CONDITIONS = [

  # ══════════════════════════════════════════════════════════
  # METABOLIC
  # ══════════════════════════════════════════════════════════
  {
    "slug": "type-2-diabetes",
    "name": "Type 2 Diabetes",
    "category": "Metabolic",
    "prevalence": "422 million people worldwide (WHO)",
    "icd10": "E11",
    "overview": "Type 2 diabetes is a condition where the body cannot use insulin effectively, leading to elevated blood sugar levels. It is the most common form of diabetes and is strongly influenced by diet and lifestyle.",
    "why_diet_matters": "Every meal you eat directly raises blood sugar. The right foods slow glucose absorption, reduce insulin spikes, and help manage HbA1c — the key long-term marker of diabetes control.",
    "foods": {
      "eat_freely": ["Leafy greens (spinach, kale)", "Broccoli and cauliflower", "Cucumber and celery", "Eggs", "Lean fish (salmon, tuna)", "Berries (in moderation)", "Nuts and seeds", "Plain Greek yogurt"],
      "limit": ["Brown rice", "Whole grain bread", "Oats", "Bananas", "Sweet potatoes", "Legumes (watch portions)", "Fruit juice (small amounts)"],
      "avoid": ["White rice", "White bread and pasta", "Sugary drinks and soda", "Candy and sweets", "Cakes and pastries", "High-fructose corn syrup", "Fried foods"]
    },
    "key_nutrients": { "focus_on": ["Fiber (slows glucose absorption)", "Chromium (improves insulin sensitivity)", "Magnesium", "Omega-3 fatty acids"], "limit": ["Simple sugars", "Refined carbohydrates", "Saturated fat"] },
    "meal_tips": ["Eat at consistent times daily to stabilise blood sugar", "Keep carbs under 45-60g per meal", "Never skip meals — it causes blood sugar crashes", "Pair carbs with protein and fat to slow absorption"],
    "lifestyle_tips": ["Walk for 10-15 minutes after each meal", "Monitor blood glucose regularly", "Maintain a healthy body weight — even 5% weight loss improves control"],
    "authority": "American Diabetes Association",
    "authority_url": "https://diabetes.org",
    "related": ["Obesity", "Hypertension", "PCOS", "High Cholesterol"],
    "ml_supported": True
  },
  {
    "slug": "type-1-diabetes",
    "name": "Type 1 Diabetes",
    "category": "Metabolic",
    "prevalence": "8 million people worldwide",
    "icd10": "E10",
    "overview": "Type 1 diabetes is an autoimmune condition where the pancreas produces little or no insulin. It requires insulin therapy and careful carbohydrate counting to manage blood glucose levels.",
    "why_diet_matters": "Carbohydrate intake directly determines your insulin dose. Consistent meal composition and timing help maintain stable blood sugar and reduce the risk of dangerous hypoglycaemia or hyperglycaemia.",
    "foods": {
      "eat_freely": ["Non-starchy vegetables", "Lean proteins", "Healthy fats (avocado, nuts)", "Eggs", "Low-sugar berries"],
      "limit": ["All carbohydrate-containing foods (carefully count quantity)", "Fruit (count portions)", "Whole grains (count portions)", "Dairy (count carbs)"],
      "avoid": ["Sugary drinks", "High-sugar foods without insulin cover", "Alcohol on an empty stomach"]
    },
    "key_nutrients": { "focus_on": ["Consistent carbohydrate intake", "Fiber", "Protein", "Healthy fats"], "limit": ["Simple sugars", "High-GI foods"] },
    "meal_tips": ["Count carbohydrates at every meal", "Keep fast-acting carbs nearby for hypoglycaemia", "Eat at regular, predictable times", "Account for exercise — it lowers blood sugar hours later"],
    "lifestyle_tips": ["Always carry glucose tablets or juice", "Wear a medical ID", "Work with your diabetes team for personalised insulin-to-carb ratios"],
    "authority": "JDRF / American Diabetes Association",
    "authority_url": "https://www.jdrf.org",
    "related": ["Celiac Disease", "Thyroid Disorder", "Kidney Disease"],
    "ml_supported": False
  },
  {
    "slug": "obesity",
    "name": "Obesity",
    "category": "Metabolic",
    "prevalence": "Over 1 billion adults worldwide (WHO 2022)",
    "icd10": "E66",
    "overview": "Obesity is a complex condition involving excess body fat that increases the risk of many diseases including diabetes, heart disease, and joint problems. It is driven by genetics, environment, and behaviour — not just willpower.",
    "why_diet_matters": "A sustainable calorie deficit combined with high-nutrient foods is the most effective dietary approach. Crash dieting slows metabolism — steady changes build lasting results.",
    "foods": {
      "eat_freely": ["Non-starchy vegetables", "Lean protein (chicken, fish, legumes)", "Broth-based soups", "Herbs and spices", "Water, green tea", "Eggs"],
      "limit": ["Whole grains (watch portions)", "Fruit (1-2 portions/day)", "Healthy fats (nutrient-dense but calorie-dense)", "Dairy (choose low-fat)"],
      "avoid": ["Ultra-processed foods", "Sugary drinks", "Fried foods", "High-calorie snacks", "Fast food", "Alcohol (excess calories)"]
    },
    "key_nutrients": { "focus_on": ["Protein (preserves muscle during weight loss)", "Fiber (keeps you full)", "Water"], "limit": ["Added sugar", "Saturated fat", "Refined carbs"] },
    "meal_tips": ["Eat slowly — it takes 20 minutes for fullness signals to reach the brain", "Use smaller plates", "Never eat in front of screens", "Have a protein source at every meal"],
    "lifestyle_tips": ["Aim for 150+ minutes of moderate exercise per week", "Track meals (awareness helps, not just restriction)", "Address emotional eating with support"],
    "authority": "World Health Organisation / NICE",
    "authority_url": "https://www.who.int/news-room/fact-sheets/detail/obesity-and-overweight",
    "related": ["Diabetes", "Hypertension", "Heart Disease", "Sleep Apnoea", "NAFLD"],
    "ml_supported": True
  },
  {
    "slug": "metabolic-syndrome",
    "name": "Metabolic Syndrome",
    "category": "Metabolic",
    "prevalence": "25% of adults globally",
    "icd10": "E88.81",
    "overview": "Metabolic syndrome is a cluster of conditions — high blood sugar, excess abdominal fat, high blood pressure, and abnormal cholesterol — that together dramatically increase the risk of heart disease and diabetes.",
    "why_diet_matters": "Diet is the foundation of treating metabolic syndrome. The Mediterranean diet has the strongest evidence for reducing all five components simultaneously.",
    "foods": {
      "eat_freely": ["Olive oil", "Fish and seafood", "Colourful vegetables", "Legumes", "Nuts", "Herbs and spices"],
      "limit": ["Red meat (1-2x/week)", "Whole grain carbs", "Natural sugars in fruit"],
      "avoid": ["Trans fats", "Sugary drinks", "Refined carbs", "Processed meats", "Excess salt", "Alcohol"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 fatty acids", "Fiber", "Antioxidants", "Magnesium"], "limit": ["Saturated fat", "Simple sugars", "Sodium"] },
    "meal_tips": ["Follow Mediterranean meal pattern as closely as possible", "Eat anti-inflammatory foods daily", "Reduce meal portion sizes consistently"],
    "lifestyle_tips": ["Waist circumference reduction is the key measurable goal", "30 minutes walking daily significantly reduces risk", "Sleep quality directly impacts metabolic health"],
    "authority": "American Heart Association",
    "authority_url": "https://www.heart.org",
    "related": ["Diabetes", "Hypertension", "Heart Disease", "Obesity", "High Cholesterol"],
    "ml_supported": False
  },
  {
    "slug": "hyperuricemia",
    "name": "Hyperuricemia (High Uric Acid)",
    "category": "Metabolic",
    "prevalence": "21% of US adults",
    "icd10": "E79.0",
    "overview": "Hyperuricemia is elevated uric acid in the blood caused by excess purine breakdown. If untreated, it progresses to gout (painful joint crystals) and increases kidney stone risk.",
    "why_diet_matters": "Purines from food break down into uric acid. Fructose (from sugar) also raises uric acid independently of purines. Dietary changes can reduce uric acid by up to 15%.",
    "foods": {
      "eat_freely": ["Cherries (actively lower uric acid)", "Low-fat dairy", "Vegetables (most)", "Coffee (protective)", "Eggs", "Whole grains"],
      "limit": ["Red meat", "Poultry", "Shellfish", "Beans and lentils", "Spinach and asparagus (moderate purines)"],
      "avoid": ["Organ meats (liver, kidney)", "Anchovies, sardines, herring", "Alcohol (especially beer)", "Sugary drinks", "High-fructose corn syrup"]
    },
    "key_nutrients": { "focus_on": ["Vitamin C (lowers uric acid)", "Cherry compounds", "Low-fat dairy proteins"], "limit": ["Purines", "Fructose", "Alcohol"] },
    "meal_tips": ["Drink 8+ glasses of water daily to flush uric acid", "Eat cherries or drink tart cherry juice regularly", "Avoid large protein meals in one sitting"],
    "lifestyle_tips": ["Lose weight gradually (crash dieting raises uric acid temporarily)", "Avoid dehydration — it concentrates uric acid"],
    "authority": "American College of Rheumatology",
    "authority_url": "https://rheumatology.org",
    "related": ["Gout", "Kidney Stones", "Hypertension", "Metabolic Syndrome"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # CARDIOVASCULAR
  # ══════════════════════════════════════════════════════════
  {
    "slug": "hypertension",
    "name": "Hypertension (High Blood Pressure)",
    "category": "Cardiovascular",
    "prevalence": "1.28 billion adults worldwide (WHO)",
    "icd10": "I10",
    "overview": "Hypertension occurs when blood pressure consistently reads 130/80 mmHg or higher. It is called the 'silent killer' because it causes no symptoms while damaging arteries, the heart, kidneys, and brain.",
    "why_diet_matters": "The DASH diet (Dietary Approaches to Stop Hypertension) has been clinically proven to lower blood pressure by 8-14 mmHg — comparable to some medications — through low sodium and high potassium intake.",
    "foods": {
      "eat_freely": ["Dark leafy greens (potassium-rich)", "Berries", "Oats", "Bananas", "Avocados", "Fatty fish", "Beetroot"],
      "limit": ["Canned foods (rinse first)", "Restaurant meals", "Condiments (sauces, dressings)", "Red meat (1-2x/week)"],
      "avoid": ["Table salt and salty snacks", "Processed meats", "Fast food", "Alcohol (excess)", "Pickles and preserved foods", "Instant noodles"]
    },
    "key_nutrients": { "focus_on": ["Potassium (counteracts sodium)", "Magnesium", "Calcium", "Fiber", "Omega-3"], "limit": ["Sodium (under 1500mg/day)", "Saturated fat", "Alcohol"] },
    "meal_tips": ["Cook at home — you control the salt", "Use herbs and spices instead of salt for flavour", "Eat potassium-rich foods at every meal", "Read food labels — even bread contains salt"],
    "lifestyle_tips": ["30 minutes aerobic exercise daily lowers BP by 5-8 mmHg", "Stress reduction (yoga, meditation) has measurable effect", "Limit alcohol to 1 drink/day max"],
    "authority": "American College of Cardiology / AHA",
    "authority_url": "https://www.heart.org/en/health-topics/high-blood-pressure",
    "related": ["Heart Disease", "Stroke", "Kidney Disease", "Diabetes", "Metabolic Syndrome"],
    "ml_supported": True
  },
  {
    "slug": "heart-disease",
    "name": "Coronary Heart Disease",
    "category": "Cardiovascular",
    "prevalence": "620 million people globally",
    "icd10": "I25",
    "overview": "Coronary heart disease occurs when arteries supplying the heart become narrowed by plaque (atherosclerosis). It is the leading cause of death worldwide. Diet has a direct impact on plaque formation and progression.",
    "why_diet_matters": "Saturated and trans fats raise LDL cholesterol which builds plaque in arteries. A Mediterranean or DASH diet reduces cardiovascular events by 30% in clinical trials.",
    "foods": {
      "eat_freely": ["Olive oil", "Fatty fish (salmon, mackerel)", "Nuts and seeds", "Whole grains", "Colourful vegetables", "Berries", "Legumes"],
      "limit": ["Red meat (unprocessed, small portions)", "Eggs (up to 1/day)", "Full-fat dairy", "Poultry skin"],
      "avoid": ["Trans fats and hydrogenated oils", "Processed meats (bacon, sausage)", "Fried foods", "High-sodium foods", "Sugary foods and drinks"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 fatty acids (reduce triglycerides)", "Soluble fiber (lowers LDL)", "Plant sterols", "Antioxidants (vitamins C, E)"], "limit": ["Saturated fat", "Trans fat", "Dietary cholesterol (some individuals)", "Sodium"] },
    "meal_tips": ["Use olive oil instead of butter for all cooking", "Eat oily fish at least twice a week", "Replace white carbs with whole grain versions", "Snack on a handful of nuts instead of crisps"],
    "lifestyle_tips": ["Quitting smoking is the single biggest cardiovascular intervention", "Achieve and maintain a healthy weight", "Manage stress — cortisol directly damages arteries"],
    "authority": "American Heart Association",
    "authority_url": "https://www.heart.org",
    "related": ["High Cholesterol", "Hypertension", "Diabetes", "Obesity"],
    "ml_supported": True
  },
  {
    "slug": "high-cholesterol",
    "name": "High Cholesterol (Hyperlipidaemia)",
    "category": "Cardiovascular",
    "prevalence": "39% of adults globally (WHO)",
    "icd10": "E78.5",
    "overview": "High cholesterol means elevated levels of LDL ('bad') cholesterol or triglycerides, or low HDL ('good') cholesterol in the blood. It is a major risk factor for heart disease and stroke with no symptoms until damage is done.",
    "why_diet_matters": "Saturated and trans fats directly raise LDL cholesterol. Soluble fiber actively removes cholesterol from the bloodstream. Diet changes can reduce LDL by 10-20%.",
    "foods": {
      "eat_freely": ["Oats and barley (beta-glucan)", "Beans and lentils", "Fatty fish", "Nuts (especially walnuts, almonds)", "Avocados", "Olive oil", "Fruits and vegetables"],
      "limit": ["Eggs (watch total dietary cholesterol)", "Full-fat dairy", "Lean meats in moderation"],
      "avoid": ["Trans fats (partially hydrogenated oils)", "Saturated fats (butter, lard, cream)", "Processed meats", "Fried foods", "Baked goods with shortening"]
    },
    "key_nutrients": { "focus_on": ["Soluble fiber (oats, beans, flaxseed)", "Omega-3 fatty acids", "Plant sterols/stanols", "Niacin-rich foods"], "limit": ["Saturated fat (<7% of calories)", "Trans fats (zero tolerance)", "Dietary cholesterol"] },
    "meal_tips": ["Start the day with oats — beta-glucan is a proven LDL reducer", "Use olive oil as your main fat", "Eat a small handful of walnuts daily", "Add flaxseed or chia to meals for plant omega-3"],
    "lifestyle_tips": ["Regular aerobic exercise raises HDL (good cholesterol)", "Lose weight if overweight — even 5-10% improves lipid profile", "Quit smoking — it lowers HDL"],
    "authority": "American Heart Association / NCEP ATP III",
    "authority_url": "https://www.heart.org/en/health-topics/cholesterol",
    "related": ["Heart Disease", "Hypertension", "Metabolic Syndrome", "Diabetes"],
    "ml_supported": True
  },
  {
    "slug": "heart-failure",
    "name": "Heart Failure",
    "category": "Cardiovascular",
    "prevalence": "64 million people worldwide",
    "icd10": "I50",
    "overview": "Heart failure is when the heart cannot pump enough blood to meet the body's needs. Fluid retention (oedema) is a key symptom. Sodium restriction and fluid management are critical components of management.",
    "why_diet_matters": "Excess sodium causes fluid retention that worsens heart failure. Studies show that sodium restriction reduces hospitalisations by 30%. Fluid itself must sometimes be limited.",
    "foods": {
      "eat_freely": ["Potassium-rich vegetables (under physician guidance)", "Lean proteins", "Fresh herbs for flavouring", "Whole grains"],
      "limit": ["All fluid intake (follow cardiologist's prescribed limit)", "Potassium-rich foods (if on ACE inhibitors — discuss with doctor)", "Red meat"],
      "avoid": ["Table salt and salty foods", "Processed and canned foods", "Fast food", "Alcohol", "Licorice (raises BP)", "Caffeine in excess"]
    },
    "key_nutrients": { "focus_on": ["Potassium balance (under medical supervision)", "Magnesium", "Coenzyme Q10"], "limit": ["Sodium (typically <1500mg/day)", "Fluid (if prescribed)", "Saturated fat"] },
    "meal_tips": ["Weigh yourself every morning — sudden 2kg gain means fluid retention (call doctor)", "Cook everything from scratch to control salt", "Flavour with citrus, vinegar, and herbs"],
    "lifestyle_tips": ["Fluid restriction is often prescribed — follow it precisely", "Daily weight monitoring is essential for early warning", "Cardiac rehab programs significantly improve outcomes"],
    "authority": "American College of Cardiology / Heart Failure Society",
    "authority_url": "https://www.acc.org",
    "related": ["Hypertension", "Coronary Heart Disease", "Kidney Disease"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # DIGESTIVE / GASTROINTESTINAL
  # ══════════════════════════════════════════════════════════
  {
    "slug": "ibs",
    "name": "Irritable Bowel Syndrome (IBS)",
    "category": "Digestive",
    "prevalence": "11% of the global population",
    "icd10": "K58",
    "overview": "IBS is a common digestive disorder causing abdominal pain, bloating, and altered bowel habits (diarrhoea, constipation, or both). Symptoms are triggered by specific foods and stress, and vary greatly between individuals.",
    "why_diet_matters": "Up to 80% of IBS patients report food as a trigger. The Low FODMAP diet — developed at Monash University — reduces symptoms in 75% of patients. Identifying personal triggers is key.",
    "foods": {
      "eat_freely": ["Rice", "Oats", "Bananas", "Blueberries", "Carrots", "Zucchini", "Eggs", "Lean meats", "Firm tofu", "Lactose-free dairy"],
      "limit": ["High-fibre foods initially", "Onion and garlic (cook and strain for flavour)", "Apples and pears", "Stone fruits"],
      "avoid": ["High-FODMAP personal triggers", "Garlic and onion (for most)", "Wheat in large amounts", "Milk and soft cheeses", "Honey", "Legumes (for some)"]
    },
    "key_nutrients": { "focus_on": ["Soluble fiber (soothes gut)", "Probiotics", "Low-FODMAP sources of nutrients"], "limit": ["FODMAPs (fermentable carbs)", "Insoluble fiber during flares", "Caffeine and alcohol"] },
    "meal_tips": ["Eat at regular times — irregular meals worsen IBS", "Chew food thoroughly", "Do not eat large meals — smaller portions reduce symptoms", "Keep a food-symptom diary to identify personal triggers"],
    "lifestyle_tips": ["Gut-directed hypnotherapy has clinical evidence", "Stress management directly reduces IBS severity", "Exercise improves gut motility"],
    "authority": "Monash University Low FODMAP / NICE",
    "authority_url": "https://www.monashfodmap.com",
    "related": ["Crohn's Disease", "Celiac Disease", "Anxiety"],
    "ml_supported": True
  },
  {
    "slug": "crohns-disease",
    "name": "Crohn's Disease",
    "category": "Digestive",
    "prevalence": "3 million in the US & Europe combined",
    "icd10": "K50",
    "overview": "Crohn's disease is a chronic inflammatory bowel disease that can affect any part of the digestive tract. It causes inflammation, pain, diarrhoea, and malnutrition. Diet management differs between flare periods and remission.",
    "why_diet_matters": "During flares, certain foods irritate the inflamed bowel and must be avoided. Malnutrition is a serious risk since inflammation impairs nutrient absorption. Adequate nutrition is essential for healing.",
    "foods": {
      "eat_freely": ["Well-cooked vegetables", "White rice and pasta", "Lean fish and chicken", "Bananas", "Refined cereals", "Eggs (usually tolerated)"],
      "limit": ["Raw vegetables during flares", "High-fibre foods during flares", "Dairy (many Crohn's patients are lactose intolerant)"],
      "avoid": ["Raw seeds, nuts, and popcorn", "Fried and greasy foods", "Spicy foods", "Alcohol", "Carbonated drinks", "Artificial sweeteners (sorbitol)"]
    },
    "key_nutrients": { "focus_on": ["Iron (prevent anaemia from bleeding)", "Calcium and Vitamin D (bone protection from steroids)", "Vitamin B12 (if terminal ileum is affected)", "Zinc", "Omega-3 (anti-inflammatory)"], "limit": ["Insoluble fiber during flares", "Fat during flares", "FODMAP foods"] },
    "meal_tips": ["Keep a food diary to identify personal triggers", "Eat 5-6 small meals rather than 3 large ones", "Stay well-hydrated — diarrhoea causes dehydration", "Elemental formulas may be needed during severe flares"],
    "lifestyle_tips": ["Work with an IBD specialist dietitian", "Smoking worsens Crohn's significantly", "Regular monitoring for nutritional deficiencies is essential"],
    "authority": "Crohn's and Colitis Foundation",
    "authority_url": "https://www.crohnscolitisfoundation.org",
    "related": ["Ulcerative Colitis", "IBS", "Anaemia", "Osteoporosis"],
    "ml_supported": True
  },
  {
    "slug": "ulcerative-colitis",
    "name": "Ulcerative Colitis",
    "category": "Digestive",
    "prevalence": "5 million people worldwide",
    "icd10": "K51",
    "overview": "Ulcerative colitis is chronic inflammation of the colon and rectum, causing bloody diarrhoea, cramping, and urgency. Unlike Crohn's, it is limited to the colon. Diet does not cause UC but significantly affects symptoms and nutritional status.",
    "why_diet_matters": "Flares increase nutritional needs while reducing appetite. Certain foods worsen diarrhoea and bleeding. Maintaining good nutrition helps sustain remission and supports medication effectiveness.",
    "foods": {
      "eat_freely": ["Bananas", "White rice", "Boiled potatoes (peeled)", "Lean proteins", "Eggs", "Well-cooked vegetables"],
      "limit": ["Raw fruits and vegetables during flares", "High-fibre foods", "Dairy (if lactose intolerant)"],
      "avoid": ["Alcohol", "Caffeine", "Spicy foods", "Fatty and fried foods", "Raw nuts and seeds", "Popcorn", "Carbonated drinks"]
    },
    "key_nutrients": { "focus_on": ["Calcium and Vitamin D", "Iron (due to blood loss)", "Folate", "Magnesium", "Vitamin B12"], "limit": ["Fiber during flares", "Fat during active disease"] },
    "meal_tips": ["Eat smaller, more frequent meals to rest the colon", "Stay well hydrated with water and oral rehydration drinks", "Nutritional supplements may be needed during flares"],
    "lifestyle_tips": ["Stress does not cause UC but worsens flares — manage it actively", "Always take prescribed medication consistently", "Regular blood tests to monitor nutritional status"],
    "authority": "Crohn's and Colitis Foundation",
    "authority_url": "https://www.crohnscolitisfoundation.org",
    "related": ["Crohn's Disease", "IBS", "Anaemia", "Colorectal Cancer risk"],
    "ml_supported": False
  },
  {
    "slug": "celiac-disease",
    "name": "Coeliac (Celiac) Disease",
    "category": "Digestive",
    "prevalence": "1 in 100 people worldwide",
    "icd10": "K90.0",
    "overview": "Celiac disease is an autoimmune condition triggered by gluten — a protein in wheat, barley, and rye. It causes the immune system to attack the small intestine's lining, leading to malabsorption of almost all nutrients.",
    "why_diet_matters": "A strict gluten-free diet is the only treatment. Even tiny amounts of gluten (as little as 20mg — the size of a breadcrumb) trigger an immune reaction that takes weeks to heal. Cross-contamination must be actively avoided.",
    "foods": {
      "eat_freely": ["Rice", "Potatoes", "Quinoa", "Corn (maize)", "Buckwheat", "Millet", "Tapioca", "All fruits and vegetables", "Meat, fish, eggs", "Legumes"],
      "limit": ["Oats (must be certified gluten-free)", "Processed foods (check every label)", "Restaurant food (cross-contamination risk)"],
      "avoid": ["Wheat (including spelt, kamut, farro, durum, semolina)", "Barley", "Rye", "Regular pasta, bread, cereals", "Beer", "Most soy sauce"]
    },
    "key_nutrients": { "focus_on": ["Iron (often deficient)", "Calcium and Vitamin D", "B vitamins (especially folate and B12)", "Zinc", "Fibre from GF grains"], "limit": ["Gluten (absolutely zero)"] },
    "meal_tips": ["Get dedicated gluten-free cookware to prevent cross-contamination", "Read every label — gluten hides in sauces, seasonings, and medications", "Eat whole naturally gluten-free foods rather than processed GF alternatives (less nutritious)"],
    "lifestyle_tips": ["Get family members tested — celiac is hereditary", "Annual nutritional blood tests are recommended", "Bone density scan recommended — celiac causes bone loss"],
    "authority": "Celiac Disease Foundation / Beyond Celiac",
    "authority_url": "https://celiac.org",
    "related": ["Type 1 Diabetes", "Thyroid Disorder", "Anaemia", "Osteoporosis"],
    "ml_supported": True
  },
  {
    "slug": "gerd",
    "name": "GERD (Acid Reflux)",
    "category": "Digestive",
    "prevalence": "20% of Western adults",
    "icd10": "K21",
    "overview": "Gastro-oesophageal reflux disease (GERD) occurs when stomach acid repeatedly flows back into the oesophagus, causing heartburn, regurgitation, and over time, damage to the oesophageal lining.",
    "why_diet_matters": "Certain foods relax the lower oesophageal sphincter or increase acid production, directly triggering reflux. Dietary changes reduce symptoms in most patients without needing medication.",
    "foods": {
      "eat_freely": ["Oatmeal", "Ginger (anti-inflammatory)", "Non-citrus fruits (bananas, melons)", "Lean meats and fish", "Egg whites", "Root vegetables", "Fennel"],
      "limit": ["Tomatoes and tomato sauce", "Citrus fruits", "Chocolate", "Peppermint", "Coffee (some tolerate small amounts)"],
      "avoid": ["Fried and fatty foods", "Alcohol", "Carbonated drinks", "Spicy foods", "Large meals (especially late at night)", "Lying down within 3 hours of eating"]
    },
    "key_nutrients": { "focus_on": ["Alkaline-forming foods", "Fiber (reduces acid exposure)", "Low-fat protein"], "limit": ["Saturated fat (relaxes sphincter)", "Acidic foods", "Caffeine"] },
    "meal_tips": ["Eat 4-5 smaller meals rather than 3 large ones", "Never eat within 3 hours of bedtime", "Elevate the head of your bed 15-20cm for night symptoms", "Eat slowly and chew thoroughly"],
    "lifestyle_tips": ["Lose weight if overweight — it significantly reduces GERD", "Avoid tight clothing around the abdomen", "Quit smoking — it weakens the oesophageal sphincter"],
    "authority": "American College of Gastroenterology",
    "authority_url": "https://gi.org",
    "related": ["Obesity", "Asthma", "Chronic Cough", "Barrett's Oesophagus"],
    "ml_supported": True
  },
  {
    "slug": "gallbladder-disease",
    "name": "Gallbladder Disease",
    "category": "Digestive",
    "prevalence": "10-15% of adults in developed countries",
    "icd10": "K80",
    "overview": "Gallbladder disease includes gallstones and cholecystitis (inflammation). Gallstones form when bile contains too much cholesterol or bilirubin. Fatty meals trigger gallbladder contractions, causing pain. Diet is central to both prevention and management.",
    "why_diet_matters": "Fat is the primary trigger for gallbladder contractions and pain. Very low fat diets reduce symptoms. However, very low calorie crash diets or fasting paradoxically cause gallstones — a balanced approach is needed.",
    "foods": {
      "eat_freely": ["Fruits and vegetables", "Whole grains", "Low-fat fish", "Egg whites", "Low-fat dairy", "Legumes"],
      "limit": ["Lean poultry (skin removed)", "Whole eggs (1/day)", "Avocado (healthy fat but fat nonetheless)", "Olive oil (small amounts)"],
      "avoid": ["Fried foods", "Fatty meats", "Butter and cream", "Cheese (high fat)", "Whole milk", "Fast food", "Cakes and pastries"]
    },
    "key_nutrients": { "focus_on": ["Vitamin C (reduces gallstone formation)", "Fiber (binds bile acids)", "Low-fat protein"], "limit": ["Total fat (<30% of calories)", "Saturated fat", "Cholesterol"] },
    "meal_tips": ["Never skip meals — regular eating prevents bile from becoming concentrated", "Eat 5 small meals rather than 3 large ones", "Avoid very large, fatty meals completely"],
    "lifestyle_tips": ["Maintain a healthy weight — obesity is the biggest risk factor", "Avoid rapid weight loss (crash dieting causes stones)", "Exercise regularly"],
    "authority": "American College of Gastroenterology",
    "authority_url": "https://gi.org",
    "related": ["Obesity", "High Cholesterol", "Diabetes"],
    "ml_supported": True
  },
  {
    "slug": "chronic-pancreatitis",
    "name": "Chronic Pancreatitis",
    "category": "Digestive",
    "prevalence": "50 per 100,000 adults",
    "icd10": "K86.1",
    "overview": "Chronic pancreatitis is persistent inflammation of the pancreas that impairs its ability to produce digestive enzymes and insulin. Fat digestion is severely affected, leading to malnutrition and fat malabsorption.",
    "why_diet_matters": "Fat is the most difficult nutrient for the damaged pancreas to process. Even small amounts of fat can trigger severe pain. Enzyme replacement therapy must be taken with all fat-containing meals.",
    "foods": {
      "eat_freely": ["White rice", "Plain boiled potatoes", "Lean fish (very low fat)", "Egg whites", "Plain pasta", "Cooked vegetables", "Bananas"],
      "limit": ["Very small amounts of healthy fats only", "Whole eggs (small amounts)", "Lean poultry (no skin)"],
      "avoid": ["All fried foods", "Fatty meats", "Dairy (full fat)", "Nuts and oils in large amounts", "Alcohol (absolutely critical)", "Spicy foods"]
    },
    "key_nutrients": { "focus_on": ["MCT oil (medium chain fats, easier to absorb)", "Fat-soluble vitamins (A, D, E, K) via supplements", "B12", "Zinc", "Pancreatic enzymes with all meals"], "limit": ["Long-chain fats", "Alcohol (absolutely zero)"] },
    "meal_tips": ["6 small low-fat meals daily is essential", "Take prescribed pancreatic enzyme supplements with every meal and snack", "MCT oil can be used as a safe fat source", "Nutritional support shakes may be needed"],
    "lifestyle_tips": ["Alcohol cessation is the single most important intervention regardless of cause", "Quit smoking — it significantly worsens pancreatitis", "Work with a specialist dietitian who understands pancreatic disease"],
    "authority": "American Pancreatic Association",
    "authority_url": "https://american-pancreatic-association.org",
    "related": ["Diabetes (pancreatic)", "Malnutrition", "NAFLD"],
    "ml_supported": True
  },
  {
    "slug": "nafld",
    "name": "Non-Alcoholic Fatty Liver Disease (NAFLD)",
    "category": "Digestive",
    "prevalence": "25% of global adult population",
    "icd10": "K76.0",
    "overview": "NAFLD is a buildup of excess fat in the liver not caused by alcohol. It ranges from simple fatty liver to NASH (with inflammation), which can progress to cirrhosis and liver failure. It is closely linked to obesity and metabolic syndrome.",
    "why_diet_matters": "Fructose is metabolised almost exclusively in the liver and is the primary driver of NAFLD. Weight loss of just 7-10% can reverse early NAFLD. Diet is the most effective treatment available.",
    "foods": {
      "eat_freely": ["Coffee (3+ cups/day is liver-protective)", "Leafy greens", "Fatty fish", "Olive oil", "Nuts", "Berries", "Broccoli and cruciferous vegetables"],
      "limit": ["Whole grains (controlled portions)", "Natural fruit (not juice)", "Lean meat (small portions)", "Dairy (low fat)"],
      "avoid": ["Fructose and high-fructose corn syrup", "Sugar-sweetened beverages", "White carbs", "Fried foods", "Alcohol", "Processed snacks", "Red meat (in excess)"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 fatty acids (reduce liver fat)", "Vitamin E (anti-inflammatory for NASH)", "Choline", "Coffee polyphenols"], "limit": ["Fructose (primary driver)", "Saturated fat", "Refined carbohydrates"] },
    "meal_tips": ["Drink 3+ cups of coffee daily — it has the strongest evidence for liver protection", "Replace sugary drinks with water and unsweetened coffee", "Follow a calorie-restricted Mediterranean diet for best results"],
    "lifestyle_tips": ["7-10% body weight loss reverses early NAFLD — make it your primary goal", "Exercise 150-300 minutes/week even if weight doesn't change immediately", "Avoid all alcohol"],
    "authority": "American Association for the Study of Liver Diseases (AASLD)",
    "authority_url": "https://www.aasld.org",
    "related": ["Obesity", "Metabolic Syndrome", "Diabetes", "Heart Disease"],
    "ml_supported": True
  },
  {
    "slug": "diverticular-disease",
    "name": "Diverticular Disease",
    "category": "Digestive",
    "prevalence": "30% of adults over 50",
    "icd10": "K57",
    "overview": "Diverticular disease involves small pouches (diverticula) that form in the colon wall. During diverticulitis (inflammation), a low-fibre diet is needed temporarily. In remission, high fibre prevents recurrence.",
    "why_diet_matters": "A lifelong high-fibre diet is the most evidence-based prevention for diverticular complications. During acute diverticulitis, a liquid or low-residue diet is needed to rest the colon.",
    "foods": {
      "eat_freely": ["High-fibre vegetables (in remission)", "Whole grains", "Legumes", "Fruits", "Nuts and seeds (current evidence shows these are SAFE, not a trigger)"],
      "limit": ["Refined carbohydrates", "Red meat (associated with higher risk)"],
      "avoid": ["Red and processed meat (in excess)", "Low-fibre diets long-term", "Solid foods during acute diverticulitis attack"]
    },
    "key_nutrients": { "focus_on": ["Dietary fiber (25-38g/day)", "Water (adequate hydration prevents constipation)", "Probiotics"], "limit": ["Saturated fat", "Red meat"] },
    "meal_tips": ["Increase fibre gradually to avoid bloating", "Drink plenty of water alongside high-fibre foods", "During flares, follow your doctor's liquid/low-residue diet"],
    "lifestyle_tips": ["Physical activity (especially vigorous exercise) significantly reduces diverticulitis risk", "Maintain healthy body weight", "Avoid NSAIDs which increase risk of diverticular bleeding"],
    "authority": "American Gastroenterological Association",
    "authority_url": "https://gastro.org",
    "related": ["IBS", "Colorectal Cancer", "Constipation"],
    "ml_supported": False
  },
  {
    "slug": "liver-disease",
    "name": "Liver Disease (Cirrhosis)",
    "category": "Digestive",
    "prevalence": "1.5 billion people globally have some form of liver disease",
    "icd10": "K74",
    "overview": "Cirrhosis is advanced scarring of the liver that impairs its ability to process nutrients, medications, and toxins. Malnutrition is almost universal in cirrhosis patients and significantly worsens outcomes.",
    "why_diet_matters": "The liver is central to nutrient metabolism. In cirrhosis, the liver cannot store glycogen, so patients need frequent meals to prevent muscle breakdown. Protein restriction (an old approach) is now discouraged — adequate protein is essential.",
    "foods": {
      "eat_freely": ["Vegetables and fruits", "Lean protein (chicken, fish, eggs, dairy)", "Complex carbohydrates", "Branched-chain amino acid enriched foods"],
      "limit": ["Salt (if ascites present)", "Foods high in saturated fat", "Sugar"],
      "avoid": ["Alcohol (absolutely zero)", "Raw shellfish (risk of fatal bacterial infection)", "High-sodium processed foods", "High-ammonia foods if in hepatic encephalopathy"]
    },
    "key_nutrients": { "focus_on": ["Protein (1.2-1.5g/kg/day — higher than for healthy adults)", "Zinc (almost universally deficient)", "Fat-soluble vitamins (A, D, E, K)", "B vitamins"], "limit": ["Sodium (if fluid retention present)", "Fluid (in some cases)", "Ammonia-generating foods"] },
    "meal_tips": ["Eat every 3-4 hours including a late-night snack (critical — prevents muscle breakdown)", "Never fast for extended periods", "A bedtime snack of complex carbs (oats, bread) reduces overnight muscle catabolism"],
    "lifestyle_tips": ["Late evening snacking is medically recommended for cirrhosis — not indulgent", "Monitor for signs of malnutrition regularly", "Work with a hepatology dietitian"],
    "authority": "European Association for the Study of the Liver (EASL)",
    "authority_url": "https://easl.eu",
    "related": ["NAFLD", "Hepatitis B/C", "Alcohol Use Disorder"],
    "ml_supported": True
  },

  # ══════════════════════════════════════════════════════════
  # KIDNEY
  # ══════════════════════════════════════════════════════════
  {
    "slug": "chronic-kidney-disease",
    "name": "Chronic Kidney Disease (CKD)",
    "category": "Kidney",
    "prevalence": "850 million people worldwide (10% of global population)",
    "icd10": "N18",
    "overview": "CKD is a progressive loss of kidney function over time. The kidneys cannot adequately filter waste, regulate minerals, or control blood pressure. Diet is the most complex and individualised aspect of CKD management.",
    "why_diet_matters": "Damaged kidneys cannot excrete potassium, phosphorus, and metabolic waste from protein. Excess of these causes dangerous complications. A renal diet must be carefully individualised by stage of disease.",
    "foods": {
      "eat_freely": ["Cabbage", "Cauliflower", "Bell peppers", "Blueberries", "Egg whites", "White rice", "Apple and cranberries"],
      "limit": ["Whole grains (higher phosphorus)", "Potassium-containing vegetables", "Dairy (phosphorus content)", "Protein (individualised to kidney stage)"],
      "avoid": ["Bananas, potatoes, tomatoes (high potassium)", "Salt substitutes (made of potassium chloride)", "Processed foods (high phosphorus additives)", "Herbal supplements", "Dark colas"]
    },
    "key_nutrients": { "focus_on": ["Individualised protein (0.6-0.8g/kg in early CKD, higher in dialysis)", "Monitoring potassium blood levels", "Phosphorus management", "Fluid management in advanced disease"], "limit": ["Potassium (if blood levels elevated)", "Phosphorus", "Sodium", "Fluid (in advanced stages)"] },
    "meal_tips": ["Every patient's limits are different — only follow a diet guided by your nephrologist and dietitian", "Read food labels for hidden phosphorus additives", "Leach vegetables (boil and discard water) to reduce potassium"],
    "lifestyle_tips": ["Blood pressure control is as important as diet in CKD", "Avoid NSAIDs (ibuprofen) — they worsen kidney function", "Regular monitoring of blood potassium, phosphorus, and creatinine is essential"],
    "authority": "Kidney Disease: Improving Global Outcomes (KDIGO)",
    "authority_url": "https://kdigo.org",
    "related": ["Diabetes", "Hypertension", "Heart Disease", "Anaemia"],
    "ml_supported": True
  },
  {
    "slug": "kidney-stones",
    "name": "Kidney Stones",
    "category": "Kidney",
    "prevalence": "1 in 11 people will have a kidney stone in their lifetime",
    "icd10": "N20",
    "overview": "Kidney stones form when minerals in urine crystallise. The most common type (calcium oxalate) is paradoxically managed by keeping calcium intake adequate (not reducing it). Hydration is the most effective prevention measure.",
    "why_diet_matters": "Diet strongly influences stone formation. Opposite to what many believe, reducing calcium actually increases kidney stone risk. The stone type determines specific dietary restrictions.",
    "foods": {
      "eat_freely": ["Citrus fruits (lemon juice actively prevents stones)", "Water (abundant)", "Vegetables (most)", "Low-fat dairy (counterintuitively reduces stone risk)"],
      "limit": ["Oxalate-rich foods (spinach, beets, nuts — for calcium oxalate stones)", "Meat protein (raises uric acid and calcium excretion)", "Sodium (increases calcium in urine)"],
      "avoid": ["High-salt foods", "Excess animal protein", "Sugary drinks", "High-dose Vitamin C supplements (converts to oxalate)"]
    },
    "key_nutrients": { "focus_on": ["Hydration (2+ litres of urine output daily)", "Calcium from food (NOT supplements with meals)", "Citrate (lemon juice)", "Potassium"], "limit": ["Sodium (increases stone risk)", "Oxalate (if calcium oxalate stones)", "Purines (if uric acid stones)", "Animal protein"] },
    "meal_tips": ["Drink enough water to produce at least 2 litres of urine daily", "Add fresh lemon juice to water — citrate actively prevents stones", "Eat calcium-rich foods AT meals (binds oxalate in gut before reaching kidneys)"],
    "lifestyle_tips": ["Urine colour should be pale yellow — dark yellow means not enough water", "Stone type should be analysed to personalise diet advice", "24-hour urine tests guide personalised prevention"],
    "authority": "National Kidney Foundation",
    "authority_url": "https://kidney.org",
    "related": ["Hyperuricemia", "Gout", "CKD", "Inflammatory Bowel Disease"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # HORMONAL / ENDOCRINE
  # ══════════════════════════════════════════════════════════
  {
    "slug": "pcos",
    "name": "PCOS (Polycystic Ovary Syndrome)",
    "category": "Hormonal",
    "prevalence": "8-13% of women of reproductive age",
    "icd10": "E28.2",
    "overview": "PCOS is a hormonal disorder involving excess androgen, irregular periods, and often insulin resistance. It is the most common endocrine disorder in women of reproductive age and has significant nutritional management components.",
    "why_diet_matters": "70-80% of women with PCOS have insulin resistance. A low glycaemic index diet reduces insulin and androgen levels, often improving menstrual regularity, acne, and weight without medication.",
    "foods": {
      "eat_freely": ["Colourful vegetables", "Leafy greens", "Berries", "Legumes", "Quinoa", "Fatty fish", "Walnuts and flaxseeds", "Olive oil"],
      "limit": ["White carbohydrates", "Tropical fruits (high sugar)", "Full-fat dairy (some evidence of benefit, individual variation)", "Red meat"],
      "avoid": ["Sugary drinks and juices", "Refined carbohydrates", "Added sugar", "Processed foods", "Trans fats"]
    },
    "key_nutrients": { "focus_on": ["Inositol (myo-inositol and d-chiro-inositol supplements have clinical evidence)", "Omega-3 fatty acids", "Zinc (reduces androgens)", "Magnesium", "Chromium", "Vitamin D"], "limit": ["High-GI carbohydrates", "Simple sugars", "Saturated fat"] },
    "meal_tips": ["Pair every carbohydrate with protein and fat to blunt insulin response", "Eat breakfast consistently — skipping raises cortisol and worsens insulin resistance", "Spread meals evenly throughout the day"],
    "lifestyle_tips": ["Even 5% weight loss significantly improves hormonal balance in PCOS", "Strength training is particularly effective for reducing insulin resistance", "Adequate sleep is critical — poor sleep worsens insulin resistance"],
    "authority": "Endocrine Society / International Evidence-Based PCOS Guideline",
    "authority_url": "https://www.endocrine.org",
    "related": ["Diabetes", "Obesity", "Infertility", "Thyroid Disorder", "Metabolic Syndrome"],
    "ml_supported": True
  },
  {
    "slug": "hypothyroidism",
    "name": "Hypothyroidism (Underactive Thyroid)",
    "category": "Hormonal",
    "prevalence": "5% of people over 12 years old",
    "icd10": "E03",
    "overview": "Hypothyroidism is when the thyroid gland does not produce enough thyroid hormone, slowing metabolism and causing fatigue, weight gain, cold intolerance, and depression. Hashimoto's thyroiditis is the most common cause.",
    "why_diet_matters": "Certain nutrients are essential for thyroid hormone production (iodine, selenium, zinc). Some foods (goitrogens) can interfere with thyroid function when raw. Thyroid medication absorption is affected by calcium, iron, and fibre if consumed at the same time.",
    "foods": {
      "eat_freely": ["Iodine-rich seafood and eggs", "Selenium-rich Brazil nuts (1-2/day)", "Zinc-rich foods (pumpkin seeds, beef)", "Colourful vegetables (cooked)", "Whole grains"],
      "limit": ["Raw cruciferous vegetables in large amounts (cooking reduces goitrogenic effect)", "Soy products (in excess)", "Millet"],
      "avoid": ["Taking thyroid medication within 4 hours of calcium, iron, or fibre-rich foods", "Excessive iodine supplementation (can paradoxically worsen thyroid)", "Very low calorie diets (further slow metabolism)"]
    },
    "key_nutrients": { "focus_on": ["Iodine (required for hormone synthesis)", "Selenium (activates T3)", "Zinc (required for T3 conversion)", "Iron (low iron worsens hypothyroid symptoms)"], "limit": ["Goitrogens (raw)", "Excessive soy isoflavones", "Excess gluten (in Hashimoto's — some benefit from GF trial)"] },
    "meal_tips": ["Take levothyroxine on an empty stomach, 30-60 minutes before breakfast", "Wait 4 hours after medication before taking calcium or iron supplements", "Cook cruciferous vegetables rather than eating them raw"],
    "lifestyle_tips": ["Medication consistency is more important than any dietary change", "Have thyroid function tested every 6-12 months", "Support mental health — hypothyroidism commonly causes depression"],
    "authority": "American Thyroid Association",
    "authority_url": "https://www.thyroid.org",
    "related": ["Anaemia", "Coeliac Disease (Hashimoto's)", "PCOS", "Depression"],
    "ml_supported": True
  },
  {
    "slug": "hyperthyroidism",
    "name": "Hyperthyroidism (Overactive Thyroid)",
    "category": "Hormonal",
    "prevalence": "1% of the population",
    "icd10": "E05",
    "overview": "Hyperthyroidism occurs when the thyroid produces excess thyroid hormone, speeding up the body's metabolism. It causes weight loss, rapid heartbeat, anxiety, and heat intolerance. Graves' disease is the most common cause.",
    "why_diet_matters": "The accelerated metabolism of hyperthyroidism dramatically increases calorie and nutrient needs. Iodine intake must be carefully managed as it fuels thyroid hormone production. Bone loss is a serious complication requiring calcium and Vitamin D.",
    "foods": {
      "eat_freely": ["Calcium-rich foods (dairy, leafy greens)", "Cruciferous vegetables (broccoli, cabbage — may have mild goitrogenic effect that helps)", "High-calorie nutrient-dense foods", "Antioxidant-rich foods"],
      "limit": ["Very high-fibre foods (can worsen absorption of medication)", "Caffeine (worsens palpitations and anxiety)"],
      "avoid": ["Iodine-rich foods in excess (seaweed, kelp supplements)", "High-iodine supplements", "Stimulants (caffeine, energy drinks)", "Alcohol"]
    },
    "key_nutrients": { "focus_on": ["Calcium and Vitamin D (bone loss prevention)", "Antioxidants", "Increased calorie intake to compensate for high metabolism", "Magnesium (reduces palpitations)"], "limit": ["Iodine (don't over-supplement)", "Caffeine", "Alcohol"] },
    "meal_tips": ["Eat more frequently and in larger portions to maintain weight", "Add healthy calorie-dense foods like nuts, avocado, and olive oil", "Take calcium supplement separately from thyroid medication"],
    "lifestyle_tips": ["Regular bone density screening is recommended", "Protect eyes if Graves' ophthalmopathy is present (UV protection)", "Avoid smoking — it worsens Graves' eye disease significantly"],
    "authority": "American Thyroid Association",
    "authority_url": "https://www.thyroid.org",
    "related": ["Osteoporosis", "Heart Arrhythmia", "Anxiety"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # BONE / JOINT / AUTOIMMUNE
  # ══════════════════════════════════════════════════════════
  {
    "slug": "osteoporosis",
    "name": "Osteoporosis",
    "category": "Bone & Joint",
    "prevalence": "200 million women worldwide affected",
    "icd10": "M81",
    "overview": "Osteoporosis is a condition where bones become weak and porous, increasing fragility fracture risk. It is a 'silent disease' with no symptoms until a fracture occurs. Peak bone mass is built in youth; preservation is the goal in adult life.",
    "why_diet_matters": "Calcium and Vitamin D are the essential building blocks of bone. Inadequate intake throughout life is the primary nutritional cause of osteoporosis. Excess sodium and caffeine increase calcium excretion.",
    "foods": {
      "eat_freely": ["Dairy products (milk, yogurt, cheese)", "Calcium-fortified plant milks", "Sardines and salmon with bones", "Leafy greens (kale, bok choy, broccoli)", "Tofu set with calcium sulfate", "Sesame seeds"],
      "limit": ["Caffeine (more than 3 cups of coffee/day increases calcium loss)", "Alcohol", "Very high sodium foods"],
      "avoid": ["Very low calorie diets (restrict bone-building nutrients)", "Excessive alcohol (3+ drinks/day directly impairs bone formation)", "Extreme protein restriction"]
    },
    "key_nutrients": { "focus_on": ["Calcium (1000-1200mg/day)", "Vitamin D (800-1000 IU/day)", "Protein (critical for bone matrix)", "Vitamin K2 (directs calcium to bones)", "Magnesium"], "limit": ["Sodium (increases calcium excretion)", "Excess caffeine", "Alcohol"] },
    "meal_tips": ["Spread calcium intake through the day — the body absorbs max ~500mg at once", "Get sunlight daily for Vitamin D synthesis (15-30 minutes)", "Eat calcium-rich foods at every meal"],
    "lifestyle_tips": ["Weight-bearing exercise (walking, running, dancing) is the most important non-dietary bone protector", "Avoid falls — they are the primary fracture trigger", "Bone density scan (DEXA) recommended after menopause or 70 for men"],
    "authority": "National Osteoporosis Foundation / IOF",
    "authority_url": "https://www.nof.org",
    "related": ["Coeliac Disease", "Hyperthyroidism", "Crohn's Disease", "Menopause", "Hypothyroidism"],
    "ml_supported": True
  },
  {
    "slug": "rheumatoid-arthritis",
    "name": "Rheumatoid Arthritis",
    "category": "Bone & Joint",
    "prevalence": "18 million people worldwide",
    "icd10": "M05",
    "overview": "Rheumatoid arthritis (RA) is an autoimmune disease where the immune system attacks joint linings, causing inflammation, pain, swelling, and eventual joint damage. It also increases cardiovascular risk.",
    "why_diet_matters": "Certain foods fuel inflammation (saturated fats, sugar, processed foods) while an anti-inflammatory diet (Mediterranean pattern) reduces disease activity and cardiovascular risk. Omega-3 fatty acids have clinical evidence for reducing joint pain.",
    "foods": {
      "eat_freely": ["Fatty fish rich in omega-3 (salmon, sardines, mackerel)", "Olive oil", "Colourful vegetables and fruits", "Berries", "Turmeric and ginger (active anti-inflammatory compounds)", "Garlic and onion", "Green tea"],
      "limit": ["Red meat (limit to 1-2x/week)", "Full-fat dairy", "Refined carbohydrates", "Nightshade vegetables (tomatoes, peppers — for some, though evidence is limited)"],
      "avoid": ["Trans fats", "Fried foods", "Sugary drinks", "Alcohol in excess", "Processed and ultra-processed foods", "Salt in excess (worsens fluid retention around joints)"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 fatty acids (EPA and DHA — anti-inflammatory)", "Antioxidants (vitamins C and E)", "Vitamin D (immune modulation)", "Calcium (steroid medications deplete bone)", "Folate (if on methotrexate medication)"], "limit": ["Omega-6 fatty acids (pro-inflammatory — common in vegetable oils)", "Saturated fat", "Sugar"] },
    "meal_tips": ["Cook with olive oil instead of butter or sunflower oil", "Eat oily fish at least twice a week", "Add turmeric and ginger to daily cooking", "Take folic acid if on methotrexate"],
    "lifestyle_tips": ["Regular gentle exercise (swimming, cycling) maintains joint function", "Maintain healthy weight — every kg lost reduces 4kg of knee pressure", "Protect joints during activities with ergonomic aids"],
    "authority": "Arthritis Foundation / EULAR",
    "authority_url": "https://arthritis.org",
    "related": ["Osteoporosis", "Heart Disease", "Anaemia", "Sjögren's Syndrome"],
    "ml_supported": True
  },
  {
    "slug": "osteoarthritis",
    "name": "Osteoarthritis",
    "category": "Bone & Joint",
    "prevalence": "528 million people worldwide (WHO)",
    "icd10": "M15",
    "overview": "Osteoarthritis is wear-and-tear joint disease from cartilage breakdown, most commonly in knees, hips, and hands. Weight bearing on damaged joints causes pain and stiffness. It is the most common form of arthritis.",
    "why_diet_matters": "Weight loss is the most effective intervention for knee and hip osteoarthritis — every 1kg lost reduces knee load by 4kg. Anti-inflammatory dietary patterns reduce pain independently of weight loss.",
    "foods": {
      "eat_freely": ["Fatty fish", "Olive oil", "Berries and cherries (reduce inflammation)", "Broccoli and green vegetables", "Garlic", "Ginger and turmeric"],
      "limit": ["Red meat", "Full fat dairy", "Refined carbs"],
      "avoid": ["Sugary foods and drinks", "Processed meats", "Fried foods", "Trans fats", "Excess sodium", "Alcohol"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 (reduces joint inflammation)", "Vitamin D (low levels linked to faster progression)", "Vitamin C (collagen synthesis)", "Selenium (antioxidant protection of cartilage)"], "limit": ["Saturated fat", "Simple sugar", "Excess body weight"] },
    "meal_tips": ["Focus weight loss strategies if overweight — it is the highest-impact intervention", "Eat an anti-inflammatory food with every meal", "Stay well-hydrated — cartilage is largely water"],
    "lifestyle_tips": ["Strength training around the joint reduces pain and improves function", "Swimming and water exercise are ideal — no impact on joints", "Physiotherapy is as effective as surgery for many cases"],
    "authority": "Osteoarthritis Research Society International (OARSI)",
    "authority_url": "https://oarsi.org",
    "related": ["Obesity", "Rheumatoid Arthritis", "Gout"],
    "ml_supported": False
  },
  {
    "slug": "gout",
    "name": "Gout",
    "category": "Bone & Joint",
    "prevalence": "41 million people worldwide",
    "icd10": "M10",
    "overview": "Gout is caused by excess uric acid crystallising in joints, causing sudden, severe joint pain — most commonly in the big toe. It is the most common inflammatory arthritis. Diet plays a major role in both triggering attacks and long-term prevention.",
    "why_diet_matters": "Purines from food break down into uric acid. Fructose raises uric acid independently. Alcohol — especially beer — both contains purines and reduces kidney excretion of uric acid. Together these are the primary dietary drivers.",
    "foods": {
      "eat_freely": ["Cherries and cherry juice (clinically proven to reduce attacks)", "Low-fat dairy products (uricosuric — help excrete uric acid)", "Coffee (protective)", "Eggs", "Vegetables (including asparagus and spinach — OK in moderation)", "Whole grains"],
      "limit": ["Red meat (beef, pork, lamb)", "Poultry", "Shellfish", "Oily fish (in moderation, despite omega-3 benefits)", "Legumes (moderate purines — usually okay in remission)"],
      "avoid": ["Organ meats (liver, kidney, sweetbreads)", "Anchovies, sardines, herring, mackerel (very high purine)", "Beer and spirits", "Fructose and high-sugar drinks", "Sugary beverages"]
    },
    "key_nutrients": { "focus_on": ["Vitamin C (reduces uric acid — 500mg supplement has evidence)", "Cherry anthocyanins", "Low-fat dairy proteins (allopurinol-like effect)", "Hydration"], "limit": ["Purines (especially from organ meats and seafood)", "Fructose", "Alcohol"] },
    "meal_tips": ["Drink 8-16 glasses of water daily to dilute and excrete uric acid", "Eat cherries or drink tart cherry juice daily", "Never crash diet — rapid weight loss raises uric acid and triggers attacks"],
    "lifestyle_tips": ["Even single episodes of binge drinking can trigger a gout attack", "Gradual weight loss reduces uric acid and attacks long-term", "Take prescribed urate-lowering medication consistently"],
    "authority": "American College of Rheumatology",
    "authority_url": "https://rheumatology.org",
    "related": ["Hyperuricemia", "Kidney Stones", "Hypertension", "Heart Disease"],
    "ml_supported": True
  },
  {
    "slug": "anemia-iron",
    "name": "Iron Deficiency Anaemia",
    "category": "Blood",
    "prevalence": "1.2 billion people worldwide — most common nutritional deficiency",
    "icd10": "D50",
    "overview": "Iron deficiency anaemia is insufficient iron to produce haemoglobin, reducing the blood's oxygen-carrying capacity. It causes fatigue, breathlessness, pale skin, and impaired cognitive function. Diet is the first-line treatment for mild to moderate cases.",
    "why_diet_matters": "Iron absorption is highly variable depending on food source and co-consumed foods. Haem iron (from meat) absorbs at 15-35%. Non-haem iron (from plants) absorbs at only 2-20%. Vitamin C dramatically enhances non-haem iron absorption.",
    "foods": {
      "eat_freely": ["Lean red meat (highest haem iron)", "Liver and kidney (very high — limit in pregnancy)", "Sardines and tuna", "Spinach and leafy greens", "Legumes (lentils, beans, chickpeas)", "Tofu", "Pumpkin seeds", "Fortified cereals"],
      "limit": ["Calcium-rich foods at the same meal as iron-rich foods (inhibits absorption)", "Tea and coffee with meals (tannins block iron)", "Whole grains and high-fibre foods with iron supplements"],
      "avoid": ["Tea and coffee within 1 hour of iron-rich meals", "Antacids with iron supplements", "Excessive dairy at iron-rich meals"]
    },
    "key_nutrients": { "focus_on": ["Iron (18mg/day women, 8mg/day men, 27mg/day pregnant)", "Vitamin C at every iron-rich meal (doubles absorption)", "Vitamin A (aids iron metabolism)", "Folic acid (often co-deficient)"], "limit": ["Calcium at iron-rich meals", "Phytates (in seeds/grains — reduce iron absorption)", "Polyphenols (tea, coffee, red wine at iron meals)"] },
    "meal_tips": ["Always pair iron-rich foods with Vitamin C — squeeze lemon over spinach, have orange juice with fortified cereal", "Avoid tea and coffee for at least 1 hour around iron-rich meals", "Cook iron-rich foods in a cast-iron pan (a genuine way to add iron to food)"],
    "lifestyle_tips": ["Find and treat the underlying cause of iron loss (heavy periods, GI bleeding)", "Iron supplements can cause constipation — stay hydrated and increase fibre", "Recheck blood iron levels after 1-3 months of dietary change or supplementation"],
    "authority": "World Health Organisation / British Haematological Society",
    "authority_url": "https://www.who.int",
    "related": ["Coeliac Disease", "Crohn's Disease", "Ulcerative Colitis", "Chronic Kidney Disease"],
    "ml_supported": True
  },
  {
    "slug": "anemia-b12",
    "name": "Vitamin B12 Deficiency Anaemia",
    "category": "Blood",
    "prevalence": "6% of adults under 60, 20% over 60",
    "icd10": "D51",
    "overview": "B12 deficiency anaemia (including pernicious anaemia) occurs when insufficient B12 is available for red blood cell production and nerve function. It is particularly common in vegans, older adults, and those taking metformin or proton pump inhibitors.",
    "why_diet_matters": "Vitamin B12 is found almost exclusively in animal products. Vegans and vegetarians who do not supplement are at near-certain risk of deficiency over time. Even meat-eaters can become deficient if absorption is impaired.",
    "foods": {
      "eat_freely": ["Meat (beef, pork, lamb)", "Fish and shellfish (especially clams and oysters — very high B12)", "Eggs", "Dairy", "B12-fortified plant milks and cereals (for vegans)", "Nutritional yeast (if B12-fortified)"],
      "limit": ["N/A — there is no upper limit for B12 as excess is excreted"],
      "avoid": ["If vegan, do NOT rely on unfortified plant foods — B12 deficiency will develop over time without supplementation"]
    },
    "key_nutrients": { "focus_on": ["Vitamin B12 (2.4mcg/day — 1000mcg/day recommended for absorption-impaired individuals)", "Folate (co-works with B12)", "Iron (often co-deficient)"], "limit": ["Nothing specific — focus on adequate intake"] },
    "meal_tips": ["Vegans must supplement with cyanocobalamin B12 — this is non-negotiable", "Older adults often need higher-dose supplements or sublingual B12 due to reduced stomach acid", "B12 injections are used for pernicious anaemia (autoimmune impair absorption permanently)"],
    "lifestyle_tips": ["If taking metformin for diabetes, have B12 levels checked annually", "Prolonged proton pump inhibitor use also depletes B12 — monitor levels", "Neurological symptoms from B12 deficiency can be permanent if not caught early"],
    "authority": "National Institutes of Health / British Society for Haematology",
    "authority_url": "https://ods.od.nih.gov/factsheets/VitaminB12-HealthProfessional/",
    "related": ["Coeliac Disease", "Crohn's Disease", "Diabetes (metformin users)", "Veganism"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # NEUROLOGICAL
  # ══════════════════════════════════════════════════════════
  {
    "slug": "migraine",
    "name": "Migraine",
    "category": "Neurological",
    "prevalence": "1 billion people worldwide — 3rd most prevalent illness",
    "icd10": "G43",
    "overview": "Migraine is a neurological condition causing severe, often debilitating headaches accompanied by nausea, light/sound sensitivity. Specific foods, skipping meals, caffeine changes, dehydration, and alcohol are well-documented triggers.",
    "why_diet_matters": "Food triggers account for up to 30% of migraine attacks. Tyramine (aged/fermented foods), MSG, caffeine withdrawal, alcohol, and nitrates (processed meats) are the best-documented dietary triggers. Meal skipping is one of the most consistent triggers.",
    "foods": {
      "eat_freely": ["Fresh fruits and vegetables (most)", "Lean fresh meats (not processed)", "Fish", "Whole grains", "Low-fat dairy (fresh, not aged)", "Cooked eggs", "Herbal teas"],
      "limit": ["Caffeine (maintain a consistent daily amount — it is withdrawal, not caffeine itself, that triggers)", "Chocolate (a trigger for some)", "Citrus fruits (trigger for some)", "Nuts (trigger for some)"],
      "avoid": ["Aged cheeses (parmesan, blue, brie — high tyramine)", "Processed and cured meats (nitrates)", "Red wine and alcohol", "MSG (common in takeaways, crisps)", "Aspartame (artificial sweetener)", "Pickled and fermented foods"]
    },
    "key_nutrients": { "focus_on": ["Magnesium (deficiency linked to migraine — 400mg/day supplement has evidence)", "Riboflavin (Vitamin B2 — 400mg/day reduces frequency)", "CoQ10 (150-300mg/day may reduce attacks)", "Omega-3 (anti-inflammatory)"], "limit": ["Tyramine", "Nitrates/nitrites", "MSG", "Alcohol"] },
    "meal_tips": ["Never skip meals — meal skipping is the most avoidable trigger", "Eat at consistent times every day", "Stay hydrated — dehydration is a primary trigger", "Keep a food-migraine diary for 2+ months to identify personal triggers"],
    "lifestyle_tips": ["Sleep at consistent times — both too little and too much sleep trigger migraines", "Gradual caffeine reduction rather than sudden cessation", "Regular aerobic exercise (3x/week) reduces migraine frequency by 25%"],
    "authority": "American Migraine Foundation",
    "authority_url": "https://americanmigrainefoundation.org",
    "related": ["Anxiety", "Depression", "Sleep Disorders"],
    "ml_supported": True
  },
  {
    "slug": "epilepsy",
    "name": "Epilepsy",
    "category": "Neurological",
    "prevalence": "50 million people worldwide",
    "icd10": "G40",
    "overview": "Epilepsy is a neurological disorder characterised by recurrent seizures caused by abnormal electrical activity in the brain. The ketogenic diet is a clinically proven dietary treatment, especially for drug-resistant epilepsy in children.",
    "why_diet_matters": "The ketogenic diet (very high fat, very low carbohydrate) reduces seizure frequency by 50% in about half of patients who try it, and eliminates seizures entirely in 10-15%. It requires strict medical supervision.",
    "foods": {
      "eat_freely": ["Healthy fats (avocado, butter, cream, coconut oil)", "Fatty fish", "Meat and poultry", "Eggs", "Full-fat dairy (small amounts)"],
      "limit": ["All carbohydrates must be very strictly limited", "Even vegetables are limited by carb content on classical ketogenic diet", "Fruit (high sugar)"],
      "avoid": ["All grains, bread, pasta", "Sugar and sweets", "All fruit juice", "Starchy vegetables", "Legumes and most beans"]
    },
    "key_nutrients": { "focus_on": ["Fat (70-90% of calories on classical keto)", "Adequate protein", "Micronutrients via planned supplementation", "Selenium", "Calcium and Vitamin D (bone loss is a keto side effect)"], "limit": ["Carbohydrates (<10-20g/day on strict keto)", "Anything that could trigger hypoglycaemia"] },
    "meal_tips": ["The ketogenic diet for epilepsy must only be started under medical supervision with a specialist dietitian", "Meal plans must be calculated to the gram", "Never make changes without informing your neurologist"],
    "lifestyle_tips": ["Adequate sleep is critical — sleep deprivation is a seizure trigger for almost all people with epilepsy", "Alcohol lowers seizure threshold", "Do not drive during uncontrolled seizure periods"],
    "authority": "Epilepsy Foundation / Charlie Foundation",
    "authority_url": "https://www.epilepsy.com",
    "related": ["Obesity (keto may help)", "Autism Spectrum Disorder", "Alzheimer's"],
    "ml_supported": False
  },
  {
    "slug": "alzheimers",
    "name": "Alzheimer's Disease",
    "category": "Neurological",
    "prevalence": "55 million people with dementia worldwide",
    "icd10": "G30",
    "overview": "Alzheimer's disease is the most common cause of dementia, involving progressive memory loss and cognitive decline. While there is no cure, the MIND diet (combining Mediterranean and DASH) has clinical evidence for reducing risk and slowing progression.",
    "why_diet_matters": "The MIND diet reduces Alzheimer's risk by 35-53% in observational studies. Specific foods (leafy greens, berries, fish, olive oil, nuts) appear to reduce oxidative stress and neuroinflammation in the brain.",
    "foods": {
      "eat_freely": ["Green leafy vegetables daily (strongest evidence)", "Other vegetables", "Nuts (5+ servings/week)", "Berries (2+ servings/week — especially blueberries and strawberries)", "Beans (4+ servings/week)", "Whole grains", "Fish (1+/week)", "Olive oil"],
      "limit": ["Red meat (<4 servings/week)", "Butter and margarine (<1 tbsp/day)", "Cheese (<1 serving/week)", "Pastries (<5 servings/week)"],
      "avoid": ["Fried and fast food (strongest negative association)", "Excess alcohol", "Ultra-processed foods", "Trans fats"]
    },
    "key_nutrients": { "focus_on": ["Vitamin E (from food, not supplements)", "Omega-3 DHA (brain structure)", "Folate, B6, B12 (reduces brain-harmful homocysteine)", "Polyphenols (berries, olive oil)", "Lutein and zeaxanthin (leafy greens)"], "limit": ["Saturated fat", "Trans fats", "Excess alcohol", "Ultra-processed food chemicals"] },
    "meal_tips": ["Eat a serving of leafy greens every single day — it has the strongest individual evidence", "Use olive oil as your primary fat in all cooking and dressings", "Have a serving of berries at least every 2 days"],
    "lifestyle_tips": ["Physical exercise is the strongest modifiable risk factor for dementia prevention", "Cognitive engagement (learning, social connection) is protective", "Managing blood pressure and diabetes reduces dementia risk significantly"],
    "authority": "Alzheimer's Association",
    "authority_url": "https://www.alz.org",
    "related": ["Hypertension", "Diabetes", "Depression", "Obesity", "Heart Disease"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # MENTAL HEALTH
  # ══════════════════════════════════════════════════════════
  {
    "slug": "depression",
    "name": "Depression",
    "category": "Mental Health",
    "prevalence": "280 million people worldwide (WHO)",
    "icd10": "F32",
    "overview": "Depression is a mental health disorder characterised by persistent low mood, loss of interest, and reduced energy. The gut-brain axis, inflammation, and neurotransmitter synthesis are all directly influenced by diet, making nutrition a meaningful complementary approach.",
    "why_diet_matters": "A Mediterranean diet was shown in the SMILES trial to be significantly more effective than social support alone in resolving clinical depression. The gut microbiome produces 95% of the body's serotonin — what you eat directly affects this.",
    "foods": {
      "eat_freely": ["Fatty fish (omega-3 and mood)","Fermented foods (yogurt, kefir, kimchi — gut microbiome)", "Dark leafy greens", "Berries", "Nuts and seeds", "Extra virgin olive oil", "Legumes", "Turmeric (curcumin has antidepressant evidence)"],
      "limit": ["Refined carbohydrates (cause blood sugar crashes that worsen mood)", "Red meat", "Full-fat dairy"],
      "avoid": ["Ultra-processed foods (strongest negative association with depression)", "Alcohol (depressant)", "Sugar-sweetened beverages", "Trans fats"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 EPA and DHA (anti-inflammatory, brain function)", "Magnesium (deficiency is common in depression)", "Zinc", "Vitamin D (deficiency associated with depression)", "Folate and B12 (support neurotransmitter synthesis)", "Iron (deficiency causes cognitive fatigue resembling depression)"], "limit": ["Sugar", "Saturated fat", "Alcohol"] },
    "meal_tips": ["Never skip meals — blood sugar instability worsens mood", "Eat fermented foods daily for gut health", "Omega-3 supplements (1-2g EPA/day) have Level I clinical evidence for depression"],
    "lifestyle_tips": ["Exercise is the most evidence-based non-pharmacological intervention for depression", "Social eating is therapeutic — the context of meals matters, not just nutrients", "Nutritional psychiatry works best alongside, not instead of, professional mental health care"],
    "authority": "SMILES Trial / International Society for Nutritional Psychiatry Research",
    "authority_url": "https://www.isnpr.org",
    "related": ["Anxiety", "Hypothyroidism", "Anaemia", "Vitamin D Deficiency"],
    "ml_supported": False
  },
  {
    "slug": "anxiety",
    "name": "Anxiety Disorders",
    "category": "Mental Health",
    "prevalence": "301 million people worldwide (WHO)",
    "icd10": "F41",
    "overview": "Anxiety disorders are the most common mental health disorders globally. There is a bidirectional relationship between gut health and anxiety — the 'gut-brain axis' — with the microbiome influencing anxiety through serotonin and vagal nerve signalling.",
    "why_diet_matters": "Caffeine, alcohol, and blood sugar crashes are direct, immediate anxiety triggers. An anti-inflammatory diet rich in magnesium, omega-3, and fermented foods has growing evidence for reducing anxiety severity.",
    "foods": {
      "eat_freely": ["Chamomile tea (anxiolytic evidence)", "Fatty fish", "Dark chocolate (70%+, in moderation)", "Avocados (magnesium)", "Leafy greens", "Blueberries", "Fermented foods", "Oysters (high zinc)"],
      "limit": ["Caffeine (a direct anxiogen — many anxiety sufferers benefit from reducing significantly)", "Alcohol (short-term relief, long-term anxiety worsening)", "Added sugar"],
      "avoid": ["Energy drinks", "Excess caffeine", "Alcohol as a coping mechanism", "Highly processed snack foods", "High-sugar foods (blood sugar crashes worsen anxiety)"]
    },
    "key_nutrients": { "focus_on": ["Magnesium (calms the nervous system — commonly deficient)", "Omega-3 fatty acids", "GABA-supporting foods", "Vitamin D", "Zinc", "B vitamins (especially B1, B6, B12 — anxiety symptoms worsen with deficiency)"], "limit": ["Caffeine", "Alcohol", "Refined sugar"] },
    "meal_tips": ["Eat regular meals to prevent blood sugar dips which worsen anxiety", "Reduce caffeine gradually — sudden withdrawal worsens anxiety temporarily", "Ensure adequate magnesium: eat nuts, seeds, dark chocolate, and leafy greens daily"],
    "lifestyle_tips": ["Physical exercise reduces anxiety as effectively as medication in some studies", "Mindful eating practices are directly therapeutic for anxiety", "Limiting caffeine and alcohol is often the fastest dietary intervention for symptom relief"],
    "authority": "ISNPR / American Psychological Association",
    "authority_url": "https://www.isnpr.org",
    "related": ["Depression", "IBS (gut-brain axis)", "Migraine", "Thyroid Disorder"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # RESPIRATORY
  # ══════════════════════════════════════════════════════════
  {
    "slug": "asthma",
    "name": "Asthma",
    "category": "Respiratory",
    "prevalence": "262 million people worldwide (WHO)",
    "icd10": "J45",
    "overview": "Asthma is chronic inflammation of the airways causing breathing difficulty, wheezing, and chest tightness. Diet influences asthma through inflammation, airway reactivity, and triggering specific immune responses.",
    "why_diet_matters": "A Mediterranean diet reduces asthma severity in children and adults. Vitamin D deficiency is strongly linked to worse asthma control. Certain foods (sulphites, aspirin-sensitive foods, food allergens) can directly trigger asthmatic episodes.",
    "foods": {
      "eat_freely": ["Fruits and vegetables (antioxidant-rich)", "Fatty fish", "Olive oil", "Turmeric and ginger", "Garlic (anti-inflammatory)", "Honey (may soothe airway irritation)", "Apple (quercetin — anti-inflammatory flavonoid)"],
      "limit": ["Dairy (for some people, increases mucus — individual variation)", "Refined carbohydrates", "Red meat"],
      "avoid": ["Sulphite-containing foods (dried fruit, wine, preserved foods)", "Specific food allergens (individual — common triggers: peanuts, shellfish, milk, wheat, eggs, tree nuts, soy)", "Fast food (associated with higher asthma rates)", "Artificial food colours and additives (for some)"]
    },
    "key_nutrients": { "focus_on": ["Vitamin D (deficiency worsens asthma significantly)", "Magnesium (bronchial smooth muscle relaxant)", "Omega-3 fatty acids (anti-inflammatory)", "Antioxidants (Vitamins C and E, selenium)", "Quercetin (anti-inflammatory — apples, onions, berries)"], "limit": ["Sulphites", "Potential allergens", "Saturated fat", "Sodium (may worsen airway hyperresponsiveness)"] },
    "meal_tips": ["Keep a food-symptom diary to identify personal food triggers", "Maintain a healthy weight — obesity worsens asthma control significantly", "Take Vitamin D supplement — most people with asthma are deficient"],
    "lifestyle_tips": ["Never smoke or be exposed to second-hand smoke", "Maintain a healthy weight — it is one of the most modifiable asthma factors", "Ensure prescribed inhalers are always available and used correctly"],
    "authority": "Global Initiative for Asthma (GINA)",
    "authority_url": "https://ginasthma.org",
    "related": ["Obesity", "GERD (worsens asthma)", "Allergic Rhinitis"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # SKIN
  # ══════════════════════════════════════════════════════════
  {
    "slug": "psoriasis",
    "name": "Psoriasis",
    "category": "Skin",
    "prevalence": "125 million people worldwide",
    "icd10": "L40",
    "overview": "Psoriasis is a chronic autoimmune skin condition causing raised, scaly, inflamed patches. It is associated with psoriatic arthritis, heart disease, and metabolic syndrome. Diet has a meaningful impact on disease severity.",
    "why_diet_matters": "Psoriasis is driven by systemic inflammation that diet can directly influence. Obesity markedly worsens psoriasis and reduces medication effectiveness. The Mediterranean diet and gluten-free diet (in those with sensitivity) both reduce severity.",
    "foods": {
      "eat_freely": ["Colourful fruits and vegetables", "Fatty fish (omega-3)", "Olive oil", "Nuts and seeds", "Legumes", "Whole grains"],
      "limit": ["Red meat", "Full-fat dairy", "Refined carbohydrates", "Gluten (trial elimination if suspected sensitivity)"],
      "avoid": ["Alcohol (directly worsens psoriasis — avoid completely)", "Processed foods", "Sugary drinks", "Trans fats", "Nightshade vegetables (anecdotally reported triggers for some)"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 fatty acids (anti-inflammatory — EPA and DHA)", "Vitamin D (important for skin immune regulation)", "Antioxidants (vitamins A, C, E, selenium)", "Zinc (skin healing)", "Folate (especially if on methotrexate)"], "limit": ["Saturated fat", "Alcohol (primary trigger)", "Simple sugars"] },
    "meal_tips": ["Alcohol avoidance is the highest-impact single dietary intervention for psoriasis", "Follow weight management — obesity directly worsens skin plaques", "Consider a gluten elimination trial if no improvement with other dietary changes"],
    "lifestyle_tips": ["Weight loss significantly improves skin clearance even without medication change", "Limited sun exposure (carefully — not burning) improves psoriasis", "Smoking worsens psoriasis significantly"],
    "authority": "British Association of Dermatologists / AAD",
    "authority_url": "https://www.bad.org.uk",
    "related": ["Psoriatic Arthritis", "Metabolic Syndrome", "Heart Disease", "Diabetes", "Coeliac Disease"],
    "ml_supported": False
  },
  {
    "slug": "eczema",
    "name": "Eczema (Atopic Dermatitis)",
    "category": "Skin",
    "prevalence": "230 million people worldwide",
    "icd10": "L20",
    "overview": "Eczema is a chronic inflammatory skin condition causing itchy, dry, inflamed skin. Food allergies are a confirmed trigger in 30% of children with severe eczema (less in adults). The microbiome and dietary patterns influence overall severity.",
    "why_diet_matters": "In children especially, specific food allergens (eggs, dairy, wheat, soy, peanuts, fish) are a direct trigger. Gut microbiome diversity, influenced strongly by diet, is strongly linked to eczema risk and severity.",
    "foods": {
      "eat_freely": ["Omega-3 rich foods (anti-inflammatory)", "Probiotic foods (yogurt, kefir — support microbiome)", "Prebiotic foods (garlic, onion, leeks, oats)", "Vitamin D rich foods", "Anti-inflammatory herbs and spices"],
      "limit": ["Identified food allergens (individual testing required)", "Highly processed foods (associated with higher eczema risk)"],
      "avoid": ["Confirmed personal food allergens (only after IgE testing or elimination trial under dietitian supervision)", "Ultra-processed foods", "Artificial additives (reported trigger for some)"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 fatty acids (skin barrier function)", "Probiotics (Lactobacillus strains have good evidence)", "Vitamin D", "Vitamin E", "Zinc", "Evening primrose oil (GLA — gamma-linolenic acid)"], "limit": ["Identified allergens only", "Avoid unnecessary dietary restriction without evidence — malnutrition risk, especially in children"] },
    "meal_tips": ["Do not self-diagnose food allergies without testing — most elimination diets are unnecessary and risk malnutrition", "Work with an allergist and dietitian before eliminating foods", "Introduce probiotic foods daily — they have strong preventive evidence"],
    "lifestyle_tips": ["Moisturise skin immediately after bathing — this is the most evidence-based skin intervention", "Avoid overheating — it worsens itching", "Identify non-food triggers (dust mites, pet dander, certain fabrics)"],
    "authority": "National Eczema Association / NICE",
    "authority_url": "https://nationaleczema.org",
    "related": ["Asthma", "Allergic Rhinitis", "Food Allergies"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # WOMEN'S HEALTH
  # ══════════════════════════════════════════════════════════
  {
    "slug": "menopause",
    "name": "Menopause",
    "category": "Women's Health",
    "prevalence": "All women experience menopause, typically between ages 45-55",
    "icd10": "N95.1",
    "overview": "Menopause is the natural end of menstruation. Oestrogen decline causes hot flushes, sleep disruption, mood changes, and accelerated bone loss and cardiovascular risk. Diet can significantly manage symptoms and protect long-term health.",
    "why_diet_matters": "Declining oestrogen increases cardiovascular risk, accelerates bone loss, and changes fat distribution. Diet manages all three. Phytoestrogens (plant oestrogens) in soy and flaxseeds may reduce hot flush frequency in some women.",
    "foods": {
      "eat_freely": ["Soy foods (phytoestrogens — tofu, tempeh, edamame)", "Flaxseeds (phytoestrogens + omega-3)", "Calcium-rich foods (dairy, fortified plant milks, leafy greens)", "Fatty fish", "Colourful vegetables", "Whole grains"],
      "limit": ["Caffeine and alcohol (worsen hot flushes and disrupt sleep)", "Spicy foods (can trigger hot flushes)", "Refined carbohydrates"],
      "avoid": ["Excess alcohol", "High-sodium foods (worsen bone loss)", "Very high-sugar foods (increase cardiovascular risk post-menopause)"]
    },
    "key_nutrients": { "focus_on": ["Calcium (1200mg/day post-menopause)", "Vitamin D (800-1000 IU/day)", "Omega-3 (cardiovascular protection)", "Soy isoflavones (phytoestrogens)", "Lignans (flaxseeds)", "Magnesium (sleep quality)"], "limit": ["Saturated fat (cardiovascular risk increases after menopause)", "Alcohol", "Caffeine (worsens hot flushes and bone loss)"] },
    "meal_tips": ["Eat soy or flaxseed daily — phytoestrogens take 2-4 weeks to effect hot flush frequency", "Maintain calcium intake across the day (max 500mg absorbed at once)", "Avoid large meals in the evening — they worsen night sweats"],
    "lifestyle_tips": ["Weight-bearing exercise is critical — bone loss accelerates rapidly after menopause", "Strength training preserves muscle mass which decreases with oestrogen", "Regular cardiovascular exercise manages elevated post-menopausal heart disease risk"],
    "authority": "British Menopause Society / The Menopause Society",
    "authority_url": "https://thebms.org.uk",
    "related": ["Osteoporosis", "Heart Disease", "Hypothyroidism", "Depression", "Anxiety"],
    "ml_supported": False
  },
  {
    "slug": "endometriosis",
    "name": "Endometriosis",
    "category": "Women's Health",
    "prevalence": "190 million women and girls worldwide (WHO)",
    "icd10": "N80",
    "overview": "Endometriosis is a condition where tissue similar to the uterine lining grows outside the uterus, causing chronic pelvic pain, painful periods, and infertility. It is driven by oestrogen and inflammation — both of which diet can influence.",
    "why_diet_matters": "An anti-inflammatory diet reduces systemic inflammation and oestrogen levels through insulin management. Omega-3 fatty acids have clinical evidence for reducing endometriosis pain. Trans fats and red meat are associated with higher risk.",
    "foods": {
      "eat_freely": ["Fatty fish (omega-3)", "Leafy greens", "Berries", "Flaxseeds (fibre binds oestrogen for excretion)", "Whole grains (support oestrogen clearance)", "Cruciferous vegetables (DIM helps oestrogen metabolism)", "Turmeric"],
      "limit": ["Red and processed meat (associated with higher risk)", "Alcohol", "Full-fat dairy (some evidence of worsening)", "Gluten (a subset of patients report improvement with GF diet)"],
      "avoid": ["Trans fats (highest risk association)", "Excess alcohol", "Highly processed foods", "Excessive caffeine (worsens pain for some)"]
    },
    "key_nutrients": { "focus_on": ["Omega-3 fatty acids (EPA and DHA — proven pain reduction)", "Vitamin D (immune modulation)", "Magnesium (reduces uterine cramping)", "DIM (from cruciferous vegetables — supports oestrogen clearance)", "Fiber (promotes oestrogen excretion)"], "limit": ["Trans fats", "Saturated fat", "Alcohol", "Added sugar"] },
    "meal_tips": ["Eat omega-3 rich foods at least 3 times per week", "Increase cruciferous vegetables (broccoli, Brussels sprouts, kale) to support oestrogen clearance", "Consider a trial gluten elimination if other dietary changes have not helped after 3 months"],
    "lifestyle_tips": ["Regular exercise reduces oestrogen levels and pain severity", "Heat therapy during periods can reduce pain in conjunction with dietary anti-inflammatory support", "Track symptoms in relation to diet — individual triggers vary"],
    "authority": "Endometriosis UK / World Endometriosis Society",
    "authority_url": "https://endometriosis-uk.org",
    "related": ["PCOS", "Iron Deficiency Anaemia", "Infertility", "IBS"],
    "ml_supported": False
  },

  # ══════════════════════════════════════════════════════════
  # LACTOSE & FOOD INTOLERANCES
  # ══════════════════════════════════════════════════════════
  {
    "slug": "lactose-intolerance",
    "name": "Lactose Intolerance",
    "category": "Digestive",
    "prevalence": "68% of the world's population has some degree of lactose malabsorption",
    "icd10": "E73",
    "overview": "Lactose intolerance is the inability to fully digest lactose (the sugar in milk) due to insufficient lactase enzyme. It causes bloating, gas, diarrhoea, and cramping after dairy consumption. It is not an allergy and most people can tolerate some dairy.",
    "why_diet_matters": "Most lactose-intolerant people can still consume small amounts of dairy without symptoms. Removing all dairy unnecessarily risks calcium deficiency. The key is identifying personal tolerance threshold, not blanket dairy avoidance.",
    "foods": {
      "eat_freely": ["Hard aged cheeses (very low lactose: parmesan, cheddar)", "Lactose-free milk and dairy", "Fortified plant milks (soy, almond, oat)", "Yogurt with live cultures (bacteria digest lactose)", "Calcium-fortified foods"],
      "limit": ["Fresh milk (high lactose)", "Soft cheeses (moderate lactose)", "Ice cream (usually trigger larger amounts)", "Cream and butter (some have no or low lactose)"],
      "avoid": ["Large amounts of liquid milk on an empty stomach (highest lactose load)", "Lactose-containing medications (ask pharmacist)", "Assuming all dairy is equal — tolerance varies greatly by product"]
    },
    "key_nutrients": { "focus_on": ["Calcium (ensure alternative sources if limiting dairy)", "Vitamin D (often co-deficient with low dairy intake)", "Probiotics (may improve lactose digestion)"], "limit": ["Lactose beyond personal tolerance threshold"] },
    "meal_tips": ["Always consume dairy with other foods — this slows digestion and reduces symptoms", "Try lactase enzyme tablets before consuming lactose-containing foods", "Start with hard cheeses and yogurt — most people with lactose intolerance can eat these freely"],
    "lifestyle_tips": ["Do not self-diagnose lactose intolerance — breath test or elimination trial with dietitian supervision is recommended", "Ensure calcium from non-dairy sources if avoiding dairy", "Asian and African heritage individuals have higher rates — a deliberate calcium strategy is important"],
    "authority": "National Institute of Diabetes and Digestive and Kidney Diseases",
    "authority_url": "https://www.niddk.nih.gov",
    "related": ["Calcium Deficiency", "Osteoporosis", "IBS"],
    "ml_supported": True
  },
]

# Save
os.makedirs('data', exist_ok=True)
with open('data/conditions.json', 'w', encoding='utf-8') as f:
    json.dump(CONDITIONS, f, indent=2, ensure_ascii=False)

print(f"[OK] Saved {len(CONDITIONS)} conditions to data/conditions.json")
cats = {}
for c in CONDITIONS:
    cats[c['category']] = cats.get(c['category'], 0) + 1
print("\nBy category:")
for cat, n in sorted(cats.items()):
    print(f"  {cat:<20} {n}")
