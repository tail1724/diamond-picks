import { formatAmerican } from "../engines/odds";

export { formatAmerican };

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const signedPct = (x: number, digits = 1) => `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
export const signed = (x: number, digits = 2) => `${x >= 0 ? "+" : ""}${x.toFixed(digits)}`;

export function slateDateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} · ${month} ${d.getDate()}`;
}

export function payoutForStake(stake: number, american: number): number {
  return american >= 0 ? stake * (american / 100) : stake * (100 / Math.abs(american));
}

export function pickStrength(score: number): string {
  if (score >= 205) return "Best Bet";
  if (score >= 175) return "Strong";
  if (score >= 145) return "Solid";
  if (score >= 115) return "Lean";
  return "Pass";
}

export const navItems = [
  { to: "/", label: "Today" },
  { to: "/games", label: "Every Game" },
  { to: "/props", label: "Player Picks" },
  { to: "/my-card", label: "My Card" },
  { to: "/performance", label: "Results" },
] as const;

export const advancedNavItems = [
  { to: "/parlays", label: "Parlay Builder" },
  { to: "/scenario", label: "What-If Tool" },
  { to: "/simulation", label: "Simulation Detail" },
] as const;

export const adminNavItems = [
  { to: "/lab", label: "Research Lab" },
  { to: "/replay", label: "Replay Lab" },
  { to: "/models", label: "Models & Runs" },
  { to: "/ops", label: "System Health" },
  { to: "/settings", label: "Admin Settings" },
] as const;
