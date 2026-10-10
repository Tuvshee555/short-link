/** What the dashboard (and the JSON API) knows about one link. */
export type LinkDTO = {
  id: string;
  alias: string;
  /** Full public short URL, e.g. https://uudamtravel.mn/hotel-booking */
  shortUrl: string;
  destination: string;
  /** Hostname of the destination, for display. */
  destinationHost: string;
  /** False when the destination is on your own website. */
  isExternal: boolean;
  clicks: number;
  createdAt: string;
  updatedAt: string;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    /** Which form field the message belongs to, when there is one. */
    field?: "destination" | "alias" | "password";
    retryAfterSeconds?: number;
  };
};
