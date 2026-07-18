import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { ComputedSlate } from "../engines/pipeline";
import { regenerateRunFn } from "./persist";

interface SlateContextValue {
  slate: ComputedSlate;
  regenerating: boolean;
  regenerate: () => Promise<void>;
}

const SlateContext = createContext<SlateContextValue | null>(null);

export function SlateProvider({
  initial,
  children,
}: {
  initial: ComputedSlate;
  children: ReactNode;
}) {
  const [slate, setSlate] = useState<ComputedSlate>(initial);
  const [regenerating, setRegenerating] = useState(false);

  const regenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const next = await regenerateRunFn({ data: { runNumber: slate.runNumber + 1 } });
      setSlate(next);
      toast.success(`Forecast run #${next.runNumber} completed`, {
        description: `${next.stats.gamesPriced} games priced · ${next.stats.recommendations} recommendations · preserved as a new immutable version.`,
      });
    } catch {
      toast.error("Forecast run failed", {
        description: "The pipeline could not complete. Try again.",
      });
    } finally {
      setRegenerating(false);
    }
  }, [slate.runNumber]);

  return (
    <SlateContext.Provider value={{ slate, regenerating, regenerate }}>
      {children}
    </SlateContext.Provider>
  );
}

export function useSlate(): SlateContextValue {
  const ctx = useContext(SlateContext);
  if (!ctx) throw new Error("useSlate must be used within a SlateProvider");
  return ctx;
}
