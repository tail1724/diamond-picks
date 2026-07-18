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
  { to: "/", label: "Dashboard" },
  { to: "/parlays", label: "TAIL Sports Parlays" },
  { to: "/props", label: "Player Props" },
  { to: "/performance", label: "Performance" },
  { to: "/lab", label: "TAIL Sports Lab" },
  { to: "/scenario", label: "Scenario Studio" },
  { to: "/simulation", label: "Simulation Explorer" },
  { to: "/replay", label: "Replay Lab" },
  { to: "/models", label: "Model Registry" },
  { to: "/ops", label: "TAIL Sports Ops" },
  { to: "/settings", label: "Settings" },
] as const;
