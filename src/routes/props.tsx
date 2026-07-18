import { createFileRoute } from "@tanstack/react-router";
import { useSlate } from "@/lib/tail/context";
import { formatAmerican, pct, signedPct } from "@/lib/tail/format";
import type { MarketDecision, Outcome } from "@/lib/engines/decision";
import { Panel, PanelHead, SectionHead, Tag, type Tone } from "@/components/tail/ui";

export const Route = createFileRoute("/props")({ component: PlayerProps });

const outcomeTone: Record<Outcome, Tone> = { recommend: "green", monitor: "amber", reject: "red" };

function PropTable({ decisions }: { decisions: MarketDecision[] }) {
  return (
    <div className="overflow-x-auto p-1">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["Selection", "Model", "Fair", "Market", "Edge", "Score", "Decision"].map((h) => (
              <th
                key={h}
                className="border-b border-line p-2.5 text-left text-[10px] font-black uppercase tracking-wide text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {decisions.map((d) => (
            <tr key={`${d.gameId}-${d.legId}`}>
              <td className="border-b border-line p-2.5 text-[11px] font-black text-navy">
                {d.selection}
              </td>
              <td className="border-b border-line p-2.5 text-[11px]">{pct(d.modelProb)}</td>
              <td className="border-b border-line p-2.5 text-[11px]">
                {formatAmerican(d.fairAmerican)}
              </td>
              <td className="border-b border-line p-2.5 text-[11px]">
                {formatAmerican(d.marketAmerican)}
              </td>
              <td
                className={`border-b border-line p-2.5 text-[11px] font-black ${d.edge >= 0 ? "text-edge" : "text-muted-foreground"}`}
              >
                {signedPct(d.edge)}
              </td>
              <td className="border-b border-line p-2.5 text-[11px] font-black text-navy">
                {d.score}
              </td>
              <td className="border-b border-line p-2.5 text-[11px]">
                <Tag tone={outcomeTone[d.outcome]}>{d.outcome}</Tag>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerProps() {
  const { slate } = useSlate();
  const all = slate.games.flatMap((g) => g.decisions);
  const pitcher = all
    .filter((d) => d.kind === "pitcher_k" || d.kind === "pitcher_er")
    .sort((a, b) => b.score - a.score);
  const hitter = all.filter((d) => d.kind === "hitter_tb").sort((a, b) => b.score - a.score);

  return (
    <>
      <SectionHead
        eyebrow="Pitcher and hitter markets"
        title="Player Props"
        copy="Strikeout, earned-run, and total-base markets priced from the same simulation the game markets use — each with model probability, fair price, edge, and decision state."
      />
      <div className="grid gap-[18px]">
        <Panel>
          <PanelHead
            title="Pitcher Props"
            subtitle={`${pitcher.length} markets · strikeouts and earned runs`}
          />
          <PropTable decisions={pitcher} />
        </Panel>
        <Panel>
          <PanelHead title="Hitter Props" subtitle={`${hitter.length} markets · total bases`} />
          <PropTable decisions={hitter} />
        </Panel>
      </div>
    </>
  );
}
