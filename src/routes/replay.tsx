import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { REPLAY_SLATES, type ReplayStatus } from "@/lib/domain/research";
import { Btn, Panel, PanelHead, SectionHead, Tag, type Tone } from "@/components/tail/ui";

export const Route = createFileRoute("/replay")({ component: Replay });

const statusTone: Record<ReplayStatus, Tone> = {
  Complete: "green",
  Ready: "blue",
  "Partial odds": "amber",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[9px] font-black uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select className="w-full rounded-[10px] border border-line bg-card px-3 py-2.5 text-ink">
        {children}
      </select>
    </div>
  );
}

function Replay() {
  return (
    <>
      <SectionHead
        eyebrow="Leakage-safe validation"
        title="Replay Lab"
        copy="Reconstruct archived slates using only the data that was available at the selected historical cutoff (PRD DATA-003)."
        action={
          <Btn
            onClick={() => toast.success("Historical replay job created with leakage-safe cutoff.")}
          >
            Start Replay
          </Btn>
        }
      />
      <div className="grid items-start gap-[18px] lg:grid-cols-[minmax(0,1.62fr)_minmax(315px,0.78fr)]">
        <Panel>
          <PanelHead
            title="Available Slates"
            subtitle="Snapshots include data, model, feature, market, and simulation versions."
          />
          <div className="grid gap-2.5 p-3.5">
            {REPLAY_SLATES.map((s) => (
              <div
                key={s.date}
                className="flex items-center justify-between gap-2.5 rounded-[11px] bg-soft px-2.5 py-2.5"
              >
                <div>
                  <strong className="text-navy">{s.date}</strong>
                  <div className="text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                    {s.games} games · Snapshot {s.snapshot}
                  </div>
                </div>
                <Tag tone={statusTone[s.status]}>{s.status}</Tag>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Replay Configuration"
            subtitle="Compare production and candidate models."
          />
          <div className="grid gap-2.5 p-3.5">
            <Field label="Historical cutoff">
              <option>60 minutes before first pitch</option>
              <option>Opening market</option>
              <option>Confirmed lineups</option>
            </Field>
            <Field label="Model comparison">
              <option>v2.0.0 vs v2.1.0-rc2</option>
              <option>v2.0.0 vs v1.9.3</option>
            </Field>
            <Field label="Markets">
              <option>All supported markets</option>
              <option>Moneyline only</option>
              <option>Props only</option>
            </Field>
          </div>
        </Panel>
      </div>
    </>
  );
}
