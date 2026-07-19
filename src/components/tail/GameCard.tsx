import { Link } from "@tanstack/react-router";
import { Bookmark, BookmarkCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { team } from "@/lib/domain/teams";
import { pitcher } from "@/lib/domain/slate";
import type { GameRun } from "@/lib/engines/pipeline";
import { formatAmerican, pct, pickStrength, payoutForStake } from "@/lib/tail/format";
import { useSlate } from "@/lib/tail/context";

function TeamLine({ code, pitcherId }: { code: string; pitcherId: string }) {
  const t = team(code);
  const p = pitcher(pitcherId);
  return (
    <div>
      <div className="font-black text-navy">{t.city} {t.name}</div>
      <div className="text-xs text-muted-foreground">{p.name} · {p.hand}HP</div>
    </div>
  );
}

export function GameCard({ run, featured = false }: { run: GameRun; featured?: boolean }) {
  const { game, headline, explanation } = run;
  const { savePick, removePick, isSaved } = useSlate();
  const saved = isSaved(game.id, headline.legId);
  const actionable = headline.outcome === "recommend" && game.marketSource === "sportsbook";
  const label = actionable ? pickStrength(headline.score) : headline.outcome === "monitor" ? "Worth Watching" : "Pass";
  const offer = game.markets.find((quote) =>
    `${quote.kind}:${quote.side}:${quote.line ?? ""}:${quote.playerId ?? ""}` === headline.legId,
  );
  const bookmaker = offer?.bookmaker;
  const profit = payoutForStake(10, headline.marketAmerican);

  return (
    <article className={cn("relative overflow-hidden rounded-[18px] border bg-paper p-5 shadow-[0_10px_27px_rgba(7,26,51,0.07)]", featured ? "border-brand-red/40" : "border-line")}>
      <div className={cn("absolute inset-y-0 left-0 w-1.5", actionable ? "bg-brand-red" : headline.outcome === "monitor" ? "bg-brand-amber" : "bg-navy/40")} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-bold text-muted-foreground">
            {game.awayCode} at {game.homeCode} · {game.startTimeET} · {game.venue}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide", actionable ? "bg-brand-red/10 text-brand-red" : headline.outcome === "monitor" ? "bg-brand-amber/10 text-brand-amber" : "bg-navy/8 text-navy")}>
              {label}
            </span>
            <span className="text-xs text-muted-foreground">
              {game.lineupCertainty >= 0.9 ? "Lineups confirmed" : "Lineups projected"}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Current price</div>
          <div className="font-serif text-2xl font-black text-navy">{formatAmerican(headline.marketAmerican)}</div>
          <div className="text-[11px] text-muted-foreground">{bookmaker ? `Best at ${bookmaker}` : game.marketSource === "sportsbook" ? "Live market" : "Estimated price"}</div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-muted-foreground">The play</div>
          <h2 className="mt-1 font-serif text-[clamp(25px,3vw,34px)] leading-tight text-navy">{headline.selection}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/80">{explanation.whyItQualifies}</p>
        </div>
        <div className="grid min-w-[190px] grid-cols-2 gap-2 rounded-[14px] bg-soft p-3">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Our confidence</div>
            <div className="mt-1 text-xl font-black text-navy">{pct(headline.modelProb, 0)}</div>
          </div>
          <div>
            <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">$10 wins</div>
            <div className="mt-1 text-xl font-black text-navy">${profit.toFixed(2)}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-brand-amber/20 bg-brand-amber/5 px-3 py-2.5 text-sm text-foreground/75">
        <strong className="text-navy">What could go wrong:</strong> {explanation.keyRisk.replace(/^What could go wrong:\s*/i, "")}
      </div>

      <details className="mt-3 rounded-xl border border-line bg-card px-3 py-2.5 text-sm">
        <summary className="cursor-pointer font-extrabold text-navy">See the numbers</summary>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div><span className="block text-muted-foreground">Our price</span><b>{formatAmerican(headline.fairAmerican)}</b></div>
          <div><span className="block text-muted-foreground">Sportsbook chance</span><b>{pct(headline.modelProb - headline.edge, 0)}</b></div>
          <div><span className="block text-muted-foreground">Value gap</span><b>{pct(headline.edge, 1)}</b></div>
          <div><span className="block text-muted-foreground">Info confidence</span><b>{pct(game.dataQuality, 0)}</b></div>
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <TeamLine code={game.awayCode} pitcherId={game.awayPitcherId} />
          <span className="font-black">vs.</span>
          <TeamLine code={game.homeCode} pitcherId={game.homePitcherId} />
        </div>
        <div className="flex gap-2">
          <button
            disabled={!actionable}
            onClick={() => saved ? removePick(`${game.id}:${headline.legId}`) : savePick(headline)}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm font-extrabold text-navy disabled:cursor-not-allowed disabled:opacity-45"
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saved ? "Saved" : actionable ? "Add to My Card" : "Not playable yet"}
          </button>
          <Link
            to="/pick/$gameId"
            params={{ gameId: game.id }}
            className="inline-flex items-center gap-1 rounded-xl bg-navy px-3.5 py-2.5 text-sm font-extrabold text-white"
          >
            Full breakdown <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  );
}
