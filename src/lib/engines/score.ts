/**
 * TAIL Sports Score — a 1–250 confidence and recommendation-quality score
 * (PRD §5.3). It is NOT a win probability. It blends economic attractiveness
 * (edge, EV), statistical confidence (probability, model/simulation consensus),
 * demonstrated reliability (historical calibration) and input trustworthiness
 * (data quality, market stability, lineup certainty).
 */

export interface ScoreSignals {
  /** Probability edge vs. market (e.g. 0.06). */
  edge: number;
  /** Model win/selection probability. */
  prob: number;
  /** Expected value per unit. */
  ev: number;
  /** Model-vs-simulation agreement, 0–1. */
  consensus: number;
  /** Historical calibration reliability for this market, 0–1. */
  calibration: number;
  /** Data quality, 0–1. */
  dataQuality: number;
  /** Market stability, 0–1. */
  marketStability: number;
  /** Lineup certainty, 0–1. */
  lineupCertainty: number;
}

const WEIGHTS: Record<keyof ScoreSignals, number> = {
  edge: 0.18,
  ev: 0.15,
  consensus: 0.15,
  prob: 0.12,
  calibration: 0.12,
  dataQuality: 0.1,
  marketStability: 0.1,
  lineupCertainty: 0.08,
};

const clamp01 = (x: number) => Math.min(Math.max(x, 0), 1);

export function normalizedSignals(s: ScoreSignals): Record<keyof ScoreSignals, number> {
  return {
    edge: clamp01(s.edge / 0.1),
    ev: clamp01(s.ev / 0.12),
    consensus: clamp01(s.consensus),
    prob: clamp01((s.prob - 0.5) / 0.25),
    calibration: clamp01(s.calibration),
    dataQuality: clamp01(s.dataQuality),
    marketStability: clamp01(s.marketStability),
    lineupCertainty: clamp01(s.lineupCertainty),
  };
}

/** Compute the 1–250 TAIL Sports Score. */
export function tailSportsScore(s: ScoreSignals): number {
  const n = normalizedSignals(s);
  let q = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof ScoreSignals)[]) {
    q += WEIGHTS[key] * n[key];
  }
  return Math.round(1 + q * 249);
}
