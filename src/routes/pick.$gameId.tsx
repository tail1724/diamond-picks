import { createFileRoute, Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useSlate } from "@/lib/tail/context";
import { formatAmerican, pct, pickStrength, payoutForStake } from "@/lib/tail/format";
import { team } from "@/lib/domain/teams";
import { pitcher } from "@/lib/domain/slate";
import { Panel, PanelHead, SectionHead, Tag } from "@/components/tail/ui";

export const Route = createFileRoute("/pick/$gameId")({ component: PickDetail });

function PickDetail() {
  const { gameId } = Route.useParams();
  const { slate, savePick, removePick, isSaved } = useSlate();
  const run = slate.games.find((item) => item.game.id === gameId);

  if (!run) {
    return (
      <div className="rounded-[18px] border border-dashed border-line bg-card p-10 text-center">
        <h1 className="font-serif text-3xl text-navy">This pick is no longer on today’s board</h1>
        <Link to="/games" className="mt-4 inline-flex rounded-xl bg-navy px-4 py-2.5 text-sm font-extrabold text-white">See every game</Link>
      </div>
    );
  }

  const { game, headline, explanation, decisions } = run;
  const saved = isSaved(game.id, headline.legId);
  const actionable = headline.outcome === "recommend" && game.marketSource === "sportsbook";
  const away = team(game.awayCode);
  const home = team(game.homeCode);
  const awayPitcher = pitcher(game.awayPitcherId);
  const homePitcher = pitcher(game.homePitcherId);

  return (
    <>
      <Link to="/" className="mb-4 inline-flex text-sm font-bold text-navy">← Back to today</Link>
      <SectionHead
        eyebrow={`${game.awayCode} at ${game.homeCode} · ${game.startTimeET}`}
        title={headline.selection}
        copy={`${pickStrength(headline.score)} · ${formatAmerican(headline.marketAmerican)} · ${pct(headline.modelProb, 0)} confidence`}
        action={
          <button
            disabled={!actionable}
            onClick={() => saved ? removePick(`${game.id}:${headline.legId}`) : savePick(headline)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-45"
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saved ? "Saved" : "Add to My Card"}
          </button>
        }
      />

      <div className="grid gap-[18px] lg:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <PanelHead title="The simple case" subtitle="Why this play made the board" />
          <div className="space-y-4 p-5">
            <p className="text-base leading-relaxed text-foreground/85">{explanation.whyItQualifies}</p>
            <div className="rounded-xl border border-brand-amber/20 bg-brand-amber/5 p-4 text-sm leading-relaxed">
              <strong className="text-navy">What could change our mind:</strong> {explanation.keyRisk.replace(/^What could go wrong:\s*/i, "")}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-soft p-3"><span className="text-xs text-muted-foreground">Current price</span><b className="mt-1 block text-xl text-navy">{formatAmerican(headline.marketAmerican)}</b></div>
              <div className="rounded-xl bg-soft p-3"><span className="text-xs text-muted-foreground">Our confidence</span><b className="mt-1 block text-xl text-navy">{pct(headline.modelProb, 0)}</b></div>
              <div className="rounded-xl bg-soft p-3"><span className="text-xs text-muted-foreground">$10 wins</span><b className="mt-1 block text-xl text-navy">${payoutForStake(10, headline.marketAmerican).toFixed(2)}</b></div>
              <div className="rounded-xl bg-soft p-3"><span className="text-xs text-muted-foreground">Lineup status</span><b className="mt-1 block text-sm text-navy">{game.lineupCertainty >= 0.9 ? "Confirmed" : "Projected"}</b></div>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Matchup" subtitle={`${game.venue}`} />
          <div className="grid gap-3 p-5">
            <div className="rounded-xl bg-soft p-4"><b className="text-navy">{away.city} {away.name}</b><div className="mt-1 text-sm text-muted-foreground">Starter: {awayPitcher.name}</div></div>
            <div className="rounded-xl bg-soft p-4"><b className="text-navy">{home.city} {home.name}</b><div className="mt-1 text-sm text-muted-foreground">Starter: {homePitcher.name}</div></div>
            <div className="rounded-xl border border-line p-4 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Price source</span><b>{game.marketSource === "sportsbook" ? "Live sportsbook" : "Estimated"}</b></div>
              <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Info confidence</span><b>{pct(game.dataQuality, 0)}</b></div>
              <div className="mt-2 flex justify-between"><span className="text-muted-foreground">Weather</span><b>{game.weather.windDir === "weather feed pending" ? "Pending" : `${game.weather.tempF}°F`}</b></div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-[18px]">
        <PanelHead title="Other ways to play this game" subtitle="Ranked from strongest to weakest" />
        <div className="grid gap-2 p-4">
          {decisions.slice(0, 6).map((decision) => (
            <div key={decision.legId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-soft p-3">
              <div><b className="text-navy">{decision.selection}</b><div className="text-xs text-muted-foreground">{pct(decision.modelProb, 0)} confidence · {formatAmerican(decision.marketAmerican)}</div></div>
              <Tag tone={decision.outcome === "recommend" ? "green" : decision.outcome === "monitor" ? "amber" : "navy"}>
                {decision.outcome === "recommend" ? "Play" : decision.outcome === "monitor" ? "Watch" : "Pass"}
              </Tag>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
