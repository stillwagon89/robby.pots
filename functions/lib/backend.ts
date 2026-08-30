import { computeRecipeAnalysis, substituteMaterial, classifySurface, RecipeLine } from "./chem_engine";

export interface Env {
  CERAMICS_DB: D1Database;
  VECTORIZE: VectorizeIndex;
  AI: Ai;
  RATE_LIMIT: KVNamespace;
  ANTHROPIC_API_KEY: string;
  TURNSTILE_SECRET_KEY: string;
}

export async function searchKnowledge(env: Env, query: string, limit = 5) {
  const embedResult: any = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [query] });
  const vector = embedResult.data[0];
  const results = await env.VECTORIZE.query(vector, { topK: limit, returnMetadata: true });
  return results.matches.map((m) => ({
    category: m.metadata?.category,
    title: m.metadata?.title,
    source_url: m.metadata?.source_url,
    text: m.metadata?.text,
  }));
}

export async function lookupMaterial(env: Env, name: string) {
  const row = await env.CERAMICS_DB.prepare("SELECT * FROM materials WHERE name = ?").bind(name).first();
  const mat =
    row ||
    (await env.CERAMICS_DB.prepare("SELECT * FROM materials WHERE LOWER(name) = LOWER(?)").bind(name).first()) ||
    (await env.CERAMICS_DB.prepare("SELECT * FROM materials WHERE name LIKE ? LIMIT 1").bind(`%${name}%`).first());
  if (!mat) return { found: false, message: `No material found matching '${name}'` };
  const oxides = JSON.parse((mat.oxides_json as string) || "{}");
  const oxidesWeightPct: Record<string, number> = {};
  for (const [sym, info] of Object.entries<any>(oxides)) {
    oxidesWeightPct[sym] = parseFloat(String(info.analysis_pct || "0").replace("%", "")) || 0;
  }
  return {
    found: true,
    name: mat.name,
    material_id: mat.material_id,
    oxides_weight_pct: oxidesWeightPct,
    loi: mat.loi,
    notes: mat.notes ? String(mat.notes).slice(0, 500) : "",
    source_url: mat.source_url,
  };
}

export async function lookupRecipe(env: Env, name: string) {
  const slug = name.toLowerCase().replace(/\s+/g, "");
  const row = await env.CERAMICS_DB.prepare(
    "SELECT * FROM recipes WHERE slug = ? OR LOWER(name) = LOWER(?) OR name LIKE ? LIMIT 1"
  )
    .bind(slug, name, `%${name}%`)
    .first();
  if (!row) return { found: false, message: `No recipe found matching '${name}'` };
  return {
    found: true,
    name: row.name,
    keywords: row.keywords,
    materials: JSON.parse((row.materials_json as string) || "[]"),
    source_url: row.source_url,
  };
}

export async function dispatchTool(env: Env, toolName: string, input: any): Promise<any> {
  try {
    switch (toolName) {
      case "search_knowledge":
        return await searchKnowledge(env, input.query, input.limit || 5);
      case "lookup_material":
        return await lookupMaterial(env, input.name);
      case "lookup_recipe":
        return await lookupRecipe(env, input.name);
      case "compute_recipe_analysis":
        return await computeRecipeAnalysis(env.CERAMICS_DB as any, input.materials as RecipeLine[]);
      case "substitute_material":
        return await substituteMaterial(
          env.CERAMICS_DB as any,
          input.materials as RecipeLine[],
          input.remove_name,
          input.add_name,
          input.new_amount
        );
      case "classify_surface":
        return { prediction: classifySurface(input.sio2_al2o3_ratio) };
      default:
        return { error: `Unknown tool ${toolName}` };
    }
  } catch (e: any) {
    return { error: String(e?.message || e) };
  }
}
