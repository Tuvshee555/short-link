import { Prisma, type Link } from "@prisma/client";

import { generateRandomAlias } from "./alias";
import { isOwnHost } from "./destination";
import { db } from "./db";
import { getBaseUrl, getOwnHosts } from "./env";
import { isReservedAlias } from "./reserved";
import type { LinkDTO } from "./types";

export class AliasTakenError extends Error {
  constructor(public readonly alias: string) {
    super(`Alias "${alias}" is already taken`);
  }
}

export class LinkNotFoundError extends Error {
  constructor() {
    super("Link not found");
  }
}

/** Hard ceiling on one dashboard load; search narrows it from there. */
const LIST_LIMIT = 1000;

function isKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export function toDTO(link: Link): LinkDTO {
  let host = "";
  try {
    host = new URL(link.destination).hostname;
  } catch {
    // The CHECK constraint makes this unreachable; show the raw text if it ever happens.
    host = link.destination;
  }

  return {
    id: link.id,
    alias: link.alias,
    shortUrl: `${getBaseUrl()}/${link.alias}`,
    destination: link.destination,
    destinationHost: host,
    isExternal: !isOwnHost(host, getOwnHosts()),
    clicks: link.clicks,
    createdAt: link.createdAt.toISOString(),
    updatedAt: link.updatedAt.toISOString(),
  };
}

export async function listLinks(query?: string): Promise<{ links: LinkDTO[]; total: number }> {
  const term = query?.trim();

  const [rows, total] = await Promise.all([
    db.link.findMany({
      where: term
        ? {
            OR: [
              { alias: { contains: term.toLowerCase() } },
              { destination: { contains: term, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: LIST_LIMIT,
    }),
    db.link.count(),
  ]);

  return { links: rows.map(toDTO), total };
}

export async function aliasExists(alias: string): Promise<boolean> {
  const row = await db.link.findUnique({ where: { alias }, select: { id: true } });
  return row !== null;
}

/** The unique index is the real guard; a lost race surfaces as AliasTakenError. */
export async function createLink(alias: string, destination: string): Promise<Link> {
  try {
    return await db.link.create({ data: { alias, destination } });
  } catch (error) {
    if (isKnownError(error, "P2002")) throw new AliasTakenError(alias);
    throw error;
  }
}

export async function createRandomLink(destination: string): Promise<Link> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const alias = generateRandomAlias(attempt < 5 ? 7 : 8);
    if (isReservedAlias(alias)) continue;
    try {
      return await createLink(alias, destination);
    } catch (error) {
      if (error instanceof AliasTakenError) continue;
      throw error;
    }
  }
  throw new Error("Could not find a free random alias after 8 attempts");
}

export async function updateDestination(id: string, destination: string): Promise<Link> {
  try {
    return await db.link.update({ where: { id }, data: { destination } });
  } catch (error) {
    if (isKnownError(error, "P2025")) throw new LinkNotFoundError();
    throw error;
  }
}

export async function deleteLink(id: string): Promise<void> {
  try {
    await db.link.delete({ where: { id } });
  } catch (error) {
    if (isKnownError(error, "P2025")) throw new LinkNotFoundError();
    throw error;
  }
}

/**
 * Look up an alias for a visitor.
 *
 * With `countClick`, lookup and increment are ONE statement
 * (`SET clicks = clicks + 1 ... RETURNING`), so concurrent visitors can never
 * overwrite each other's count. It is raw SQL on purpose: Prisma's `update`
 * would also bump `updatedAt`, which should only move when someone edits a link.
 */
export async function resolveAlias(alias: string, countClick: boolean): Promise<string | null> {
  if (countClick) {
    const rows = await db.$queryRaw<{ destination: string }[]>`
      UPDATE "Link" SET "clicks" = "clicks" + 1
      WHERE "alias" = ${alias}
      RETURNING "destination"`;
    return rows[0]?.destination ?? null;
  }

  const row = await db.link.findUnique({ where: { alias }, select: { destination: true } });
  return row?.destination ?? null;
}
