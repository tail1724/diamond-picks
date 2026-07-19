import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useSlate } from "@/lib/tail/context";
import { slateDateLabel } from "@/lib/tail/format";
import { GameCard } from "@/components/tail/GameCard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Top Picks — TAIL Sports" },
      {
        name: "description",
        content:
          "Today's top MLB picks — the highest-confidence games from our simulation and Decision Engine.",
      },
    ],
  }),
  component: TopPicks,
});

function TopPicks() {
  const { slate } = useSlate();

  const picks = useMemo(
    () =>
      slate.games
        .filter((g) => g.headline.outcome === "recommend")
        .sort(
          (a, b) =>
            b.headline.gatesPassed - a.headline.gatesPassed ||
            b.headline.score - a.headline.score,
        )
        .slice(0, 5),
    [slate],
  );

  return (
    <>
      <section className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-red">
            {slateDateLabel(slate.date)}
          </div>
          <h1 className="mt-1 font-serif text-[clamp(30px,4vw,44px)] leading-tight text-navy">
            Top Picks Today
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The highest-confidence games from today's slate — filtered through our Decision Engine.
          </p>
        </div>
        <Link
          to="/games"
          className="inline-flex items-center rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm font-extrabold text-navy transition hover:-translate-y-px"
        >
          See all games →
        </Link>
      </section>

      {picks.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-line bg-card p-8 text-center text-sm text-muted-foreground">
          No qualifying top picks today. Check{" "}
          <Link to="/games" className="font-bold text-navy underline">
            all games
          </Link>{" "}
          for the full slate.
        </div>
      ) : (
        <div className="grid gap-3">
          {picks.map((run) => (
            <GameCard key={run.game.id} run={run} />
          ))}
        </div>
      )}
    </>
  );
}
