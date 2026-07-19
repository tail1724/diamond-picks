import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { runSlateFn } from "../lib/tail/run";
import { SlateProvider } from "../lib/tail/context";
import { Header, TopStrip, shell } from "../components/tail/Header";
import { Toaster } from "../components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-7xl font-bold text-navy">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">That page is off the board</h2>
        <p className="mt-2 text-sm text-muted-foreground">The link may be old, or today’s slate may have changed.</p>
        <Link to="/" className="mt-6 inline-flex rounded-xl bg-navy px-4 py-2.5 text-sm font-extrabold text-white">Back to today’s picks</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl text-navy">The board didn’t load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your saved card is still on this device. Try loading the latest picks again.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-xl bg-brand-red px-4 py-2.5 text-sm font-extrabold text-white"
          >
            Try again
          </button>
          <a href="/" className="rounded-xl border border-line bg-card px-4 py-2.5 text-sm font-extrabold text-navy">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "TAIL Sports — MLB Picks Explained Simply" },
      {
        name: "description",
        content: "Clear MLB picks, live sportsbook prices, and straightforward explanations of what we like and what could go wrong.",
      },
      { name: "author", content: "TAIL Sports" },
      { property: "og:title", content: "TAIL Sports — MLB Picks Explained Simply" },
      { property: "og:description", content: "Today’s MLB picks, current prices, and the simple case for every play." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  loader: () => runSlateFn(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const slate = Route.useLoaderData();
  return (
    <QueryClientProvider client={queryClient}>
      <SlateProvider initial={slate}>
        <TopStrip />
        <Header />
        <main className={`${shell} py-7 pb-16`}><Outlet /></main>
        <footer className={`${shell} border-t border-line py-6 text-center text-xs leading-relaxed text-muted-foreground`}>
          TAIL Sports provides probabilistic analysis, not guarantees. Recheck prices before acting and bet only what you can afford to lose.
        </footer>
        <Toaster position="bottom-right" richColors />
      </SlateProvider>
    </QueryClientProvider>
  );
}
