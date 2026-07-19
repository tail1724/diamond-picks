import { createFileRoute } from "@tanstack/react-router";
import { useSlate } from "@/lib/tail/context";
import { Btn, Panel, PanelHead, SectionHead, StatCard, Tag } from "@/components/tail/ui";

export const Route = createFileRoute("/ops")({ component: Ops });

function Ops() {
  const { slate, regenerate, regenerating } = useSlate();
  const status = slate.dataStatus;
  const fetchedAt = new Date(status.fetchedAt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const sourceRows = [
    {
      name: "MLB schedule",
      live: status.schedule === "live",
      detail: status.schedule === "live" ? `${slate.stats.gamesPriced} games loaded from MLB.` : "Using the authored fallback slate because MLB schedule data could not be reached.",
    },
    {
      name: "Sportsbook prices",
      live: status.odds === "live",
      detail: status.odds === "live" ? "Bookmaker-specific offers are available and the best price is preserved." : status.odds === "unconfigured" ? "THE_ODDS_API_KEY is not configured." : "The odds provider could not be reached; fallback prices are not published as plays.",
    },
    {
      name: "MLB live feed",
      live: status.liveFeedGames > 0,
      detail: `${status.liveFeedGames} started games returned live-feed data during the latest refresh.`,
    },
    {
      name: "Baseball Savant",
      live: status.savantGames > 0,
      detail: `${status.savantGames} started games returned Savant data during the latest refresh.`,
    },
  ];

  return (
    <>
      <SectionHead
        eyebrow="Admin"
        title="System Health"
        copy="This page reports only status that the application actually observed during the latest forecast refresh."
        action={<Btn variant="ghost" disabled={regenerating} onClick={regenerate}>{regenerating ? "Refreshing…" : "Refresh data"}</Btn>}
      />
      <section className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard label="Schedule" value={status.schedule === "live" ? "Live" : "Fallback"} note={fetchedAt} noteTone="muted" />
        <StatCard label="Odds" value={status.odds === "live" ? "Live" : "Limited"} note={status.odds} noteTone="muted" />
        <StatCard label="Latest run" value={`${(slate.stats.simMs / 1000).toFixed(2)}s`} note={`Run #${slate.runNumber}`} noteTone="muted" />
        <StatCard label="Published plays" value={slate.stats.recommendations} note={`${slate.stats.gamesPriced} games checked`} noteTone="muted" />
      </section>

      <Panel className="mt-[18px]">
        <PanelHead title="Observed data sources" subtitle={`Last refresh ${fetchedAt}`} />
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {sourceRows.map((row) => (
            <article key={row.name} className="rounded-[14px] border border-line bg-card p-4">
              <div className="flex items-center justify-between gap-2"><h3 className="font-black text-navy">{row.name}</h3><Tag tone={row.live ? "green" : "amber"}>{row.live ? "Available" : "Limited"}</Tag></div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{row.detail}</p>
            </article>
          ))}
        </div>
      </Panel>

      <div className="mt-[18px] rounded-[14px] border border-line bg-soft p-4 text-sm text-muted-foreground">
        Hosting uptime, database connection utilization, failed background jobs, and external SLA metrics are intentionally omitted until they are connected to real monitoring sources.
      </div>
    </>
  );
}
