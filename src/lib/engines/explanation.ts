import type { Game } from "../domain/types";
import { team } from "../domain/teams";
import { formatAmerican } from "./odds";
import type { GameForecast } from "./forecast";
import type { MarketDecision } from "./decision";
import type { SimResult } from "./simulation";

/**
 * Turns the model output into clear, conversational pick analysis without
 * changing any probabilities, prices, scores, or recommendation states.
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
  const modelPct = (d.modelProb * 100).toFixed(0);
  const marketPct = ((d.modelProb - d.edge) * 100).toFixed(0);

  const headline = `${d.selection} · our number ${formatAmerican(d.fairAmerican)} · available at ${formatAmerican(d.marketAmerican)}`;

  const whyItQualifies =
    `Here’s the simple case: ${topDriver.label.toLowerCase()} is the biggest reason we like it. ` +
    `We give ${d.selection} about a ${modelPct}% chance, while the current price is closer to ${marketPct}%. ` +
    `That gap is why this one makes the cut—the number is better than we think it should be, and the game simulations back it up.`;

  const meanTotal = sim.meanTotal.toFixed(1);
  const keyRisk = failGate
    ? `Why we’re passing: ${failGate.label.toLowerCase()} is not strong enough yet (${failGate.detail}).`
    : watchGate
      ? `What could go wrong: ${watchGate.label.toLowerCase()} is still a concern. The game projects around ${meanTotal} total runs, so a swingy game from ${(favored ? home : away).city} could flip it.`
      : `What could go wrong: baseball gets weird. This game projects around ${meanTotal} total runs, but one rough inning can change the whole picture.`;

  return { headline, whyItQualifies, keyRisk };
}
