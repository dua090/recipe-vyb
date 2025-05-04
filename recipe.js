/**
 * Indian Dish Nutrition Estimator
 * A simple tool to estimate nutritional values of Indian dishes
 */


const axios = require('axios');
const { GoogleGenAI } = require("@google/genai");
require('dotenv').config();
// API Keys and configs
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY 
const SPREADSHEET_ID = process.env.SPREADSHEET_ID


// Sheet names
const NUTRITION_SHEET_NAME = 'Nutrition source';
const MEASUREMENT_SHEET_NAME = 'Unit of measurements';
const CATEGORIES_SHEET_NAME = 'Food categories';

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: "AIzaSyBjdXqqhj4bHwLABqd8iS1fc6dfY9vP5jI" });
// Cache for data
let nutritionDatabase = null;
let measurementUnits = null;
let foodCategories = null;

/**
 * Main function to estimate nutrition for an Indian dish
 */
async function estimateNutrition(dishName) {
  try {
    console.log(`Estimating nutrition for: ${dishName}`);
    
    // Step 1: Load data
    await loadData();
    
    // Step 2: Fetch recipe
    const recipe = await fetchRecipe(dishName);
    
    
    // Step 3: Identify food category
    const foodType = await identifyFoodCategory(dishName, recipe);
    
    // Step 4: Process ingredients and calculate nutrition
    const processedIngredients = await processIngredients(recipe.ingredients, foodType);
    
    // Step 5: Calculate serving nutrition
    const servingNutrition = calculateServingNutrition(
      processedIngredients.totalNutrition, 
      foodType
    );
    
    // Format output
    return {
      dish_name: dishName,
      dish_type: foodType,
      estimated_nutrition_per_serving: servingNutrition,
      ingredients_used: processedIngredients.ingredients.map(ing => ({
        ingredient: ing.name,
        quantity: ing.originalQuantity,
        weight_grams: Math.round(ing.weightInGrams || 0)
      }))
    };
  } catch (error) {
    console.error(`Error processing ${dishName}:`, error.message);
    return { error: `Failed to process ${dishName}`, message: error.message };
  }
}

/**
 * Load all necessary data from Google Sheets
 */
async function loadData() {
  if (!nutritionDatabase || !measurementUnits || !foodCategories) {
    try {
      // Load nutrition database
      nutritionDatabase = await fetchSheetData(NUTRITION_SHEET_NAME);
      
      // Load measurement units
      measurementUnits = await fetchSheetData(MEASUREMENT_SHEET_NAME);
      
      // Load food categories
      foodCategories = await fetchSheetData(CATEGORIES_SHEET_NAME);
      
      console.log('Data loaded successfully');
    } catch (error) {
      console.error('Failed to load data:', error.message);
      throw new Error('Failed to load required data');
    }
  }
}

/**
 * Fetch data from Google Sheet
 */
async function fetchSheetData(sheetName) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetName}?key=${GOOGLE_API_KEY}`;
    const response = await axios.get(url);
    
    if (!response.data || !response.data.values) {
      throw new Error(`No data found in sheet: ${sheetName}`);
    }
    
    const [headers, ...rows] = response.data.values;
    return rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  } catch (error) {
    console.error(`Failed to fetch data from ${sheetName}:`, error.message);
    throw error;
  }
}

/**
 * Fetch recipe using Gemini
 */
async function fetchRecipe(dishName) {
  try {
    
    const prompt = `
    Create a typical recipe for Indian dish: "${dishName}".
    Return ONLY a JSON object with this exact structure:
    { for example
      "ingredients": [
        {"name": "ingredient name", "quantity": "approximate quantity"}
      ]
    }
    Include 5-10 main ingredients with quantities in common household measurements (cups, tbsp, tsp, etc.).
    `;
    
    const response = await await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });    
    // const response = await result.response;
    const text = response.text;
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    throw new Error('Could not parse recipe response');
  } catch (error) {
    console.error(`Failed to fetch recipe for ${dishName}:`, error.message);
    return getDummyRecipe(dishName);
  }
}

/**
 * Get a fallback recipe
 */
function getDummyRecipe(dishName) {
  const lowerDishName = dishName.toLowerCase();
  
  // Map of common dishes
  const recipes = {
    "paneer butter masala": {
      ingredients: [
        { name: "paneer", quantity: "250g" },
        { name: "butter", quantity: "2 tbsp" },
        { name: "tomato", quantity: "3 medium" },
        { name: "onion", quantity: "1 large" },
        { name: "cream", quantity: "2 tbsp" },
        { name: "garam masala", quantity: "1 tsp" }
      ]
    },
    "dal makhani": {
      ingredients: [
        { name: "black urad dal", quantity: "1 cup" },
        { name: "rajma", quantity: "1/4 cup" },
        { name: "butter", quantity: "2 tbsp" },
        { name: "tomato", quantity: "2 medium" },
        { name: "cream", quantity: "1 tbsp" }
      ]
    },
    "chicken curry": {
      ingredients: [
        { name: "chicken", quantity: "500g" },
        { name: "onion", quantity: "2 medium" },
        { name: "tomato", quantity: "2 medium" },
        { name: "oil", quantity: "2 tbsp" },
        { name: "garam masala", quantity: "1 tsp" }
      ]
    }
  };
  
  // Return matching recipe or generic fallback
  return recipes[lowerDishName] || {
    ingredients: [
      { name: "main ingredient", quantity: "250g" },
      { name: "onion", quantity: "1 medium" },
      { name: "tomato", quantity: "2 medium" },
      { name: "oil", quantity: "2 tbsp" },
      { name: "spices", quantity: "2 tsp" }
    ]
  };
}

/**
 * Identify food category
 */
async function identifyFoodCategory(dishName, recipe) {
  try {
    
    const prompt = `
    Categorize the Indian dish "${dishName}" into EXACTLY ONE of these categories:
    - Wet Sabzi
    - Dry Sabzi
    - Dal
    - Dal
    - Non-Veg Curry
    - Rice Dish
    - Roti/Bread
    - Sweet/Dessert
    
    Return ONLY the category name, nothing else.
    `;
    
    const response = await await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });    
    // const response = await result.response;
    let category = response.text.trim();
    
    // Validate against our known categories
    const validCategories = foodCategories.map(cat => cat.Food_category_name);
    
    if (validCategories.includes(category)) {
      return category;
    }
    
    // Fallback based on ingredients
    return inferCategoryFromDish(dishName);
  } catch (error) {
    console.error(`Failed to identify category:`, error.message);
    return inferCategoryFromDish(dishName);
  }
}

/**
 * Infer food category from dish name
 */
function inferCategoryFromDish(dishName) {
  const dish = dishName.toLowerCase();
  
  if (dish.includes('dal') || dish.includes('dhal')) return 'Dal';
  if (dish.includes('curry') || dish.includes('masala')) {
    if (dish.includes('chicken') || dish.includes('mutton') || 
        dish.includes('fish') || dish.includes('prawn')) {
      return 'Non-Veg Curry';
    }
    return 'Wet Sabzi';
  }
  if (dish.includes('rice') || dish.includes('pulao') || dish.includes('biryani')) return 'Rice Dish';
  if (dish.includes('roti') || dish.includes('naan') || dish.includes('paratha')) return 'Roti/Bread';
  if (dish.includes('sweet') || dish.includes('halwa') || dish.includes('kheer')) return 'Sweet/Dessert';
  
  // Default
  return 'Dry Sabzi';
}

/**
 * Process ingredients and calculate nutrition
 */
async function processIngredients(ingredients, foodType) {
  let totalNutrition = {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0
  };
  
  const processedIngredients = await Promise.all(ingredients.map(async ingredient => {
    try {
      // Parse quantities
      const { standardQuantity, weightInGrams } = standardizeQuantity(ingredient.name, ingredient.quantity);
      
      // Find nutrition data
      const nutritionData = await getNutritionData(ingredient.name, weightInGrams);
      
      // Add to total
      Object.keys(totalNutrition).forEach(key => {
        totalNutrition[key] += nutritionData[key] || 0;
      });
      
      return {
        name: ingredient.name,
        originalQuantity: ingredient.quantity,
        standardQuantity,
        weightInGrams,
        nutritionData
      };
    } catch (error) {
      console.warn(`Error processing ingredient ${ingredient.name}:`, error.message);
      return {
        name: ingredient.name,
        originalQuantity: ingredient.quantity,
        warning: 'Failed to process'
      };
    }
  }));
  
  // Round values
  Object.keys(totalNutrition).forEach(key => {
    totalNutrition[key] = Math.round(totalNutrition[key] * 10) / 10;
  });
  
  return { ingredients: processedIngredients, totalNutrition };
}

/**
 * Standardize ingredient quantity
 */
function standardizeQuantity(name, quantity) {
  // Skip non-quantifiable
  if (!quantity || quantity.toLowerCase().includes('to taste')) {
    return { standardQuantity: quantity, weightInGrams: 0 };
  }
  
  try {
    // Parse quantity
    const parsedQty = parseQuantity(quantity);
    const standardQuantity = parsedQty.value ? 
      `${parsedQty.value} ${parsedQty.unit || ''}`.trim() : 
      quantity;
    
    // Convert to grams based on unit
    let weightInGrams = 0;
    
    if (parsedQty.value) {
      if (parsedQty.unit === 'g' || parsedQty.unit === 'gram') {
        weightInGrams = parsedQty.value;
      } else if (parsedQty.unit === 'kg') {
        weightInGrams = parsedQty.value * 1000;
      } else if (parsedQty.unit === 'tsp' || parsedQty.unit === 'teaspoon') {
        weightInGrams = parsedQty.value * 5;
      } else if (parsedQty.unit === 'tbsp' || parsedQty.unit === 'tablespoon') {
        weightInGrams = parsedQty.value * 15;
      } else if (parsedQty.unit === 'cup') {
        weightInGrams = parsedQty.value * 150; // Approximate
      } else if (parsedQty.unit === 'piece' || parsedQty.unit === 'medium') {
        // Estimate by ingredient
        if (name.includes('onion')) weightInGrams = parsedQty.value * 150;
        else if (name.includes('tomato')) weightInGrams = parsedQty.value * 120;
        else if (name.includes('potato')) weightInGrams = parsedQty.value * 150;
        else weightInGrams = parsedQty.value * 100;
      } else {
        // Default estimate
        weightInGrams = parsedQty.value * 30;
      }
    } else {
      // Can't parse, use default estimate
      weightInGrams = 30;
    }
    
    return { standardQuantity, weightInGrams };
  } catch (error) {
    console.warn(`Error standardizing ${name} quantity:`, error.message);
    return { standardQuantity: quantity, weightInGrams: 30 };
    
  }
}

/**
 * Parse quantity string to value and unit
 */
function parseQuantity(quantityStr) {
  if (!quantityStr) return { value: null, unit: null };
  
  // Handle numeric values with units
  const regex = /^(\d+\/\d+|\d+\.?\d*|\.\d+)\s*([a-zA-Z]+)?$/;
  const match = quantityStr.trim().match(regex);
  
  if (match) {
    let value = match[1];
    const unit = match[2] || '';
    
    // Handle fractions
    if (value.includes('/')) {
      const [numerator, denominator] = value.split('/');
      value = parseFloat(numerator) / parseFloat(denominator);
    } else {
      value = parseFloat(value);
    }
    
    return { value, unit: unit.toLowerCase() };
  }
  
  // If can't parse, return as is
  return { value: null, unit: null, raw: quantityStr };
}

/**
 * Get nutrition data for an ingredient
 */
async function getNutritionData(ingredientName, weightInGrams) {
  try {
    // Find in database
    const dbIngredient = findIngredientInDatabase(ingredientName);
    
    if (dbIngredient) {
      // Convert nutrition data based on weight
      const factor = weightInGrams / 100; // DB values per 100g
      
      return {
        calories: parseFloat(dbIngredient.energy_kcal || 0) * factor,
        protein: parseFloat(dbIngredient.protein_g || 0) * factor,
        carbs: parseFloat(dbIngredient.carb_g || 0) * factor,
        fat: parseFloat(dbIngredient.fat_g || 0) * factor,
        fiber: parseFloat(dbIngredient.fibre_g || 0) * factor
      };
    } else {
      // Not found, try asking Gemini
      return await estimateNutritionWithGemini(ingredientName, weightInGrams);
    }
  } catch (error) {
    console.warn(`Failed to get nutrition data for ${ingredientName}:`, error.message);
    // Fallback to estimates
    return estimateBasicNutrition(ingredientName, weightInGrams);
  }
}

/**
 * Find ingredient in database with fuzzy matching
 */
function findIngredientInDatabase(ingredientName) {
  const cleanName = ingredientName.toLowerCase().trim();
  
  // Exact match
  const exactMatch = nutritionDatabase.find(item => 
    item.food_name && item.food_name.toLowerCase() === cleanName
  );
  
  if (exactMatch) return exactMatch;
  
  // Partial match
  const partialMatch = nutritionDatabase.find(item => 
    item.food_name && item.food_name.toLowerCase().includes(cleanName)
  );
  
  if (partialMatch) return partialMatch;
  
  // Match by parts
  const words = cleanName.split(' ');
  for (const word of words) {
    if (word.length < 3) continue;
    
    const wordMatch = nutritionDatabase.find(item => 
      item.food_name && item.food_name.toLowerCase().includes(word)
    );
    
    if (wordMatch) return wordMatch;
  }
  
  return null;
}

/**
 * Estimate nutrition using Gemini
 */
async function estimateNutritionWithGemini(ingredientName, weightInGrams) {
  if (!GEMINI_API_KEY) {
    return estimateBasicNutrition(ingredientName, weightInGrams);
  }
  
  try {
    
    const prompt = `
    Please estimate the nutritional values for ${weightInGrams}g of ${ingredientName}.
    Provide ONLY a JSON with exact keys: calories, protein, carbs, fat, fiber.
    Values should be numbers only (no units), with calories in kcal and others in grams.
    Example: {"calories": 150, "protein": 5, "carbs": 20, "fat": 3, "fiber": 2}
    `;
    
    const response = await await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });    
    // const response = await result.response;
    const text = response.text;
    
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const nutrition = JSON.parse(jsonMatch[0]);
      return {
        calories: parseFloat(nutrition.calories || 0),
        protein: parseFloat(nutrition.protein || 0),
        carbs: parseFloat(nutrition.carbs || 0),
        fat: parseFloat(nutrition.fat || 0),
        fiber: parseFloat(nutrition.fiber || 0)
      };
    }
    
    throw new Error('Could not parse nutrition estimate');
  } catch (error) {
    console.warn(`Failed to get Gemini nutrition for ${ingredientName}:`, error.message);
    return estimateBasicNutrition(ingredientName, weightInGrams);
  }
}

/**
 * Basic nutrition estimates for fallback
 */
function estimateBasicNutrition(ingredientName, weightInGrams) {
  const name = ingredientName.toLowerCase();
  const factor = weightInGrams / 100;
  
  // Base values per 100g
  let nutrition = { calories: 50, protein: 2, carbs: 10, fat: 0.5, fiber: 1 };
  
  // Adjust based on ingredient type
  if (name.includes('oil') || name.includes('ghee') || name.includes('butter')) {
    nutrition = { calories: 900, protein: 0, carbs: 0, fat: 100, fiber: 0 };
  } else if (name.includes('sugar') || name.includes('jaggery')) {
    nutrition = { calories: 400, protein: 0, carbs: 100, fat: 0, fiber: 0 };
  } else if (name.includes('paneer') || name.includes('cheese')) {
    nutrition = { calories: 300, protein: 20, carbs: 5, fat: 25, fiber: 0 };
  } else if (name.includes('chicken') || name.includes('mutton') || name.includes('meat')) {
    nutrition = { calories: 200, protein: 25, carbs: 0, fat: 10, fiber: 0 };
  } else if (name.includes('rice') || name.includes('wheat') || name.includes('flour')) {
    nutrition = { calories: 350, protein: 8, carbs: 75, fat: 1, fiber: 3 };
  } else if (name.includes('vegetable') || name.includes('sabzi')) {
    nutrition = { calories: 40, protein: 2, carbs: 8, fat: 0.2, fiber: 3 };
  }
  
  // Apply weight factor
  Object.keys(nutrition).forEach(key => {
    nutrition[key] *= factor;
  });
  
  return nutrition;
}

/**
 * Calculate nutrition per standard serving
 */
function calculateServingNutrition(totalNutrition, foodType) {
  // Get standard serving size
  const servingSizeGrams = getServingSizeForCategory(foodType);
  
  // Estimate total cooked weight
  const totalWeight = getTotalWeightForCategory(foodType);
  
  // Calculate scale factor
  const scaleFactor = servingSizeGrams / totalWeight;
  
  // Scale nutrition values
  const servingNutrition = {};
  Object.keys(totalNutrition).forEach(key => {
    servingNutrition[key] = Math.round(totalNutrition[key] * scaleFactor);
  });
  
  return servingNutrition;
}

/**
 * Get standard serving size for a food category
 */
function getServingSizeForCategory(category) {
  const servingSizes = {
    'Wet Sabzi': 180,
    'Dry Sabzi': 100,
    'Dal': 150,
    'Non-Veg Curry': 180,
    'Rice Dish': 150,
    'Roti/Bread': 30,
    'Sweet/Dessert': 75
  };
  
  return servingSizes[category] || 150;
}

/**
 * Get total cooked weight for a food category
 */
function getTotalWeightForCategory(category) {
  const weights = {
    'Wet Sabzi': 800,
    'Dry Sabzi': 600,
    'Dal': 700,
    'Non-Veg Curry': 800,
    'Rice Dish': 800,
    'Roti/Bread': 300,
    'Sweet/Dessert': 500
  };
  
  return weights[category] || 700;
}

/**
 * Command line interface
 */
async function main() {
  if (process.argv.length < 3) {
    console.log('Usage: node nutrition-estimator.js "Dish Name"');
    process.exit(1);
  }
  
  const dishName = process.argv[2];
  
  try {
    const result = await estimateNutrition(dishName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { estimateNutrition };