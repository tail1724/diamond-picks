import type { Game } from "../domain/types";
import { pitcher } from "../domain/slate";
import { team } from "../domain/teams";

/**
 * TAIL Sports Forecast Engine.
 *
 * Produces baseline probabilities and expected values only — it never produces
 * recommendations (PRD §7.3). Expected runs are built from offense, opposing
 * starter suppression, defense, bullpen fatigue and the park/weather run
 * environment; the baseline win probability comes from an analytic Poisson
 * matchup (the Simulation Engine later refines the full distribution).
 */

const LEAGUE_AVG_RUNS = 4.3;
const HOME_FIELD = 0.12;
const ER_BASE = 3.0;

export interface Driver {
  label: string;
  /** Signed contribution to the home side's run/win margin. */
  value: number;
  detail: string;
}

export interface GameForecast {
  gameId: string;
  awayXR: number;
  homeXR: number;
  fairTotal: number;
  homeWinProbBaseline: number;
  awayWinProbBaseline: number;
  homePitcherErMean: number;
  awayPitcherErMean: number;
  homePitcherKMean: number;
  awayPitcherKMean: number;
  drivers: Driver[];
}

function poissonPmf(k: number, lambda: number): number {
  let logp = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logp -= Math.log(i);
  return Math.exp(logp);
}

/** Analytic P(home wins), extra-inning ties broken toward the stronger offense. */
function analyticHomeWin(homeXR: number, awayXR: number): number {
  const MAX = 24;
  const homePmf: number[] = [];
  const awayPmf: number[] = [];
  for (let k = 0; k <= MAX; k++) {
    homePmf[k] = poissonPmf(k, homeXR);
    awayPmf[k] = poissonPmf(k, awayXR);
  }
  let win = 0;
  let tie = 0;
  for (let a = 0; a <= MAX; a++) {
    for (let h = 0; h <= MAX; h++) {
      const p = awayPmf[a] * homePmf[h];
      if (h > a) win += p;
      else if (h === a) tie += p;
    }
  }
  return win + tie * (homeXR / (homeXR + awayXR));
}

export function expectedK(p: { k9: number; expectedIP: number }): number {
  return (p.k9 / 9) * p.expectedIP;
}

export function forecastGame(game: Game): GameForecast {
  const away = team(game.awayCode);
  const home = team(game.homeCode);
  const homeSp = pitcher(game.homePitcherId);
  const awaySp = pitcher(game.awayPitcherId);
  const env = game.weather.runFactor;

  const awayXR = clamp(
    (LEAGUE_AVG_RUNS +
      away.offense -
      homeSp.suppression -
      home.defense +
      home.bullpenFatigue * 0.4) *
      env,
    2.6,
    7.6,
  );
  const homeXR = clamp(
    (LEAGUE_AVG_RUNS +
      home.offense -
      awaySp.suppression -
      away.defense +
      away.bullpenFatigue * 0.4 +
      HOME_FIELD) *
      env,
    2.6,
    7.6,
  );

  const homeWin = analyticHomeWin(homeXR, awayXR);

  const homeErMean = clamp(
    (ER_BASE + away.offense - homeSp.suppression) * env * (homeSp.expectedIP / 6),
    0.7,
    6.5,
  );
  const awayErMean = clamp(
    (ER_BASE + home.offense - awaySp.suppression) * env * (awaySp.expectedIP / 6),
    0.7,
    6.5,
  );

  const pitchingEdge = awaySp.suppression - homeSp.suppression; // + favors away run prevention
  const offenseEdge = home.offense - away.offense;
  const parkDelta = (env - 1) * (homeXR + awayXR);
  const bullpenEdge = away.bullpenFatigue - home.bullpenFatigue;

  const drivers: Driver[] = [
    {
      label: "Starting pitching",
      value: -pitchingEdge,
      detail: `${homeSp.name} (${homeSp.suppression >= 0 ? "+" : ""}${homeSp.suppression.toFixed(2)} suppression) vs ${awaySp.name} (${awaySp.suppression.toFixed(2)})`,
    },
    {
      label: "Lineup strength",
      value: offenseEdge,
      detail: `${home.city} offense ${offenseEdge >= 0 ? "leads" : "trails"} by ${Math.abs(offenseEdge).toFixed(2)} expected runs`,
    },
    {
      label: "Park & weather",
      value: parkDelta,
      detail: `${game.weather.windMph} mph ${game.weather.windDir}, run factor ${env.toFixed(2)}`,
    },
    {
      label: "Bullpen availability",
      value: bullpenEdge * 0.4,
      detail: `Fatigue index ${home.city} ${home.bullpenFatigue.toFixed(2)} vs ${away.city} ${away.bullpenFatigue.toFixed(2)}`,
    },
  ].sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return {
    gameId: game.id,
    awayXR,
    homeXR,
    fairTotal: awayXR + homeXR,
    homeWinProbBaseline: homeWin,
    awayWinProbBaseline: 1 - homeWin,
    homePitcherErMean: homeErMean,
    awayPitcherErMean: awayErMean,
    homePitcherKMean: expectedK(homeSp),
    awayPitcherKMean: expectedK(awaySp),
    drivers,
  };
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(Math.max(x, lo), hi);
}

/**
 * A deliberately simpler "market" model that ignores bullpen fatigue and the
 * park/weather run environment. The reference sportsbook is assumed to price
 * off this — so TAIL's edge is exactly the value of the features the book
 * underweights. Used only to synthesize realistic comparison prices.
 */
export function naiveForecast(game: Game): { homeWin: number; total: number } {
  const away = team(game.awayCode);
  const home = team(game.homeCode);
  const homeSp = pitcher(game.homePitcherId);
  const awaySp = pitcher(game.awayPitcherId);
  const env = game.weather.runFactor;
  // The reference book knows offense, pitching and park/weather but underweights
  // two features that pull opposite ways: defense (a run-suppression signal) and
  // bullpen fatigue (a run-adding signal). TAIL's edge is their residual value.
  const awayXR = clamp((LEAGUE_AVG_RUNS + away.offense - homeSp.suppression) * env, 2.6, 7.6);
  const homeXR = clamp(
    (LEAGUE_AVG_RUNS + home.offense - awaySp.suppression + HOME_FIELD) * env,
    2.6,
    7.6,
  );
  return { homeWin: analyticHomeWin(homeXR, awayXR), total: awayXR + homeXR };
}
