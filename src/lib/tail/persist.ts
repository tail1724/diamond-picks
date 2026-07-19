import { createServerFn } from "@tanstack/react-start";
import { runSlate, type ComputedSlate } from "../engines/pipeline";
import { hashSeed } from "../engines/rng";
import { loadProductionSlate } from "../data/live-mlb";
import type { AppSlate } from "./run";
import { supabase } from "./supabase";

/** Persist immutable forecast versions without blocking the user-facing refresh. */
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
      detail: `Run #${slate.runNumber} published (${slate.stats.recommendations} recommendations).`,
    }),
  ]);
}

export const regenerateRunFn = createServerFn({ method: "POST" })
  .validator((d: { runNumber: number; date?: string }) => d)
  .handler(async ({ data }): Promise<AppSlate> => {
    const { slate: sourceSlate, status } = await loadProductionSlate(data.date);
    const slate = runSlate({
      slate: sourceSlate,
      runNumber: data.runNumber,
      seed: hashSeed("run", data.runNumber, sourceSlate.date),
    });
    try {
      await persist(slate);
    } catch {
      // A database outage must not prevent a fresh forecast from reaching users.
    }
    return { ...slate, dataStatus: status };
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
