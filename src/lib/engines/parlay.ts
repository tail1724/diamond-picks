import type { MarketQuote } from "../domain/types";
import { expectedValue, formatAmerican, impliedProb, parlayAmerican, toAmerican } from "./odds";
import type { SimResult, SimParlay } from "./simulation";
import { tailSportsScore } from "./score";

/**
 * TAIL Sports Parlay Engine.
 *
 * A parlay is a first-class, versioned prediction object (PRD §10). Joint
 * probabilities come from the shared simulation outcomes (PRD §10.3), never
 * from multiplying marginals — the difference between the two is exactly the
 * correlation edge the engine surfaces.
 */

export interface ParlayLegRef {
  gameId: string;
  legId: string;
}

export interface ParlaySpec {
  id: string;
  title: string;
  subtitle: string;
  legs: ParlayLegRef[];
}

export interface PricedLeg {
  gameId: string;
  legId: string;
  selection: string;
  individualProb: number;
  american: number;
}

export type RiskRating = "Low" | "Moderate" | "Elevated" | "High";

export interface PricedParlay {
  id: string;
  title: string;
  subtitle: string;
  legs: PricedLeg[];
  jointProb: number;
  naiveIndependentProb: number;
  correlationStrength: number;
  mutualInfo: number;
  fairAmerican: number;
  marketAmerican: number;
  edge: number;
  ev: number;
  score: number;
  riskRating: RiskRating;
  explanation: string;
  qualified: boolean;
}

export interface PricingContext {
  quote: (gameId: string, legId: string) => MarketQuote | undefined;
  selection: (gameId: string, legId: string) => string;
  sim: (gameId: string) => SimResult | undefined;
  dataQuality: (gameId: string) => number;
}

/** SimParlay registrations (per game) required to price a set of specs. */
export function simParlaysForSpecs(specs: ParlaySpec[]): Record<string, SimParlay[]> {
  const out: Record<string, SimParlay[]> = {};
  for (const spec of specs) {
    const byGame = new Map<string, string[]>();
    for (const leg of spec.legs) {
      if (!byGame.has(leg.gameId)) byGame.set(leg.gameId, []);
      byGame.get(leg.gameId)!.push(leg.legId);
    }
    for (const [gameId, legIds] of byGame) {
      (out[gameId] ??= []).push({ id: `${spec.id}@${gameId}`, legIds });
    }
  }
  return out;
}

function riskFrom(jointProb: number, corr: number): RiskRating {
  let base: RiskRating =
    jointProb >= 0.45
      ? "Low"
      : jointProb >= 0.28
        ? "Moderate"
        : jointProb >= 0.16
          ? "Elevated"
          : "High";
  if (corr < -0.05 && base !== "High") {
    // negative dependency widens variance → bump risk up one notch
    base = base === "Low" ? "Moderate" : base === "Moderate" ? "Elevated" : "High";
  }
  return base;
}

export function priceParlay(spec: ParlaySpec, ctx: PricingContext): PricedParlay {
  const legs: PricedLeg[] = spec.legs.map((ref) => {
    const q = ctx.quote(ref.gameId, ref.legId);
    const s = ctx.sim(ref.gameId);
    return {
      gameId: ref.gameId,
      legId: ref.legId,
      selection: ctx.selection(ref.gameId, ref.legId),
      individualProb: s?.legs[ref.legId]?.prob ?? 0,
      american: q?.american ?? 0,
    };
  });

  // Joint probability: product of per-game sub-joints (games independent),
  // each sub-joint taken directly from that game's shared simulation.
  const gameIds = Array.from(new Set(spec.legs.map((l) => l.gameId)));
  let jointProb = 1;
  for (const gameId of gameIds) {
    const s = ctx.sim(gameId);
    jointProb *= s?.parlayJoint[`${spec.id}@${gameId}`] ?? 0;
  }

  const naive = legs.reduce((acc, l) => acc * l.individualProb, 1);

  // Correlation + mutual information averaged over same-game leg pairs.
  let corrSum = 0;
  let miSum = 0;
  let pairs = 0;
  for (const gameId of gameIds) {
    const s = ctx.sim(gameId);
    if (!s) continue;
    const inGame = spec.legs
      .filter((l) => l.gameId === gameId)
      .map((l) => s.legOrder.indexOf(l.legId));
    for (let a = 0; a < inGame.length; a++) {
      for (let b = a + 1; b < inGame.length; b++) {
        if (inGame[a] < 0 || inGame[b] < 0) continue;
        corrSum += s.correlation[inGame[a]][inGame[b]];
        miSum += s.mutualInfo[inGame[a]][inGame[b]];
        pairs++;
      }
    }
  }
  const correlationStrength = pairs ? corrSum / pairs : 0;
  const mutualInfo = pairs ? miSum / pairs : 0;

  const marketAmerican = parlayAmerican(legs.map((l) => l.american));
  const fairAmerican = toAmerican(jointProb);
  const edge = jointProb - impliedProb(marketAmerican);
  const ev = expectedValue(jointProb, marketAmerican);

  const avgDq =
    gameIds.reduce((acc, g) => acc + ctx.dataQuality(g), 0) / Math.max(gameIds.length, 1);
  const score = tailSportsScore({
    edge,
    prob: jointProb,
    ev,
    consensus: clamp01(0.7 + Math.min(Math.abs(correlationStrength), 0.25)),
    calibration: 0.83,
    dataQuality: avgDq,
    marketStability: 0.72,
    lineupCertainty: avgDq,
  });

  const riskRating = riskFrom(jointProb, correlationStrength);
  const explanation = buildParlayExplanation(legs, jointProb, naive, correlationStrength);
  const qualified = edge > 0.01 && jointProb > 0.05;

  return {
    id: spec.id,
    title: spec.title,
    subtitle: spec.subtitle,
    legs,
    jointProb,
    naiveIndependentProb: naive,
    correlationStrength,
    mutualInfo,
    fairAmerican,
    marketAmerican,
    edge,
    ev,
    score,
    riskRating,
    explanation,
    qualified,
  };
}

function buildParlayExplanation(
  legs: PricedLeg[],
  joint: number,
  naive: number,
  corr: number,
): string {
  const lift = joint - naive;
  const dir = lift >= 0 ? "positive" : "negative";
  const magnitude = Math.abs(corr) > 0.15 ? "strong" : Math.abs(corr) > 0.06 ? "moderate" : "mild";
  const first = legs[0]?.selection ?? "the anchor leg";
  const rest = legs
    .slice(1)
    .map((l) => l.selection)
    .join(" and ");
  return (
    `${first} shares a ${magnitude} ${dir} dependency with ${rest || "the remaining legs"}: ` +
    `the shared simulation puts the joint probability at ${(joint * 100).toFixed(1)}% versus a naive independent ` +
    `estimate of ${(naive * 100).toFixed(1)}% (${lift >= 0 ? "+" : ""}${(lift * 100).toFixed(1)} pts). ` +
    `Fair price ${formatAmerican(toAmerican(joint))} against the book's combined ${formatAmerican(parlayAmerican(legs.map((l) => l.american)))}.`
  );
}

function clamp01(x: number): number {
  return Math.min(Math.max(x, 0), 1);
}
