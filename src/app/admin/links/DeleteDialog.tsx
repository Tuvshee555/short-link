"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import type { LinkDTO } from "@/lib/types";

import Modal from "./Modal";
import { api, displayUrl, formatCount } from "./client";

type Props = {
  link: LinkDTO | null;
  onClose: () => void;
  onDeleted: (link: LinkDTO) => void;
};

export default function DeleteDialog({ link, onClose, onDeleted }: Props) {
  return (
    <Modal open={link !== null} onClose={onClose} title="Delete this short link?">
      {link && <DeleteBody key={link.id} link={link} onClose={onClose} onDeleted={onDeleted} />}
    </Modal>
  );
}

function DeleteBody({ link, onClose, onDeleted }: { link: LinkDTO; onClose: () => void; onDeleted: (link: LinkDTO) => void }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    try {
      await api<{ ok: true }>(`/api/links/${link.id}`, { method: "DELETE" });
      onDeleted(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t delete. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted">
        <strong className="break-all font-semibold text-ink">{displayUrl(link.shortUrl)}</strong> will stop working
        immediately for everyone who has it, and its {formatCount(link.clicks)} recorded{" "}
        {link.clicks === 1 ? "click" : "clicks"} will be lost. This can’t be undone.
      </p>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft p-3 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          autoFocus
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-canvas"
        >
          Keep it
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={deleting}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-danger px-5 text-sm font-semibold text-white hover:bg-danger-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {deleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {deleting ? "Deleting…" : "Delete link"}
        </button>
      </div>
    </div>
  );
}
