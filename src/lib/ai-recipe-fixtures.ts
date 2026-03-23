import type { AiRecipeDraftBatch, PantryAiContext } from "@/lib/ai-recipe-schema";

export const pantryAiContextFixtures: Record<string, PantryAiContext> = {
  small: {
    dietaryPreferences: null,
    existingRecipeTitles: ["Tomato pasta"],
    pantryItems: [
      {
        name: "Eggs",
        quantity: "6",
        unit: "each",
        location: "Fridge",
        expirationDate: null,
        isExpiringSoon: false,
      },
      {
        name: "Spinach",
        quantity: "1",
        unit: "bag",
        location: "Fridge",
        expirationDate: null,
        isExpiringSoon: false,
      },
    ],
    expiringSoon: [],
  },
  medium: {
    dietaryPreferences: "high protein",
    existingRecipeTitles: ["Chicken stir fry", "Lentil soup"],
    pantryItems: [
      {
        name: "Chicken breast",
        quantity: "2",
        unit: "fillets",
        location: "Fridge",
        expirationDate: null,
        isExpiringSoon: false,
      },
      {
        name: "Rice",
        quantity: "3",
        unit: "cups",
        location: "Pantry",
        expirationDate: null,
        isExpiringSoon: false,
      },
      {
        name: "Frozen peas",
        quantity: "1",
        unit: "bag",
        location: "Freezer",
        expirationDate: null,
        isExpiringSoon: false,
      },
    ],
    expiringSoon: [],
  },
  expiring: {
    dietaryPreferences: "vegetarian",
    existingRecipeTitles: [],
    pantryItems: [
      {
        name: "Mushrooms",
        quantity: "250",
        unit: "g",
        location: "Fridge",
        expirationDate: "2026-03-24",
        isExpiringSoon: true,
      },
      {
        name: "Cream",
        quantity: "1",
        unit: "carton",
        location: "Fridge",
        expirationDate: "2026-03-23",
        isExpiringSoon: true,
      },
      {
        name: "Pasta",
        quantity: "1",
        unit: "packet",
        location: "Pantry",
        expirationDate: null,
        isExpiringSoon: false,
      },
    ],
    expiringSoon: [
      {
        name: "Mushrooms",
        quantity: "250",
        unit: "g",
        expirationDate: "2026-03-24",
      },
      {
        name: "Cream",
        quantity: "1",
        unit: "carton",
        expirationDate: "2026-03-23",
      },
    ],
  },
};

export const aiRecipeDraftBatchFixture: AiRecipeDraftBatch = {
  drafts: [
    {
      title: "Creamy Mushroom Pasta",
      description: "A fast pasta that uses up mushrooms and cream.",
      instructions:
        "Cook the pasta. Saute mushrooms until browned, add cream, then toss everything together and season to taste.",
      mealType: "dinner",
      servings: 2,
      prepTimeMinutes: 25,
      whyThisFits: "It uses the mushrooms and cream that are expiring soon and only needs one pantry staple.",
      usesExpiringItems: ["Mushrooms", "Cream"],
      ingredients: [
        {
          pantryItemName: "Mushrooms",
          quantity: "250",
          unit: "g",
          optional: false,
          source: "pantry",
        },
        {
          pantryItemName: "Cream",
          quantity: "1",
          unit: "carton",
          optional: false,
          source: "pantry",
        },
        {
          pantryItemName: "Pasta",
          quantity: "250",
          unit: "g",
          optional: false,
          source: "pantry",
        },
        {
          pantryItemName: "Parmesan",
          quantity: "30",
          unit: "g",
          optional: true,
          source: "missing",
        },
      ],
    },
  ],
};
