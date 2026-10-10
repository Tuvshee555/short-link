import type { ApiErrorBody } from "@/lib/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly field?: "destination" | "alias" | "password",
  ) {
    super(message);
  }
}

/** JSON fetch wrapper: throws ApiError with a human message; bounces to sign-in when the session is gone. */
export async function api<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "network", "Couldn’t reach the server. Check your connection and try again.");
  }

  if (response.ok) return (await response.json()) as T;

  const body = (await response.json().catch(() => null)) as ApiErrorBody | null;

  if (response.status === 401) {
    // A full navigation on purpose: it drops all client state along with the dead session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/admin/login?expired=1";
  }

  throw new ApiError(
    response.status,
    body?.error.code ?? "error",
    body?.error.message ?? "Something went wrong. Try again.",
    body?.error.field,
  );
}

/** Clipboard write with a fallback for non-secure contexts and older browsers. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Ulaanbaatar",
});

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Ulaanbaatar",
});

// A fixed zone keeps server-rendered and browser-rendered dates identical.
export const formatDate = (iso: string) => DATE_FORMAT.format(new Date(iso));
export const formatDateTime = (iso: string) => `${DATE_TIME_FORMAT.format(new Date(iso))} (Ulaanbaatar)`;
export const formatCount = (n: number) => n.toLocaleString("en-US");

/** `https://uudamtravel.mn/x` -> `uudamtravel.mn/x` */
export const displayUrl = (url: string) => url.replace(/^https?:\/\//, "");
