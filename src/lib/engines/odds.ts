/**
 * American-odds ⇄ probability conversions and expected-value math.
 * The platform prices in probability first, then converts to fair odds and
 * compares against sportsbook prices (PRD §1.1).
 */

/** Implied probability of an American price (includes the book's vig). */
export function impliedProb(american: number): number {
  return american >= 0 ? 100 / (american + 100) : -american / (-american + 100);
}

/** Convert a true probability into a fair American price. */
export function toAmerican(prob: number): number {
  const p = Math.min(Math.max(prob, 1e-4), 1 - 1e-4);
  return p >= 0.5 ? -Math.round((100 * p) / (1 - p)) : Math.round((100 * (1 - p)) / p);
}

/** Profit returned per 1 unit staked at an American price. */
export function profitMultiple(american: number): number {
  return american >= 0 ? american / 100 : 100 / -american;
}

/** Decimal odds equivalent. */
export function decimalOdds(american: number): number {
  return profitMultiple(american) + 1;
}

/** Expected value per 1 unit staked, given the model's true win probability. */
export function expectedValue(prob: number, american: number): number {
  return prob * profitMultiple(american) - (1 - prob);
}

/**
 * Probability edge: model probability minus the market's implied probability.
 * Positive = the model thinks the outcome is likelier than the price implies.
 */
export function probabilityEdge(modelProb: number, american: number): number {
  return modelProb - impliedProb(american);
}

/** Remove vig from a two-way market, returning normalized fair probabilities. */
export function devigTwoWay(a1: number, a2: number): [number, number] {
  const p1 = impliedProb(a1);
  const p2 = impliedProb(a2);
  const s = p1 + p2;
  return [p1 / s, p2 / s];
}

/** Format an American price with an explicit sign, e.g. +135 / -148. */
export function formatAmerican(american: number): string {
  const r = Math.round(american);
  return r >= 0 ? `+${r}` : `${r}`;
}

/** Combine a set of American prices into the parlay's combined decimal/American. */
export function parlayAmerican(legs: number[]): number {
  const dec = legs.reduce((acc, a) => acc * decimalOdds(a), 1);
  // decimal → american
  return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1));
}
