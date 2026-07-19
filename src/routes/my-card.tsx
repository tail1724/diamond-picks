import { createFileRoute, Link } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useSlate } from "@/lib/tail/context";
import { formatAmerican, payoutForStake, pct } from "@/lib/tail/format";
import { Btn, Panel, PanelHead, SectionHead } from "@/components/tail/ui";

export const Route = createFileRoute("/my-card")({ component: MyCard });

function MyCard() {
  const { savedPicks, removePick, updateStake, clearCard } = useSlate();
  const totalRisk = savedPicks.reduce((sum, pick) => sum + pick.stake, 0);
  const totalProfit = savedPicks.reduce((sum, pick) => sum + payoutForStake(pick.stake, pick.american), 0);

  return (
    <>
      <SectionHead
        eyebrow="Your saved plays"
        title="My Card"
        copy="Keep the plays you’re considering in one place. Stakes stay on this device and are never sent to a sportsbook."
        action={savedPicks.length ? <Btn variant="ghost" onClick={clearCard}>Clear card</Btn> : undefined}
      />

      {savedPicks.length === 0 ? (
        <div className="rounded-[18px] border border-dashed border-line bg-card p-10 text-center">
          <h2 className="font-serif text-2xl text-navy">Your card is empty</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Save a pick to compare prices, enter a stake, and see the potential return before deciding what to do.
          </p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-brand-red px-4 py-2.5 text-sm font-extrabold text-white">
            See today’s picks
          </Link>
        </div>
      ) : (
        <div className="grid gap-[18px] lg:grid-cols-[1fr_320px]">
          <Panel>
            <PanelHead title="Saved picks" subtitle={`${savedPicks.length} play${savedPicks.length === 1 ? "" : "s"}`} />
            <div className="grid gap-2 p-3.5">
              {savedPicks.map((pick) => (
                <article key={pick.id} className="grid gap-3 rounded-[14px] border border-line bg-card p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                  <div>
                    <div className="font-black text-navy">{pick.selection}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatAmerican(pick.american)} · Our confidence {pct(pick.modelProb, 0)}
                    </div>
                  </div>
                  <label className="text-xs font-bold text-muted-foreground">
                    Stake
                    <div className="mt-1 flex items-center rounded-lg border border-line bg-white px-2">
                      <span>$</span>
                      <input
                        aria-label={`Stake for ${pick.selection}`}
                        type="number"
                        min="0"
                        step="1"
                        value={pick.stake}
                        onChange={(event) => updateStake(pick.id, Number(event.target.value))}
                        className="w-20 bg-transparent px-1 py-2 text-right font-bold text-navy outline-none"
                      />
                    </div>
                  </label>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Potential profit</div>
                      <div className="text-lg font-black text-edge">${payoutForStake(pick.stake, pick.american).toFixed(2)}</div>
                    </div>
                    <button onClick={() => removePick(pick.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-brand-red">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel className="h-fit">
            <PanelHead title="Card summary" subtitle="For planning only" />
            <div className="grid gap-3 p-4">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total risk</span><b className="text-navy">${totalRisk.toFixed(2)}</b></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Potential profit</span><b className="text-edge">${totalProfit.toFixed(2)}</b></div>
              <div className="rounded-xl bg-brand-amber/10 p-3 text-xs leading-relaxed text-foreground/75">
                Odds can move. Recheck every price before placing anything, keep stakes consistent, and never treat a forecast as a guarantee.
              </div>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
