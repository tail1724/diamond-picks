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
  rates: { bb: number; single: number; double: number