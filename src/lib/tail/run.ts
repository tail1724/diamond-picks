import { createServerFn } from "@tanstack/react-start";
import { BASE_RUN_NUMBER, runSlate, type ComputedSlate } from "../engines/pipeline";
import { hashSeed } from "../engines/rng";
import { loadProductionSlate } from "../data/live-mlb";

/**
 * Server function that loads the current MLB slate and sportsbook markets,
 * then executes the production forecast workflow server-side.
 */
export const runSlateFn = createServerFn({ method: "GET" })
  .validator((d: { runNumber?: number; date?: string } = {}) => d ?? {})
  .handler(async ({ data }): Promise<ComputedSlate> => {
    const runNumber = data?.runNumber ?? BASE_RUN_NUMBER;
    const { slate } = await loadProductionSlate(data?.date);
    return runSlate({ slate, runNumber, seed: hashSeed("run", runNumber, slate.date) });
  });

export type { ComputedSlate };
