import type { Game } from "../domain/types";
import { team } from "../domain/teams";
import { formatAmerican } from "./odds";
import type { GameForecast } from "./forecast";
import type { MarketDecision } from "./decision";
import type { SimResult } from "./simulation";

/**
 * Turns the model output into clear, conversational pick analysis without
 * changing any probabilities, prices, scores, or recommendation states.
 */

export interface GameExplanation {