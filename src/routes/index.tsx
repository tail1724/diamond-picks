import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSlate } from "@/lib/tail/context";
import { pct, signedPct, slateDateLabel } from "@/lib/tail/format";
import { EXPERIMENTS, REPLAY_ARCHIVE_COUNT } from "@/lib/domain/research";
import {
  Btn,
  DataRow,
  Explanation,
  Panel,
  PanelHead,
  Pill,
  ScoreRing,
  StatCard,
} from "@/components/tail/ui";
import { GameCard } from "@/components/tail/GameCard";
import type { Gate } from "@/lib/engines/decision";

export const Route = createFileRoute("/")({ component: Dashboard });

const gateColor: Record<Gate["status"], string> = {
  pass: "text-edge",
  watch: "text-brand-amber",
  fail: "text-brand-red",
};

function GateList({ gates }: { gates: Gate[] }) {
  return (
    <div className="grid gap-2">
      {gates.map((g) => (
        <div
          key={g.key}
          className="flex items-center justify-between gap-2.5 rounded-[11px] bg-soft px-2.5 py-2.5 text-[11px]"
        >
          <b className="text-navy">{g.label}</b>
          <span className={`font-black ${gateColor[g.status]}`}>{g.status.toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

const WORKSPACES = [
  {
    to: "/parlays",
    title: "TAIL Sports Parlays",
    desc: "Simulation-priced parlays with joint probability, correlation strength, fair odds, and risk explanations.",
  },
  {
    to: "/lab",
    title: "TAIL Sports Lab",
    desc: "Candidate experiments with historical replay, feature tests, and promotion gates.",
  },
  {
    to: "/scenario",
    title: "Scenario Studio",
    desc: "Saved what-if branches for lineup, weather, pitcher, and bullpen changes.",
  },
  {
    to: "/simulation",
    title: "Simulation Explorer",
    desc: "Slate-wide simulated outcomes with distributions, confidence intervals, and joint-event analysis.",
  },
  {
    to: "/replay",
    title: "Replay Lab",
    desc: "Leakage-safe archived slates reconstructed from information available before first pitch.",
  },
  {
    to: "/ops",
    title: "TAIL Sports Ops",
    desc: "Operational monitoring using application health, data freshness, run status, and database metrics.",
  },
] as const;

function Dashboard() {
  const { slate, regenerate, regenerating } = useSlate();
  const [sort, setSort] = useState<"score" | "edge">("score");

  const bestGames = useMemo(() => {
    const scored = slate.games
      .filter((g) => g.headline.outcome === "recommend" || g.headline.outcome === "monitor")
      .sort((a, b) =>
        sort === "edge" ? b.headline.edge - a.headline.edge : b.headline.score - a.headline.score,
      );
    return scored.slice(0, 6);
  }, [slate, sort]);

  const topScore = slate.recommendations[0] ?? slate.games[0].headline;
  const workspaceMetric: Record<string, string> = {
    "/parlays": String(slate.stats.qualifiedParlays),
    "/lab": String(EXPERIMENTS.length),
    "/scenario": "3",
    "/simulation": `${(slate.stats.totalSimulations / 1_000_000).toFixed(1)}M`,
    "/replay": REPLAY_ARCHIVE_COUNT.toLocaleString(),
    "/ops": "99.9%",
  };

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[27px] bg-gradient-to-br from-navy to-navy-2 p-8 text-white shadow-[0_16px_40px_rgba(7,26,51,0.11)]">
        <div className="pointer-events-none absolute -right-32 -top-52 h-[470px] w-[470px] rounded-full border-[36px] border-white/5" />
        <div className="relative z-10 grid items-end gap-8 lg:grid-cols-[1.4fr_0.75fr]">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[#f1c56b]">
                {slateDateLabel(slate.date)} · Production Run #{slate.runNumber}
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                  slate.dataSource === "live"
                    ? "bg-[#37c979]/15 text-[#8fe6b6]"
                    : "bg-gold/15 text-gold"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${slate.dataSource === "live" ? "bg-[#37c979]" : "bg-gold"}`}
                />
                {slate.dataSource === "live" ? "Live MLB data" : "Demonstration data"}
              </span>
            </div>
            <h1 className="mt-2 max-w-[900px] font-serif text-[clamp(34px,4.6vw,58px)] font-normal leading-[0.98] tracking-[-0.04em]">
              One platform for forecasting, simulation, decisions, and research.
            </h1>
            <p className="mb-5 mt-3 max-w-[780px] text-[15px] leading-relaxed text-white/75">
              TAIL Sports prices MLB games and props independently, executes 100,000 simulations per
              game, filters recommendations through a dedicated Decision Engine, and publishes
              correlated parlays with complete model lineage.
            </p>
            <div className="flex flex-wrap gap-2.5">
              <select className="min-w-[175px] rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-white [&>option]:text-ink">
                <option>MLB — All Games</option>
                <option>American League</option>
                <option>National League</option>
              </select>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "score" | "edge")}
                className="min-w-[175px] rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-white [&>option]:text-ink"
              >
                <option value="score">Sort: Decision Score</option>
                <option value="edge">Sort: Edge</option>
              </select>
              <Btn onClick={regenerate} disabled={regenerating}>
                {regenerating ? "Running…" : "Run Fresh Forecast"}
              </Btn>
              <Link
                to="/scenario"
                className="inline-flex items-center rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110"
              >
                Open Scenario Studio
              </Link>
            </div>
          </div>

          <aside className="rounded-[20px] border border-white/15 bg-white/[0.07] p-5">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-white/60">
              Production pipeline
            </div>
            <div className="mb-1 mt-1.5 font-serif text-[43px] font-black">100,000</div>
            <p className="mb-3.5 text-[12px] leading-snug text-white/70">
              Simulations per game · feature set {slate.lineage.featureSet} · model ensemble{" "}
              {slate.lineage.productionModel} · deterministic seed stored
            </p>
            <div className="h-[9px] overflow-hidden rounded-full bg-white/15">
              <div className="h-full w-full bg-gradient-to-r from-brand-red to-gold" />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Ingestion", "Features", "Prediction", "Simulation", "Decision", "Parlays"].map(
                (s) => (
                  <span
                    key={s}
                    className="rounded-full bg-white/10 px-2 py-1.5 text-[9px] font-extrabold"
                  >
                    {s} ✓
                  </span>
                ),
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Stats */}
      <section className="my-[18px] grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Games Priced" value={slate.stats.gamesPriced} note="Full slate covered" />
        <StatCard
          label="Recommendations"
          value={slate.stats.recommendations}
          note="Passed Decision Engine"
        />
        <StatCard
          label="Qualified Parlays"
          value={slate.stats.qualifiedParlays}
          note="Joint probability verified"
        />
        <StatCard
          label="Average Edge"
          value={signedPct(slate.stats.avgEdge)}
          note="Across recommendations"
        />
        <StatCard
          label="Calibration"
          value={slate.stats.calibrationIndex}
          note="Production model"
        />
      </section>

      {/* Main layout */}
      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.62fr)_minmax(315px,0.78fr)]">
        <Panel>
          <PanelHead
            title="Today’s Best Decisions"
            subtitle="Forecasts become recommendations only after edge, stability, calibration, and data-quality gates."
            aside={<Pill>{slate.stats.recommendations} recommendations</Pill>}
          />
          <div className="grid gap-3 p-3.5">
            {bestGames.map((run) => (
              <GameCard key={run.game.id} run={run} />
            ))}
          </div>
        </Panel>

        <div className="grid gap-[18px]">
          <Panel>
            <PanelHead title="TAIL Sports Score" subtitle="Five of six gates required." />
            <div className="p-3.5">
              <ScoreRing score={topScore.score} />
              <GateList gates={topScore.gates.slice(0, 6)} />
              <Explanation className="mt-3">
                <strong className="text-navy">Top decision:</strong> {topScore.selection} —{" "}
                {signedPct(topScore.edge)} edge, {pct(topScore.modelProb)} model probability.
              </Explanation>
            </div>
          </Panel>

          <Panel>
            <PanelHead title="Model Lineage" subtitle="Exact artifacts used by this run." />
            <div className="grid gap-2 p-3.5">
              <DataRow label="Production model" value={slate.lineage.productionModel} />
              <DataRow label="Feature set" value={slate.lineage.featureSet} />
              <DataRow label="Dataset snapshot" value={slate.lineage.datasetSnapshot} />
              <DataRow label="Simulation config" value={slate.lineage.simulationConfig} />
              <DataRow label="Explanation prompt" value={slate.lineage.explanationPrompt} />
            </div>
          </Panel>
        </div>
      </div>

      {/* Workspaces */}
      <section className="mt-[18px]">
        <div className="mb-3">
          <h2 className="font-serif text-[28px] text-navy">Platform Workspaces</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The production application and quantitative research environment share the same
            versioned data foundation.
          </p>
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {WORKSPACES.map((w) => (
            <article
              key={w.to}
              className="rounded-[16px] border border-line bg-card p-4 shadow-[0_10px_27px_rgba(7,26,51,0.07)]"
            >
              <h3 className="font-serif text-lg text-navy">{w.title}</h3>
              <div className="my-1 font-serif text-[28px] font-black text-navy">
                {workspaceMetric[w.to]}
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{w.desc}</p>
              <Link
                to={w.to}
                className="mt-3 inline-flex items-center rounded-xl border border-line bg-card px-3.5 py-2 text-sm font-extrabold text-navy transition hover:-translate-y-px"
              >
                Open →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
