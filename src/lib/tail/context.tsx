import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { MarketDecision } from "../engines/decision";
import type { AppSlate } from "./run";
import { regenerateRunFn } from "./persist";

export interface SavedPick {
  id: string;
  gameId: string;
  selection: string;
  american: number;
  modelProb: number;
  stake: number;
  savedAt: string;
}

interface SlateContextValue {
  slate: AppSlate;
  regenerating: boolean;
  regenerate: () => Promise<void>;
  savedPicks: SavedPick[];
  isSaved: (gameId: string, legId: string) => boolean;
  savePick: (decision: MarketDecision) => void;
  removePick: (id: string) => void;
  updateStake: (id: string, stake: number) => void;
  clearCard: () => void;
}

const SlateContext = createContext<SlateContextValue | null>(null);
const STORAGE_KEY = "tail-sports-my-card-v1";

export function SlateProvider({ initial, children }: { initial: AppSlate; children: ReactNode }) {
  const [slate, setSlate] = useState<AppSlate>(initial);
  const [regenerating, setRegenerating] = useState(false);
  const [savedPicks, setSavedPicks] = useState<SavedPick[]>([]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSavedPicks(JSON.parse(raw) as SavedPick[]);
    } catch {
      setSavedPicks([]);
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPicks));
    } catch {
      // Private browsing or storage limits should not break the app.
    }
  }, [savedPicks]);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const next = await regenerateRunFn({ data: { runNumber: slate.runNumber + 1 } });
      setSlate(next);
      const oddsMessage = next.dataStatus.odds === "live" ? "Live prices updated." : "Limited data mode is active.";
      toast.success("Today’s picks are refreshed", {
        description: `${next.stats.gamesPriced} games checked · ${next.stats.recommendations} plays found. ${oddsMessage}`,
      });
    } catch {
      toast.error("We couldn’t refresh the picks", {
        description: "The current board is still available. Try again in a moment.",
      });
    } finally {
      setRegenerating(false);
    }
  }, [slate.runNumber]);

  const isSaved = useCallback(
    (gameId: string, legId: string) => savedPicks.some((pick) => pick.id === `${gameId}:${legId}`),
    [savedPicks],
  );

  const savePick = useCallback((decision: MarketDecision) => {
    const id = `${decision.gameId}:${decision.legId}`;
    setSavedPicks((current) => {
      if (current.some((pick) => pick.id === id)) return current;
      return [
        ...current,
        {
          id,
          gameId: decision.gameId,
          selection: decision.selection,
          american: decision.marketAmerican,
          modelProb: decision.modelProb,
          stake: 10,
          savedAt: new Date().toISOString(),
        },
      ];
    });
    toast.success("Added to My Card", { description: decision.selection });
  }, []);

  const removePick = useCallback((id: string) => {
    setSavedPicks((current) => current.filter((pick) => pick.id !== id));
  }, []);

  const updateStake = useCallback((id: string, stake: number) => {
    setSavedPicks((current) =>
      current.map((pick) => (pick.id === id ? { ...pick, stake: Math.max(0, stake || 0) } : pick)),
    );
  }, []);

  const clearCard = useCallback(() => setSavedPicks([]), []);

  const value = useMemo(
    () => ({ slate, regenerating, regenerate, savedPicks, isSaved, savePick, removePick, updateStake, clearCard }),
    [slate, regenerating, regenerate, savedPicks, isSaved, savePick, removePick, updateStake, clearCard],
  );

  return <SlateContext.Provider value={value}>{children}</SlateContext.Provider>;
}

export function useSlate(): SlateContextValue {
  const ctx = useContext(SlateContext);
  if (!ctx) throw new Error("useSlate must be used within a SlateProvider");
  return ctx;
}
