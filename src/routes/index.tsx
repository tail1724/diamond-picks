import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Clock3, CircleDollarSign, ShieldAlert, Sparkles } from "lucide-react";
import { useSlate } from "@/lib/tail/context";
import { slateDateLabel } from "@/lib/tail/format";
import { GameCard } from "@/components/tail/GameCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today’s Best MLB Picks — TAIL Sports" },
      { name: "description", content: "The MLB picks we like most today, explained in plain English." },
    ],
  }),
  component: Today,
});

function Today() {
  const { slate } = useSlate();
  const recommendations = useMemo(
    () => [...slate.games]
      .filter((run) => run.headline.outcome === "recommend" && run.game.marketSource === "sportsbook")
      .sort((a, b) => b.headline.score - a.headline.score),
    [slate],
  );
  const watches = slate.games.filter((run) => run.headline.outcome === "monitor").length;
  const waiting = slate.games.filter((run) => run.game.marketSource !== "sportsbook" || run.game.lineupCertainty < 0.9).length;
  const best = recommendations[0];
  const secondary = recommendations.slice(1, 4);
  const fetchedAt = new Date(slate.dataStatus.fetchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const fullyLive = slate.dataStatus.schedule === "live" && slate.dataStatus.odds === "live";

  return (
    <>
      <section className="mb-5 rounded-[22px] bg-navy px-5 py-6 text-white sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-white/60">{slateDateLabel(slate.date)}</div>
            <h1 className="mt-2 max-w-3xl font-serif text-[clamp(34px,5vw,54px)] leading-[1.02]">
              {best ? `${recommendations.length} play${recommendations.length === 1 ? "" : "s"} worth your attention today` : "No forced plays today"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70">
              {best ? `The strongest spot is ${best.headline.selection} at ${best.headline.marketAmerican > 0 ? "+" : ""}${best.headline.marketAmerican}.` : "We checked the full board, but nothing with a verified price clears the bar right now."}
            </p>
          </div>
          <Link to="/games" className="rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-navy">See the full board →</Link>
        </div>
      </section>

      <section className="mb-[18px] grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[16px] border border-line bg-card p-4"><Sparkles className="h-5 w-5 text-brand-red" /><div className="mt-3 text-2xl font-black text-navy">{recommendations.length}</div><div className="text-xs text-muted-foreground">Playable picks</div></div>
        <div className="rounded-[16px] border border-line bg-card p-4"><Clock3 className="h-5 w-5 text-brand-amber" /><div className="mt-3 text-2xl font-black text-navy">{watches}</div><div className="text-xs text-muted-foreground">Worth watching</div></div>
        <div className="rounded-[16px] border border-line bg-card p-4"><ShieldAlert className="h-5 w-5 text-brand-blue" /><div className="mt-3 text-2xl font-black text-navy">{waiting}</div><div className="text-xs text-muted-foreground">Waiting on info</div></div>
        <div className="rounded-[16px] border border-line bg-card p-4"><CircleDollarSign className="h-5 w-5 text-edge" /><div className="mt-3 text-2xl font-black text-navy">{slate.stats.gamesPriced}</div><div className="text-xs text-muted-foreground">Games checked</div></div>
      </section>

      <div className={`mb-[18px] rounded-[14px] border px-4 py-3 text-sm ${fullyLive ? "border-edge/20 bg-edge/5" : "border-brand-amber/30 bg-brand-amber/10"}`}>
        <strong className="text-navy">{fullyLive ? "Live board" : "Limited data mode"}:</strong>{" "}
        {fullyLive
          ? `MLB schedule and sportsbook prices were refreshed at ${fetchedAt}.`
          : "Some prices or schedule data are unavailable. Estimated-price games are not shown as playable picks."}
      </div>

      {best ? (
        <>
          <div className="mb-3"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-red">Best bet</div><h2 className="mt-1 font-serif text-3xl text-navy">The strongest play on the board</h2></div>
          <GameCard run={best} featured />
          {secondary.length > 0 && (
            <section className="mt-7">
              <div className="mb-3"><div className="text-[11px] font-black uppercase tracking-[0.16em] text-brand-red">Also worth a look</div><h2 className="mt-1 font-serif text-3xl text-navy">The next-best spots</h2></div>
              <div className="grid gap-3">{secondary.map((run) => <GameCard key={run.game.id} run={run} />)}</div>
            </section>
          )}
        </>
      ) : (
        <div className="rounded-[18px] border border-dashed border-line bg-card p-10 text-center">
          <h2 className="font-serif text-2xl text-navy">Passing is a decision too</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">We will show a play when the matchup, confidence, and verified sportsbook price all line up. Until then, you can review the games that are close.</p>
          <Link to="/games" className="mt-5 inline-flex rounded-xl bg-navy px-4 py-2.5 text-sm font-extrabold text-white">See games worth watching</Link>
        </div>
      )}
    </>
  );
}
