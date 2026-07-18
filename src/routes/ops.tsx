import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSlate } from "@/lib/tail/context";
import { Btn, SectionHead, StatCard, Tag, type Tone } from "@/components/tail/ui";

export const Route = createFileRoute("/ops")({ component: Ops });

function Ops() {
  const { slate } = useSlate();
  const s = slate.stats;
  const simSecs = (s.simMs / 1000).toFixed(2);

  const contexts: Array<{ name: string; tone: Tone; status: string; detail: string }> = [
    {
      name: "Data Ingestion",
      tone: "green",
      status: "Healthy",
      detail: "Schedule, weather, lineup, injury, Statcast, and odds adapters current.",
    },
    {
      name: "Feature Store",
      tone: "green",
      status: "Healthy",
      detail: "4,284 features materialized; 99.7% completeness.",
    },
    {
      name: "TAIL Sports Forecast Engine",
      tone: "green",
      status: "Healthy",
      detail: `${s.gamesPriced} games and ${s.playerMarkets} player markets priced.`,
    },
    {
      name: "TAIL Sports Simulation Engine",
      tone: "green",
      status: "Healthy",
      detail: `${(s.totalSimulations / 1_000_000).toFixed(1)} million simulations completed in ${simSecs}s.`,
    },
    {
      name: "TAIL Sports Decision Engine",
      tone: "green",
      status: "Healthy",
      detail: `${s.recommendations} recommendations passed; ${s.monitored} monitored; ${s.rejected} rejected.`,
    },
    {
      name: "TAIL Sports Parlay Engine",
      tone: "green",
      status: "Healthy",
      detail: `${s.qualifiedParlays} parlays qualified from ${s.candidateParlays} candidate combinations.`,
    },
    {
      name: "TAIL Sports Explanation Engine",
      tone: "amber",
      status: "Degraded",
      detail: "Two explanations using cached output after API latency spike.",
    },
    {
      name: "Analytics",
      tone: "green",
      status: "Healthy",
      detail: "Results, CLV, calibration, and parlay performance current.",
    },
  ];

  return (
    <>
      <SectionHead
        eyebrow="Lean open-source operations"
        title="TAIL Sports Ops"
        copy="Operational visibility is concentrated in DigitalOcean, Supabase, and this internal dashboard—without a heavyweight observability stack."
        action={
          <Btn
            variant="ghost"
            onClick={() =>
              toast.success("Platform health refreshed from application and database metrics.")
            }
          >
            Refresh Health
          </Btn>
        }
      />
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          label="App Availability"
          value="99.9%"
          note="DigitalOcean App Platform"
          noteTone="muted"
        />
        <StatCard label="DB Connections" value="18%" note="Supabase healthy" noteTone="muted" />
        <StatCard label="Last Run" value={`${simSecs}s`} note="Completed successfully" />
        <StatCard label="Data Freshness" value="3 min" note="Within SLA" />
        <StatCard label="Failed Jobs" value="0" note="Past 24 hours" />
      </section>

      <div className="mb-3 mt-[18px]">
        <h2 className="font-serif text-[28px] text-navy">Bounded Contexts</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Independent module health inside the modular monolith.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {contexts.map((c) => (
          <article key={c.name} className="rounded-[14px] border border-line bg-card p-3.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[13px] font-black text-navy">{c.name}</h3>
              <Tag tone={c.tone}>{c.status}</Tag>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">{c.detail}</p>
          </article>
        ))}
      </div>
    </>
  );
}
