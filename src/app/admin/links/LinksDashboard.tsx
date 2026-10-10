"use client";

import { AlertCircle, Link2, LogOut, RefreshCw, Search, SearchX, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import type { LinkDTO } from "@/lib/types";

import CreateLinkForm from "./CreateLinkForm";
import DeleteDialog from "./DeleteDialog";
import EditDialog from "./EditDialog";
import LinksList from "./LinksList";
import { api, displayUrl, formatCount } from "./client";

type Props = {
  initialLinks: LinkDTO[];
  initialTotal: number;
  baseUrl: string;
};

export default function LinksDashboard({ initialLinks, initialTotal, baseUrl }: Props) {
  const router = useRouter();
  const host = displayUrl(baseUrl);

  const [links, setLinks] = useState(initialLinks);
  const [total, setTotal] = useState(initialTotal);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LinkDTO | null>(null);
  const [deleting, setDeleting] = useState<LinkDTO | null>(null);
  const [notice, setNotice] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  const latestRequest = useRef(0);
  const skipFirstSearch = useRef(true);

  const refresh = useCallback(async (q: string) => {
    const id = ++latestRequest.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await api<{ links: LinkDTO[]; total: number }>(`/api/links?q=${encodeURIComponent(q)}`);
      if (id !== latestRequest.current) return; // a newer search is already in flight
      setLinks(data.links);
      setTotal(data.total);
    } catch (error) {
      if (id === latestRequest.current) {
        setLoadError(error instanceof Error ? error.message : "Couldn’t load your links.");
      }
    } finally {
      if (id === latestRequest.current) setLoading(false);
    }
  }, []);

  // Debounced search. The first render already has server-fetched data.
  useEffect(() => {
    if (skipFirstSearch.current) {
      skipFirstSearch.current = false;
      return;
    }
    const timer = setTimeout(() => void refresh(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query, refresh]);

  // Transient confirmation line, announced politely to screen readers.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  function onCreated() {
    // Show the new link at the top of the full list, not hidden behind an old search.
    if (query !== "") setQuery("");
    else void refresh("");
  }

  function onSaved(saved: LinkDTO) {
    setLinks((prev) => prev.map((link) => (link.id === saved.id ? saved : link)));
    setEditing(null);
    setNotice(`Updated ${displayUrl(saved.shortUrl)}`);
  }

  function onDeleted(removed: LinkDTO) {
    setLinks((prev) => prev.filter((link) => link.id !== removed.id));
    setTotal((count) => Math.max(0, count - 1));
    setDeleting(null);
    setNotice(`Deleted ${displayUrl(removed.shortUrl)}`);
  }

  async function signOut() {
    setSigningOut(true);
    try {
      await api<{ ok: true }>("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  const searching = query.trim() !== "";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
      <header className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-white" aria-hidden="true">
            <Link2 className="size-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Short links</h1>
            <p className="truncate text-sm text-muted">Links under {host}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={signOut}
          disabled={signingOut}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-canvas disabled:opacity-60"
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
          <span className="sr-only sm:hidden">Sign out</span>
        </button>
      </header>

      <div className="grid gap-6">
        <CreateLinkForm host={host} onCreated={onCreated} />

        <section aria-labelledby="links-heading" className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div>
              <h2 id="links-heading" className="text-base font-semibold tracking-tight">
                Your links
              </h2>
              <p className="text-sm text-muted" aria-live="polite">
                {searching
                  ? `${formatCount(links.length)} of ${formatCount(total)} ${total === 1 ? "link" : "links"}`
                  : `${formatCount(total)} ${total === 1 ? "link" : "links"}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-72 sm:flex-none">
                <label htmlFor="search" className="sr-only">
                  Search links by alias or destination
                </label>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
                <input
                  id="search"
                  type="search"
                  placeholder="Search links…"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-10 w-full rounded-lg border border-line bg-white pl-9 pr-9 text-sm placeholder:text-muted/70 focus:border-accent [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-canvas hover:text-ink"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => void refresh(query.trim())}
                disabled={loading}
                aria-label="Refresh list and click counts"
                title="Refresh"
                className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-white text-muted hover:bg-canvas hover:text-ink disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div aria-busy={loading} className="relative">
            {loading && (
              <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-brand-soft" aria-hidden="true">
                <div className="h-full w-1/3 bg-brand [animation:sl-slide_1s_ease-in-out_infinite]" />
              </div>
            )}

            {loadError ? (
              <div role="alert" className="grid place-items-center gap-3 px-6 py-14 text-center">
                <AlertCircle className="size-8 text-danger" aria-hidden="true" />
                <p className="max-w-sm text-sm text-muted">{loadError}</p>
                <button
                  type="button"
                  onClick={() => void refresh(query.trim())}
                  className="h-10 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover"
                >
                  Try again
                </button>
              </div>
            ) : links.length === 0 && !loading ? (
              searching ? (
                <div className="grid place-items-center gap-2 px-6 py-14 text-center">
                  <SearchX className="size-8 text-muted" aria-hidden="true" />
                  <p className="font-medium">No links match “{query.trim()}”</p>
                  <p className="text-sm text-muted">Try part of the alias or the website’s name.</p>
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="mt-2 h-9 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-canvas"
                  >
                    Clear search
                  </button>
                </div>
              ) : (
                <div className="grid place-items-center gap-2 px-6 py-14 text-center">
                  <span className="grid size-12 place-items-center rounded-2xl bg-brand-soft text-brand" aria-hidden="true">
                    <Link2 className="size-6" />
                  </span>
                  <p className="font-medium">No short links yet</p>
                  <p className="max-w-sm text-sm text-muted">
                    Paste a long URL above, pick an alias like <span className="font-medium text-ink">hotel-booking</span>,
                    and your first link will show up here.
                  </p>
                </div>
              )
            ) : (
              <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <LinksList links={links} host={host} onEdit={setEditing} onDelete={setDeleting} />
              </div>
            )}
          </div>
        </section>
      </div>

      <EditDialog link={editing} onClose={() => setEditing(null)} onSaved={onSaved} />
      <DeleteDialog link={deleting} onClose={() => setDeleting(null)} onDeleted={onDeleted} />

      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
        {notice && (
          <p className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white shadow-lg">{notice}</p>
        )}
      </div>
    </div>
  );
}
