"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { copyText } from "./client";

type Props = {
  text: string;
  /** Accessible name, e.g. "Copy uudamtravel.mn/hotel-booking". */
  label: string;
  /** "icon" is a compact square button; "labelled" shows the word "Copy". */
  variant?: "icon" | "labelled";
};

export default function CopyButton({ text, label, variant = "icon" }: Props) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onClick() {
    const ok = await copyText(text);
    setState(ok ? "copied" : "failed");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2000);
  }

  const copied = state === "copied";
  const Icon = copied ? Check : Copy;

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className={
          variant === "icon"
            ? `grid size-9 place-items-center rounded-lg border border-line bg-white hover:bg-canvas ${
                copied ? "border-success/40 text-success" : "text-muted hover:text-ink"
              }`
            : `inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-white px-3 text-sm font-medium hover:bg-canvas ${
                copied ? "border-success/40 text-success" : "text-ink"
              }`
        }
      >
        <Icon className="size-4" aria-hidden="true" />
        {variant === "labelled" && <span>{copied ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}</span>}
      </button>
      {/* Announces the result to screen readers for the compact variant too. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : state === "failed" ? "Copy failed. Select the link and copy it manually." : ""}
      </span>
    </>
  );
}
