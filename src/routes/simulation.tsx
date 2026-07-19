import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSlate } from "@/lib/tail/context";
import { team } from "@/lib/domain/teams";
import { hitter } from "@/lib/domain/slate";
import type { MarketQuote } from "@/lib/domain/types";
import { pct } from "@/lib/tail/format";
import type { SimResult } from "@/lib/engines/simulation";
import { Panel, PanelHead, SectionHead } from "@/components/tail/ui";

export const Route = createFileRoute("/simulation")({ component: SimulationExplorer });

function legId(m: MarketQuote): string {
  return `${m.kind}:${m.side}:${m.line ?? ""}:${m.playerId ?? ""}`;
}

/** Reconstruct a two-way joint probability from marginals + phi correlation. */
function jointFromCorr(sim: SimResult, a: string, b: string): number | null {
  const ia = sim.legOrder.indexOf(a);
  const ib = sim.legOrder.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  const pa = sim.legs[a].prob;
  const pb = sim.legs[b].prob;
  const corr = sim.correlation[ia][ib];
  return Math.max(0, pa * pb + corr * Math.sqrt(pa * (1 - pa) * pb * (1 - pb)));
}

function SimulationExplorer() {
  const { slate } = useSlate();
  const [gameId, setGameId] = useState(slate.games[0].game.id);
  const run = slate.games.find((g) => g.game.id === gameId) ?? slate.games[0];
  const sim = run.sim;
  const home = team(run.game.homeCode);

  const dist = sim.homeRunDist.slice(0, 12);
  const maxP = Math.max(...dist);

  const events = useMemo(() => {
    const mlHome = "moneyline:home::";
    const under = run.game.markets.find((m) => m.kind === "total" && m.side === "under");
    const kHome = run.game.markets.find(
      (m) => m.kind === "pitcher_k" && m.side === "over" && m.playerId === run.game.homePitcherId,
    );
    const tb = run.game.markets.find((m) => m.kind === "hitter_tb");
    const homeSpName = run.game.homePitcherName ?? "Home SP";
    const rows: Array<{ label: string; value: number | null }> = [];
    if (kHome)
      rows.push({
        label: `${home.code} win + ${homeSpName} K over`,
        value: jointFromCorr(sim, mlHome, legId(kHome)),
      });
    if (tb)
      rows.push({
        label: `${home.code} win + ${hitter(tb.playerId!).name} 2+ TB`,
        value: jointFromCorr(sim, mlHome, legId(tb)),
      });
    if (under && kHome)
      rows.push({
        label: `${homeSpName} K over + Under ${under.line}`,
        value: jointFromCorr(sim, legId(kHome), legId(under)),
      });
    if (under)
      rows.push({
        label: `${home.code} win + Under ${under.line}`,
        value: jointFromCorr(sim, mlHome, legId(under)),
      });
    return rows.filter((r) => r.value !== null);
  }, [run, sim, home.code]);

  const parlay = slate.parlays.find((p) => p.legs.every((l) => l.gameId === gameId));

  return (
    <>
      <SectionHead
        eyebrow="Distribution, not just averages"
        title="Simulation Explorer"
        copy="Inspect score frequencies, confidence intervals, and joint events from the exact production simulation run."
        action={
          <select
            value={gameId}
            onChange={(e) => setGameId(e.target.value)}
            className="rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm font-extrabold text-navy"
          >
            {slate.games.map((g) => (
              <option key={g.game.id} value={g.game.id}>
                {g.game.awayCode} at {g.game.homeCode}
              </option>
            ))}
          </select>
        }
      />
      <div className="grid gap-[18px] lg:grid-cols-2">
        <Panel>
          <PanelHead
            title={`${home.name} Run Distribution`}
            subtitle={`${sim.sims.toLocaleString()} simulated games · mean ${sim.meanHomeRuns.toFixed(1)} runs`}
          />
          <div className="flex h-[180px] items-end gap-1.5 border-b border-line px-3.5 pb-2 pt-4">
            {dist.map((p, i) => (
              <div
                key={i}
                title={`${i} runs · ${pct(p)}`}
                className="min-w-[10px] flex-1 rounded-t-md bg-gradient-to-b from-brand-red to-navy"
                style={{ height: `${maxP ? (p / maxP) * 100 : 0}%` }}
              />
            ))}
          </div>
          <div className="flex justify-between px-3.5 py-2 text-[9px] text-muted-foreground">
            <span>0 runs</span>
            <span>5 runs</span>
            <span>11+ runs</span>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Joint Event Matrix"
            subtitle="Co-occurrence estimated from the shared simulation."
          />
          <div className="grid gap-2.5 p-3.5">
            {events.map((e) => (
              <div
                key={e.label}
                className="flex items-center justify-between gap-2.5 rounded-[11px] bg-soft px-2.5 py-2.5 text-[11px]"
              >
                <b className="text-navy">{e.label}</b>
                <span className="text-muted-foreground">{pct(e.value ?? 0)}</span>
              </div>
            ))}
            {parlay && (
              <>
                <div className="flex items-center justify-between gap-2.5 rounded-[11px] bg-navy/10 px-2.5 py-2.5 text-[11px]">
                  <b className="text-navy">All primary legs (shared sim)</b>
                  <span className="font-black text-navy">{pct(parlay.jointProb)}</span>
                </div>
                <div className="flex items-center justify-between gap-2.5 rounded-[11px] bg-soft px-2.5 py-2.5 text-[11px]">
                  <b className="text-navy">Naive independent estimate</b>
                  <span className="text-muted-foreground">{pct(parlay.naiveIndependentProb)}</span>
                </div>
              </>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
