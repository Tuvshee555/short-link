"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { validateDestination } from "@/lib/destination";
import type { LinkDTO } from "@/lib/types";

import Modal from "./Modal";
import { api, displayUrl } from "./client";

type Props = {
  link: LinkDTO | null;
  onClose: () => void;
  onSaved: (link: LinkDTO) => void;
};

/** Only the destination is editable — the alias is the thing people already have. */
export default function EditDialog({ link, onClose, onSaved }: Props) {
  return (
    <Modal open={link !== null} onClose={onClose} title="Edit destination">
      {/* Keyed so reopening for another link starts from that link's values. */}
      {link && <EditForm key={link.id} link={link} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function EditForm({ link, onClose, onSaved }: { link: LinkDTO; onClose: () => void; onSaved: (link: LinkDTO) => void }) {
  const [destination, setDestination] = useState(link.destination);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    const checked = validateDestination(destination);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }
    if (checked.url === link.destination) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { link: saved } = await api<{ link: LinkDTO }>(`/api/links/${link.id}`, {
        method: "PATCH",
        body: JSON.stringify({ destination }),
      });
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div>
        <p className="text-sm font-medium">Short link</p>
        <p className="mt-1 break-all rounded-lg bg-canvas px-3 py-2 text-sm text-muted">{displayUrl(link.shortUrl)}</p>
        <p className="mt-1 text-xs text-muted">The alias stays the same, so every place you’ve shared it keeps working.</p>
      </div>

      <div>
        <label htmlFor="edit-destination" className="block text-sm font-medium">
          Destination URL
        </label>
        <textarea
          id="edit-destination"
          rows={4}
          autoFocus
          spellCheck={false}
          value={destination}
          onChange={(e) => {
            setDestination(e.target.value);
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "edit-error" : undefined}
          className="mt-1.5 w-full resize-y rounded-lg border border-line bg-white px-3 py-2.5 text-sm focus:border-accent aria-[invalid=true]:border-danger"
        />
        {error && (
          <p id="edit-error" role="alert" className="mt-1.5 text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-lg border border-line bg-white px-4 text-sm font-medium hover:bg-canvas"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
