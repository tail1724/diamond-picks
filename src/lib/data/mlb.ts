import type {
  Game,
  Hand,
  MarketQuote,
  Pitcher,
  Side,
  Slate,
  WeatherSnapshot,
} from "../domain/types";
import { hittersForTeam, registerPitcher } from "../domain/slate";
import { team, TEAMS } from "../domain/teams";
import { forecastGame } from "../engines/forecast";

/**
 * Live production data provider — MLB Stats API (statsapi.mlb.com).
 *
 * Fetches the real slate for a date: games, venues, start times, probable
 * pitchers, and each pitcher's real season K/9 + ERA (→ run suppression). Team
 * offense is taken from real season runs-per-game where available; other team
 * ratings (defense, bullpen, park) remain model-estimated. Sportsbook odds are
 * NOT part of the MLB API, so the reference book is still synthesized downstream.
 *
 * Every step degrades gracefully: any failure throws and the caller falls back
 * to the demonstration slate, so the app never breaks. Networks that block
 * statsapi.mlb.com (e.g. a restricted egress allowlist) simply get the fallback.
 */

const BASE = "https://statsapi.mlb.com/api/v1";
const LEAGUE_RPG = 4.3;
const LEAGUE_ERA = 4.1;

/** Permanent MLB team id → this app's team code. */
const MLB_ID_TO_CODE: Record<number, string> = {
  108: "LAA",
  109: "ARI",
  110: "BAL",
  111: "BOS",
  112: "CHC",
  113: "CIN",
  114: "CLE",
  115: "COL",
  116: "DET",
  117: "HOU",
  118: "KCR",
  119: "LAD",
  120: "WSN",
  121: "NYM",
  133: "ATH",
  134: "PIT",
  135: "SDP",
  136: "SEA",
  137: "SFG",
  138: "STL",
  139: "TBR",
  140: "TEX",
  141: "TOR",
  142: "MIN",
  143: "PHI",
  144: "ATL",
  145: "CHW",
  146: "MIA",
  147: "NYY",
  158: "MIL",
};

async function fetchJson(url: string, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : fallback;
}
function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

interface RawGame {
  gamePk: number;
  gameDate: string;
  venueName: string;
  away: { code: string; pitcherId?: number; pitcherName?: string };
  home: { code: string; pitcherId?: number; pitcherName?: string };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

function parseSchedule(data: any): RawGame[] {
  const games: RawGame[] = [];
  const dateBlocks = data?.dates ?? [];
  for (const block of dateBlocks) {
    for (const g of block?.games ?? []) {
      if (g?.status?.abstractGameCode === "F") continue; // skip finals
      const awayId = g?.teams?.away?.team?.id;
      const homeId = g?.teams?.home?.team?.id;
      const awayCode = MLB_ID_TO_CODE[awayId];
      const homeCode = MLB_ID_TO_CODE[homeId];
      if (!awayCode || !homeCode) continue;
      games.push({
        gamePk: g.gamePk,
        gameDate: g.gameDate,
        venueName: g?.venue?.name ?? team(homeCode).name,
        away: {
          code: awayCode,
          pitcherId: g?.teams?.away?.probablePitcher?.id,
          pitcherName: g?.teams?.away?.probablePitcher?.fullName,
        },
        home: {
          code: homeCode,
          pitcherId: g?.teams?.home?.probablePitcher?.id,
          pitcherName: g?.teams?.home?.probablePitcher?.fullName,
        },
      });
    }
  }
  return games;
}

interface PitcherStat {
  hand: Hand;
  k9: number;
  era: number;
  ip: number;
  gs: number;
}

function parsePitcherStats(data: any): Map<number, PitcherStat> {
  const out = new Map<number, PitcherStat>();
  for (const p of data?.people ?? []) {
    const split = p?.stats?.[0]?.splits?.[0]?.stat ?? {};
    const ip = num(split.inningsPitched, 0);
    const gs = num(split.gamesStarted, 0);
    const k9 = split.strikeoutsPer9Inn
      ? num(split.strikeoutsPer9Inn, 8)
      : ip > 0
        ? (num(split.strikeOuts, 0) / ip) * 9
        : 8;
    out.set(p.id, {
      hand: (p?.pitchHand?.code as Hand) ?? "R",
      k9: clamp(k9, 4, 14),
      era: clamp(num(split.era, LEAGUE_ERA), 1.5, 8),
      ip,
      gs,
    });
  }
  return out;
}

/** Map real season stats onto this app's rating scale. */
function pitcherFromStat(id: number, name: string, stat?: PitcherStat): Pitcher {
  const era = stat?.era ?? LEAGUE_ERA;
  const suppression = clamp(0.55 + (LEAGUE_ERA - era) * 0.3, -0.3, 1.1);
  const expectedIP = stat && stat.gs > 0 ? clamp(stat.ip / stat.gs, 4.5, 6.8) : 5.7;
  return {
    id: `mlb-${id}`,
    name,
    hand: stat?.hand ?? "R",
    k9: stat?.k9 ?? 8,
    suppression,
    expectedIP,
  };
}

function parseTeamOffense(data: any): Map<string, number> {
  // team season runs-per-game → offense rating vs league average.
  const rpg = new Map<string, number>();
  const splits = data?.stats?.[0]?.splits ?? [];
  for (const s of splits) {
    const code = MLB_ID_TO_CODE[s?.team?.id];
    const runs = num(s?.stat?.runs, NaN);
    const gp = num(s?.stat?.gamesPlayed, NaN);
    if (code && Number.isFinite(runs) && gp > 0) rpg.set(code, runs / gp);
  }
  const offense = new Map<string, number>();
  const values = [...rpg.values()];
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : LEAGUE_RPG;
  for (const [code, v] of rpg) offense.set(code, clamp(v - mean, -0.8, 0.9));
  return offense;
}

function etTime(iso: string): string {
  try {
    const d = new Date(iso);
    const s = d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      minute: "2-digit",
    });
    return `${s} ET`;
  } catch {
    return "TBD";
  }
}

function weatherFor(homeCode: string): WeatherSnapshot {
  // Real weather needs a separate provider; use the home park run factor with a
  // neutral wind so the run environment still reflects the venue.
  const park = team(homeCode).parkFactor;
  return { tempF: 72, windMph: 0, windDir: "n/a", roof: "none", runFactor: park };
}

const ml = (side: Side, american: number): MarketQuote => ({ kind: "moneyline", side, american });
const tot = (side: Side, line: number): MarketQuote => ({
  kind: "total",
  side,
  line,
  american: -110,
});
const pk = (playerId: string, side: Side, line: number): MarketQuote => ({
  kind: "pitcher_k",
  side,
  line,
  playerId,
  american: -110,
});
const per = (playerId: string, side: Side, line: number): MarketQuote => ({
  kind: "pitcher_er",
  side,
  line,
  playerId,
  american: -110,
});
const htb = (playerId: string, line: number): MarketQuote => ({
  kind: "hitter_tb",
  side: "over",
  line,
  playerId,
  american: -110,
});

/** Build a game's market menu with sensible lines (odds are calibrated later). */
function buildMarkets(game: Game): MarketQuote[] {
  const fc = forecastGame(game);
  const totalLine = Math.round(fc.fairTotal * 2) / 2;
  const kLine = (mean: number) => Math.max(2.5, Math.round(mean) - 0.5);
  const erLine = (mean: number) => Math.max(1.5, Math.round(mean) + 0.5);
  const quotes: MarketQuote[] = [
    ml("home", -110),
    ml("away", -110),
    tot("over", totalLine),
    tot("under", totalLine),
    pk(game.homePitcherId, "over", kLine(fc.homePitcherKMean)),
    pk(game.awayPitcherId, "over", kLine(fc.awayPitcherKMean)),
    per(game.homePitcherId, "under", erLine(fc.homePitcherErMean)),
  ];
  for (const hid of game.featuredHitterIds) quotes.push(htb(hid, 1.5));
  return quotes;
}

export async function buildLiveSlate(date: string): Promise<Slate> {
  const season = date.slice(0, 4);
  const schedule = await fetchJson(
    `${BASE}/schedule?sportId=1&date=${date}&hydrate=probablePitcher,venue`,
  );
  const rawGames = parseSchedule(schedule).filter((g) => g.away.pitcherId && g.home.pitcherId);
  if (rawGames.length === 0) throw new Error("no games with probable pitchers for date");

  // Pitcher season stats (one batched call).
  const ids = Array.from(new Set(rawGames.flatMap((g) => [g.away.pitcherId!, g.home.pitcherId!])));
  let pStats = new Map<number, PitcherStat>();
  try {
    const people = await fetchJson(
      `${BASE}/people?personIds=${ids.join(",")}&hydrate=stats(group=[pitching],type=[season],season=${season})`,
    );
    pStats = parsePitcherStats(people);
  } catch {
    // proceed with league-average defaults
  }

  // Team offense from real season runs/game (best-effort).
  let offense = new Map<string, number>();
  try {
    const teamStats = await fetchJson(
      `${BASE}/teams/stats?sportId=1&season=${season}&stats=season&group=hitting`,
    );
    offense = parseTeamOffense(teamStats);
  } catch {
    // keep curated offense ratings
  }

  // Apply real offense onto the (mutable) ratings table where available.
  for (const [code, off] of offense) {
    if (TEAMS[code]) TEAMS[code].offense = off;
  }

  // Register real pitchers and assemble games.
  const games: Game[] = rawGames.map((rg) => {
    const awayP = pitcherFromStat(
      rg.away.pitcherId!,
      rg.away.pitcherName ?? "TBD",
      pStats.get(rg.away.pitcherId!),
    );
    const homeP = pitcherFromStat(
      rg.home.pitcherId!,
      rg.home.pitcherName ?? "TBD",
      pStats.get(rg.home.pitcherId!),
    );
    registerPitcher(awayP);
    registerPitcher(homeP);

    const featuredHitterIds = [
      ...hittersForTeam(rg.away.code),
      ...hittersForTeam(rg.home.code),
    ].map((h) => h.id);

    const partial: Game = {
      id: `g${rg.gamePk}`,
      startTimeET: etTime(rg.gameDate),
      venue: rg.venueName,
      awayCode: rg.away.code,
      homeCode: rg.home.code,
      awayPitcherId: awayP.id,
      homePitcherId: homeP.id,
      awayPitcherName: awayP.name,
      homePitcherName: homeP.name,
      awayPitcherHand: awayP.hand,
      homePitcherHand: homeP.hand,
      weather: weatherFor(rg.home.code),
      dataQuality: 0.94,
      lineupCertainty: 0.85,
      marketStability: 0.75,
      featuredHitterIds,
      markets: [],
    };
    partial.markets = buildMarkets(partial);
    return partial;
  });

  return { date, source: "live", games };
}

/** ISO date (YYYY-MM-DD) for "today" in US Eastern time. */
export function easternDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts; // en-CA formats as YYYY-MM-DD
}
