// ──────────────────────────────────────────────────────────────────────────
// Random Forest inference for lead quality — wires the TRAINED model into the
// live app. Previously lead scores were rule-based only; this runs the actual
// Random Forest (50 trees, trained offline, exported via scripts/upload_model.py)
// to predict P(high quality / likely to close) for a lead.
//
// The model is BUNDLED (leadScoringModel.json) rather than read from the
// `ml_models` table because that table's RLS only lets Owner / platform-tenant
// members read it — the Sales/Admin users who actually score leads (and belong to
// customer tenants) cannot. Bundling works for every role, runs in-browser, and
// needs no migration. To switch to live DB-driven models later: add an RLS policy
// letting all authenticated users read active global models, then fetch params
// from `ml_models` instead of this import.
// ──────────────────────────────────────────────────────────────────────────
import modelParams from './leadScoringModel.json';

interface RfTree {
  feature: number[];        // feature index per node; -2 marks a leaf
  threshold: number[];      // split threshold per node
  children_left: number[];  // left child index; -1 at a leaf
  children_right: number[]; // right child index; -1 at a leaf
  value: number[][][];      // value[node] = [[p0, p1]] (class probabilities)
}
interface RfModel {
  features: string[];                      // feature order the model expects
  feature_medians: Record<string, number>; // training medians, used to impute nulls
  trees: RfTree[];
  classes: number[];
}

const MODEL = modelParams as unknown as RfModel;

// Walk one decision tree to its leaf; return [p0, p1] at that leaf.
// sklearn convention: feature === -2 marks a leaf (children are -1 there).
function treeProba(tree: RfTree, x: number[]): number[] {
  let node = 0;
  let guard = 0;
  while (tree.feature[node] !== -2 && guard++ < 10000) {
    const f = tree.feature[node];
    node = x[f] <= tree.threshold[node] ? tree.children_left[node] : tree.children_right[node];
  }
  return tree.value[node]?.[0] ?? [1, 0];
}

/**
 * Predict P(class 1) — the trained model's estimate that this lead is high
 * quality / likely to close — in [0, 1]. Missing/non-finite features fall back
 * to the model's training medians. Returns null only if the model is unusable.
 */
export function predictLeadQuality(featureValues: Record<string, number | null | undefined>): number | null {
  if (!MODEL?.trees?.length || !MODEL.features?.length) return null;
  const x = MODEL.features.map((name) => {
    const v = featureValues[name];
    if (v === null || v === undefined || !Number.isFinite(Number(v))) {
      return Number(MODEL.feature_medians?.[name]) || 0;
    }
    return Number(v);
  });
  let sum1 = 0;
  for (const tree of MODEL.trees) sum1 += treeProba(tree, x)[1];
  return sum1 / MODEL.trees.length;
}

/** Model metadata for display ("powered by Random Forest, N trees"). */
export const RF_MODEL_INFO = {
  trees: (MODEL?.trees?.length) || 0,
  features: (MODEL?.features?.length) || 0,
};
