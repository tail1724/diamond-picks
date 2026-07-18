import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground">
          Baseball Predictions
        </span>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Smarter picks. Every pitch.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          AI-powered MLB predictions, matchup analytics, and daily edges — built for
          bettors and fans who want a data advantage.
        </p>
        <p className="mt-10 text-sm text-muted-foreground">
          Setup in progress — tell me the product name and features to build next.
        </p>
      </section>
    </main>
  );
}
