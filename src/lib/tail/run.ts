import { createServerFn } from "@tanstack/react-start";
import { BASE_RUN_NUMBER, getBaseRun, runSlate, type ComputedSlate } from "../engines/pipeline";
import { hashSeed } from "../engines/rng";

/**
 * Server function that executes the production forecast workflow and returns
 * the fully computed, versioned slate. Heavy Monte Carlo work always runs
 * server-side; the base run is memoized so navigation reuses one computation.
 */
export const runSlateFn = createServerFn({ method: "GET" })
  .validator((d: { runNumber?: number } = {}) => d ?? {})
  .handler(({ data }): ComputedSlate => {
    const runNumber = data?.runNumber ?? BASE_RUN_NUMBER;
    if (runNumber === BASE_RUN_NUMBER) return getBaseRun();
    return runSlate({ runNumber, seed: hashSeed("run", runNumber) });
  });

export type { ComputedSlate };
