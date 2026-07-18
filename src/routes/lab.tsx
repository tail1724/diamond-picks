import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { pct } from "@/lib/tail/format";
import {
  EXPERIMENTS,
  FEATURE_IMPORTANCE,
  LAB_STATS,
  type ExperimentStatus,
} from "@/lib/domain/research";
import { BarRow, Btn, Panel, PanelHead, SectionHead, Tag, type Tone } from "@/components/tail/ui";

export const Route = createFileRoute("/lab")({ component: Lab });

const statusTone: Record<ExperimentStatus, Tone> = {
  Promote: "green",
  Review: "amber",
  Backtest: "blue",
  Reject: "amber",
};

function Lab() {
  const maxImportance = Math.max(...FEATURE_IMPORTANCE.map((f) => f.value));
  return (
    <>
      <SectionHead
        eyebrow="Research before production"
        title="Research & Model Lab"
        copy="Candidate models cannot enter production until they pass historical replay, calibration, stability, and promotion thresholds."
        action={
          <Btn
            onClick={() =>
              toast.success("Experiment EXP-185 created from production model v2.0.0.")
            }
          >
            New Experiment
          </Btn>
        }
      />
      <div className="grid gap-[18px] lg:grid-cols-[1.05fr_0.95fr]">
        <Panel>
          <PanelHead
            title="Active Experiments"
            subtitle="Versioned datasets, features, parameters, and decisions."
          />
          <div className="overflow-x-auto p-1">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {["Experiment", "Candidate", "Dataset", "Brier", "CLV", "Status"].map((h) => (
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
                {EXPERIMENTS.map((e) => (
                  <tr key={e.id}>
                    <td className="border-b border-line p-2.5 text-[10px]">
                      <strong className="text-navy">{e.id}</strong>
                      <br />
                      {e.title}
                    </td>
                    <td className="border-b border-line p-2.5 text-[10px]">{e.candidate}</td>
                    <td className="border-b border-line p-2.5 text-[10px]">{e.dataset}</td>
                    <td className="border-b border-line p-2.5 text-[10px]">{e.brier.toFixed(3)}</td>
                    <td className="border-b border-line p-2.5 text-[10px]">{pct(e.clv)}</td>
                    <td className="border-b border-line p-2.5 text-[10px]">
                      <Tag tone={statusTone[e.status]}>{e.status}</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Feature Importance"
            subtitle="Production moneyline ensemble · SHAP summary."
          />
          <div className="grid gap-2.5 p-3.5">
            {FEATURE_IMPORTANCE.map((f) => (
              <BarRow
                key={f.label}
                label={f.label}
                value={f.value.toFixed(1)}
                width={(f.value / maxImportance) * 100}
              />
            ))}
          </div>
        </Panel>
      </div>

      <section className="mt-[18px] grid gap-3.5 sm:grid-cols-3">
        <Card
          title="Backtest Coverage"
          metric={`${(LAB_STATS.backtestObservations / 1_000_000).toFixed(1)}M`}
          copy="Historical market observations evaluated without future-information leakage."
        />
        <Card
          title="Candidate Win Rate"
          metric={LAB_STATS.candidateWinRate}
          copy="Only one active candidate currently exceeds every production promotion gate."
        />
        <Card
          title="Dataset Version"
          metric={LAB_STATS.datasetVersion}
          copy="Immutable training snapshot with feature provenance and source-quality report."
        />
      </section>
    </>
  );
}

function Card({ title, metric, copy }: { title: string; metric: string; copy: string }) {
  return (
    <article className="rounded-[16px] border border-line bg-card p-4 shadow-[0_10px_27px_rgba(7,26,51,0.07)]">
      <h3 className="font-serif text-lg text-navy">{title}</h3>
      <div className="my-1 font-serif text-[28px] font-black text-navy">{metric}</div>
      <p className="text-[11px] leading-snug text-muted-foreground">{copy}</p>
    </article>
  );
}
