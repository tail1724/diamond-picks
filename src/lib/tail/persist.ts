import { createServerFn } from "@tanstack/react-start";
import { type ComputedSlate } from "../engines/pipeline";
import { runProduction } from "./production";
import { supabase } from "./supabase";

/**
 * Persistence + versioning (PRD §5.2, FR-002). Each manual regeneration runs
 * the pipeline and writes a new immutable forecast-run version — plus its
 * recommendations, parlays, and an audit event — then returns the slate.
 * Writes are best-effort: a persistence failure never blocks the forecast.
 */

async function persist(slate: ComputedSlate): Promise<void> {
  const { data, error } = await supabase
    .from("forecast_runs")
    .insert({
      run_number: slate.runNumber,
      seed: slate.seed,
      slate_date: slate.date,
      model_version: slate.lineage.productionModel,
      feature_set: slate.lineage.featureSet,
      dataset_snapshot: slate.lineage.datasetSnapshot,
      simulation_config: slate.lineage.simulationConfig,
      explanation_prompt: slate.lineage.explanationPrompt,
      games_priced: slate.stats.gamesPriced,
      recommendations: slate.stats.recommendations,
      monitored: slate.stats.monitored,
      rejected: slate.stats.rejected,
      qualified_parlays: slate.stats.qualifiedParlays,
      avg_edge: slate.stats.avgEdge,
      calibration_index: slate.stats.calibrationIndex,
      total_simulations: slate.stats.totalSimulations,
      sim_ms: slate.stats.simMs,
      initiator: "admin",
      status: "completed",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("insert failed");
  const runId = data.id as string;

  const recs = slate.recommendations.slice(0, 24).map((d) => ({
    run_id: runId,
    game_id: d.gameId,
    market_kind: d.kind,
    selection: d.selection,
    model_prob: d.modelProb,
    fair_american: d.fairAmerican,
    market_american: d.marketAmerican,
    edge: d.edge,
    ev: d.ev,
    score: d.score,
    outcome: d.outcome,
    gates_passed: d.gatesPassed,
  }));
  const parlays = slate.parlays.map((p) => ({
    run_id: runId,
    title: p.title,
    subtitle: p.subtitle,
    legs: p.legs,
    joint_prob: p.jointProb,
    naive_prob: p.naiveIndependentProb,
    correlation: p.correlationStrength,
    mutual_info: p.mutualInfo,
    fair_american: p.fairAmerican,
    market_american: p.marketAmerican,
    edge: p.edge,
    score: p.score,
    risk_rating: p.riskRating,
  }));

  await Promise.all([
    recs.length ? supabase.from("run_recommendations").insert(recs) : Promise.resolve(),
    parlays.length ? supabase.from("run_parlays").insert(parlays) : Promise.resolve(),
    supabase.from("audit_events").insert({
      actor: "admin",
      action: "forecast_run.completed",
      detail: `Run #${slate.runNumber} published as immutable version (${slate.stats.recommendations} recommendations, ${slate.stats.qualifiedParlays} parlays).`,
    }),
  ]);
}

/** Run the pipeline for a new run number and persist it as a new version. */
export const regenerateRunFn = createServerFn({ method: "POST" })
  .validator((d: { runNumber: number }) => d)
  .handler(async ({ data }): Promise<ComputedSlate> => {
    const slate = await runProduction(data.runNumber);
    try {
      await persist(slate);
    } catch {
      // Persistence is best-effort; the forecast still returns.
    }
    return slate;
  });

export interface RunHistoryRow {
  run_number: number;
  recommendations: number;
  qualified_parlays: number;
  avg_edge: number;
  calibration_index: number;
  initiator: string;
  status: string;
  model_version: string;
  created_at: string;
}

/** Read the immutable run history (most recent first). */
export const getRunHistoryFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<RunHistoryRow[]> => {
    const { data, error } = await supabase
      .from("forecast_runs")
      .select(
        "run_number,recommendations,qualified_parlays,avg_edge,calibration_index,initiator,status,model_version,created_at",
      )
      .order("run_number", { ascending: false })
      .limit(12);
    if (error || !data) return [];
    return data as RunHistoryRow[];
  },
);
