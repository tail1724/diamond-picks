import type { Game, MarketQuote, RunLineage, Slate } from "../domain/types";
import { SLATE, pitcher } from "../domain/slate";
import { forecastGame, type GameForecast } from "./forecast";
import { calibrateMarkets } from "./market";
import { hashSeed } from "./rng";
import { simulateGame, DEFAULT_SIMS, type SimLeg, type SimResult } from "./simulation";
import { decideGame, legIdForQuote, type MarketDecision } from "./decision";
import { explainGame, type GameExplanation } from "./explanation";
import {
  priceParlay,
  simParlaysForSpecs,
  type ParlaySpec,
  type PricedParlay,
  type PricingContext,
} from "./parlay";

/**
 * Production forecast workflow (PRD §5.1): ingest → features → forecast →
 * simulate → decide → parlays → explain → publish. Every run is deterministic
 * from its seed and stamped with full lineage (ARCH-002, reproducibility).
 */

export interface GameRun {
  game: Game;
  forecast: GameForecast;
  sim: SimResult;
  decisions: MarketDecision[];
  headline: MarketDecision;
  explanation: GameExplanation;
}

export interface SlateStats {
  gamesPriced: number;
  playerMarkets: number;
  recommendations: number;
  monitored: number;
  rejected: number;
  qualifiedParlays: number;
  candidateParlays: number;
  avgEdge: number;
  calibrationIndex: number;
  totalSimulations: number;
  simMs: number;
}

export interface ComputedSlate {
  date: string;
  runNumber: number;
  seed: number;
  lineage: RunLineage;
  dataSource: "live" | "synthetic";
  games: GameRun[];
  recommendations: MarketDecision[];
  monitored: MarketDecision[];
  parlays: PricedParlay[];
  stats: SlateStats;
}

export const BASE_LINEAGE: RunLineage = {
  productionModel: "v2.0.0",
  featureSet: "v41",
  datasetSnapshot: "2026.07.18.1",
  simulationConfig: "sim-v12",
  explanationPrompt: "exp-v7",
};

export const BASE_RUN_NUMBER = 4482;

function uniqueQuotes(game: Game): MarketQuote[] {
  const seen = new Set<string>();
  const out: MarketQuote[] = [];
  for (const q of game.markets) {
    const id = legIdForQuote(q);
    if (!seen.has(id)) {
      seen.add(id);
      out.push(q);
    }
  }
  return out;
}

function legsForGame(game: Game): SimLeg[] {
  return uniqueQuotes(game).map((q) => ({
    id: legIdForQuote(q),
    kind: q.kind,
    side: q.side,
    line: q.line,
    playerId: q.playerId,
  }));
}

function favoredMoneyline(game: Game): MarketQuote | undefined {
  return game.markets
    .filter((q) => q.kind === "moneyline")
    .sort((a, b) => a.american - b.american)[0];
}

function findQuote(game: Game, kind: string, side?: string): MarketQuote | undefined {
  return game.markets.find((q) => q.kind === kind && (side ? q.side === side : true));
}

/** Build the slate's candidate parlays: two hand-set anchors + auto-generated SGPs. */
function buildParlaySpecs(slate: Slate): ParlaySpec[] {
  const specs: ParlaySpec[] = [];

  const featured: Record<string, ParlaySpec | undefined> = {
    "bos-nyy": {
      id: "bronx-power",
      title: "Bronx Power & Pitching SGP",
      subtitle: "NYY vs BOS · same-game correlation",
      legs: [
        { gameId: "bos-nyy", legId: "moneyline:home::" },
        { gameId: "bos-nyy", legId: "pitcher_k:over:5.5:fried" },
        { gameId: "bos-nyy", legId: "hitter_tb:over:1.5:judge" },
      ],
    },
    "sea-hou": {
      id: "run-suppression",
      title: "Seattle–Houston Run Suppression",
      subtitle: "SEA vs HOU · positive dependency",
      legs: [
        { gameId: "sea-hou", legId: "total:under:8:" },
        { gameId: "sea-hou", legId: "pitcher_k:over:6.5:gilbert" },
        { gameId: "sea-hou", legId: "pitcher_er:under:2.5:brown" },
      ],
    },
  };

  for (const game of slate.games) {
    if (featured[game.id]) {
      specs.push(featured[game.id]!);
      continue;
    }
    const mlFav = favoredMoneyline(game);
    const under = findQuote(game, "total", "under");
    const kOver = game.markets.find((q) => q.kind === "pitcher_k" && q.side === "over");
    const legs = [mlFav, under, kOver].filter(Boolean) as MarketQuote[];
    if (legs.length >= 2) {
      specs.push({
        id: `sgp-${game.id}`,
        title: `${game.awayCode}–${game.homeCode} Suppression SGP`,
        subtitle: `${game.awayCode} @ ${game.homeCode} · same-game`,
        legs: legs.map((q) => ({ gameId: game.id, legId: legIdForQuote(q) })),
      });
    }
  }
  return specs;
}

export interface RunOptions {
  runNumber?: number;
  seed?: number;
  sims?: number;
  slate?: Slate;
}

export function runSlate(opts: RunOptions = {}): ComputedSlate {
  const slate = opts.slate ?? SLATE;
  const runNumber = opts.runNumber ?? BASE_RUN_NUMBER;
  const seed = opts.seed ?? hashSeed("run", runNumber);
  const sims = opts.sims ?? DEFAULT_SIMS;

  const specs = buildParlaySpecs(slate);
  const simParlays = simParlaysForSpecs(specs);

  const t0 = Date.now();
  const games: GameRun[] = slate.games.map((rawGame) => {
    const forecast = forecastGame(rawGame);
    // Embed pitcher display fields so client render needs no runtime registry,
    // then replace authored prices with synthesized efficient-book prices.
    const awaySp = pitcher(rawGame.awayPitcherId);
    const homeSp = pitcher(rawGame.homePitcherId);
    const game: Game = {
      ...rawGame,
      awayPitcherName: rawGame.awayPitcherName ?? awaySp.name,
      homePitcherName: rawGame.homePitcherName ?? homeSp.name,
      awayPitcherHand: rawGame.awayPitcherHand ?? awaySp.hand,
      homePitcherHand: rawGame.homePitcherHand ?? homeSp.hand,
      markets: calibrateMarkets(rawGame, forecast),
    };
    const legs = legsForGame(game);
    const sim = simulateGame(game, forecast, legs, simParlays[game.id] ?? [], {
      sims,
      seed: hashSeed(seed, game.id),
    });
    const decisions = decideGame(game, forecast, sim);
    const headline = decisions[0];
    const explanation = explainGame(game, forecast, headline, sim);
    return { game, forecast, sim, decisions, headline, explanation };
  });
  const simMs = Date.now() - t0;

  // Pricing context over all games.
  const quoteMap = new Map<string, Map<string, MarketQuote>>();
  const selMap = new Map<string, Map<string, string>>();
  const simMap = new Map<string, SimResult>();
  for (const run of games) {
    const qm = new Map<string, MarketQuote>();
    for (const q of run.game.markets) qm.set(legIdForQuote(q), q);
    quoteMap.set(run.game.id, qm);
    const sm = new Map<string, string>();
    for (const d of run.decisions) sm.set(d.legId, d.selection);
    selMap.set(run.game.id, sm);
    simMap.set(run.game.id, run.sim);
  }
  const ctx: PricingContext = {
    quote: (g, l) => quoteMap.get(g)?.get(l),
    selection: (g, l) => selMap.get(g)?.get(l) ?? l,
    sim: (g) => simMap.get(g),
    dataQuality: (g) => slate.games.find((x) => x.id === g)?.dataQuality ?? 0.9,
  };

  const parlays = specs.map((spec) => priceParlay(spec, ctx)).sort((a, b) => b.score - a.score);
  const qualifiedParlays = parlays.filter((p) => p.qualified);

  // Aggregate decisions across every priced market.
  const allDecisions = games.flatMap((g) => g.decisions);
  const recommendations = allDecisions
    .filter((d) => d.outcome === "recommend")
    .sort((a, b) => b.score - a.score);
  const monitored = allDecisions
    .filter((d) => d.outcome === "monitor")
    .sort((a, b) => b.score - a.score);
  const rejected = allDecisions.filter((d) => d.outcome === "reject");

  const playerMarkets = slate.games.reduce(
    (acc, g) =>
      acc +
      g.markets.filter((q) => q.kind.startsWith("pitcher") || q.kind.startsWith("hitter")).length,
    0,
  );
  const avgEdge = recommendations.length
    ? recommendations.reduce((acc, d) => acc + d.edge, 0) / recommendations.length
    : 0;
  const calibrationIndex = recommendations.length
    ? Math.round(
        (recommendations.reduce(
          (acc, d) => acc + d.consensus * 0.5 + (d.gatesPassed / 6) * 0.5,
          0,
        ) /
          recommendations.length) *
          100,
      )
    : 0;

  return {
    date: slate.date,
    runNumber,
    seed,
    lineage: { ...BASE_LINEAGE, datasetSnapshot: `${slate.date}.1` },
    dataSource: slate.source ?? "synthetic",
    games,
    recommendations,
    monitored,
    parlays: qualifiedParlays,
    stats: {
      gamesPriced: slate.games.length,
      playerMarkets,
      recommendations: recommendations.length,
      monitored: monitored.length,
      rejected: rejected.length,
      qualifiedParlays: qualifiedParlays.length,
      candidateParlays: specs.length,
      avgEdge,
      calibrationIndex,
      totalSimulations: slate.games.length * sims,
      simMs,
    },
  };
}

// Memoize the base production run so navigation reuses one computation.
let baseRunCache: ComputedSlate | undefined;
export function getBaseRun(): ComputedSlate {
  if (!baseRunCache) baseRunCache = runSlate();
  return baseRunCache;
}
