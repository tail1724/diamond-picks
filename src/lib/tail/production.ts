import { runSlate, type ComputedSlate } from "../engines/pipeline";
import { hashSeed } from "../engines/rng";
import { SLATE } from "../domain/slate";
import { buildLiveSlate, easternDate } from "../data/mlb";

/**
 * Server-side production run orchestration. Fetches the real MLB slate for the
 * date and runs the full pipeline over it; if the live feed is unreachable or
 * returns no games (offseason, blocked egress, off-day), it falls back to the
 * demonstration slate so the app always renders. Results are memoized per
 * (date, runNumber) so navigation reuses one computation.
 */

const cache = new Map<string, ComputedSlate>();

export async function runProduction(runNumber: number, date?: string): Promise<ComputedSlate> {
  const d = date ?? easternDate();
  const key = `${d}:${runNumber}`;
  const cached = cache.get(key);
  if (cached) return cached;

  let slate = SLATE;
  try {
    slate = await buildLiveSlate(d);
  } catch {
    slate = SLATE; // graceful fallback to the demonstration slate
  }

  const computed = runSlate({ slate, runNumber, seed: hashSeed("run", runNumber) });

  cache.set(key, computed);
  if (cache.size > 24) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return computed;
}
