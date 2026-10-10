/**
 * Which requests count as a "click". Privacy by design: we read the User-Agent
 * only to skip obvious machines — it is never stored, and neither is the IP.
 */

const MACHINE_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headlesschrome|lighthouse|pingdom|uptime/i;

export function shouldCountClick(method: string, headers: Headers): boolean {
  // HEAD is what link checkers and some chat apps send before a real visit.
  if (method !== "GET") return false;

  const purpose = `${headers.get("sec-purpose") ?? ""} ${headers.get("purpose") ?? ""} ${headers.get("x-moz") ?? ""}`;
  if (/prefetch|prerender/i.test(purpose)) return false;

  const userAgent = headers.get("user-agent") ?? "";
  return !MACHINE_UA.test(userAgent);
}
