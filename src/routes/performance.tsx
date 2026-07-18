import { createFileRoute } from "@tanstack/react-router";
import { PERFORMANCE } from "@/lib/domain/research";
import { pct, signed, signedPct } from "@/lib/tail/format";
import { Panel, PanelHead, SectionHead, StatCard } from "@/components/tail/ui";

export const Route = createFileRoute("/performance")({ component: Performance });

function EquityCurve({ points }: { points: number[] }) {
  const w = 520;
  const h = 150;
  const max = Math.max(...points);
  const min = Math.min(...points, 0);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / (max - min || 1)) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-[150px] w-full" preserveAspectRatio="none">
      <path d={`${path} L${w},${h} L0,${h} Z`} fill="var(--brand-red)" fillOpacity="0.08" />
      <path
        d={path}
        fill="none"
        stroke="var(--brand-red)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Performance() {
  const p = PERFORMANCE;
  return (
    <>
      <SectionHead
        eyebrow="Analytics and continuous learning"
        title="Performance"
        copy="Settled results scored for ROI, closing-line value, calibration, and Brier score across every market family (rolling 30 days)."
      />
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="ROI" value={signedPct(p.roiPct)} note={`${signed(p.roiUnits, 1)} units`} />
        <StatCard label="Average CLV" value={signedPct(p.avgClv)} note="Beat closing line" />
        <StatCard
          label="Win Rate"
          value={pct(p.winRate)}
          note={`${p.settledBets} settled`}
          noteTone="muted"
        />
        <StatCard
          label="Brier Score"
          value={p.brier.toFixed(3)}
          note="Lower is better"
          noteTone="muted"
        />
        <StatCard
          label="Log Loss"
          value={p.logLoss.toFixed(3)}
          note="Production model"
          noteTone="muted"
        />
      </section>

      <div className="mt-[18px] grid gap-[18px] lg:grid-cols-[1.2fr_0.8fr]">
        <Panel>
          <PanelHead
            title="Equity Curve"
            subtitle="Cumulative units over the last 14 settled slates."
          />
          <div className="p-3.5">
            <EquityCurve points={p.equityCurve} />
          </div>
        </Panel>
        <Panel>
          <PanelHead title="Calibration" subtitle="Predicted bucket vs. observed hit rate." />
          <div className="grid gap-2 p-3.5">
            {p.calibration.map((c) => {
              const err = c.observed - c.predicted;
              return (
                <div
                  key={c.bucket}
                  className="flex items-center justify-between gap-2.5 rounded-[11px] bg-soft px-2.5 py-2 text-[11px]"
                >
                  <b className="text-navy">{c.bucket}</b>
                  <span className="text-muted-foreground">
                    obs {pct(c.observed)} · Δ{" "}
                    <span className={Math.abs(err) <= 0.015 ? "text-edge" : "text-brand-amber"}>
                      {signed(err * 100, 1)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel className="mt-[18px]">
        <PanelHead
          title="Performance by Market"
          subtitle="ROI, CLV, and Brier score by market family."
        />
        <div className="overflow-x-auto p-1">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Market", "ROI", "CLV", "Brier", "Settled"].map((h) => (
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
              {p.byMarket.map((m) => (
                <tr key={m.market}>
                  <td className="border-b border-line p-2.5 text-[11px] font-black text-navy">
                    {m.market}
                  </td>
                  <td className="border-b border-line p-2.5 text-[11px] font-black text-edge">
                    {signedPct(m.roi)}
                  </td>
                  <td className="border-b border-line p-2.5 text-[11px]">{signedPct(m.clv)}</td>
                  <td className="border-b border-line p-2.5 text-[11px]">{m.brier.toFixed(3)}</td>
                  <td className="border-b border-line p-2.5 text-[11px]">{m.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
