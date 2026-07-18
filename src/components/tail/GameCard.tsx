import { cn } from "@/lib/utils";
import { team } from "@/lib/domain/teams";
import { pitcher } from "@/lib/domain/slate";
import type { GameRun } from "@/lib/engines/pipeline";
import { formatAmerican, pct, signedPct } from "@/lib/tail/format";
import { Explanation, Grade } from "./ui";

function TeamSide({
  code,
  pitcherId,
  side,
}: {
  code: string;
  pitcherId: string;
  side: "home" | "away";
}) {
  const t = team(code);
  const p = pitcher(pitcherId);
  const badge = (
    <div
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-full border-[3px] border-[#d9e1ea] font-serif text-[12px] font-black text-white",
        side === "home" ? "bg-brand-red" : "bg-navy",
      )}
    >
      {code}
    </div>
  );
  const info = (
    <div className={side === "away" ? "text-right" : ""}>
      <div className="font-black leading-tight text-navy">
        {t.city} {t.name}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">
        {p.name} · {p.hand}HP
      </div>
    </div>
  );
  return (
    <div className={cn("flex items-center gap-2.5", side === "away" && "justify-end")}>
      {side === "away" ? (
        <>
          {info}
          {badge}
        </>
      ) : (
        <>
          {badge}
          {info}
        </>
      )}
    </div>
  );
}

function Cell({
  label,
  children,
  edge,
}: {
  label: string;
  children: React.ReactNode;
  edge?: boolean;
}) {
  return (
    <div className="rounded-[11px] bg-soft p-2.5">
      <div className="text-[9px] font-black uppercase tracking-[0.07em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 text-sm font-bold", edge ? "text-edge" : "text-navy")}>
        {children}
      </div>
    </div>
  );
}

export function GameCard({ run }: { run: GameRun }) {
  const { game, headline, forecast, explanation } = run;
  const recommend = headline.outcome === "recommend";
  const winnerCode = run.sim.homeWinProb >= 0.5 ? game.homeCode : game.awayCode;

  const projection =
    headline.kind === "moneyline"
      ? {
          label: "Model Winner",
          value: `${winnerCode} ${pct(Math.max(run.sim.homeWinProb, run.sim.awayWinProb))}`,
        }
      : headline.kind === "total"
        ? { label: "Model Total", value: forecast.fairTotal.toFixed(1) }
        : { label: "Model Prob", value: pct(headline.modelProb) };

  return (
    <article className="relative overflow-hidden rounded-[16px] border border-line bg-paper p-4">
      <span
        className={cn("absolute inset-y-0 left-0 w-[5px]", recommend ? "bg-brand-red" : "bg-navy")}
      />
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted-foreground">
          {game.startTimeET} · {game.venue} · Data quality {pct(game.dataQuality, 0)}
        </div>
        <Grade value={headline.score} hot={recommend} />
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <TeamSide code={game.awayCode} pitcherId={game.awayPitcherId} side="away" />
        <div className="font-serif text-[12px] font-black text-muted-foreground">VS</div>
        <TeamSide code={game.homeCode} pitcherId={game.homePitcherId} side="home" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[11px] border border-dashed border-line bg-card px-3 py-2">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.07em] text-muted-foreground">
            Selection
          </div>
          <div className="text-sm font-black text-navy">{headline.selection}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] font-black uppercase tracking-[0.07em] text-muted-foreground">
            Probability
          </div>
          <div className="text-sm font-black text-navy">{pct(headline.modelProb)}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-dashed border-line pt-3 sm:grid-cols-5">
        <Cell label={projection.label}>{projection.value}</Cell>
        <Cell label="Fair Price">{formatAmerican(headline.fairAmerican)}</Cell>
        <Cell label="Market">{formatAmerican(headline.marketAmerican)}</Cell>
        <Cell label="Edge" edge>
          {signedPct(headline.edge)}
        </Cell>
        <Cell label="Decision">{recommend ? "Recommend" : "Monitor"}</Cell>
      </div>

      <Explanation className="mt-3">
        <strong className="text-navy">Why it qualifies:</strong> {explanation.whyItQualifies}
      </Explanation>
    </article>
  );
}
