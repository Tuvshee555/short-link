import { NextResponse, type NextRequest } from "next/server";

import { validateDestination } from "@/lib/destination";
import { getBlockedHosts, getOwnHosts } from "@/lib/env";
import { fail, readJsonBody, requireAdminWrite, serverFailure } from "@/lib/http";
import { LinkNotFoundError, deleteLink, toDTO, updateDestination } from "@/lib/links";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

const notFound = () => fail(404, "not_found", "That link no longer exists. Refresh the list.");

/** Change where a link points. The alias never changes — that's the whole point of a short URL. */
export async function PATCH(request: NextRequest, { params }: Context) {
  const denied = await requireAdminWrite(request);
  if (denied) return denied;

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;

  const checked = validateDestination(parsed.body.destination, {
    ownHosts: getOwnHosts(),
    blockedHosts: getBlockedHosts(),
  });
  if (!checked.ok) {
    return fail(400, "invalid_destination", checked.message, { field: "destination" });
  }

  const { id } = await params;

  try {
    const link = await updateDestination(id, checked.url);
    return NextResponse.json({ link: toDTO(link) });
  } catch (error) {
    if (error instanceof LinkNotFoundError) return notFound();
    return serverFailure("update link", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  const denied = await requireAdminWrite(request);
  if (denied) return denied;

  const { id } = await params;

  try {
    await deleteLink(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof LinkNotFoundError) return notFound();
    return serverFailure("delete link", error);
  }
}
