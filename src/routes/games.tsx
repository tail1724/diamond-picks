import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSlate } from "@/lib/tail/context";
import { slateDateLabel } from "@/lib/tail/format";
import { GameCard } from "@/components/tail/GameCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/games")({
  head: () => ({
    meta: [
      { title: "Every MLB Game — TAIL Sports" },
      { name: "description", content: "Every MLB game today, organized by what is playable, worth watching, or waiting on more information." },
    ],
  }),
  component: AllGames,
});

type Filter = "all" | "play" | "watch" | "waiting";

function AllGames() {
  const { slate } = useSlate();
  const [filter, setFilter] = useState<Filter>("all");

  const stateFor = (run: (typeof slate.games)[number]): Exclude<Filter, "all"> => {
    if (run.game.marketSource !== "sportsbook" || run.game.lineupCertainty < 0.75) return "waiting";
    if (run.headline.outcome === "recommend") return "play";
    return "watch";
  };

  const games = useMemo(() => {
    const rank: Record<Exclude<Filter, "all">, number> = { play: 0, watch: 1, waiting: 2 };
    const sorted = [...slate.games].sort(
      (a, b) => rank[stateFor(a)] - rank[stateFor(b)] || b.headline.score - a.headline.score,
    );
    return filter === "all" ? sorted : sorted.filter((run) => stateFor(run) === filter);
  }, [slate, filter]);

  const counts = {
    all: slate.games.length,
    play: slate.games.filter((run) => stateFor(run) === "play").length,
    watch: slate.games.filter((run) => stateFor(run) === "watch").length,
    waiting: slate.games.filter((run) => stateFor(run) === "waiting").length,
  };

  const chips: Array<{ key: Filter; label: string }> = [
    { key: "all", label: `Every game (${counts.all})` },
    { key: "play", label: `Playable (${counts.play})` },
    { key: "watch", label: `Worth watching (${counts.watch})` },
    { key: "waiting", label: `Waiting on info (${counts.waiting})` },
  ];

  return (
    <>
      <section className="mb-5">
        <div className="text-[11px] font-black uppercase tracking-[0.18em] text-brand-red">{slateDateLabel(slate.date)}</div>
        <h1 className="mt-1 font-serif text-[clamp(30px,4vw,44px)] leading-tight text-navy">Every Game Today</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Start with verified plays, then see what is close and which games still need a price or lineup update.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => setFilter(chip.key)}
              className={cn(
                "rounded-full border border-line px-3 py-1.5 text-xs font-extrabold transition",
                filter === chip.key ? "bg-navy text-white" : "bg-card text-navy hover:bg-soft",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      {games.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-line bg-card p-8 text-center text-sm text-muted-foreground">
          Nothing fits this view right now. Try another filter or refresh the board.
        </div>
      ) : (
        <div className="grid gap-3">{games.map((run) => <GameCard key={run.game.id} run={run} />)}</div>
      )}
    </>
  );
}
