import { Link } from "@tanstack/react-router";
import { RefreshCw, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSlate } from "@/lib/tail/context";
import { navItems, advancedNavItems } from "@/lib/tail/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const shell = "mx-auto w-[min(1520px,calc(100%-28px))]";

export function TopStrip() {
  return (
    <div className="bg-brand-red px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.15em] text-white">
      We find the games where the matchup and the price line up
    </div>
  );
}

export function Header() {
  const { slate, regenerate, regenerating } = useSlate();
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy/95 text-white backdrop-blur-lg">
      <div className={cn(shell, "flex min-h-[78px] flex-wrap items-center gap-5 py-2")}>
        <Link to="/" className="flex min-w-max items-center gap-3 text-white no-underline">
          <span className="grid h-[46px] w-[46px] -rotate-[5deg] place-items-center rounded-full border-[3px] border-white bg-brand-red font-serif text-[22px] font-black shadow-[0_0_0_3px_var(--brand-blue)]">
            TS
          </span>
          <span>
            <strong className="block font-serif text-[22px] leading-none">TAIL Sports</strong>
            <span className="mt-1 block text-[9px] font-extrabold uppercase tracking-[0.15em] text-white/60">
              Smarter MLB picks, explained simply
            </span>
          </span>
        </Link>

        <nav
          aria-label="Platform navigation"
          className="no-scrollbar order-3 flex flex-1 gap-0.5 overflow-x-auto lg:order-none"
        >
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="whitespace-nowrap rounded-[10px] px-2.5 py-2.5 text-xs font-extrabold text-white/70 transition hover:bg-white/10 hover:text-white [&.active]:bg-white/10 [&.active]:text-white"
            >
              {item.label}
            </Link>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 whitespace-nowrap rounded-[10px] px-2.5 py-2.5 text-xs font-extrabold text-white/70 transition hover:bg-white/10 hover:text-white">
              More tools <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {advancedNavItems.map((item) => (
                <DropdownMenuItem key={item.to} asChild>
                  <Link to={item.to}>{item.label}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="ml-auto flex min-w-max items-center gap-2.5">
          <span className="hidden items-center gap-2 text-[11px] font-extrabold text-[#cdebdc] sm:inline-flex">
            <span className="h-2 w-2 rounded-full bg-[#37c979] shadow-[0_0_0_5px_rgba(55,201,121,0.13)]" />
            Live data is up
          </span>
          <Link
            to="/models"
            className="hidden rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 text-sm font-extrabold text-white transition hover:brightness-110 sm:inline-flex"
          >
            How our picks work
          </Link>
          <button
            onClick={regenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-red px-3.5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(201,31,55,0.24)] transition hover:-translate-y-px hover:brightness-105 disabled:opacity-70"
          >
            <RefreshCw className={cn("h-4 w-4", regenerating && "animate-spin")} />
            {regenerating ? "Updating…" : "Refresh picks"}
          </button>
        </div>
      </div>
    </header>
  );
}
