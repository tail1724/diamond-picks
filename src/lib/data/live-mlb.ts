import type { BookmakerOffer, Game, LiveDataStatus, MarketQuote, Slate } from "../domain/types";
import { PITCHERS, SLATE } from "../domain/slate";

const MLB_STATS_BASE = "https://statsapi.mlb.com/api";
const BASEBALL_SAVANT_BASE = "https://baseballsavant.mlb.com";
const ODDS_BASE = "https://api.the-odds-api.com/v4";
const FETCH_TIMEOUT_MS = 10_000;

interface MlbScheduleResponse {
  dates?: Array<{ date: string; games?: MlbScheduledGame[] }>;
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

export interface SavantGameFeed {
  team_home?: Array<Record<string, unknown>>;
  team_away?: Array<Record<string, unknown>>;
  exit_velocity?: Array<Record<string, unknown>>;
  boxscore?: Record<string, unknown>;
}

export interface ProductionSlateResult {
  slate: Slate;
  status: LiveDataStatus;
}

const TEAM_CODES_BY_ID: Record<number, string> = {
  108: "LAA", 109: "ARI", 110: "BAL", 111: "BOS", 112: "CHC", 113: "CIN",
  114: "CLE", 115: "COL", 116: "DET", 117: "HOU", 118: "KCR", 119: "LAD",
  120: "WSN", 121: "NYM", 133: "ATH", 134: "PIT", 135: "SDP", 136: "SEA",
  137: "SFG", 138: "STL", 139: "TBR", 140: "TEX", 141: "TOR", 142: "MIN",
  143: "PHI", 144: "ATL", 145: "CHW", 146: "MIA", 147: "NYY", 158: "MIL",
};

const TEAM_CODE_OVERRIDES: Record<string, string> = {
  AZ: "ARI", CWS: "CHW", KC: "KCR", OAK: "ATH", SD: "SDP", SF: "SFG", TB: "TBR", WSH: "WSN",
};

const TEAM_CODES_BY_NAME: Record<string, string> = {
  losangelesangels: "LAA", arizonadiamondbacks: "ARI", baltimoreorioles: "BAL",
  bostonredsox: "BOS", chicagocubs: "CHC", cincinnatireds: "CIN", clevelandguardians: "CLE",
  coloradorockies: "COL", detroittigers: "DET", houstonastros: "HOU", kansascityroyals: "KCR",
  losangelesdodgers: "LAD", washingtonnationals: "WSN", newyorkmets: "NYM", athletics: "ATH",
  oaklandathletics: "ATH", pittsburghpirates: "PIT", sandiegopadres: "SDP", seattlemariners: "SEA",
  sanfranciscogiants: "SFG", stlouiscardinals: "STL", tampabayrays: "TBR", texasrangers: "TEX",
  torontobluejays: "TOR", minnesotatwins: "MIN", philadelphiaphillies: "PHI", atlantabraves: "ATL",
  chicagowhitesox: "CHW", miamimarlins: "MIA", newyorkyankees: "NYY", milwaukeebrewers: "MIL",
};

function normalizeName(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

function teamCode(team: { id: number; abbreviation?: string; name: string }): string {
  const byId = TEAM_CODES_BY_ID[team.id];
  if (byId) return byId;
  const raw = team.abbreviation?.toUpperCase();
  if (raw) return TEAM_CODE_OVERRIDES[raw] ?? raw;
  const byName = TEAM_CODES_BY_NAME[normalizeName(team.name)];
  if (!byName) throw new Error(`Unsupported MLB team: ${team.name} (${team.id})`);
  return byName;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", "User-Agent": "TAIL-Sports/1.0", ...init?.headers },
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
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function easternTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hour: "numeric", minute: "2-digit", timeZoneName: "short",
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

function betterAmerican(a: number, b: number): number {
  return a > b ? a : b;
}

function sportsbookMarkets(event: OddsEvent | undefined): MarketQuote[] {
  if (!event?.bookmakers?.length) return [];
  const buckets = new Map<string, { quote: Omit<MarketQuote, "american" | "offers">; offers: BookmakerOffer[] }>();

  for (const book of event.bookmakers) {
    for (const market of book.markets) {
      for (const outcome of market.outcomes) {
        let quote: Omit<MarketQuote, "american" | "offers"> | undefined;
        if (market.key === "h2h") {
          quote = { kind: "moneyline", side: normalizeName(outcome.name) === normalizeName(event.home_team) ? "home" : "away" };
        } else if (market.key === "totals" && outcome.point != null) {
          quote = { kind: "total", side: outcome.name.toLowerCase() === "over" ? "over" : "under", line: outcome.point };
        } else if (market.key === "spreads" && outcome.point != null) {
          quote = {
            kind: "runline",
            side: normalizeName(outcome.name) === normalizeName(event.home_team) ? "home" : "away",
            line: outcome.point,
          };
        }
        if (!quote) continue;
        const key = `${quote.kind}:${quote.side}:${quote.line ?? ""}`;
        const existing = buckets.get(key) ?? { quote, offers: [] };
        existing.offers.push({ key: book.key, title: book.title, american: outcome.price, lastUpdate: book.last_update });
        buckets.set(key, existing);
      }
    }
  }

  return [...buckets.values()].map(({ quote, offers }) => {
    const best = offers.reduce((current, offer) => betterAmerican(offer.american, current.american) === offer.american ? offer : current);
    return {
      ...quote,
      american: best.american,
      bookmaker: best.title,
      lastUpdate: best.lastUpdate,
      offers: [...offers].sort((a, b) => b.american - a.american),
    };
  });
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
  const params = new URLSearchParams({ sportId: "1", date, hydrate: "team,venue,probablePitcher(note,pitchHand)" });
  const response = await fetchJson<MlbScheduleResponse>(`${MLB_STATS_BASE}/v1/schedule/games/?${params.toString()}`);
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
  await Promise.all(started.map(async (game) => {
    const [live, savant] = await Promise.allSettled([fetchGameLiveFeed(game.gamePk), fetchSavantGameFeed(game.gamePk)]);
    if (live.status === "fulfilled") liveFeedGames += 1;
    if (savant.status === "fulfilled") savantGames += 1;
  }));
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
      status: { schedule: "fallback", odds: process.env.THE_ODDS_API_KEY ? "unavailable" : "unconfigured", liveFeedGames: 0, savantGames: 0, fetchedAt },
    };
  }

  if (!schedule.length) {
    return {
      slate: { date, games: [] },
      status: { schedule: "live", odds: process.env.THE_ODDS_API_KEY ? "unavailable" : "unconfigured", liveFeedGames: 0, savantGames: 0, fetchedAt },
    };
  }

  let odds: OddsEvent[] = [];
  let oddsStatus: LiveDataStatus["odds"] = process.env.THE_ODDS_API_KEY ? "unavailable" : "unconfigured";
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
    const markets = sportsbookMarkets(event);
    const hasSportsbookMarkets = markets.length > 0;

    return {
      id: String(raw.gamePk),
      startTimeET: easternTime(raw.gameDate),
      venue: raw.venue?.name ?? "Venue TBD",
      awayCode,
      homeCode,
      awayPitcherId,
      homePitcherId,
      weather: { tempF: 72, windMph: 0, windDir: "weather feed pending", roof: "none", runFactor: 1 },
      dataQuality: hasSportsbookMarkets ? 0.92 : 0.72,
      lineupCertainty: raw.status?.abstractGameState === "Preview" ? 0.72 : 0.98,
      marketStability: hasSportsbookMarkets ? 0.88 : 0.35,
      marketSource: hasSportsbookMarkets ? "sportsbook" : "fallback",
      markets: hasSportsbookMarkets ? markets : fallbackMarkets(),
      featuredHitterIds: [],
    };
  });

  const enrichment = await enrichStartedGames(schedule);
  return { slate: { date, games }, status: { schedule: "live", odds: oddsStatus, ...enrichment, fetchedAt } };
}
