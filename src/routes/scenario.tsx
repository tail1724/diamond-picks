import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useSlate } from "@/lib/tail/context";
import { formatAmerican, pct, signed } from "@/lib/tail/format";
import { toAmerican } from "@/lib/engines/odds";
import { simulateGame, type SimLeg } from "@/lib/engines/simulation";
import { decideMarket, legIdForQuote } from "@/lib/engines/decision";
import type { GameForecast } from "@/lib/engines/forecast";
import { team } from "@/lib/domain/teams";
import { hitter } from "@/lib/domain/slate";
import { Explanation, Panel, PanelHead, SectionHead } from "@/components/tail/ui";

export const Route = createFileRoute("/scenario")({ component: Scenario });

const WIND = { Calm: 0.97, "14 mph out to right": 1.05, "20 mph out to right": 1.1 };
type WindKey = keyof typeof WIND;

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-ink"
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function DiffCard({
  tag,
  code,
  winProb,
  fair,
  total,
  score,
}: {
  tag: string;
  code: string;
  winProb: number;
  fair: number;
  total: number;
  score: number;
}) {
  return (
    <div className="rounded-[14px] border border-line bg-card p-3.5">
      <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
        {tag}
      </div>
      <h3 className="mt-1 font-serif text-xl text-navy">
        {code} {pct(winProb)}
      </h3>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        Fair price {formatAmerican(fair)}
        <br />
        Total {total.toFixed(1)}
        <br />
        TAIL Sports Score {score}
      </p>
    </div>
  );
}

function homeStarName(featuredHitterIds: string[], homeCode: string): string {
  for (const id of featuredHitterIds) {
    try {
      const h = hitter(id);
      if (h.teamCode === homeCode) return h.name;
    } catch {
      /* ignore */
    }
  }
  return "Star hitter";
}

function Scenario() {
  const { slate } = useSlate();
  const run = slate.games.find((g) => g.game.featuredHitterIds.length > 0) ?? slate.games[0];
  const baseFc = run.forecast;
  const home = team(run.game.homeCode);
  const away = team(run.game.awayCode);
  const starterName = run.game.homePitcherName ?? "Listed starter";
  const starName = homeStarName(run.game.featuredHitterIds, run.game.homeCode);
  const mlQuote = run.game.markets.find((m) => m.kind === "moneyline" && m.side === "home")!;
  const baseDec = run.decisions.find((d) => d.legId === legIdForQuote(mlQuote))!;

  const [wind, setWind] = useState<WindKey>("14 mph out to right");
  const [bullpen, setBullpen] = useState("Full availability");
  const [starter, setStarter] = useState(starterName);
  const [judge, setJudge] = useState("Active");

  const scenario = useMemo(() => {
    const windMul = WIND[wind];
    const baseWindMul = WIND["14 mph out to right"];
    const envMul = windMul / baseWindMul;
    let homeMul = envMul;
    let awayMul = envMul;
    if (bullpen === "Closer unavailable") awayMul *= 1.06;
    if (starter === "Emergency starter") awayMul *= 1.12;
    if (judge === "Removed") homeMul *= 0.94;

    const fc2: GameForecast = {
      ...baseFc,
      homeXR: baseFc.homeXR * homeMul,
      awayXR: baseFc.awayXR * awayMul,
      fairTotal: baseFc.homeXR * homeMul + baseFc.awayXR * awayMul,
    };
    const legs: SimLeg[] = [{ id: legIdForQuote(mlQuote), kind: "moneyline", side: "home" }];
    const sim2 = simulateGame(run.game, fc2, legs, [], { sims: 20000, seed: run.sim.seed + 7 });
    fc2.homeWinProbBaseline = sim2.homeWinProb;
    fc2.awayWinProbBaseline = 1 - sim2.homeWinProb;
    const dec2 = decideMarket(run.game, fc2, sim2, mlQuote);
    return { winProb: sim2.homeWinProb, total: sim2.meanTotal, score: dec2.score };
  }, [wind, bullpen, starter, judge, baseFc, mlQuote, run.game, run.sim.seed]);

  const dWin = scenario.winProb - run.sim.homeWinProb;
  const dTotal = scenario.total - baseFc.fairTotal;
  const dScore = scenario.score - baseDec.score;

  return (
    <>
      <SectionHead
        eyebrow="What-if analysis"
        title="Scenario Studio"
        copy="Branch from a production forecast, modify inputs, and compare the result without overwriting the official run (PRD §11.3)."
      />
      <div className="grid gap-[18px] lg:grid-cols-2">
        <Panel>
          <PanelHead
            title="Scenario Inputs"
            subtitle={`Branch SCN-2204 from production run #${slate.runNumber}.`}
          />
          <div className="grid grid-cols-2 gap-2.5 p-3.5">
            <Select
              label="Game"
              value={`${away.code} at ${home.code}`}
              onChange={() => {}}
              options={[`${away.code} at ${home.code}`]}
            />
            <Select
              label="Lineup certainty"
              value="Confirmed lineup"
              onChange={() => {}}
              options={["Confirmed lineup", "Projected lineup"]}
            />
            <Select
              label="Starting pitcher"
              value={starter}
              onChange={setStarter}
              options={[starterName, "Emergency starter"]}
            />
            <Select
              label="Wind"
              value={wind}
              onChange={(v) => setWind(v as WindKey)}
              options={Object.keys(WIND)}
            />
            <Select
              label={`${home.code} bullpen`}
              value={bullpen}
              onChange={setBullpen}
              options={["Full availability", "Closer unavailable"]}
            />
            <Select
              label={`${starName} status`}
              value={judge}
              onChange={setJudge}
              options={["Active", "Removed"]}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Prediction Diff"
            subtitle="Production baseline versus modified scenario."
          />
          <div className="p-3.5">
            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
              <DiffCard
                tag="Production"
                code={home.code}
                winProb={run.sim.homeWinProb}
                fair={toAmerican(run.sim.homeWinProb)}
                total={baseFc.fairTotal}
                score={baseDec.score}
              />
              <div className="grid place-items-center text-2xl font-black text-brand-red">→</div>
              <DiffCard
                tag="Scenario"
                code={home.code}
                winProb={scenario.winProb}
                fair={toAmerican(scenario.winProb)}
                total={scenario.total}
                score={scenario.score}
              />
            </div>
            <Explanation className="mt-3">
              <strong className="text-navy">Largest changes:</strong> win probability{" "}
              {signed(dWin * 100, 1)} pts, projected total {signed(dTotal, 2)} runs, TAIL Sports
              Score {signed(dScore, 0)}. The branch is preserved without altering the official
              production forecast.
            </Explanation>
          </div>
        </Panel>
      </div>
      <div className="mt-4">
        <button
          onClick={() =>
            toast.success("Scenario SCN-2205 completed without changing the production forecast.")
          }
          className="inline-flex items-center rounded-xl bg-brand-red px-3.5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(201,31,55,0.24)]"
        >
          Save Scenario Branch
        </button>
      </div>
    </>
  );
}
