/**
 * NZ supermarket store-section definitions and a keyword-based classifier
 * that assigns a shopping-list item name to the section it would be found in.
 *
 * Sort order follows a typical NZ supermarket walk-through (produce → bakery
 * → meat → … → household).
 */

export interface SupermarketSection {
  id: string;
  name: string;
  sortOrder: number;
}

const SECTIONS: SupermarketSection[] = [
  { id: "produce", name: "Produce", sortOrder: 1 },
  { id: "bakery", name: "Bakery", sortOrder: 2 },
  { id: "meat_poultry", name: "Meat & Poultry", sortOrder: 3 },
  { id: "fish_seafood", name: "Fish & Seafood", sortOrder: 4 },
  { id: "fridge_dairy_deli_eggs", name: "Fridge / Dairy / Deli / Eggs", sortOrder: 5 },
  { id: "pantry", name: "Pantry", sortOrder: 6 },
  { id: "frozen", name: "Frozen", sortOrder: 7 },
  { id: "snacks_confectionery_easy_meals", name: "Snacks / Confectionery / Easy Meals", sortOrder: 8 },
  { id: "drinks", name: "Drinks", sortOrder: 9 },
  { id: "beer_wine_cider", name: "Beer / Wine / Cider", sortOrder: 10 },
  { id: "health_beauty_personal_care", name: "Health / Beauty / Personal Care", sortOrder: 11 },
  { id: "baby_toddler", name: "Baby & Toddler", sortOrder: 12 },
  { id: "pets", name: "Pets", sortOrder: 13 },
  { id: "household_cleaning", name: "Household & Cleaning", sortOrder: 14 },
  { id: "seasonal_specials", name: "Seasonal / Specials", sortOrder: 15 },
  { id: "ready_to_eat_service_counter", name: "Ready-to-Eat / Service Counter", sortOrder: 16 },
];

const SECTIONS_BY_ID = new Map(SECTIONS.map((s) => [s.id, s]));

/** Default section when no keyword matches. */
const FALLBACK_SECTION_ID = "pantry";

/**
 * Each entry is [sectionId, ...keywords]. A keyword matches when it appears as
 * a whole word (or word-boundary substring) inside the lowercased item name.
 *
 * More specific keywords should appear in earlier entries when there is
 * potential ambiguity (e.g. "chicken stock" should match pantry via "stock"
 * before matching meat via "chicken"). The classifier iterates the rules
 * top-to-bottom and returns the FIRST match, so ordering matters.
 */
const KEYWORD_RULES: [string, ...string[]][] = [
  // ── Produce ──────────────────────────────────────────────────────────
  [
    "produce",
    "apple", "apples", "banana", "bananas", "orange", "oranges", "lemon", "lemons",
    "lime", "limes", "avocado", "avocados", "tomato", "tomatoes", "potato", "potatoes",
    "kumara", "onion", "onions", "garlic", "ginger", "carrot", "carrots", "broccoli",
    "cauliflower", "capsicum", "courgette", "zucchini", "mushroom", "mushrooms",
    "spinach", "lettuce", "kale", "cabbage", "celery", "cucumber", "spring onion",
    "spring onions", "pumpkin", "beetroot", "corn on the cob", "silverbeet",
    "bok choy", "pak choi", "eggplant", "aubergine", "asparagus", "green beans",
    "beans", "peas", "leek", "leeks", "parsnip", "radish", "fennel",
    "rocket", "watercress", "mesclun", "salad mix", "salad", "herbs",
    "basil", "parsley", "coriander", "cilantro", "mint", "rosemary", "thyme",
    "dill", "chives", "sage", "oregano", "tarragon",
    "grape", "grapes", "kiwifruit", "kiwi fruit", "mandarin", "mandarins",
    "nectarine", "nectarines", "peach", "peaches", "pear", "pears", "plum", "plums",
    "berry", "berries", "strawberry", "strawberries", "blueberry", "blueberries",
    "raspberry", "raspberries", "watermelon", "melon", "pineapple", "mango",
    "feijoa", "feijoas", "passionfruit", "papaya", "cherry", "cherries",
    "coconut", "fresh coconut", "persimmon", "fig", "figs",
    "sweet potato", "swede", "turnip", "yam",
  ],

  // ── Bakery ───────────────────────────────────────────────────────────
  [
    "bakery",
    "bread", "loaf", "baguette", "ciabatta", "focaccia", "sourdough",
    "croissant", "croissants", "muffin", "muffins", "scone", "scones",
    "roll", "rolls", "bun", "buns", "bagel", "bagels", "pita", "naan",
    "tortilla", "tortillas", "wrap", "wraps", "crumpet", "crumpets",
    "cake", "danish", "brioche", "roti",
  ],

  // ── Meat & Poultry ──────────────────────────────────────────────────
  [
    "meat_poultry",
    "chicken breast", "chicken thigh", "chicken drum", "chicken wing",
    "whole chicken", "chicken piece", "chicken mince",
    "beef", "steak", "scotch fillet", "sirloin", "rump", "eye fillet",
    "beef mince", "lamb", "lamb chop", "lamb leg", "lamb shoulder",
    "lamb mince", "pork", "pork chop", "pork belly", "pork loin",
    "pork mince", "bacon", "sausage", "sausages", "chorizo", "salami",
    "ham", "mince", "venison", "veal", "duck",
    "chicken", "turkey",
  ],

  // ── Fish & Seafood ──────────────────────────────────────────────────
  [
    "fish_seafood",
    "salmon", "tuna", "snapper", "tarakihi", "hoki", "gurnard",
    "blue cod", "terakihi", "fish fillet", "fish",
    "prawn", "prawns", "shrimp", "mussel", "mussels",
    "squid", "calamari", "crab", "oyster", "oysters",
    "scallop", "scallops", "clam", "clams", "paua",
    "crayfish", "lobster", "seafood", "smoked salmon",
    "fish fingers", "fish cake",
  ],

  // ── Fridge / Dairy / Deli / Eggs ────────────────────────────────────
  [
    "fridge_dairy_deli_eggs",
    "milk", "cream", "sour cream", "cream cheese", "cottage cheese",
    "yoghurt", "yogurt", "butter", "margarine", "cheese", "cheddar",
    "mozzarella", "parmesan", "feta", "brie", "camembert", "haloumi",
    "halloumi", "ricotta", "mascarpone", "edam", "colby", "tasty cheese",
    "egg", "eggs", "free range eggs",
    "hummus", "dip", "pesto", "guacamole", "tzatziki",
    "tofu", "tempeh",
    "fresh pasta", "fresh juice", "fresh soup",
    "prosciutto", "pastrami", "roast beef slices", "deli meat",
    "coleslaw", "aioli",
  ],

  // ── Pantry ──────────────────────────────────────────────────────────
  [
    "pantry",
    "rice", "pasta", "spaghetti", "penne", "fettuccine", "macaroni",
    "noodle", "noodles", "ramen", "couscous", "quinoa", "barley", "oats",
    "porridge", "muesli", "cereal", "weetbix", "flour", "sugar",
    "caster sugar", "icing sugar", "brown sugar",
    "salt", "pepper", "spice", "cumin", "paprika", "turmeric",
    "cinnamon", "nutmeg", "chilli flakes", "curry powder", "garam masala",
    "mixed herbs", "italian seasoning", "five spice",
    "oil", "olive oil", "canola oil", "coconut oil", "vegetable oil",
    "sesame oil", "vinegar", "balsamic", "soy sauce", "fish sauce",
    "oyster sauce", "worcestershire", "tomato sauce", "ketchup",
    "mustard", "mayonnaise", "mayo", "hot sauce", "sriracha", "sambal",
    "honey", "maple syrup", "golden syrup", "treacle",
    "canned tomato", "tinned tomato", "tomato paste", "passata",
    "coconut milk", "coconut cream",
    "canned beans", "chickpeas", "lentils", "kidney beans", "baked beans",
    "canned corn", "canned tuna", "canned salmon",
    "stock", "stock cube", "broth", "bouillon",
    "baking powder", "baking soda", "bicarbonate", "yeast",
    "cocoa", "chocolate chips", "vanilla", "vanilla extract", "vanilla essence",
    "cornflour", "cornstarch", "gelatine", "agar",
    "breadcrumbs", "panko",
    "nut", "nuts", "almond", "almonds", "walnut", "walnuts",
    "cashew", "cashews", "peanut", "peanuts", "pecan", "pecans",
    "pine nut", "pine nuts", "pistachio", "pistachios",
    "peanut butter", "almond butter", "tahini",
    "dried fruit", "raisins", "sultanas", "cranberries", "dates",
    "apricot", "dried apricot",
    "jam", "marmalade", "vegemite", "marmite", "nutella", "spread",
    "chia seed", "chia seeds", "flaxseed", "sesame seeds", "sunflower seeds",
    "pumpkin seeds",
  ],

  // ── Frozen ──────────────────────────────────────────────────────────
  [
    "frozen",
    "frozen", "ice cream", "gelato", "sorbet",
    "frozen peas", "frozen corn", "frozen veg", "frozen vegetables",
    "frozen berries", "frozen chips", "frozen fries", "hash brown",
    "frozen pizza", "frozen pie", "frozen pastry", "puff pastry",
    "frozen fish", "frozen prawns", "frozen chicken",
    "frozen meal",
  ],

  // ── Snacks / Confectionery / Easy Meals ─────────────────────────────
  [
    "snacks_confectionery_easy_meals",
    "chip", "chips", "crisps", "popcorn", "pretzel", "cracker", "crackers",
    "biscuit", "biscuits", "cookie", "cookies",
    "chocolate", "chocolate bar", "lolly", "lollies", "candy", "gummy",
    "muesli bar", "protein bar", "snack bar",
    "instant noodle", "cup noodle", "pot noodle",
    "2 minute noodle", "ready meal",
  ],

  // ── Drinks ──────────────────────────────────────────────────────────
  [
    "drinks",
    "coffee", "tea", "green tea", "herbal tea", "chai",
    "instant coffee", "ground coffee", "coffee beans",
    "juice", "orange juice", "apple juice",
    "water", "sparkling water", "mineral water",
    "soft drink", "soda", "cola", "lemonade",
    "energy drink", "sports drink",
    "kombucha", "cordial", "drinking chocolate",
    "milo",
  ],

  // ── Beer / Wine / Cider ─────────────────────────────────────────────
  [
    "beer_wine_cider",
    "beer", "lager", "ale", "stout", "ipa",
    "wine", "red wine", "white wine", "rosé", "rose wine",
    "cider", "prosecco", "champagne", "sparkling wine",
    "spirits", "vodka", "gin", "whisky", "rum", "tequila",
  ],

  // ── Health / Beauty / Personal Care ─────────────────────────────────
  [
    "health_beauty_personal_care",
    "shampoo", "conditioner", "body wash", "soap", "hand wash",
    "deodorant", "toothpaste", "toothbrush", "mouthwash", "floss",
    "moisturiser", "moisturizer", "sunscreen", "sunblock",
    "razor", "shaving", "cotton bud", "cotton ball",
    "vitamin", "vitamins", "supplement", "paracetamol", "ibuprofen",
    "plaster", "bandaid", "band-aid", "first aid",
    "sanitary", "tampon", "pad", "panty liner",
    "tissue", "facial tissue",
  ],

  // ── Baby & Toddler ─────────────────────────────────────────────────
  [
    "baby_toddler",
    "nappy", "nappies", "diaper", "diapers", "baby wipe", "baby wipes",
    "baby food", "baby formula", "formula",
    "baby wash", "baby shampoo", "baby lotion",
    "sippy cup", "dummy", "pacifier",
  ],

  // ── Pets ────────────────────────────────────────────────────────────
  [
    "pets",
    "dog food", "cat food", "pet food",
    "dog treat", "cat treat", "cat litter", "kitty litter",
    "pet", "flea", "worming",
  ],

  // ── Household & Cleaning ────────────────────────────────────────────
  [
    "household_cleaning",
    "dishwash", "dish soap", "dish liquid",
    "laundry", "washing powder", "laundry liquid", "fabric softener",
    "bleach", "disinfectant", "cleaner", "spray and wipe",
    "sponge", "scourer", "cloth", "chux",
    "toilet paper", "paper towel", "paper towels", "rubbish bag",
    "rubbish bags", "bin liner", "bin liners", "glad wrap", "cling wrap",
    "aluminium foil", "aluminum foil", "foil", "baking paper",
    "ziplock", "zip lock", "food bag",
    "candle", "air freshener", "light bulb",
  ],

  // ── Ready-to-Eat / Service Counter ──────────────────────────────────
  [
    "ready_to_eat_service_counter",
    "rotisserie", "roast chicken", "hot chicken",
    "sushi", "sandwich", "wrap",
    "pie", "savoury",
    "prepared salad", "pre-made",
  ],
];

/**
 * Pre-compiled for fast lookup. Maps each keyword → sectionId. Longer
 * keywords are checked first so that "chicken breast" beats "chicken".
 */
type CompiledRule = { keyword: string; sectionId: string };
let compiled: CompiledRule[] | null = null;

function getCompiledRules(): CompiledRule[] {
  if (compiled) return compiled;
  const rules: CompiledRule[] = [];
  for (const [sectionId, ...keywords] of KEYWORD_RULES) {
    for (const kw of keywords) {
      rules.push({ keyword: kw.toLowerCase(), sectionId });
    }
  }
  // Sort longer keywords first so multi-word phrases match before their
  // single-word constituents (e.g. "chicken breast" before "chicken").
  rules.sort((a, b) => b.keyword.length - a.keyword.length);
  compiled = rules;
  return compiled;
}

/**
 * Classify an item name into a supermarket section. Returns the section
 * definition. Falls back to "Pantry" when no keyword matches.
 */
export function classifyItem(name: string): SupermarketSection {
  const lower = name.toLowerCase().trim();
  const rules = getCompiledRules();
  for (const rule of rules) {
    if (lower.includes(rule.keyword)) {
      return SECTIONS_BY_ID.get(rule.sectionId)!;
    }
  }
  return SECTIONS_BY_ID.get(FALLBACK_SECTION_ID)!;
}

/** All sections in walk-through order. */
export function allSections(): SupermarketSection[] {
  return [...SECTIONS];
}
