/**
 * TAIL Sports domain model.
 *
 * These types describe the *inputs* to the quantitative pipeline (teams,
 * pitchers, hitters, games, sportsbook markets) and are deliberately kept
 * separate from computed outputs (see src/lib/engines/*). The pipeline never
 * mutates these inputs; every run derives fresh, versioned outputs from them.
 *
 * The slate ships as a synthetic demonstration dataset — real MLB feeds are
 * out of scope for this repo — but every probability, fair price, TAIL Sports
 * Score and parlay in the app is *computed* from these inputs by the engines,
 * never hand-authored.
 */

export type League = "AL" | "NL";
export type Division = "East" | "Central" | "West";
export type Hand = "L" | "R" | "S";

export interface Team {
  code: string;
  city: string;
  name: string;
  league: League;
  division: Division;
  /** Expected runs added vs. a league-average offense (runs / game). */
  offense: number;
  /** Bullpen Fatigue Index, 0 (fresh) → 1 (depleted). Higher hurts late leads. */
  bullpenFatigue: number;
  /** Runs saved on defense vs. average (runs / game). Positive = better. */
  defense: number;
  /** Home park run factor, 1.0 = neutral (>1 favors offense). */
  parkFactor: number;
}

export interface Pitcher {
  id: string;
  name: string;
  hand: Hand;
  /** Expected strikeouts per 9 innings. */
  k9: number;
  /** Run-suppression: expected earned runs saved vs. average starter (runs). */
  suppression: number;
  /** Expected innings pitched for the start. */
  expectedIP: number;
}

export interface Hitter {
  id: string;
  name: string;
  teamCode: string;
  hand: Hand;
  /** Per-plate-appearance outcome rates (must be internally consistent). */
  rates: {
    bb: number;
    single: number;
    double: number;
    triple: number;
    hr: number;
  };
  /** Typical plate appearances in a start. */
  pa: number;
}

export interface WeatherSnapshot {
  tempF: number;
  windMph: number;
  /** Human-readable wind direction, e.g. "out to right". */
  windDir: string;
  roof: "open" | "closed" | "none";
  /** Run environment multiplier from park + weather, 1.0 = neutral. */
  runFactor: number;
}

export type MarketKind =
  | "moneyline"
  | "total"
  | "runline"
  | "pitcher_k"
  | "pitcher_er"
  | "hitter_tb"
  | "hitter_hr"
  | "hitter_hits";

export type Side = "home" | "away" | "over" | "under" | "yes";

export interface MarketQuote {
  kind: MarketKind;
  side: Side;
  /** Line for totals / props (e.g. 8.0, 5.5). Omitted for moneyline. */
  line?: number;
  /** Player id for prop markets. */
  playerId?: string;
  /** American odds offered by the reference sportsbook. */
  american: number;
}

export interface Game {
  id: string;
  startTimeET: string;
  venue: string;
  awayCode: string;
  homeCode: string;
  awayPitcherId: string;
  homePitcherId: string;
  weather: WeatherSnapshot;
  /** Data-quality score 0–1 (completeness × freshness × source quality). */
  dataQuality: number;
  /** Lineup certainty 0–1 (1 = confirmed lineups both sides). */
  lineupCertainty: number;
  /** Market stability 0–1 (1 = stable price, 0 = rapidly moving / thin). */
  marketStability: number;
  /** Reference sportsbook quotes for this game. */
  markets: MarketQuote[];
  /** Ids of hitters we price props / parlay legs for on this game. */
  featuredHitterIds: string[];
}

export interface Slate {
  date: string;
  games: Game[];
}

/** Lineage stamped onto every produced run (ARCH-002, reproducibility). */
export interface RunLineage {
  productionModel: string;
  featureSet: string;
  datasetSnapshot: string;
  simulationConfig: string;
  explanationPrompt: string;
}
