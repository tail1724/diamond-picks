import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { useSlate } from "@/lib/tail/context";
import { Btn, DataRow, Panel, PanelHead, SectionHead } from "@/components/tail/ui";

export const Route = createFileRoute("/settings")({ component: Settings });

function ToggleRow({
  label,
  desc,
  defaultOn,
}: {
  label: string;
  desc: string;
  defaultOn?: boolean;
}) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[11px] bg-soft px-3 py-2.5">
      <div>
        <div className="text-[12px] font-black text-navy">{label}</div>
        <div className="text-[10px] text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={on} onCheckedChange={setOn} />
    </div>
  );
}

function NumberRow({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const [v, setV] = useState(value);
  return (
    <div className="flex items-center justify-between gap-3 rounded-[11px] bg-soft px-3 py-2">
      <div className="text-[12px] font-black text-navy">{label}</div>
      <div className="flex items-center gap-1.5">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="w-20 rounded-lg border border-line bg-card px-2 py-1.5 text-right text-[12px] text-ink"
        />
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function Settings() {
  const { slate } = useSlate();
  return (
    <>
      <SectionHead
        eyebrow="Configuration and governance"
        title="Settings"
        copy="Decision gates, simulation configuration, notifications, and responsible-product controls. Threshold changes are versioned and audited (PRD §13.2)."
        action={
          <Btn
            onClick={() =>
              toast.success("Configuration saved", {
                description: "Change recorded to the audit log.",
              })
            }
          >
            Save Changes
          </Btn>
        }
      />
      <div className="grid gap-[18px] lg:grid-cols-2">
        <Panel>
          <PanelHead
            title="Decision Engine Gates"
            subtitle="Thresholds a market must clear to be recommended."
          />
          <div className="grid gap-2 p-3.5">
            <NumberRow label="Minimum probability" value="53" suffix="%" />
            <NumberRow label="Minimum edge" value="3.0" suffix="%" />
            <NumberRow label="Minimum expected value" value="2.0" suffix="%" />
            <NumberRow label="Gates required (of 6)" value="5" />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Simulation Configuration"
            subtitle="Production Monte Carlo parameters."
          />
          <div className="grid gap-2 p-3.5">
            <NumberRow label="Simulations per game" value="100000" />
            <DataRow label="Deterministic seed policy" value="Stored per run" />
            <DataRow label="Current run seed" value={String(slate.seed)} />
            <DataRow label="Simulation config" value={slate.lineage.simulationConfig} />
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Notifications" subtitle="Alerting for runs and opportunities." />
          <div className="grid gap-2 p-3.5">
            <ToggleRow
              label="Run completion"
              desc="Notify when a production forecast finishes."
              defaultOn
            />
            <ToggleRow
              label="New recommendations"
              desc="Alert on newly qualified recommendations."
              defaultOn
            />
            <ToggleRow
              label="Data freshness warnings"
              desc="Warn when critical inputs go stale."
              defaultOn
            />
            <ToggleRow
              label="Model drift review"
              desc="Flag when calibration crosses thresholds."
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Governance & Responsible Product"
            subtitle="Framing, access, and compliance."
          />
          <div className="grid gap-2 p-3.5">
            <ToggleRow
              label="Probabilistic framing"
              desc="Present forecasts as probabilities, never guarantees."
              defaultOn
            />
            <ToggleRow
              label="Responsible-gaming controls"
              desc="Show risk disclosures on public surfaces."
              defaultOn
            />
            <DataRow label="Active role" value="Administrator" />
            <DataRow label="Immutable prediction history" value="Enforced" />
          </div>
        </Panel>
      </div>
    </>
  );
}
