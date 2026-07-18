/**
 * TAIL Sports domain model.
 *
 * These types describe inputs to the quantitative pipeline and remain separate
 * from computed outputs. Production inputs can come from MLB Stats API,
 * Baseball Savant and The Odds API; the pipeline never mutates a source slate.
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
  /** Bullpen Fatigue Index, 0 (fresh) → 1 (depleted). */
  bullpenFatigue: number;
  /** Runs saved on defense vs. average (runs / game). */
  defense: number;
  /** Home park run factor, 1.0 = neutral. */
  parkFactor: number;
}

export interface Pitcher {
  id: string;
  name: string;
  hand: Hand;
  /** Expected strikeouts per 9 innings. */
  k9: number;
  /** Expected earned runs saved vs. an average starter. */
  suppression: number;
  /** Expected innings pitched for the start. */
  expectedIP: number;
}

export interface Hitter {
  id: string;
  name: string;
  teamCode: string;
  hand: Hand;
  rates: {
    bb: number;
    single: number;
    double: number;
    triple: number;
    hr: number;
  };
  pa: number;
}

export interface WeatherSnapshot {
  tempF: number;
  windMph: number;
  windDir: string;
  roof: "open" | "closed" | "none";
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
export type MarketSource = "sportsbook" | "fallback" | "synthetic";

export interface MarketQuote {
  kind: MarketKind;
  side: Side;
  line?: number;
  playerId?: string;
  american: number;
}

export interface Game {
  /** MLB gamePk for live games; stable authored id for fixtures/replays. */
  id: string;
  startTimeET: string;
  venue: string;
  awayCode: string;
  homeCode: string;
  awayPitcherId: string;
  homePitcherId: string;
  weather: WeatherSnapshot;
  dataQuality: number;
  lineupCertainty: number;
  marketStability: number;
  /** Distinguishes real sportsbook quotes from fallback/demo prices. */
  marketSource?: MarketSource;
  markets: MarketQuote[];
  featuredHitterIds: string[];
}

export interface Slate {
  date: string;
  games: Game[];
}

export interface RunLineage {
  productionModel: string;
  featureSet: string;
  datasetSnapshot: string;
  simulationConfig: string;
  explanationPrompt: string;
}
