import type { Game, MarketKind, Side } from "../domain/types";
import { hitter, pitcher } from "../domain/slate";
import { gamma, gammaMoment, hashSeed, mulberry32, poisson, type Rng } from "./rng";
import type { GameForecast } from "./forecast";

/**
 * TAIL Sports Simulation Engine.
 *
 * Runs N seeded Monte Carlo games and derives full outcome distributions,
 * per-leg probabilities, a correlation matrix + mutual information between
 * legs, and joint probabilities for registered parlays — all from the *same*
 * shared simulation outcomes (PRD §10.3).
 *
 * Correlation is real, not assumed: each simulated game draws latent form
 * factors — home/away offense form, home/away pitcher form, and a shared run
 * environment — that jointly drive runs, strikeouts, earned runs, and hitter
 * total bases. A sim where the home offense runs hot lifts both home runs and
 * home hitters' bases; a sim where a pitcher dominates lifts his strikeouts,
 * suppresses opponent runs, and lowers his earned runs. That shared structure
 * is what makes same-game parlays genuinely correlated.
 */

export const DEFAULT_SIMS = 100_000;
const HIST_MAX = 16;

// Latent-factor shape parameters (Gamma mean 1). Lower shape → more variance
// → stronger correlation. Couplings are renormalized so means don't drift.
const K_FORM = 5.5;
const K_ENV = 16;
const SUPP_EXP = 0.6;
const K_EXP = 0.8;
const C_SUPP = gammaMoment(K_FORM, -SUPP_EXP);
const C_K = gammaMoment(K_FORM, K_EXP);

export interface SimLeg {
  id: string;
  kind: MarketKind;
  side: Side;
  line?: number;
  playerId?: string;
}

export interface SimParlay {
  id: string;
  legIds: string[];
}

export interface LegResult {
  id: string;
  prob: number;
  mean?: number;
  line?: number;
}

export interface SimResult {
  gameId: string;
  sims: number;
  seed: number;
  homeWinProb: number;
  awayWinProb: number;
  meanHomeRuns: number;
  meanAwayRuns: number;
  medianTotal: number;
  meanTotal: number;
  homeRunDist: number[];
  awayRunDist: number[];
  totalDist: number[];
  legs: Record<string, LegResult>;
  legOrder: string[];
  correlation: number[][];
  mutualInfo: number[][];
  parlayJoint: Record<string, number>;
  pitcherKDist: Record<string, { mean: number; dist: number[] }>;
}

interface HitterSim {
  id: string;
  isHome: boolean;
  pa: number;
  /** per-PA probs: [bb, single, double, triple, hr]; remainder = out. */
  comp: number[];
}

function buildHitter(game: Game, id: string): HitterSim {
  const h = hitter(id);
  const facesHome = h.teamCode === game.awayCode; // away hitter faces home starter
  const oppSp = pitcher(facesHome ? game.homePitcherId : game.awayPitcherId);
  const env = game.weather.runFactor;
  const f = clamp(1 - oppSp.suppression * 0.1, 0.8, 1.15) * clamp(env, 0.85, 1.15);
  const r = h.rates;
  return {
    id,
    isHome: h.teamCode === game.homeCode,
    pa: Math.round(h.pa),
    comp: [r.bb, r.single * f, r.double * f, r.triple * f, r.hr * f],
  };
}

export function simulateGame(
  game: Game,
  forecast: GameForecast,
  legs: SimLeg[],
  parlays: SimParlay[],
  opts: { sims?: number; seed?: number } = {},
): SimResult {
  const sims = opts.sims ?? DEFAULT_SIMS;
  const seed = opts.seed ?? hashSeed(game.id, "base");
  const rng: Rng = mulberry32(seed);

  const K = legs.length;
  const legIndex = new Map(legs.map((l, i) => [l.id, i]));

  const kPitchers = uniq(
    legs.filter((l) => l.kind === "pitcher_k" && l.playerId).map((l) => l.playerId!),
  );
  const erPitchers = uniq(
    legs.filter((l) => l.kind === "pitcher_er" && l.playerId).map((l) => l.playerId!),
  );
  const tbHitters = uniq(
    legs.filter((l) => l.kind === "hitter_tb" && l.playerId).map((l) => l.playerId!),
  );

  const kMeans = kPitchers.map((id) =>
    id === game.homePitcherId ? forecast.homePitcherKMean : forecast.awayPitcherKMean,
  );
  const kHome = kPitchers.map((id) => id === game.homePitcherId);
  const erMeans = erPitchers.map((id) =>
    id === game.homePitcherId ? forecast.homePitcherErMean : forecast.awayPitcherErMean,
  );
  const erHome = erPitchers.map((id) => id === game.homePitcherId);
  const hitters = tbHitters.map((id) => buildHitter(game, id));

  const kIdx = new Map(kPitchers.map((id, i) => [id, i]));
  const erIdx = new Map(erPitchers.map((id, i) => [id, i]));
  const tbIdx = new Map(tbHitters.map((id, i) => [id, i]));

  const marg = new Float64Array(K);
  const pair = new Float64Array(K * K);
  const parlayCount = new Float64Array(parlays.length);
  const homeHist = new Float64Array(HIST_MAX + 1);
  const awayHist = new Float64Array(HIST_MAX + 1);
  const totalHist = new Float64Array(2 * HIST_MAX + 2);
  let sumHome = 0;
  let sumAway = 0;
  let sumTotal = 0;
  let homeWinCount = 0;
  const kDistArr = kPitchers.map(() => new Float64Array(HIST_MAX + 1));
  const kSum = new Float64Array(kPitchers.length);

  const b = new Uint8Array(K);
  const ksVals = new Float64Array(kPitchers.length);
  const erVals = new Float64Array(erPitchers.length);
  const tbVals = new Float64Array(tbHitters.length);

  const parlayLegIdx = parlays.map((p) =>
    p.legIds.map((id) => legIndex.get(id)!).filter((x) => x !== undefined),
  );

  for (let s = 0; s < sims; s++) {
    // Latent form factors (mean 1).
    const env = gamma(rng, K_ENV, 1 / K_ENV);
    const hOff = gamma(rng, K_FORM, 1 / K_FORM);
    const aOff = gamma(rng, K_FORM, 1 / K_FORM);
    const hPit = gamma(rng, K_FORM, 1 / K_FORM);
    const aPit = gamma(rng, K_FORM, 1 / K_FORM);

    const homeLambda = (forecast.homeXR * env * hOff * Math.pow(aPit, -SUPP_EXP)) / C_SUPP;
    const awayLambda = (forecast.awayXR * env * aOff * Math.pow(hPit, -SUPP_EXP)) / C_SUPP;

    let homeRuns = poisson(rng, homeLambda);
    let awayRuns = poisson(rng, awayLambda);
    let guard = 0;
    while (homeRuns === awayRuns && guard < 12) {
      homeRuns += poisson(rng, homeLambda / 9);
      awayRuns += poisson(rng, awayLambda / 9);
      guard++;
    }
    if (homeRuns === awayRuns) homeRuns++;
    const homeWin = homeRuns > awayRuns;
    const total = homeRuns + awayRuns;
    if (homeWin) homeWinCount++;

    sumHome += homeRuns;
    sumAway += awayRuns;
    sumTotal += total;
    homeHist[Math.min(homeRuns, HIST_MAX)]++;
    awayHist[Math.min(awayRuns, HIST_MAX)]++;
    totalHist[Math.min(total, 2 * HIST_MAX + 1)]++;

    for (let i = 0; i < kPitchers.length; i++) {
      const form = kHome[i] ? hPit : aPit;
      const ks = poisson(rng, (kMeans[i] * Math.pow(form, K_EXP)) / C_K);
      ksVals[i] = ks;
      kSum[i] += ks;
      kDistArr[i][Math.min(ks, HIST_MAX)]++;
    }
    for (let i = 0; i < erPitchers.length; i++) {
      // Earned runs track the opposing offense actually produced this sim.
      const oppRatio = erHome[i] ? awayLambda / forecast.awayXR : homeLambda / forecast.homeXR;
      erVals[i] = poisson(rng, erMeans[i] * oppRatio);
    }
    for (let i = 0; i < hitters.length; i++) {
      const form = hitters[i].isHome ? hOff : aOff;
      tbVals[i] = simHitterTB(rng, hitters[i], form);
    }

    for (let i = 0; i < K; i++) {
      b[i] = evalLeg(legs[i], homeWin, total, ksVals, erVals, tbVals, kIdx, erIdx, tbIdx) ? 1 : 0;
    }
    for (let i = 0; i < K; i++) {
      if (b[i]) {
        marg[i]++;
        for (let j = i; j < K; j++) {
          if (b[j]) pair[i * K + j]++;
        }
      }
    }
    for (let p = 0; p < parlayLegIdx.length; p++) {
      const idxs = parlayLegIdx[p];
      let all = idxs.length > 0;
      for (let q = 0; q < idxs.length; q++) {
        if (!b[idxs[q]]) {
          all = false;
          break;
        }
      }
      if (all) parlayCount[p]++;
    }
  }

  const legResults: Record<string, LegResult> = {};
  for (let i = 0; i < K; i++) {
    const l = legs[i];
    let mean: number | undefined;
    if (l.kind === "pitcher_k" && l.playerId && kIdx.has(l.playerId)) {
      mean = kSum[kIdx.get(l.playerId)!] / sims;
    }
    legResults[l.id] = { id: l.id, prob: marg[i] / sims, mean, line: l.line };
  }

  const correlation: number[][] = [];
  const mutualInfo: number[][] = [];
  for (let i = 0; i < K; i++) {
    correlation[i] = [];
    mutualInfo[i] = [];
    for (let j = 0; j < K; j++) {
      const [a, bb] = i <= j ? [i, j] : [j, i];
      const pij = pair[a * K + bb] / sims;
      const pi = marg[i] / sims;
      const pj = marg[j] / sims;
      correlation[i][j] = phi(pij, pi, pj);
      mutualInfo[i][j] = mutualInformation(pij, pi, pj);
    }
  }

  const parlayJoint: Record<string, number> = {};
  parlays.forEach((p, i) => {
    parlayJoint[p.id] = parlayCount[i] / sims;
  });

  const pitcherKDist: Record<string, { mean: number; dist: number[] }> = {};
  kPitchers.forEach((id, i) => {
    pitcherKDist[id] = { mean: kSum[i] / sims, dist: Array.from(kDistArr[i], (v) => v / sims) };
  });

  return {
    gameId: game.id,
    sims,
    seed,
    homeWinProb: homeWinCount / sims,
    awayWinProb: 1 - homeWinCount / sims,
    meanHomeRuns: sumHome / sims,
    meanAwayRuns: sumAway / sims,
    meanTotal: sumTotal / sims,
    medianTotal: medianFromHist(totalHist, sims),
    homeRunDist: Array.from(homeHist, (v) => v / sims),
    awayRunDist: Array.from(awayHist, (v) => v / sims),
    totalDist: Array.from(totalHist, (v) => v / sims),
    legs: legResults,
    legOrder: legs.map((l) => l.id),
    correlation,
    mutualInfo,
    parlayJoint,
    pitcherKDist,
  };
}

function simHitterTB(rng: Rng, h: HitterSim, form: number): number {
  const c = h.comp;
  // Scale hit outcomes by the team's offense form this sim; walks unchanged.
  const p0 = c[0];
  const p1 = c[1] * form;
  const p2 = c[2] * form;
  const p3 = c[3] * form;
  const p4 = c[4] * form;
  const t1 = p0 + p1;
  const t2 = t1 + p2;
  const t3 = t2 + p3;
  const t4 = t3 + p4;
  let tb = 0;
  for (let p = 0; p < h.pa; p++) {
    const r = rng();
    if (r < p0)
      continue; // walk
    else if (r < t1) tb += 1;
    else if (r < t2) tb += 2;
    else if (r < t3) tb += 3;
    else if (r < t4) tb += 4;
    // else out
  }
  return tb;
}

function evalLeg(
  leg: SimLeg,
  homeWin: boolean,
  total: number,
  ksVals: Float64Array,
  erVals: Float64Array,
  tbVals: Float64Array,
  kIdx: Map<string, number>,
  erIdx: Map<string, number>,
  tbIdx: Map<string, number>,
): boolean {
  switch (leg.kind) {
    case "moneyline":
      return leg.side === "home" ? homeWin : !homeWin;
    case "total":
      return leg.side === "over" ? total > (leg.line ?? 0) : total < (leg.line ?? 0);
    case "pitcher_k": {
      const v = ksVals[kIdx.get(leg.playerId!)!];
      return leg.side === "over" ? v > (leg.line ?? 0) : v < (leg.line ?? 0);
    }
    case "pitcher_er": {
      const v = erVals[erIdx.get(leg.playerId!)!];
      return leg.side === "over" ? v > (leg.line ?? 0) : v < (leg.line ?? 0);
    }
    case "hitter_tb": {
      const v = tbVals[tbIdx.get(leg.playerId!)!];
      return v > (leg.line ?? 0);
    }
    default:
      return false;
  }
}

function phi(pij: number, pi: number, pj: number): number {
  const denom = Math.sqrt(pi * (1 - pi) * pj * (1 - pj));
  if (denom < 1e-9) return 0;
  return clamp((pij - pi * pj) / denom, -1, 1);
}

function mutualInformation(pij: number, pi: number, pj: number): number {
  const table = [
    [pij, pi - pij],
    [pj - pij, 1 - pi - pj + pij],
  ];
  const px = [pi, 1 - pi];
  const py = [pj, 1 - pj];
  let mi = 0;
  for (let x = 0; x < 2; x++) {
    for (let y = 0; y < 2; y++) {
      const pxy = table[x][y];
      if (pxy > 1e-12) mi += pxy * Math.log2(pxy / (px[x] * py[y]));
    }
  }
  return Math.max(mi, 0);
}

function medianFromHist(hist: Float64Array, n: number): number {
  let cum = 0;
  const half = n / 2;
  for (let i = 0; i < hist.length; i++) {
    cum += hist[i];
    if (cum >= half) return i;
  }
  return hist.length - 1;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}
