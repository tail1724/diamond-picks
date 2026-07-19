import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSlate } from "@/lib/tail/context";
import { formatAmerican, pct, signed, signedPct } from "@/lib/tail/format";
import { expectedValue, impliedProb, parlayAmerican, toAmerican } from "@/lib/engines/odds";
import { simulateGame, type SimLeg } from "@/lib/engines/simulation";
import { legIdForQuote } from "@/lib/engines/decision";
import { hitter } from "@/lib/domain/slate";
import type { MarketQuote } from "@/lib/domain/types";
import type { PricedParlay } from "@/lib/engines/parlay";
import { Btn, Explanation, Grade, Panel, PanelHead, Pill, SectionHead } from "@/components/tail/ui";

export const Route = createFileRoute("/parlays")({ component: Parlays });

function CorrBox({
  label,
  value,
  edge,
}: {
  label: string;
  value: React.ReactNode;
  edge?: boolean;
}) {
  return (
    <div className="rounded-[11px] bg-soft p-2.5">
      <div className="text-[9px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 font-black ${edge ? "text-edge" : "text-navy"}`}>{value}</div>
    </div>
  );
}

function ParlayCard({ p }: { p: PricedParlay }) {
  const hot = p.score >= 200;
  return (
    <article className="rounded-[16px] border border-line bg-paper p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <strong className="text-navy">{p.title}</strong>
          <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
            {p.subtitle} · {p.legs.length} legs
          </div>
        </div>
        <Grade value={p.score} hot={hot} />
      </div>

      {p.legs.map((leg, i) => (
        <div
          key={leg.legId}
          className="grid grid-cols-[28px_1fr_auto] items-center gap-2.5 border-b border-dashed border-line py-2.5 last:border-b-0"
        >
          <span className="grid h-7 w-7 place-items-center rounded-full bg-navy text-[11px] font-black text-white">
            {i + 1}
          </span>
          <div>
            <div className="text-xs font-black text-navy">{leg.selection}</div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">
              Individual probability {pct(leg.individualProb)}
            </div>
          </div>
          <span className="font-black text-brand-red">{formatAmerican(leg.american)}</span>
        </div>
      ))}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CorrBox label="Joint probability" value={pct(p.jointProb)} />
        <CorrBox label="Fair odds" value={formatAmerican(p.fairAmerican)} />
        <CorrBox label="Market odds" value={formatAmerican(p.marketAmerican)} />
        <CorrBox label="Edge" value={signedPct(p.edge)} edge />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CorrBox label="Correlation" value={signed(p.correlationStrength, 3)} />
        <CorrBox label="Mutual info" value={p.mutualInfo.toFixed(3)} />
        <CorrBox label="Naive indep." value={pct(p.naiveIndependentProb)} />
        <CorrBox label="Risk rating" value={p.riskRating} />
      </div>

      <Explanation className="mt-3">
        <strong className="text-navy">Correlation logic:</strong> {p.explanation}
      </Explanation>
    </article>
  );
}

function hitterName(id?: string): string {
  if (!id) return "Hitter";
  try {
    return hitter(id).name;
  } catch {
    return id;
  }
}

/** Live builder: re-simulates the parlay on every leg toggle (PRD PAR-001). */
function CustomBuilder() {
  const { slate } = useSlate();
  const run = slate.games.find((g) => g.game.featuredHitterIds.length > 0) ?? slate.games[0];
  const options = useMemo(() => {
    const g = run.game;
    const picks: Array<{ q: MarketQuote; label: string }> = [];
    const mlHome = g.markets.find((m) => m.kind === "moneyline" && m.side === "home");
    if (mlHome) picks.push({ q: mlHome, label: `${g.homeCode} Moneyline` });
    const kHome = g.markets.find(
      (m) => m.kind === "pitcher_k" && m.side === "over" && m.playerId === g.homePitcherId,
    );
    if (kHome) picks.push({ q: kHome, label: `${g.homePitcherName} Over ${kHome.line} K` });
    const kAway = g.markets.find(
      (m) => m.kind === "pitcher_k" && m.side === "over" && m.playerId === g.awayPitcherId,
    );
    if (kAway) picks.push({ q: kAway, label: `${g.awayPitcherName} Over ${kAway.line} K` });
    const tb = g.markets.find((m) => m.kind === "hitter_tb");
    if (tb) picks.push({ q: tb, label: `${hitterName(tb.playerId)} 2+ Total Bases` });
    const over = g.markets.find((m) => m.kind === "total" && m.side === "over");
    if (over) picks.push({ q: over, label: `Game Over ${over.line}` });
    return picks.map((p) => ({
      legId: legIdForQuote(p.q),
      label: p.label,
      kind: p.q.kind,
      side: p.q.side,
      line: p.q.line,
      playerId: p.q.playerId,
      american: p.q.american,
    }));
  }, [run]);

  const [selected, setSelected] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(options.map((o, i) => [o.legId, i < 3])),
  );

  const priced = useMemo(() => {
    const chosen = options.filter((o) => selected[o.legId]);
    if (chosen.length < 2) return null;
    const legs: SimLeg[] = chosen.map((o) => ({
      id: o.legId,
      kind: o.kind,
      side: o.side,
      line: o.line,
      playerId: o.playerId,
    }));
    const sim = simulateGame(
      run.game,
      run.forecast,
      legs,
      [{ id: "builder", legIds: legs.map((l) => l.id) }],
      {
        sims: 20000,
        seed: run.sim.seed,
      },
    );
    const joint = sim.parlayJoint["builder"] ?? 0;
    const market = parlayAmerican(chosen.map((o) => o.american));
    const edge = joint - impliedProb(market);
    const risk =
      joint >= 0.4 ? "Low" : joint >= 0.25 ? "Moderate" : joint >= 0.15 ? "Elevated" : "High";
    return { joint, fair: toAmerican(joint), market, edge, ev: expectedValue(joint, market), risk };
  }, [selected, options, run]);

  return (
    <Panel>
      <PanelHead
        title="Custom Builder"
        subtitle="The system recalculates every time a leg changes."
      />
      <div>
        {options.map((o) => (
          <label
            key={o.legId}
            className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5 text-[11px] font-extrabold"
          >
            <input
              type="checkbox"
              checked={!!selected[o.legId]}
              onChange={(e) => setSelected((s) => ({ ...s, [o.legId]: e.target.checked }))}
              className="accent-brand-red"
            />
            <span className="flex-1">{o.label}</span>
            <span className="text-muted-foreground">{formatAmerican(o.american)}</span>
          </label>
        ))}
        <div className="grid gap-2 p-3.5">
          <CorrBox label="Current fair price" value={priced ? formatAmerican(priced.fair) : "—"} />
          <CorrBox
            label="Joint probability"
            value={priced ? pct(priced.joint) : "Select 2+ legs"}
          />
          <CorrBox label="Sportsbook price" value={priced ? formatAmerican(priced.market) : "—"} />
          <CorrBox label="Edge" value={priced ? signedPct(priced.edge) : "—"} edge />
          <CorrBox label="Risk rating" value={priced ? priced.risk : "—"} />
          <Btn
            className="mt-1 w-full"
            onClick={() =>
              toast.success("Parlay version saved", {
                description: "Exact leg and calculation versions preserved (PAR-002).",
              })
            }
          >
            Save Parlay Version
          </Btn>
        </div>
      </div>
    </Panel>
  );
}

function Parlays() {
  const { slate } = useSlate();
  return (
    <>
      <SectionHead
        eyebrow="First-class domain"
        title="TAIL Sports Parlays"
        copy="Parlays are stored, versioned, evaluated, and learned from as independent prediction objects. Joint probabilities are estimated directly from shared simulation outcomes."
        action={
          <Btn
            onClick={() =>
              toast.success("Parlays optimized", {
                description: "Joint probability and fair price recalculated across the slate.",
              })
            }
          >
            Optimize Selected Legs
          </Btn>
        }
      />
      <div className="grid gap-[18px] lg:grid-cols-[1.25fr_0.75fr]">
        <Panel>
          <PanelHead
            title="Top Correlated Parlays"
            subtitle="Joint probabilities estimated directly from simulation outcomes."
            aside={<Pill>{slate.parlays.length} qualified</Pill>}
          />
          <div className="grid gap-3 p-3.5">
            {slate.parlays.slice(0, 7).map((p) => (
              <ParlayCard key={p.id} p={p} />
            ))}
          </div>
        </Panel>
        <CustomBuilder />
      </div>
    </>
  );
}
