/**
 * Deterministic pseudo-random number generation for the Simulation Engine.
 *
 * Every run stores its seed (PRD ML-002), so a run is fully reproducible and,
 * crucially, SSR and client hydration compute identical numbers — no hydration
 * mismatch. mulberry32 is a fast, well-distributed 32-bit generator.
 */

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash → uint32, for deriving stable numeric seeds from strings. */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Poisson sampler (Knuth). Fine for the small means used here (λ ≲ 12). */
export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/** Standard normal via Box–Muller. */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Gamma(shape, scale) via Marsaglia–Tsang. Used to overdisperse run rates. */
export function gamma(rng: Rng, shape: number, scale = 1): number {
  if (shape < 1) {
    const u = Math.max(rng(), 1e-12);
    return gamma(rng, shape + 1, scale) * Math.pow(u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(rng);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v * scale;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
  }
}

/**
 * Negative-binomial-style run count: gamma-mixed Poisson. `dispersion` is the
 * gamma shape (higher → closer to plain Poisson). Baseball run totals are
 * modestly overdispersed relative to Poisson, which this captures.
 */
export function overdispersedPoisson(rng: Rng, mean: number, dispersion = 9): number {
  if (mean <= 0) return 0;
  const g = gamma(rng, dispersion, 1 / dispersion); // E[g] = 1, Var = 1/dispersion
  return poisson(rng, mean * g);
}

/** Lanczos approximation of ln Γ(x). */
export function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * E[X^p] for X ~ Gamma(shape=k, scale=1/k) (mean 1). Used to renormalize
 * multiplicative latent factors so couplings don't drift the mean.
 */
export function gammaMoment(k: number, p: number): number {
  return Math.exp(lgamma(k + p) - lgamma(k) - p * Math.log(k));
}
