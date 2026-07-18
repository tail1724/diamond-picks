import type { Game, MarketQuote, RunLineage, Slate } from "../domain/types";
import { SLATE } from "../domain/slate";
import { forecastGame, type GameForecast } from "./forecast";
import { calibrateMarkets } from "./market";
import { hashSeed } from "./rng";
import { simulateGame, DEFAULT_SIMS, type SimLeg, type SimResult } from "./simulation