import { createServerFn } from "@tanstack/react-start";
import { BASE_RUN_NUMBER, type ComputedSlate } from "../engines/pipeline";
import { runProduction } from "./production";

/**
 * Server function that executes the production forecast workflow over the live
 * MLB slate (with graceful fallback to the demonstration slate) and returns the
 * fully computed, versioned run. Heavy Monte Carlo work always runs server-side;
 * results are memoized per date so navigation reuses one computation.
 */
export const runSlateFn = createServerFn({ method: "GET" }).handler(
  (): Promise<ComputedSlate> => runProduction(BASE_RUN_NUMBER),
);

export type { ComputedSlate };
