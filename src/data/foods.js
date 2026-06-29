/**
 * NutriCare AI — Food Composition Database
 *
 * Single source of numeric truth for nutrient values (per the capstone deck:
 * "Every nutrient value comes from the verified food-composition database —
 *  never from the language model").
 *
 * Values are per 100 g edible portion unless noted, sourced from USDA FoodData
 * Central and the Saudi Food Composition Database (illustrative MVP subset).
 *
 * Fields:
 *   kcal, protein(g), fat(g), satFat(g), carbs(g), fiber(g)
 *   sodium, potassium, phosphorus, calcium, iron, magnesium  (all mg)
 *   phe (phenylalanine, mg)  — load-bearing for the IEM/PKU module
 *   gi  (glycaemic index, 0 = not applicable / not measured)
 *   nameAr — Arabic label (bilingual requirement)
 *   tags — cultural/category tags
 */

const FOODS = [
  // ── GRAINS & STARCHES ─────────────────────────────────────────────
  { name: 'White Rice (cooked)', nameAr: 'أرز أبيض مطبوخ', category: 'Grains', kcal: 130, protein: 2.7, fat: 0.3, satFat: 0.1, carbs: 28, fiber: 0.4, sodium: 1, potassium: 35, phosphorus: 43, calcium: 10, iron: 1.2, magnesium: 12, phe: 130, gi: 73, tags: ['global', 'gulf'] },
  { name: 'Brown Rice (cooked)', nameAr: 'أرز بني مطبوخ', category: 'Grains', kcal: 123, protein: 2.7, fat: 1.0, satFat: 0.2, carbs: 26, fiber: 1.6, sodium: 4, potassium: 86, phosphorus: 83, calcium: 3, iron: 0.6, magnesium: 39, phe: 130, gi: 68, tags: ['global'] },
  { name: 'White Bread', nameAr: 'خبز أبيض', category: 'Grains', kcal: 265, protein: 9, fat: 3.2, satFat: 0.7, carbs: 49, fiber: 2.7, sodium: 491, potassium: 115, phosphorus: 99, calcium: 144, iron: 3.6, magnesium: 25, phe: 430, gi: 75, tags: ['global'] },
  { name: 'Whole Wheat Bread', nameAr: 'خبز قمح كامل', category: 'Grains', kcal: 247, protein: 13, fat: 3.4, satFat: 0.7, carbs: 41, fiber: 7, sodium: 450, potassium: 248, phosphorus: 212, calcium: 107, iron: 2.5, magnesium: 76, phe: 620, gi: 74, tags: ['global'] },
  { name: 'Arabic Pita Bread', nameAr: 'خبز عربي', category: 'Grains', kcal: 275, protein: 9, fat: 1.2, satFat: 0.2, carbs: 56, fiber: 2.2, sodium: 536, potassium: 120, phosphorus: 98, calcium: 86, iron: 3.4, magnesium: 24, phe: 430, gi: 68, tags: ['gulf', 'egypt'] },
  { name: 'Oats (cooked)', nameAr: 'شوفان مطبوخ', category: 'Grains', kcal: 71, protein: 2.5, fat: 1.5, satFat: 0.3, carbs: 12, fiber: 1.7, sodium: 4, potassium: 70, phosphorus: 77, calcium: 9, iron: 0.9, magnesium: 27, phe: 120, gi: 55, tags: ['global'] },
  { name: 'Pasta (cooked)', nameAr: 'مكرونة مطبوخة', category: 'Grains', kcal: 158, protein: 5.8, fat: 0.9, satFat: 0.2, carbs: 31, fiber: 1.8, sodium: 1, potassium: 44, phosphorus: 58, calcium: 7, iron: 0.5, magnesium: 18, phe: 290, gi: 49, tags: ['global'] },
  { name: 'Couscous (cooked)', nameAr: 'كسكس مطبوخ', category: 'Grains', kcal: 112, protein: 3.8, fat: 0.2, satFat: 0.0, carbs: 23, fiber: 1.4, sodium: 5, potassium: 58, phosphorus: 22, calcium: 8, iron: 0.4, magnesium: 8, phe: 190, gi: 65, tags: ['gulf', 'egypt'] },
  { name: 'Potato (boiled)', nameAr: 'بطاطس مسلوقة', category: 'Starches', kcal: 87, protein: 1.9, fat: 0.1, satFat: 0.0, carbs: 20, fiber: 1.8, sodium: 4, potassium: 379, phosphorus: 44, calcium: 5, iron: 0.3, magnesium: 22, phe: 88, gi: 78, tags: ['global'] },
  { name: 'Sweet Potato (boiled)', nameAr: 'بطاطا حلوة مسلوقة', category: 'Starches', kcal: 76, protein: 1.4, fat: 0.1, satFat: 0.0, carbs: 18, fiber: 2.5, sodium: 27, potassium: 230, phosphorus: 32, calcium: 27, iron: 0.7, magnesium: 18, phe: 70, gi: 63, tags: ['global'] },
  { name: 'Freekeh (cooked)', nameAr: 'فريكة مطبوخة', category: 'Grains', kcal: 115, protein: 4.5, fat: 0.7, satFat: 0.1, carbs: 23, fiber: 4.0, sodium: 6, potassium: 110, phosphorus: 90, calcium: 12, iron: 1.0, magnesium: 30, phe: 220, gi: 43, tags: ['gulf', 'egypt'] },

  // ── FRUITS ────────────────────────────────────────────────────────
  { name: 'Banana', nameAr: 'موز', category: 'Fruits', kcal: 89, protein: 1.1, fat: 0.3, satFat: 0.1, carbs: 23, fiber: 2.6, sodium: 1, potassium: 358, phosphorus: 22, calcium: 5, iron: 0.3, magnesium: 27, phe: 49, gi: 51, tags: ['global'] },
  { name: 'Apple', nameAr: 'تفاح', category: 'Fruits', kcal: 52, protein: 0.3, fat: 0.2, satFat: 0.0, carbs: 14, fiber: 2.4, sodium: 1, potassium: 107, phosphorus: 11, calcium: 6, iron: 0.1, magnesium: 5, phe: 6, gi: 36, tags: ['global'] },
  { name: 'Orange', nameAr: 'برتقال', category: 'Fruits', kcal: 47, protein: 0.9, fat: 0.1, satFat: 0.0, carbs: 12, fiber: 2.4, sodium: 0, potassium: 181, phosphorus: 14, calcium: 40, iron: 0.1, magnesium: 10, phe: 31, gi: 43, tags: ['global'] },
  { name: 'Dates (Ajwa)', nameAr: 'تمر عجوة', category: 'Fruits', kcal: 282, protein: 2.5, fat: 0.4, satFat: 0.0, carbs: 75, fiber: 8, sodium: 2, potassium: 656, phosphorus: 62, calcium: 64, iron: 0.9, magnesium: 54, phe: 50, gi: 42, tags: ['gulf'] },
  { name: 'Grapes', nameAr: 'عنب', category: 'Fruits', kcal: 69, protein: 0.7, fat: 0.2, satFat: 0.1, carbs: 18, fiber: 0.9, sodium: 2, potassium: 191, phosphorus: 20, calcium: 10, iron: 0.4, magnesium: 7, phe: 19, gi: 59, tags: ['global'] },
  { name: 'Watermelon', nameAr: 'بطيخ', category: 'Fruits', kcal: 30, protein: 0.6, fat: 0.2, satFat: 0.0, carbs: 8, fiber: 0.4, sodium: 1, potassium: 112, phosphorus: 11, calcium: 7, iron: 0.2, magnesium: 10, phe: 15, gi: 76, tags: ['gulf', 'egypt'] },
  { name: 'Strawberry', nameAr: 'فراولة', category: 'Fruits', kcal: 32, protein: 0.7, fat: 0.3, satFat: 0.0, carbs: 8, fiber: 2, sodium: 1, potassium: 153, phosphorus: 24, calcium: 16, iron: 0.4, magnesium: 13, phe: 18, gi: 41, tags: ['global'] },
  { name: 'Pear', nameAr: 'كمثرى', category: 'Fruits', kcal: 57, protein: 0.4, fat: 0.1, satFat: 0.0, carbs: 15, fiber: 3.1, sodium: 1, potassium: 116, phosphorus: 12, calcium: 9, iron: 0.2, magnesium: 7, phe: 8, gi: 38, tags: ['global'] },
  { name: 'Kiwi', nameAr: 'كيوي', category: 'Fruits', kcal: 61, protein: 1.1, fat: 0.5, satFat: 0.0, carbs: 15, fiber: 3, sodium: 3, potassium: 312, phosphorus: 34, calcium: 34, iron: 0.3, magnesium: 17, phe: 30, gi: 50, tags: ['global'] },

  // ── VEGETABLES ────────────────────────────────────────────────────
  { name: 'Tomato', nameAr: 'طماطم', category: 'Vegetables', kcal: 18, protein: 0.9, fat: 0.2, satFat: 0.0, carbs: 3.9, fiber: 1.2, sodium: 5, potassium: 237, phosphorus: 24, calcium: 10, iron: 0.3, magnesium: 11, phe: 27, gi: 15, tags: ['global'] },
  { name: 'Cucumber', nameAr: 'خيار', category: 'Vegetables', kcal: 15, protein: 0.7, fat: 0.1, satFat: 0.0, carbs: 3.6, fiber: 0.5, sodium: 2, potassium: 147, phosphorus: 24, calcium: 16, iron: 0.3, magnesium: 13, phe: 19, gi: 15, tags: ['global'] },
  { name: 'Spinach (boiled)', nameAr: 'سبانخ مسلوقة', category: 'Vegetables', kcal: 23, protein: 3.0, fat: 0.3, satFat: 0.0, carbs: 3.8, fiber: 2.4, sodium: 70, potassium: 466, phosphorus: 49, calcium: 136, iron: 3.6, magnesium: 87, phe: 130, gi: 15, tags: ['global'] },
  { name: 'Broccoli (boiled)', nameAr: 'بروكلي مسلوق', category: 'Vegetables', kcal: 35, protein: 2.4, fat: 0.4, satFat: 0.1, carbs: 7, fiber: 3.3, sodium: 41, potassium: 293, phosphorus: 67, calcium: 40, iron: 0.7, magnesium: 21, phe: 100, gi: 15, tags: ['global'] },
  { name: 'Carrot', nameAr: 'جزر', category: 'Vegetables', kcal: 41, protein: 0.9, fat: 0.2, satFat: 0.0, carbs: 10, fiber: 2.8, sodium: 69, potassium: 320, phosphorus: 35, calcium: 33, iron: 0.3, magnesium: 12, phe: 50, gi: 39, tags: ['global'] },
  { name: 'Lettuce', nameAr: 'خس', category: 'Vegetables', kcal: 15, protein: 1.4, fat: 0.2, satFat: 0.0, carbs: 2.9, fiber: 1.3, sodium: 28, potassium: 194, phosphorus: 29, calcium: 36, iron: 0.9, magnesium: 13, phe: 60, gi: 15, tags: ['global'] },
  { name: 'Onion', nameAr: 'بصل', category: 'Vegetables', kcal: 40, protein: 1.1, fat: 0.1, satFat: 0.0, carbs: 9, fiber: 1.7, sodium: 4, potassium: 146, phosphorus: 29, calcium: 23, iron: 0.2, magnesium: 10, phe: 25, gi: 15, tags: ['global'] },
  { name: 'Eggplant (cooked)', nameAr: 'باذنجان مطبوخ', category: 'Vegetables', kcal: 35, protein: 0.8, fat: 0.2, satFat: 0.0, carbs: 8.7, fiber: 2.5, sodium: 1, potassium: 123, phosphorus: 15, calcium: 6, iron: 0.3, magnesium: 11, phe: 30, gi: 15, tags: ['gulf', 'egypt'] },
  { name: 'Okra (cooked)', nameAr: 'بامية مطبوخة', category: 'Vegetables', kcal: 33, protein: 1.9, fat: 0.2, satFat: 0.0, carbs: 7, fiber: 3.2, sodium: 7, potassium: 299, phosphorus: 61, calcium: 82, iron: 0.6, magnesium: 57, phe: 70, gi: 20, tags: ['gulf', 'egypt'] },
  { name: 'Bell Pepper (green)', nameAr: 'فلفل أخضر', category: 'Vegetables', kcal: 20, protein: 0.9, fat: 0.2, satFat: 0.0, carbs: 4.6, fiber: 1.7, sodium: 3, potassium: 175, phosphorus: 20, calcium: 10, iron: 0.3, magnesium: 10, phe: 30, gi: 15, tags: ['global'] },

  // ── PROTEINS (animal) ─────────────────────────────────────────────
  { name: 'Chicken Breast (grilled)', nameAr: 'صدر دجاج مشوي', category: 'Proteins', kcal: 165, protein: 31, fat: 3.6, satFat: 1.0, carbs: 0, fiber: 0, sodium: 74, potassium: 256, phosphorus: 196, calcium: 15, iron: 1.0, magnesium: 29, phe: 1230, gi: 0, tags: ['global'] },
  { name: 'Salmon (baked)', nameAr: 'سلمون مشوي', category: 'Proteins', kcal: 208, protein: 22, fat: 13, satFat: 3.1, carbs: 0, fiber: 0, sodium: 61, potassium: 363, phosphorus: 252, calcium: 12, iron: 0.8, magnesium: 30, phe: 900, gi: 0, tags: ['global'] },
  { name: 'Cod (baked)', nameAr: 'سمك القد', category: 'Proteins', kcal: 105, protein: 23, fat: 0.9, satFat: 0.2, carbs: 0, fiber: 0, sodium: 78, potassium: 244, phosphorus: 203, calcium: 14, iron: 0.5, magnesium: 36, phe: 920, gi: 0, tags: ['global'] },
  { name: 'Lean Beef (cooked)', nameAr: 'لحم بقري قليل الدهن', category: 'Proteins', kcal: 217, protein: 26, fat: 12, satFat: 4.6, carbs: 0, fiber: 0, sodium: 66, potassium: 318, phosphorus: 198, calcium: 12, iron: 2.6, magnesium: 21, phe: 1040, gi: 0, tags: ['global'] },
  { name: 'Lamb (cooked)', nameAr: 'لحم ضأن', category: 'Proteins', kcal: 294, protein: 25, fat: 21, satFat: 8.8, carbs: 0, fiber: 0, sodium: 72, potassium: 310, phosphorus: 188, calcium: 17, iron: 1.9, magnesium: 23, phe: 1000, gi: 0, tags: ['gulf'] },
  { name: 'Egg (boiled)', nameAr: 'بيض مسلوق', category: 'Proteins', kcal: 155, protein: 13, fat: 11, satFat: 3.3, carbs: 1.1, fiber: 0, sodium: 124, potassium: 126, phosphorus: 172, calcium: 50, iron: 1.2, magnesium: 10, phe: 680, gi: 0, tags: ['global'] },

  // ── PROTEINS (plant / legumes) ────────────────────────────────────
  { name: 'Lentils (cooked)', nameAr: 'عدس مطبوخ', category: 'Legumes', kcal: 116, protein: 9, fat: 0.4, satFat: 0.1, carbs: 20, fiber: 8, sodium: 2, potassium: 369, phosphorus: 180, calcium: 19, iron: 3.3, magnesium: 36, phe: 450, gi: 32, tags: ['gulf', 'egypt'] },
  { name: 'Chickpeas (cooked)', nameAr: 'حمص مطبوخ', category: 'Legumes', kcal: 164, protein: 9, fat: 2.6, satFat: 0.3, carbs: 27, fiber: 8, sodium: 7, potassium: 291, phosphorus: 168, calcium: 49, iron: 2.9, magnesium: 48, phe: 460, gi: 28, tags: ['gulf', 'egypt'] },
  { name: 'Fava Beans (cooked)', nameAr: 'فول مدمس', category: 'Legumes', kcal: 110, protein: 7.6, fat: 0.4, satFat: 0.1, carbs: 20, fiber: 5.4, sodium: 5, potassium: 268, phosphorus: 125, calcium: 36, iron: 1.5, magnesium: 43, phe: 320, gi: 30, tags: ['egypt', 'gulf'] },
  { name: 'Tofu', nameAr: 'توفو', category: 'Legumes', kcal: 76, protein: 8.1, fat: 4.8, satFat: 0.7, carbs: 1.9, fiber: 0.3, sodium: 7, potassium: 121, phosphorus: 97, calcium: 350, iron: 5.4, magnesium: 30, phe: 410, gi: 15, tags: ['global'] },

  // ── DAIRY ─────────────────────────────────────────────────────────
  { name: 'Whole Milk', nameAr: 'حليب كامل الدسم', category: 'Dairy', kcal: 61, protein: 3.2, fat: 3.3, satFat: 1.9, carbs: 4.8, fiber: 0, sodium: 43, potassium: 132, phosphorus: 84, calcium: 113, iron: 0.0, magnesium: 10, phe: 160, gi: 31, tags: ['global'] },
  { name: 'Skim Milk', nameAr: 'حليب خالي الدسم', category: 'Dairy', kcal: 34, protein: 3.4, fat: 0.1, satFat: 0.1, carbs: 5, fiber: 0, sodium: 42, potassium: 156, phosphorus: 101, calcium: 122, iron: 0.0, magnesium: 11, phe: 170, gi: 32, tags: ['global'] },
  { name: 'Plain Yogurt (Laban)', nameAr: 'زبادي/لبن', category: 'Dairy', kcal: 61, protein: 3.5, fat: 3.3, satFat: 2.1, carbs: 4.7, fiber: 0, sodium: 46, potassium: 155, phosphorus: 95, calcium: 121, iron: 0.1, magnesium: 12, phe: 175, gi: 35, tags: ['gulf'] },
  { name: 'Cheddar Cheese', nameAr: 'جبنة شيدر', category: 'Dairy', kcal: 403, protein: 25, fat: 33, satFat: 21, carbs: 1.3, fiber: 0, sodium: 621, potassium: 98, phosphorus: 512, calcium: 721, iron: 0.7, magnesium: 28, phe: 1310, gi: 0, tags: ['global'] },
  { name: 'Labneh', nameAr: 'لبنة', category: 'Dairy', kcal: 174, protein: 7.7, fat: 14, satFat: 9, carbs: 4.3, fiber: 0, sodium: 320, potassium: 130, phosphorus: 130, calcium: 150, iron: 0.1, magnesium: 14, phe: 380, gi: 0, tags: ['gulf'] },

  // ── FATS & OILS ───────────────────────────────────────────────────
  { name: 'Olive Oil', nameAr: 'زيت زيتون', category: 'Fats', kcal: 884, protein: 0, fat: 100, satFat: 14, carbs: 0, fiber: 0, sodium: 2, potassium: 1, phosphorus: 0, calcium: 1, iron: 0.6, magnesium: 0, phe: 0, gi: 0, tags: ['gulf', 'global'] },
  { name: 'Butter', nameAr: 'زبدة', category: 'Fats', kcal: 717, protein: 0.9, fat: 81, satFat: 51, carbs: 0.1, fiber: 0, sodium: 11, potassium: 24, phosphorus: 24, calcium: 24, iron: 0.0, magnesium: 2, phe: 40, gi: 0, tags: ['global'] },
  { name: 'Tahini', nameAr: 'طحينة', category: 'Fats', kcal: 595, protein: 17, fat: 54, satFat: 7.6, carbs: 21, fiber: 9, sodium: 35, potassium: 414, phosphorus: 732, calcium: 426, iron: 8.9, magnesium: 95, phe: 870, gi: 0, tags: ['gulf', 'egypt'] },

  // ── PREPARED / CULTURAL DISHES ────────────────────────────────────
  { name: 'Chicken Kabsa', nameAr: 'كبسة دجاج', category: 'Prepared', kcal: 190, protein: 11, fat: 6, satFat: 1.6, carbs: 23, fiber: 1.0, sodium: 410, potassium: 180, phosphorus: 110, calcium: 20, iron: 1.2, magnesium: 18, phe: 470, gi: 60, tags: ['gulf'] },
  { name: 'Hummus', nameAr: 'حمص بطحينة', category: 'Prepared', kcal: 166, protein: 7.9, fat: 9.6, satFat: 1.4, carbs: 14, fiber: 6, sodium: 379, potassium: 228, phosphorus: 176, calcium: 38, iron: 2.4, magnesium: 71, phe: 420, gi: 25, tags: ['gulf', 'egypt'] },
  { name: 'Shawarma (chicken)', nameAr: 'شاورما دجاج', category: 'Prepared', kcal: 215, protein: 16, fat: 12, satFat: 3.2, carbs: 12, fiber: 1.0, sodium: 640, potassium: 220, phosphorus: 150, calcium: 30, iron: 1.4, magnesium: 22, phe: 760, gi: 55, tags: ['gulf', 'egypt'] },
  { name: 'Falafel', nameAr: 'فلافل/طعمية', category: 'Prepared', kcal: 333, protein: 13, fat: 18, satFat: 2.4, carbs: 32, fiber: 5, sodium: 294, potassium: 585, phosphorus: 192, calcium: 54, iron: 3.4, magnesium: 82, phe: 600, gi: 45, tags: ['egypt', 'gulf'] },
  { name: 'Manakish Zaatar', nameAr: 'مناقيش زعتر', category: 'Prepared', kcal: 290, protein: 7, fat: 12, satFat: 2.0, carbs: 39, fiber: 2.5, sodium: 480, potassium: 140, phosphorus: 95, calcium: 60, iron: 2.8, magnesium: 26, phe: 330, gi: 65, tags: ['gulf'] },

  // ── CLINICAL FORMULAS / ONS ───────────────────────────────────────
  { name: 'Standard ONS (1.5 kcal/mL)', nameAr: 'مكمل غذائي فموي', category: 'Clinical Formula', kcal: 150, protein: 6, fat: 4.9, satFat: 0.6, carbs: 20, fiber: 0, sodium: 80, potassium: 150, phosphorus: 100, calcium: 100, iron: 1.8, magnesium: 20, phe: 290, gi: 0, tags: ['clinical'] },
  { name: 'Renal ONS (low-K, low-P)', nameAr: 'مكمل كلوي', category: 'Clinical Formula', kcal: 200, protein: 7, fat: 9, satFat: 1.0, carbs: 24, fiber: 0, sodium: 60, potassium: 50, phosphorus: 40, calcium: 30, iron: 1.0, magnesium: 6, phe: 320, gi: 0, tags: ['clinical', 'renal'] },
  { name: 'PKU Phe-free Formula', nameAr: 'حليب خاص للبيلة الفينيلية', category: 'Clinical Formula', kcal: 70, protein: 2.5, fat: 3.4, satFat: 1.4, carbs: 7.6, fiber: 0, sodium: 24, potassium: 90, phosphorus: 50, calcium: 70, iron: 1.0, magnesium: 7, phe: 0, gi: 0, tags: ['clinical', 'iem'] },
  { name: 'Term Infant Formula', nameAr: 'حليب صناعي للرضع', category: 'Clinical Formula', kcal: 67, protein: 1.4, fat: 3.6, satFat: 1.5, carbs: 7.3, fiber: 0, sodium: 18, potassium: 72, phosphorus: 38, calcium: 53, iron: 1.0, magnesium: 5, phe: 59, gi: 0, tags: ['clinical', 'neonatal'] },
];

// Assign stable ids
FOODS.forEach((f, i) => { f.id = `food-${i + 1}`; });

module.exports = { FOODS };
