import { formatAmerican } from "../engines/odds";

export { formatAmerican };

export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;

export const signedPct = (x: number, digits = 1) =>
  `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;

export const signed = (x: number, digits = 2) => `${x >= 0 ? "+" : ""}${x.toFixed(digits)}`;

/** "2026-07-18" → "Saturday · July 18". */
export function slateDateLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const month = d.toLocaleDateString("en-US", { month: "long" });
  return `${weekday} · ${month} ${d.getDate()}`;
}

export const navItems = [
  { to: "/", label: "Best Picks" },
  { to: "/games", label: "Every Game" },
] as const;

export const advancedNavItems = [
  { to: "/parlays", label: "Parlays" },
  { to: "/props", label: "Player Picks" },
  { to: "/performance", label: "How We’re Doing" },
  { to: "/lab", label: "Pick Lab" },
  { to: "/scenario", label: "What-If Tool" },
  { to: "/simulation", label: "Game Simulations" },
  { to: "/replay", label: "Past Slates" },
  { to: "/models", label: "How It Works" },
  { to: "/ops", label: "System Status" },
  { to: "/settings", label: "Settings" },
] as const;
