import { Link } from "@tanstack/react-router";
import { RefreshCw, ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSlate } from "@/lib/tail/context";
import { navItems, advancedNavItems, adminNavItems } from "@/lib/tail/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const shell = "mx-auto w-[min(1520px,calc(100%-28px))]";

export function TopStrip() {
  return (
    <div className="bg-brand-red px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.12em] text-white">
      Clear MLB picks · real prices · no guarantees
    </div>
  );
}

export function Header() {
  const { slate, regenerate, regenerating, savedPicks } = useSlate();
  const isLive = slate.dataStatus.schedule === "live" && slate.dataStatus.odds === "live";
  const statusCopy = isLive
    ? "Live schedule and prices"
    : slate.dataStatus.schedule === "live"
      ? "Schedule live · prices limited"
      : "Limited data mode";

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy/95 text-white backdrop-blur-lg">
      <div className={cn(shell, "flex min-h-[78px] flex-wrap items-center gap-4 py-2")}>
        <Link to="/" className="flex min-w-max items-center gap-3 text-white no-underline">
          <span className="grid h-[46px] w-[46px] -rotate-[5deg] place-items-center rounded-full border-[3px] border-white bg-brand-red font-serif text-[22px] font-black shadow-[0_0_0_3px_var(--brand-blue)]">
            TS
          </span>
          <span>
            <strong className="block font-serif text-[22px] leading-none">TAIL Sports</strong>
            <span className="mt-1 block text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/60">
              MLB picks without the homework
            </span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="no-scrollbar order-3 flex flex-1 gap-0.5 overflow-x-auto lg:order-none">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="whitespace-nowrap rounded-[10px] px-2.5 py-2.5 text-xs font-extrabold text-white/70 transition hover:bg-white/10 hover:text-white [&.active]:bg-white/10 [&.active]:text-white"
            >
              {item.label}
              {item.to === "/my-card" && savedPicks.length > 0 ? ` (${savedPicks.length})` : ""}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 whitespace-nowrap rounded-[10px] px-2.5 py-2.5 text-xs font-extrabold text-white/70 transition hover:bg-white/10 hover:text-white">
              More <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Fan tools</DropdownMenuLabel>
              {advancedNavItems.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" /> Admin
              </DropdownMenuLabel>
              {adminNavItems.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ml-auto flex min-w-max items-center gap-2.5">
          <span className={cn("hidden items-center gap-2 text-[11px] font-extrabold sm:inline-flex", isLive ? "text-[#cdebdc]" : "text-[#ffe1a6]")}>
            <span className={cn("h-2 w-2 rounded-full", isLive ? "bg-[#37c979]" : "bg-brand-amber")} />
            {statusCopy}
          </span>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-3.5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(201,31,55,0.24)] transition hover:-translate-y-px hover:brightness-105 disabled:opacity-70"
          >
            <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
            {regenerating ? "Updating…" : "Refresh"}
          </button>
        </div>
      </div>
    </header>
  );
}
