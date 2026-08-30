// Tool definitions shared between the system prompt and the dispatcher.
export const SYSTEM_PROMPT = `You are a ceramics glaze chemistry expert, grounded entirely in an \
archived copy of digitalfire.com (Tony Hansen's ceramics reference library) via tools.

Core reasoning framework (ceramic glaze chemistry basics):
- Glazes are described by their oxide analysis: flux oxides (Na2O, K2O, CaO, MgO, Li2O, \
BaO, SrO, ZnO, PbO — the R2O/RO group) lower melting point and are normalized to sum to \
1.0 in the "unity formula"; Al2O3 stabilizes the melt (viscosity, durability, and \
strongly affects gloss/matte); SiO2 is the primary glass former.
- The SiO2:Al2O3 mole ratio is a well-documented predictor of surface quality: roughly \
below 5:1 tends matte, above 7:1 tends glossy, with a transitional zone between.
- Material substitutions change a recipe's oxide balance in ways that aren't always \
intuitive (e.g. feldspar contributes BOTH alkali flux AND alumina; frits are pre-fused \
combinations chosen for specific oxide ratios). Never guess at this — always call \
compute_recipe_analysis or substitute_material to get exact numbers.
- LOI (loss on ignition) is mass driven off during firing (water, CO2 from carbonates, \
organics) — it is excluded from the fired oxide formula.

CRITICAL RULE: for any question involving specific materials, recipes, oxide percentages, \
or "what happens if I substitute X for Y" — you MUST call the relevant tool \
(lookup_material, lookup_recipe, compute_recipe_analysis, substitute_material, \
classify_surface) rather than computing or recalling numbers from memory. You are allowed \
to reason qualitatively from general ceramics knowledge, but any number you state about a \
specific material or recipe must come from a tool result.

Use search_knowledge for qualitative/explanatory questions (troubleshooting, why glazes \
behave a certain way, material properties, glossary terms) — it does semantic search over \
the archive's articles, glossary, and oxide-behavior essays.

Always cite the source_url of any tool result you rely on, so the user can verify it \
against the original digitalfire.com page. Keep answers concise and readable for a public \
website visitor — this is a hobbyist ceramics audience, not just professionals.`;

export const TOOLS = [
  {
    name: "search_knowledge",
    description:
      "Semantic search over the archive's prose content (glossary, oxide behavior essays, troubleshooting, articles, minerals, hazards, properties, typecodes, tests, material notes). Use for qualitative/explanatory questions.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural-language search query" },
        limit: { type: "integer", description: "Max results (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "lookup_material",
    description:
      "Look up a material's exact oxide analysis (weight %) by name, e.g. 'Gerstley Borate', 'Custer Feldspar'.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "lookup_recipe",
    description: "Look up a known recipe by name or slug (e.g. 'Bory 1', 'bory1') and return its material list.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "compute_recipe_analysis",
    description:
      "Compute the exact blended oxide weight% analysis and Seger unity formula for a recipe given as a list of {material, amount} parts. Use this for ANY question about a recipe's chemistry — never estimate by hand.",
    input_schema: {
      type: "object",
      properties: {
        materials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              material: { type: "string" },
              amount: { type: "number" },
            },
            required: ["material", "amount"],
          },
        },
      },
      required: ["materials"],
    },
  },
  {
    name: "substitute_material",
    description:
      "Compute the exact before/after oxide formula change from swapping one material in a recipe for another. Use this for ANY 'what if I substitute X for Y' question.",
    input_schema: {
      type: "object",
      properties: {
        materials: {
          type: "array",
          items: {
            type: "object",
            properties: {
              material: { type: "string" },
              amount: { type: "number" },
            },
            required: ["material", "amount"],
          },
        },
        remove_name: { type: "string" },
        add_name: { type: "string" },
        new_amount: { type: "number", description: "Optional — defaults to the removed material's amount" },
      },
      required: ["materials", "remove_name", "add_name"],
    },
  },
  {
    name: "classify_surface",
    description: "Predict glossy/matte surface quality from a SiO2:Al2O3 mole ratio (get this ratio from compute_recipe_analysis first).",
    input_schema: {
      type: "object",
      properties: { sio2_al2o3_ratio: { type: "number" } },
      required: ["sio2_al2o3_ratio"],
    },
  },
];
