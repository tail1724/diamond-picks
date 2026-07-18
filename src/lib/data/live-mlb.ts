import type { Game, MarketQuote, Slate } from "../domain/types";
import { PITCHERS, SLATE } from "../domain/slate";

const MLB_STATS_BASE = "https://statsapi.mlb.com/api";
const BASEBALL_SAVANT_BASE = "https://baseballsavant.mlb.com";
const ODDS_BASE = "https://api.the-odds-api.com/v4";
const FETCH_TIMEOUT_MS = 10_000;

interface MlbScheduleResponse {
  dates?: Array<{
    date: string;
    games?: MlbScheduledGame[];
  }>;
}

interface MlbScheduledGame {
  gamePk: number;
  gameDate: string;
  status?: { abstractGameState?: string; detailedState?: string };
  venue?: { name?: string };
  teams: {
    away: { team: { id: number; name: string; abbreviation?: string }; probablePitcher?: MlbPerson };
    home: { team: { id: number; name: string; abbreviation?: string }; probablePitcher?: MlbPerson };
  };
}

interface MlbPerson {
  id: number;
  fullName: string;
  pitchHand?: { code?: string };
}

interface OddsEvent {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: "h2h" | "spreads" | "totals" | string;
      outcomes: Array<{ name: string; price: number; point?: number }>;
    }>;
  }>;
}

interface SavantGameFeed {
  team_home?: Array<Record<string, unknown>>;
  team_away?: Array<Record<string, unknown>>;
  exit_velocity?: Array<Record<string, unknown>>;
  boxscore?: Record<string, unknown>;
}

export interface LiveDataStatus {
  schedule: "live" | "fallback";
  odds: "live" | "unconfigured" | "unavailable";
  liveFeedGames: number;
  savantGames: number;
  fetchedAt: string;
}

export interface ProductionSlateResult {
  slate: Slate;
  status: LiveDataStatus;
}

const TEAM_CODE_OVERRIDES: Record<string, string> = {
  AZ: "ARI",
  CWS: "CHW",
  KC: "KCR",
  OAK: "ATH",
  SD: "SDP",
  SF: "SFG",
  TB: "TBR",
  WSH: "WSN",
};

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function teamCode(team: { abbreviation?: string; name: string }): string {
  const raw = team.abbreviation?.toUpperCase();
  if (raw) return TEAM_CODE_OVERRIDES[raw] ?? raw;

  const byName: Record<string, string> = {
    arizonadiamondbacks: "ARI",
    athletics: "ATH",
    oaklandathletics: "ATH",
    chicagowhitesox: "CHW",
    kansascityroyals: "KCR",
    sandiegopadres: "SDP",
    sanfranciscogiants: "SFG",
    tampabayrays: "TBR",
    washingtonnationals: "WSN",
  };
  return byName[normalizeName(team.name)] ?? team.name.slice(0, 3).toUpperCase();
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        "User-Agent": "TAIL-Sports/1.0",
        ...init?.headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function easternDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function easternTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function registerPitcher(person: MlbPerson | undefined, fallbackLabel: string): string {
  const id = person ? `mlb-${person.id}` : `tbd-${normalizeName(fallbackLabel)}`;
  if (!PITCHERS[id]) {
    PITCHERS[id] = {
      id,
      name: person?.fullName ?? "TBD",
      hand: person?.pitchHand?.code === "L" ? "L" : "R",
      k9: 8.7,
      suppression: 0,
      expectedIP: 5.5,
    };
  }
  return id;
}

function gameKey(away: string, home: string): string {
  return `${normalizeName(away)}:${normalizeName(home)}`;
}

function averageAmerican(values: number[]): number {
  if (!values.length) return -110;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function consensusMarkets(event: OddsEvent | undefined): MarketQuote[] {
  if (!event?.bookmakers?.length) return [];

  const buckets = new Map<string, { quote: Omit<MarketQuote, "american">; prices: number[] }>();
  for (const book of event.bookmakers) {
    for (const market of book.markets) {
      for (const outcome of market.outcomes) {
        let quote: Omit<MarketQuote, "american"> | undefined;
        if (market.key === "h2h") {
          quote = {
            kind: "moneyline",
            side: normalizeName(outcome.name) === normalizeName(event.home_team) ? "home" : "away",
          };
        } else if (market.key === "totals" && outcome.point != null) {
          quote = {
            kind: "total",
            side: outcome.name.toLowerCase() === "over" ? "over" : "under",
            line: outcome.point,
          };
        } else if (market.key === "spreads" && outcome.point != null) {
          quote = {
            kind: "runline",
            side: normalizeName(outcome.name) === normalizeName(event.home_team) ? "home" : "away",
            line: outcome.point,
          };
        }
        if (!quote) continue;
        const key = `${quote.kind}:${quote.side}:${quote.line ?? ""}`;
        const existing = buckets.get(key) ?? { quote, prices: [] };
        existing.prices.push(outcome.price);
        buckets.set(key, existing);
      }
    }
  }

  return [...buckets.values()].map(({ quote, prices }) => ({
    ...quote,
    american: averageAmerican(prices),
  }));
}

function fallbackMarkets(): MarketQuote[] {
  return [
    { kind: "moneyline", side: "away", american: -110 },
    { kind: "moneyline", side: "home", american: -110 },
    { kind: "total", side: "over", line: 8.5, american: -110 },
    { kind: "total", side: "under", line: 8.5, american: -110 },
  ];
}

async function fetchSchedule(date: string): Promise<MlbScheduledGame[]> {
  const params = new URLSearchParams({
    sportId: "1",
    date,
    hydrate: "team,venue,probablePitcher(note,pitchHand)",
  });
  const response = await fetchJson<MlbScheduleResponse>(
    `${MLB_STATS_BASE}/v1/schedule/games/?${params.toString()}`,
  );
  return response.dates?.flatMap((entry) => entry.games ?? []) ?? [];
}

async function fetchOdds(date: string): Promise<OddsEvent[]> {
  const apiKey = process.env.THE_ODDS_API_KEY;
  if (!apiKey) return [];

  const from = new Date(`${date}T00:00:00-04:00`).toISOString();
  const to = new Date(`${date}T23:59:59-04:00`).toISOString();
  const params = new URLSearchParams({
    apiKey,
    regions: process.env.THE_ODDS_API_REGIONS ?? "us",
    markets: "h2h,spreads,totals",
    oddsFormat: "american",
    dateFormat: "iso",
    commenceTimeFrom: from,
    commenceTimeTo: to,
  });
  return fetchJson<OddsEvent[]>(`${ODDS_BASE}/sports/baseball_mlb/odds/?${params.toString()}`);
}

export async function fetchGameLiveFeed(gamePk: number): Promise<unknown> {
  return fetchJson(`${MLB_STATS_BASE}/v1.1/game/${gamePk}/feed/live`);
}

export async function fetchSavantGameFeed(gamePk: number): Promise<SavantGameFeed> {
  return fetchJson<SavantGameFeed>(`${BASEBALL_SAVANT_BASE}/gf?game_pk=${gamePk}`);
}

async function enrichStartedGames(games: MlbScheduledGame[]): Promise<{ liveFeedGames: number; savantGames: number }> {
  const started = games.filter((game) => game.status?.abstractGameState !== "Preview").slice(0, 4);
  let liveFeedGames = 0;
  let savantGames = 0;

  await Promise.all(
    started.map(async (game) => {
      const [live, savant] = await Promise.allSettled([
        fetchGameLiveFeed(game.gamePk),
        fetchSavantGameFeed(game.gamePk),
      ]);
      if (live.status === "fulfilled") liveFeedGames += 1;
      if (savant.status === "fulfilled") savantGames += 1;
    }),
  );
  return { liveFeedGames, savantGames };
}

export async function loadProductionSlate(date = easternDate()): Promise<ProductionSlateResult> {
  const fetchedAt = new Date().toISOString();
  let schedule: MlbScheduledGame[];
  try {
    schedule = await fetchSchedule(date);
  } catch {
    return {
      slate: SLATE,
      status: {
        schedule: "fallback",
        odds: process.env.THE_ODDS_API_KEY ? "unavailable" : "unconfigured",
        liveFeedGames: 0,
        savantGames: 0,
        fetchedAt,
      },
    };
  }

  if (!schedule.length) {
    return {
      slate: { date, games: [] },
      status: {
        schedule: "live",
        odds: process.env.THE_ODDS_API_KEY ? "unavailable" : "unconfigured",
        liveFeedGames: 0,
        savantGames: 0,
        fetchedAt,
      },
    };
  }

  let odds: OddsEvent[] = [];
  let oddsStatus: LiveDataStatus["odds"] = process.env.THE_ODDS_API_KEY
    ? "unavailable"
    : "unconfigured";
  if (process.env.THE_ODDS_API_KEY) {
    try {
      odds = await fetchOdds(date);
      oddsStatus = "live";
    } catch {
      oddsStatus = "unavailable";
    }
  }

  const oddsByGame = new Map(odds.map((event) => [gameKey(event.away_team, event.home_team), event]));
  const games: Game[] = schedule.map((raw) => {
    const awayCode = teamCode(raw.teams.away.team);
    const homeCode = teamCode(raw.teams.home.team);
    const awayPitcherId = registerPitcher(raw.teams.away.probablePitcher, `${awayCode}-starter`);
    const homePitcherId = registerPitcher(raw.teams.home.probablePitcher, `${homeCode}-starter`);
    const event = oddsByGame.get(gameKey(raw.teams.away.team.name, raw.teams.home.team.name));
    const markets = consensusMarkets(event);

    return {
      id: String(raw.gamePk),
      startTimeET: easternTime(raw.gameDate),
      venue: raw.venue?.name ?? "Venue TBD",
      awayCode,
      homeCode,
      awayPitcherId,
      homePitcherId,
      weather: {
        tempF: 72,
        windMph: 0,
        windDir: "weather feed pending",
        roof: "none",
        runFactor: 1,
      },
      dataQuality: event ? 0.92 : 0.78,
      lineupCertainty: raw.status?.abstractGameState === "Preview" ? 0.72 : 0.98,
      marketStability: event ? 0.88 : 0.5,
      markets: markets.length ? markets : fallbackMarkets(),
      featuredHitterIds: [],
    };
  });

  const enrichment = await enrichStartedGames(schedule);
  return {
    slate: { date, games },
    status: {
      schedule: "live",
      odds: oddsStatus,
      ...enrichment,
      fetchedAt,
    },
  };
}
