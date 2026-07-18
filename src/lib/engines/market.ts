import type { Game, MarketQuote } from "../domain/types";
import { hitter, pitcher } from "../domain/slate";
import { naiveForecast, type GameForecast } from "./forecast";
import { toAmerican } from "./odds";

/**
 * Synthetic sportsbook price generator for the demonstration slate.
 *
 * The reference book is modeled as efficient but slightly less sophisticated
 * than TAIL: it prices game markets off the naive forecast (ignoring bullpen /
 * park / weather) and shades player props toward the house. Prices carry a
 * realistic ~4.5% two-way hold. This keeps the authored lines from slate.ts
 * intact while producing believable, feature-driven edges rather than the
 * unrealistic gaps hand-authored odds would create.
 */

const VIG = 0.045;

function poissonPmf(k: number, lambda: number): number {
  let logp = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logp -= Math.log(i);
  return Math.exp(logp);
}
function poissonCdf(k: number, lambda: number): number {
  let s = 0;
  for (let i = 0; i <= k; i++) s += poissonPmf(i, lambda);
  return Math.min(s, 1);
}

/** Round an American price to the nearest 5, keeping it away from 0. */
function roundAmerican(a: number): number {
  const r = Math.round(a / 5) * 5;
  if (r === 0) return a >= 0 ? 5 : -5;
  return r;
}

/** Convert a book "true" probability into a posted American price with hold. */
function priceFrom(bookProb: number): number {
  const withVig = Math.min(Math.max(bookProb + VIG / 2, 0.02), 0.98);
  return roundAmerican(toAmerican(withVig));
}

function overUnderProb(side: string, line: number, lambda: number): number {
  return side === "over"
    ? 1 - poissonCdf(Math.floor(line), lambda)
    : poissonCdf(Math.ceil(line) - 1, lambda);
}

/** Analytic P(2+ total bases) for a hitter vs the opposing starter. */
function hitterTwoPlusTB(game: Game, hitterId: string): number {
  const h = hitter(hitterId);
  const facesHome = h.teamCode === game.awayCode;
  const oppSp = pitcher(facesHome ? game.homePitcherId : game.awayPitcherId);
  const env = game.weather.runFactor;
  const f =
    Math.min(Math.max(1 - oppSp.suppression * 0.1, 0.8), 1.15) *
    Math.min(Math.max(env, 0.85), 1.15);
  const r = h.rates;
  // per-PA distribution over total bases {0,1,2,3,4}
  const p1 = r.single * f;
  const p2 = r.double * f;
  const p3 = r.triple * f;
  const p4 = r.hr * f;
  const p0 = Math.max(1 - (r.bb + p1 + p2 + p3 + p4), 0) + r.bb; // out or walk → 0 TB
  let dist = [1]; // P(total bases = 0) = 1 before any PA
  const per = [p0, p1, p2, p3, p4];
  const pa = Math.round(h.pa);
  for (let i = 0; i < pa; i++) {
    const next = new Array(dist.length + 4).fill(0);
    for (let a = 0; a < dist.length; a++) {
      if (dist[a] === 0) continue;
      for (let b = 0; b < per.length; b++) next[a + b] += dist[a] * per[b];
    }
    dist = next;
  }
  const pLt2 = (dist[0] ?? 0) + (dist[1] ?? 0);
  return 1 - pLt2;
}

/** Recompute realistic American prices for every quote, keeping lines/kinds. */
export function calibrateMarkets(game: Game, fc: GameForecast): MarketQuote[] {
  const naive = naiveForecast(game);
  return game.markets.map((q) => {
    const line = q.line ?? 0;
    let bookProb: number;
    switch (q.kind) {
      case "moneyline": {
        // Books shade favorites toward the middle to balance action; the model
        // finds value on favorites it prices more confidently than the book.
        const COMPRESS = 0.68;
        const shaded = 0.5 + (naive.homeWin - 0.5) * COMPRESS;
        bookProb = q.side === "home" ? shaded : 1 - shaded;
        break;
      }
      case "total":
        bookProb = overUnderProb(q.side, line, naive.total);
        break;
      case "pitcher_k": {
        const mean =
          (q.playerId === game.homePitcherId ? fc.homePitcherKMean : fc.awayPitcherKMean) * 0.955;
        bookProb = overUnderProb(q.side, line, mean);
        break;
      }
      case "pitcher_er": {
        const mean =
          (q.playerId === game.homePitcherId ? fc.homePitcherErMean : fc.awayPitcherErMean) * 1.05;
        bookProb = overUnderProb(q.side, line, mean);
        break;
      }
      case "hitter_tb": {
        bookProb = hitterTwoPlusTB(game, q.playerId!) * 0.97;
        break;
      }
      default:
        bookProb = 0.5;
    }
    return { ...q, american: priceFrom(bookProb) };
  });
}
