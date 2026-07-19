/**
 * TAIL Sports domain model.
 *
 * Source inputs remain separate from computed recommendations. Production inputs
 * can come from MLB Stats API, Baseball Savant, and The Odds API.
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
  offense: number;
  bullpenFatigue: number;
  defense: number;
  parkFactor: number;
}

export interface Pitcher {
  id: string;
  name: string;
  hand: Hand;
  k9: number;
  suppression: number;
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

export interface BookmakerOffer {
  key: string;
  title: string;
  american: number;
  lastUpdate: string;
}

export interface MarketQuote {
  kind: MarketKind;
  side: Side;
  line?: number;
  playerId?: string;
  american: number;
  bookmaker?: string;
  lastUpdate?: string;
  offers?: BookmakerOffer[];
}

export interface LiveDataStatus {
  schedule: "live" | "fallback";
  odds: "live" | "unconfigured" | "unavailable";
  liveFeedGames: number;
  savantGames: number;
  fetchedAt: string;
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
