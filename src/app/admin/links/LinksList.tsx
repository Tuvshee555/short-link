"use client";

import { ExternalLink, Globe, Home, Pencil, Trash2 } from "lucide-react";

import type { LinkDTO } from "@/lib/types";

import CopyButton from "./CopyButton";
import { displayUrl, formatCount, formatDate, formatDateTime } from "./client";

type Props = {
  links: LinkDTO[];
  host: string;
  onEdit: (link: LinkDTO) => void;
  onDelete: (link: LinkDTO) => void;
};

function DestinationBadge({ link }: { link: LinkDTO }) {
  return link.isExternal ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-warn-soft px-2 py-0.5 text-xs font-medium text-warn">
      <Globe className="size-3" aria-hidden="true" /> External
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
      <Home className="size-3" aria-hidden="true" /> Your site
    </span>
  );
}

function Destination({ link }: { link: LinkDTO }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <DestinationBadge link={link} />
        <span className="truncate text-sm font-medium">{link.destinationHost}</span>
      </div>
      <a
        href={link.destination}
        target="_blank"
        rel="noopener noreferrer nofollow"
        title={link.destination}
        className="mt-1 flex min-w-0 items-center gap-1 text-xs text-muted hover:text-brand"
      >
        <span className="truncate">{displayUrl(link.destination)}</span>
        <ExternalLink className="size-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </div>
  );
}

function ShortLink({ link, host }: { link: LinkDTO; host: string }) {
  return (
    <a
      href={link.shortUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm [overflow-wrap:anywhere] hover:underline"
      title="Open short link in a new tab"
    >
      <span className="text-muted">{host}/</span>
      {/* Lets a narrow column wrap before the alias instead of cutting the alias in half. */}
      <wbr />
      <span className="font-semibold text-brand">{link.alias}</span>
    </a>
  );
}

function RowActions({ link, onEdit, onDelete }: Pick<Props, "onEdit" | "onDelete"> & { link: LinkDTO }) {
  const name = displayUrl(link.shortUrl);
  return (
    <div className="flex items-center gap-1.5">
      <CopyButton text={link.shortUrl} label={`Copy ${name}`} />
      <button
        type="button"
        onClick={() => onEdit(link)}
        aria-label={`Edit destination of ${name}`}
        title="Edit destination"
        className="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted hover:bg-canvas hover:text-ink"
      >
        <Pencil className="size-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(link)}
        aria-label={`Delete ${name}`}
        title="Delete"
        className="grid size-9 place-items-center rounded-lg border border-line bg-white text-muted hover:border-danger/30 hover:bg-danger-soft hover:text-danger"
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function LinksList({ links, host, onEdit, onDelete }: Props) {
  return (
    <>
      {/* Desktop / tablet: table */}
      <table className="hidden w-full table-fixed text-left md:table">
        <caption className="sr-only">Your short links</caption>
        <thead>
          <tr className="border-b border-line text-xs font-medium uppercase tracking-wide text-muted">
            <th scope="col" className="w-[26%] px-5 py-3 font-medium">
              Short link
            </th>
            <th scope="col" className="px-3 py-3 font-medium">
              Destination
            </th>
            <th scope="col" className="w-28 px-3 py-3 font-medium">
              Created
            </th>
            <th scope="col" className="w-20 px-3 py-3 text-right font-medium">
              Clicks
            </th>
            <th scope="col" className="w-36 px-5 py-3 font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {links.map((link) => (
            <tr key={link.id} className="align-middle hover:bg-canvas/70">
              <td className="px-5 py-3.5">
                <ShortLink link={link} host={host} />
              </td>
              <td className="px-3 py-3.5">
                <Destination link={link} />
              </td>
              <td className="px-3 py-3.5 text-sm text-muted">
                <time dateTime={link.createdAt} title={formatDateTime(link.createdAt)}>
                  {formatDate(link.createdAt)}
                </time>
              </td>
              <td className="px-3 py-3.5 text-right text-sm font-medium tabular-nums">{formatCount(link.clicks)}</td>
              <td className="px-5 py-3.5">
                <RowActions link={link} onEdit={onEdit} onDelete={onDelete} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Phone: stacked cards */}
      <ul className="divide-y divide-line md:hidden">
        {links.map((link) => (
          <li key={link.id} className="grid gap-3 p-4">
            <ShortLink link={link} host={host} />
            <Destination link={link} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">
                <time dateTime={link.createdAt}>{formatDate(link.createdAt)}</time>
                <span aria-hidden="true"> · </span>
                <span className="font-medium text-ink tabular-nums">{formatCount(link.clicks)}</span>{" "}
                {link.clicks === 1 ? "click" : "clicks"}
              </p>
              <RowActions link={link} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
