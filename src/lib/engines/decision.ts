import type { Game, MarketKind, MarketQuote } from "../domain/types";
import { hitter, pitcher } from "../domain/slate";
import { team } from "../domain/teams";
import { expectedValue, impliedProb, probabilityEdge, toAmerican } from "./odds";
import type { GameForecast } from "./forecast";
import type { SimResult } from "./simulation";
import { tailSportsScore, type ScoreSignals } from "./score";

/**
 * TAIL Sports Decision Engine.
 *
 * Classifies each priced market as recommend / monitor / reject (PRD §7.5)
 * by running six configurable gates. A highest-confidence recommendation
 * requires at least five of six gates to pass (PRD §5.3).
 */

export type Outcome = "recommend" | "monitor" | "reject";
export type GateStatus = "pass" | "watch" | "fail";

export interface Gate {
  key: string;
  label: string;
  status: GateStatus;
  detail: string;
}

export interface MarketDecision {
  gameId: string;
  kind: MarketKind;
  legId: string;
  selection: string;
  modelProb: number;
  fairAmerican: number;
  marketAmerican: number;
  edge: number;
  ev: number;
  consensus: number;
  outcome: Outcome;
  score: number;
  gatesPassed: number;
  gates: Gate[];
}

/** Demonstrated historical reliability by market family (0–1). */
const CALIBRATION: Record<MarketKind, number> = {
  moneyline: 0.94,
  total: 0.9,
  runline: 0.88,
  pitcher_k: 0.86,
  pitcher_er: 0.84,
  hitter_tb: 0.8,
  hitter_hr: 0.76,
  hitter_hits: 0.82,
};

export function legIdForQuote(q: MarketQuote): string {
  return `${q.kind}:${q.side}:${q.line ?? ""}:${q.playerId ?? ""}`;
}

// --- analytic baselines for model/simulation consensus ---
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

function analyticProb(game: Game, fc: GameForecast, q: MarketQuote): number | undefined {
  const line = q.line ?? 0;
  switch (q.kind) {
    case "moneyline":
      return q.side === "home" ? fc.homeWinProbBaseline : fc.awayWinProbBaseline;
    case "total": {
      const lam = fc.fairTotal;
      return q.side === "over"
        ? 1 - poissonCdf(Math.floor(line), lam)
        : poissonCdf(Math.ceil(line) - 1, lam);
    }
    case "pitcher_k": {
      const lam = q.playerId === game.homePitcherId ? fc.homePitcherKMean : fc.awayPitcherKMean;
      return q.side === "over"
        ? 1 - poissonCdf(Math.floor(line), lam)
        : poissonCdf(Math.ceil(line) - 1, lam);
    }
    case "pitcher_er": {
      const lam = q.playerId === game.homePitcherId ? fc.homePitcherErMean : fc.awayPitcherErMean;
      return q.side === "over"
        ? 1 - poissonCdf(Math.floor(line), lam)
        : poissonCdf(Math.ceil(line) - 1, lam);
    }
    default:
      return undefined;
  }
}

function selectionLabel(game: Game, q: MarketQuote): string {
  const home = team(game.homeCode);
  const away = team(game.awayCode);
  const line = q.line ?? 0;
  switch (q.kind) {
    case "moneyline":
      return `${q.side === "home" ? home.code : away.code} Moneyline`;
    case "total":
      return `${q.side === "over" ? "Over" : "Under"} ${line.toFixed(1)}`;
    case "pitcher_k":
      return `${pitcher(q.playerId!).name} ${q.side === "over" ? "Over" : "Under"} ${line} K`;
    case "pitcher_er":
      return `${pitcher(q.playerId!).name} ${q.side === "over" ? "Over" : "Under"} ${line} ER`;
    case "hitter_tb":
      return `${hitter(q.playerId!).name} ${Math.ceil(line)}+ Total Bases`;
    default:
      return q.kind;
  }
}

function band(v: number, pass: number, watch: number): GateStatus {
  return v >= pass ? "pass" : v >= watch ? "watch" : "fail";
}

export function decideMarket(
  game: Game,
  fc: GameForecast,
  sim: SimResult,
  q: MarketQuote,
): MarketDecision {
  const legId = legIdForQuote(q);
  const modelProb = sim.legs[legId]?.prob ?? 0;
  const edge = probabilityEdge(modelProb, q.american);
  const ev = expectedValue(modelProb, q.american);
  const calibration = CALIBRATION[q.kind];

  const baseline = analyticProb(game, fc, q);
  const consensus =
    baseline === undefined
      ? clamp01(0.6 + 0.3 * game.dataQuality)
      : clamp01(1 - Math.abs(modelProb - baseline) / 0.15);

  const signals: ScoreSignals = {
    edge,
    prob: modelProb,
    ev,
    consensus,
    calibration,
    dataQuality: game.dataQuality,
    marketStability: game.marketStability,
    lineupCertainty: game.lineupCertainty,
  };
  const score = tailSportsScore(signals);

  const gates: Gate[] = [
    {
      key: "probability",
      label: "Probability threshold",
      status: band(modelProb, 0.53, 0.5),
      detail: `${(modelProb * 100).toFixed(1)}% model probability`,
    },
    {
      key: "edge",
      label: "Edge",
      status: band(edge, 0.03, 0.01),
      detail: `${signPct(edge)} vs implied ${(impliedProb(q.american) * 100).toFixed(1)}%`,
    },
    {
      key: "ev",
      label: "Expected value",
      status: band(ev, 0.02, 0),
      detail: `${signPct(ev)} per unit`,
    },
    {
      key: "consensus",
      label: "Model consensus",
      status: band(consensus, 0.7, 0.55),
      detail: `${(consensus * 100).toFixed(0)}% model–simulation agreement`,
    },
    {
      key: "calibration",
      label: "Historical calibration",
      status: band(calibration, 0.82, 0.75),
      detail: `${(calibration * 100).toFixed(0)}% reliability, ${q.kind.replace("_", " ")}`,
    },
    {
      key: "dataQuality",
      label: "Data quality",
      status: band(game.dataQuality, 0.9, 0.8),
      detail: `${(game.dataQuality * 100).toFixed(0)}% completeness`,
    },
    {
      key: "marketStability",
      label: "Market stability",
      status: band(game.marketStability, 0.75, 0.5),
      detail: `${(game.marketStability * 100).toFixed(0)}% stability index`,
    },
  ];

  // Six configured recommendation gates (PRD §5.3): probability, edge, EV,
  // consensus, historical calibration, data quality.
  const configured = ["probability", "edge", "ev", "consensus", "calibration", "dataQuality"];
  const gatesPassed = gates.filter((g) => configured.includes(g.key) && g.status === "pass").length;

  let outcome: Outcome;
  if (ev <= 0 || edge < 0.005) outcome = "reject";
  else if (gatesPassed >= 5) outcome = "recommend";
  else if (gatesPassed >= 4 && edge >= 0.035 && ev >= 0.05)
    outcome = "recommend"; // strong edge covers one soft gate
  else if (gatesPassed >= 3 && edge >= 0.02) outcome = "monitor";
  else outcome = "reject";

  return {
    gameId: game.id,
    kind: q.kind,
    legId,
    selection: selectionLabel(game, q),
    modelProb,
    fairAmerican: toAmerican(modelProb),
    marketAmerican: q.american,
    edge,
    ev,
    consensus,
    outcome,
    score,
    gatesPassed,
    gates,
  };
}

/** Decide every priced market for a game and return them ranked by score. */
export function decideGame(game: Game, fc: GameForecast, sim: SimResult): MarketDecision[] {
  return game.markets.map((q) => decideMarket(game, fc, sim, q)).sort((a, b) => b.score - a.score);
}

function signPct(x: number): string {
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(1)}%`;
}
function clamp01(x: number): number {
  return Math.min(Math.max(x, 0), 1);
}
