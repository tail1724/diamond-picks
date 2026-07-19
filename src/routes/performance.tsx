import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock3, LockKeyhole } from "lucide-react";
import { Panel, PanelHead, SectionHead } from "@/components/tail/ui";

export const Route = createFileRoute("/performance")({ component: Results });

function Results() {
  return (
    <>
      <SectionHead
        eyebrow="Transparent tracking"
        title="Verified Results"
        copy="This page will show only picks that were published with a timestamped price and settled against an official MLB result."
      />

      <div className="rounded-[18px] border border-brand-amber/30 bg-brand-amber/10 p-5">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-brand-amber" />
          <div>
            <h2 className="font-black text-navy">Verified settlement history is not live yet</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-foreground/75">
              We removed the demonstration ROI and win-rate numbers from the public app. Results will appear here after published picks are stored with their exact price, automatically settled, and independently reproducible.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-[18px] grid gap-[18px] lg:grid-cols-3">
        <Panel>
          <PanelHead title="1. Publish" subtitle="Lock the original recommendation" />
          <div className="p-5 text-sm leading-relaxed text-muted-foreground">
            <LockKeyhole className="mb-3 h-6 w-6 text-brand-red" />
            Every counted pick must include the selection, exact sportsbook price, model confidence, and publication time.
          </div>
        </Panel>
        <Panel>
          <PanelHead title="2. Settle" subtitle="Use the official result" />
          <div className="p-5 text-sm leading-relaxed text-muted-foreground">
            <CheckCircle2 className="mb-3 h-6 w-6 text-edge" />
            Picks will be graded from official MLB game data. Postponements, pushes, and void markets will be handled explicitly.
          </div>
        </Panel>
        <Panel>
          <PanelHead title="3. Report" subtitle="Show the whole record" />
          <div className="p-5 text-sm leading-relaxed text-muted-foreground">
            Results will include record, units, average price, sample size, and a complete pick-by-pick history—not just winning screenshots.
          </div>
        </Panel>
      </div>

      <div className="mt-[18px] rounded-[18px] border border-line bg-card p-6 text-center">
        <h2 className="font-serif text-2xl text-navy">Today’s board is still available</h2>
        <p className="mt-2 text-sm text-muted-foreground">Review current picks while the verified results pipeline is being populated.</p>
        <Link to="/" className="mt-4 inline-flex rounded-xl bg-navy px-4 py-2.5 text-sm font-extrabold text-white">See today’s picks</Link>
      </div>
    </>
  );
}
