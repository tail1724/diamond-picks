import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSlate } from "@/lib/tail/context";
import { slateDateLabel } from "@/lib/tail/format";
import { GameCard } from "@/components/tail/GameCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "All Games — TAIL Sports" },
      {
        name: "description",
        content: "Every MLB game on today's slate with model prediction, edge, and decision.",
      },
    ],
  }),
  component: AllGames,
});

type Filter = "all" | "recommend" | "monitor";

function AllGames() {
  const { slate } = useSlate();
  const [filter, setFilter] = useState<Filter>("all");

  const games = useMemo(() => {
    const sorted = [...slate.games].sort((a, b) =>
      a.game.startTimeET.localeCompare(b.game.startTimeET),
    );
    if (filter === "all") return sorted;
    return sorted.filter((g) => g.headline.outcome === filter);
  }, [slate, filter]);

  const counts = useMemo(
    () => ({
      all: slate.games.length,
      recommend: slate.games.filter((g) => g.headline.outcome === "recommend").length,
      monitor: slate.games.filter((g) => g.headline.outcome === "monitor").length,
    }),
    [slate],
  );

  const chips: { key: Filter; label: string }[] = [
    { key: "all", label: `All (${counts.all})` },
    { key: "recommend", label: `Recommended (${counts.recommend})` },
    { key: "monitor", label: `Monitor (${counts.monitor})` },
  ];

  return (
    <>
      <section className="mb-5">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-red">
          {slateDateLabel(slate.date)}
        </div>
        <h1 className="mt-1 font-serif text-[clamp(30px,4vw,44px)] leading-tight text-navy">
          All Games
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every game on today's slate with a model prediction, sorted by start time.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={cn(
                "rounded-full border border-line px-3 py-1.5 text-xs font-extrabold transition",
                filter === c.key
                  ? "bg-navy text-white"
                  : "bg-card text-navy hover:bg-soft",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {games.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-line bg-card p-8 text-center text-sm text-muted-foreground">
          No games match this filter.
        </div>
      ) : (
        <div className="grid gap-3">
          {games.map((run) => (
            <GameCard key={run.game.id} run={run} />
          ))}
        </div>
      )}
    </>
  );
}