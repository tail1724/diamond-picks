import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { pct, signedPct } from "@/lib/tail/format";
import { MODELS, type ModelStatus } from "@/lib/domain/research";
import { getRunHistoryFn, type RunHistoryRow } from "@/lib/tail/persist";
import { Btn, DataRow, Panel, PanelHead, SectionHead, Tag, type Tone } from "@/components/tail/ui";

export const Route = createFileRoute("/models")({ component: Models });

const statusTone: Record<ModelStatus, Tone> = {
  Active: "green",
  Candidate: "blue",
  Retired: "amber",
};

function RunHistory() {
  const [rows, setRows] = useState<RunHistoryRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    getRunHistoryFn()
      .then((r) => setRows(r))
      .catch(() => setFailed(true));
  }, []);
  return (
    <Panel className="mt-[18px]">
      <PanelHead
        title="Run History"
        subtitle="Immutable forecast-run versions from Supabase (insert-only; PRD FR-002, SEC-002)."
      />
      <div className="overflow-x-auto p-1">
        {rows === null && !failed && (
          <div className="p-3.5 text-[11px] text-muted-foreground">Loading versioned runs…</div>
        )}
        {failed && (
          <div className="p-3.5 text-[11px] text-muted-foreground">Run history unavailable.</div>
        )}
        {rows && rows.length > 0 && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {[
                  "Run",
                  "Model",
                  "Recs",
                  "Parlays",
                  "Avg Edge",
                  "Calibration",
                  "Initiator",
                  "Status",
                ].map((h) => (
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
              {rows.map((r) => (
                <tr key={r.run_number}>
                  <td className="border-b border-line p-2.5 text-[11px] font-black text-navy">
                    #{r.run_number}
                  </td>
                  <td className="border-b border-line p-2.5 text-[11px]">{r.model_version}</td>
                  <td className="border-b border-line p-2.5 text-[11px]">{r.recommendations}</td>
                  <td className="border-b border-line p-2.5 text-[11px]">{r.qualified_parlays}</td>
                  <td className="border-b border-line p-2.5 text-[11px]">
                    {signedPct(r.avg_edge ?? 0)}
                  </td>
                  <td className="border-b border-line p-2.5 text-[11px]">{r.calibration_index}</td>
                  <td className="border-b border-line p-2.5 text-[11px] capitalize">
                    {r.initiator}
                  </td>
                  <td className="border-b border-line p-2.5 text-[11px]">
                    <Tag tone="green">{r.status}</Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Panel>
  );
}

function Models() {
  const [selected, setSelected] = useState(MODELS[0].version);
  const model = MODELS.find((m) => m.version === selected) ?? MODELS[0];
  return (
    <>
      <SectionHead
        eyebrow="Reproducibility and governance"
        title="Model Registry"
        copy="Immutable model records connect every prediction to its dataset, features, parameters, validation metrics, and rollback target."
        action={
          <Btn onClick={() => toast.success("Candidate queued for final promotion-gate review.")}>
            Promote Candidate
          </Btn>
        }
      />
      <div className="grid gap-[18px] lg:grid-cols-2">
        <Panel>
          <PanelHead title="Registered Models" subtitle="Production and candidate lifecycle." />
          <div className="grid gap-2 p-3.5">
            {MODELS.map((m) => (
              <button
                key={m.version}
                onClick={() => setSelected(m.version)}
                className={`flex items-center justify-between gap-2.5 rounded-[11px] px-2.5 py-2.5 text-left transition ${
                  m.version === selected
                    ? "bg-navy/10 ring-1 ring-navy/20"
                    : "bg-soft hover:bg-navy/5"
                }`}
              >
                <div>
                  <strong className="text-navy">{m.version}</strong>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                    {m.note}
                  </div>
                </div>
                <Tag tone={statusTone[m.status]}>{m.status}</Tag>
              </button>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Selected Model Metadata" subtitle={model.version} />
          <div className="grid gap-2 p-3.5">
            <DataRow label="Parent version" value={model.parent} />
            <DataRow label="Training dataset" value={model.dataset} />
            <DataRow label="Feature set" value={model.featureSet} />
            <DataRow label="Moneyline Brier" value={model.brier.toFixed(3)} />
            <DataRow label="Average CLV" value={pct(model.clv)} />
            <DataRow label="Rollback target" value={model.rollback} />
            <DataRow label="Promotion date" value={model.promoted} />
            <DataRow label="Approval" value={model.approval} />
          </div>
        </Panel>
      </div>
      <RunHistory />
    </>
  );
}
