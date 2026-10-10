"use client";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">Couldn’t load the dashboard</h1>
        <p className="mt-2 text-sm text-muted">
          The database may be waking up or briefly unreachable. Your links are safe — try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
