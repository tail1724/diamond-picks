import { createServerFn } from "@tanstack/react-start";
import { BASE_RUN_NUMBER, runSlate, type ComputedSlate } from "../engines/pipeline";
import { hashSeed } from "../engines/rng";
import { loadProductionSlate } from "../data/live-mlb";
import type { LiveDataStatus } from "../domain/types";

export type AppSlate = ComputedSlate & { dataStatus: LiveDataStatus };

/** Load the current MLB slate, preserve source status, and run forecasts server-side. */
export const runSlateFn = createServerFn({ method: "GET" })
  .validator((d: { runNumber?: number; date?: string } = {}) => d ?? {})
  .handler(async ({ data }): Promise<AppSlate> => {
    const runNumber = data?.runNumber ?? BASE_RUN_NUMBER;
    const { slate, status } = await loadProductionSlate(data?.date);
    return {
      ...runSlate({ slate, runNumber, seed: hashSeed("run", runNumber, slate.date) }),
      dataStatus: status,
    };
  });

export type { ComputedSlate };
