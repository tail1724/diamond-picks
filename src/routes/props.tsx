import { createFileRoute } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSlate } from "@/lib/tail/context";
import { formatAmerican, pct, pickStrength, payoutForStake } from "@/lib/tail/format";
import type { MarketDecision } from "@/lib/engines/decision";
import { Panel, PanelHead, SectionHead, Tag } from "@/components/tail/ui";

export const Route = createFileRoute("/props")({ component: PlayerProps });

function PropList({ decisions }: { decisions: MarketDecision[] }) {
  const { savePick, removePick, isSaved, slate } = useSlate();
  if (!decisions.length) {
    return (
      <div className="p-7 text-center">
        <h3 className="font-serif text-xl text-navy">No verified player prices yet</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Today’s live feed currently includes game lines only. Player picks will appear when the sportsbook feed supplies a price we can verify.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2 p-3.5">
      {decisions.map((decision) => {
        const run = slate.games.find((game) => game.game.id === decision.gameId);
        const saved = isSaved(decision.gameId, decision.legId);
        const playable = decision.outcome === "recommend" && run?.game.marketSource === "sportsbook";
        return (
          <article key={`${decision.gameId}-${decision.legId}`} className="grid gap-3 rounded-[14px] border border-line bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-black text-navy">{decision.selection}</h3>
                <Tag tone={playable ? "green" : decision.outcome === "monitor" ? "amber" : "navy"}>
                  {playable ? pickStrength(decision.score) : decision.outcome === "monitor" ? "Watch" : "Pass"}
                </Tag>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {pct(decision.modelProb, 0)} confidence · {formatAmerican(decision.marketAmerican)} · $10 wins ${payoutForStake(10, decision.marketAmerican).toFixed(2)}
              </p>
            </div>
            <button
              disabled={!playable}
              onClick={() => saved ? removePick(`${decision.gameId}:${decision.legId}`) : savePick(decision)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm font-extrabold text-navy disabled:opacity-45"
            >
              {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              {saved ? "Saved" : playable ? "Add to My Card" : "Not playable"}
            </button>
          </article>
        );
      })}
    </div>
  );
}

function PlayerProps() {
  const { slate } = useSlate();
  const all = slate.games.flatMap((game) => game.decisions);
  const pitcher = all
    .filter((decision) => decision.kind === "pitcher_k" || decision.kind === "pitcher_er")
    .sort((a, b) => b.score - a.score);
  const hitter = all.filter((decision) => decision.kind === "hitter_tb").sort((a, b) => b.score - a.score);

  return (
    <>
      <SectionHead
        eyebrow="Player picks"
        title="Pitchers and hitters"
        copy="Only player markets with an available price appear here. No made-up lines and no forced recommendations."
      />
      <div className="grid gap-[18px]">
        <Panel>
          <PanelHead title="Pitcher picks" subtitle={pitcher.length ? `${pitcher.length} prices checked` : "Waiting on sportsbook prop prices"} />
          <PropList decisions={pitcher} />
        </Panel>
        <Panel>
          <PanelHead title="Hitter picks" subtitle={hitter.length ? `${hitter.length} prices checked` : "Waiting on sportsbook prop prices"} />
          <PropList decisions={hitter} />
        </Panel>
      </div>
    </>
  );
}
