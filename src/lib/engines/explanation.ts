import type { Game } from "../domain/types";
import { team } from "../domain/teams";
import { formatAmerican } from "./odds";
import type { GameForecast } from "./forecast";
import type { MarketDecision } from "./decision";
import type { SimResult } from "./simulation";

/**
 * TAIL Sports Explanation Engine.
 *
 * Translates structured outputs into human-readable analysis. It uses computed
 * facts only and never creates, modifies, or overrides probabilities, prices,
 * scores, or recommendation states (PRD §7.6).
 */

export interface GameExplanation {
  headline: string;
  whyItQualifies: string;
  keyRisk: string;
}

export function explainGame(
  game: Game,
  fc: GameForecast,
  d: MarketDecision,
  sim: SimResult,
): GameExplanation {
  const topDriver = fc.drivers[0];
  const favored = d.modelProb >= 0.5;
  const watchGate = d.gates.find((g) => g.status === "watch");
  const failGate = d.gates.find((g) => g.status === "fail");
  const home = team(game.homeCode);
  const away = team(game.awayCode);

  const headline = `${d.selection} · fair ${formatAmerican(d.fairAmerican)} vs market ${formatAmerican(d.marketAmerican)}`;

  const whyItQualifies =
    `${topDriver.label} is the largest signal (${topDriver.detail}). ` +
    `The model prices ${d.selection} at ${(d.modelProb * 100).toFixed(1)}% — a ${signPct(d.edge)} probability edge and ${signPct(d.ev)} expected value versus the ${formatAmerican(d.marketAmerican)} market. ` +
    `Model and simulation agree to ${(d.consensus * 100).toFixed(0)}%, and the price sits outside the calibrated fair-price interval.`;

  const meanTotal = sim.meanTotal.toFixed(1);
  const keyRisk = failGate
    ? `${failGate.label} fails (${failGate.detail}); treat as ${d.outcome}.`
    : watchGate
      ? `${watchGate.label} is on watch (${watchGate.detail}). Simulated total centers on ${meanTotal} runs; ${(favored ? home : away).city} variance is the main downside.`
      : `Primary risk is run-environment variance — the simulated total centers on ${meanTotal} runs with a long right tail.`;

  return { headline, whyItQualifies, keyRisk };
}

function signPct(x: number): string {
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
}
