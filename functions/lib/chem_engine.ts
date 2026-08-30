// Deterministic ceramics glaze chemistry engine — TypeScript port of
// chem_engine.py (digitalfire-archive/ceramics-ai/chem_engine.py).
//
// This module does the actual math — recipe oxide-analysis blending and
// Seger unity-formula conversion — as plain arithmetic, not LLM guesswork.
// The chat Function calls into this for any question that requires real
// numbers; the model never computes chemistry from memory.

export interface RecipeLine {
  material: string;
  amount: number;
}

export interface OxideInfo {
  analysis_pct: string;
  formula: string;
  tolerance: string;
}

export interface MaterialRow {
  material_id: string;
  name: string;
  oxides_json: string;
  oxide_weight: string | null;
  formula_weight: string | null;
  loi: string | null;
  notes: string | null;
  source_url: string;
}

// Standard molecular weights (g/mol) for oxides commonly seen in ceramic
// glaze chemistry. These are physical constants, not scraped data.
export const MOLECULAR_WEIGHTS: Record<string, number> = {
  SiO2: 60.08, Al2O3: 101.96, B2O3: 69.62, Fe2O3: 159.69,
  TiO2: 79.87, ZrO2: 123.22, SnO2: 150.69, P2O5: 141.94,
  Cr2O3: 151.99,
  CaO: 56.08, MgO: 40.30, K2O: 94.20, Na2O: 61.98,
  Li2O: 29.88, BaO: 153.33, SrO: 103.62, ZnO: 81.38,
  PbO: 223.20, MnO: 70.94, CoO: 74.93, NiO: 74.69, CuO: 79.55,
  FeO: 71.85,
};

// Standard oxide role classification for unity-formula normalization.
export const FLUX_OXIDES = new Set([ // R2O / RO group — normalized to sum = 1.0 ("unity")
  "CaO", "MgO", "K2O", "Na2O", "Li2O", "BaO", "SrO", "ZnO", "PbO",
  "MnO", "CoO", "NiO", "CuO", "FeO",
]);
export const STABILIZER_OXIDES = new Set(["Al2O3", "Fe2O3", "Cr2O3", "B2O3"]); // R2O3
export const GLASS_FORMER_OXIDES = new Set(["SiO2", "TiO2", "ZrO2", "SnO2", "P2O5"]); // RO2
// LOI is excluded entirely — it's mass lost during firing, not part of
// the fired glass structure.

function pctToFloat(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.trim().replace(/%$/, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function num(s: number | string | null | undefined, def = 0): number {
  if (s === null || s === undefined) return def;
  const n = typeof s === "number" ? s : parseFloat(String(s).trim());
  return isNaN(n) ? def : n;
}

export interface D1Like {
  prepare(query: string): {
    bind(...args: any[]): {
      first(): Promise<any>;
      all(): Promise<{ results: any[] }>;
    };
  };
}

export async function findMaterial(db: D1Like, name: string): Promise<MaterialRow | null> {
  let row = await db.prepare("SELECT * FROM materials WHERE name = ?").bind(name).first();
  if (!row) {
    row = await db.prepare("SELECT * FROM materials WHERE LOWER(name) = LOWER(?)").bind(name).first();
  }
  if (!row) {
    row = await db.prepare("SELECT * FROM materials WHERE name LIKE ? LIMIT 1").bind(`%${name}%`).first();
  }
  return (row as MaterialRow) ?? null;
}

export function materialOxideWeightPct(material: MaterialRow): Record<string, number> {
  const oxides: Record<string, OxideInfo> = JSON.parse(material.oxides_json || "{}");
  const out: Record<string, number> = {};
  for (const [sym, info] of Object.entries(oxides)) {
    out[sym] = pctToFloat(info.analysis_pct);
  }
  return out;
}

export interface ResolvedMaterial {
  input_name: string;
  matched_name: string | null;
  material_id: string | null;
  amount: number;
  found: boolean;
}

export interface RecipeAnalysis {
  resolved: ResolvedMaterial[];
  weight_pct: Record<string, number>;
  unity: Record<string, number>;
  sio2_al2o3_ratio: number | null;
  total_amount: number;
}

export async function computeRecipeAnalysis(
  db: D1Like,
  recipeMaterials: RecipeLine[]
): Promise<RecipeAnalysis> {
  const resolved: ResolvedMaterial[] = [];
  let totalAmount = 0;
  const oxideParts: Record<string, number> = {};

  for (const line of recipeMaterials) {
    const name = line.material || "";
    const amount = num(line.amount, 0);
    const mat = await findMaterial(db, name);
    resolved.push({
      input_name: name,
      matched_name: mat ? mat.name : null,
      material_id: mat ? mat.material_id : null,
      amount,
      found: mat !== null,
    });
    if (!mat || amount <= 0) continue;
    totalAmount += amount;
    const wt = materialOxideWeightPct(mat);
    for (const [sym, pct] of Object.entries(wt)) {
      oxideParts[sym] = (oxideParts[sym] || 0) + (pct / 100) * amount;
    }
  }

  const weightPct: Record<string, number> = {};
  if (totalAmount > 0) {
    for (const [sym, parts] of Object.entries(oxideParts)) {
      weightPct[sym] = Math.round(((parts / totalAmount) * 100) * 1000) / 1000;
    }
  }

  const unity = toUnityFormula(weightPct);

  let sio2Al2o3: number | null = null;
  if (unity.SiO2 && unity.Al2O3) {
    sio2Al2o3 = Math.round((unity.SiO2 / unity.Al2O3) * 100) / 100;
  }

  return {
    resolved,
    weight_pct: weightPct,
    unity,
    sio2_al2o3_ratio: sio2Al2o3,
    total_amount: totalAmount,
  };
}

function toUnityFormula(weightPct: Record<string, number>): Record<string, number> {
  const moles: Record<string, number> = {};
  for (const [sym, pct] of Object.entries(weightPct)) {
    const mw = MOLECULAR_WEIGHTS[sym];
    if (!mw || pct <= 0) continue;
    moles[sym] = pct / mw;
  }

  let fluxTotal = 0;
  for (const [sym, m] of Object.entries(moles)) {
    if (FLUX_OXIDES.has(sym)) fluxTotal += m;
  }
  if (fluxTotal <= 0) return {};

  const unity: Record<string, number> = {};
  for (const [sym, m] of Object.entries(moles)) {
    unity[sym] = Math.round((m / fluxTotal) * 10000) / 10000;
  }
  return unity;
}

export function classifySurface(sio2Al2o3Ratio: number | null): string {
  if (sio2Al2o3Ratio === null) {
    return "unknown (insufficient Al2O3/SiO2 data to compute ratio)";
  }
  if (sio2Al2o3Ratio < 5) {
    return `likely matte (SiO2:Al2O3 = ${sio2Al2o3Ratio}:1, below the ~5:1 matte threshold)`;
  }
  if (sio2Al2o3Ratio > 7) {
    return `likely glossy (SiO2:Al2O3 = ${sio2Al2o3Ratio}:1, above the ~7:1 glossy threshold)`;
  }
  return `transitional / semi-matte (SiO2:Al2O3 = ${sio2Al2o3Ratio}:1, in the 5:1-7:1 transitional band)`;
}

export interface SubstitutionResult {
  before: RecipeAnalysis;
  after: RecipeAnalysis;
  diff: Record<string, { before: number; after: number; change: number }>;
}

export async function substituteMaterial(
  db: D1Like,
  recipeMaterials: RecipeLine[],
  removeName: string,
  addName: string,
  newAmount?: number
): Promise<SubstitutionResult> {
  const before = await computeRecipeAnalysis(db, recipeMaterials);

  const newMaterials: RecipeLine[] = [];
  let removedAmount: number | null = null;
  for (const line of recipeMaterials) {
    if ((line.material || "").toLowerCase() === removeName.toLowerCase()) {
      removedAmount = num(line.amount, 0);
      continue;
    }
    newMaterials.push(line);
  }
  const amountToUse = newAmount !== undefined ? newAmount : removedAmount || 0;
  newMaterials.push({ material: addName, amount: amountToUse });

  const after = await computeRecipeAnalysis(db, newMaterials);

  const diff: Record<string, { before: number; after: number; change: number }> = {};
  const allOxides = new Set([...Object.keys(before.unity), ...Object.keys(after.unity)]);
  for (const sym of allOxides) {
    const b = before.unity[sym] || 0;
    const a = after.unity[sym] || 0;
    if (Math.abs(a - b) > 0.001) {
      diff[sym] = { before: b, after: a, change: Math.round((a - b) * 10000) / 10000 };
    }
  }

  return { before, after, diff };
}
