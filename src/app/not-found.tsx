import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center">
        <p className="inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">404</p>
        <h1 className="mt-4 text-xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">There’s nothing at this address.</p>
        <Link
          href="/admin/links"
          className="mt-6 inline-block rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
