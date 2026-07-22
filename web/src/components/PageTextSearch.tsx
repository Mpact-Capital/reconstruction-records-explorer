"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BookmarkButton from "@/components/BookmarkButton";

function highlight(text: string, term: string) {
  if (!term.trim()) return text;
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} style={{ background: "var(--series-3)", color: "var(--surface)" }}>
        {part}
      </mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function PageTextSearch({
  recordId,
  title,
  text,
  caption,
  photoDescription,
  textSource,
  currentPage,
  representativePage,
}: {
  recordId: string;
  title: string | null;
  text: string | null;
  caption: string | null;
  photoDescription: string | null;
  textSource: string | null;
  currentPage: number;
  representativePage: number | null;
}) {
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const combined = [text, caption, photoDescription].filter(Boolean).join("\n\n");
  const hasMatch = useMemo(
    () => !!submitted && combined.toLowerCase().includes(submitted.toLowerCase()),
    [combined, submitted]
  );
  const onRepresentativePage = representativePage !== null && currentPage === representativePage;

  function getSelectionExcerpt(): string | null {
    if (typeof window === "undefined") return null;
    const sel = window.getSelection()?.toString().trim();
    if (sel) return sel.slice(0, 800);
    return combined ? combined.slice(0, 400) : null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(query);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search this document's transcribed text…"
            className="text-sm border rounded px-2 py-1 w-64"
            style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
          />
          <button type="submit" className="text-xs px-2 py-1.5 rounded border" style={{ borderColor: "var(--border)" }}>
            Search
          </button>
        </form>
        <BookmarkButton recordId={recordId} title={title} page={currentPage} label="☆ Bookmark this page" />
        {combined && (
          <BookmarkButton
            recordId={recordId}
            title={title}
            page={onRepresentativePage ? currentPage : representativePage}
            getExcerpt={getSelectionExcerpt}
            label="✎ Bookmark passage"
          />
        )}
      </div>

      {submitted && (
        <div className="text-xs" style={{ color: hasMatch ? "var(--series-1)" : "var(--text-muted)" }}>
          {hasMatch ? (
            <>
              Found a match in this record&rsquo;s transcribed text.{" "}
              {!onRepresentativePage && representativePage !== null && (
                <Link
                  href={{ pathname: "/pages", query: { id: recordId, page: String(representativePage) } }}
                  className="underline"
                >
                  Jump to transcribed page {representativePage} →
                </Link>
              )}
            </>
          ) : (
            "No match in this record's transcribed text. Note: only one representative page per record has been transcribed so far — the term may still appear in an untranscribed page image."
          )}
        </div>
      )}

      {onRepresentativePage && combined && (
        <div>
          <div className="masthead-caps text-xs mb-1" style={{ color: "var(--text-muted)" }}>
            Transcribed text {textSource ? `(${textSource})` : ""} — this page
          </div>
          <div className="paper-card text-sm whitespace-pre-wrap p-3 rounded leading-relaxed">
            {highlight(combined, submitted)}
          </div>
        </div>
      )}

      {!onRepresentativePage && representativePage !== null && combined && (
        <div className="text-xs" style={{ color: "var(--text-muted)" }}>
          This record&rsquo;s transcribed text lives on{" "}
          <Link href={{ pathname: "/pages", query: { id: recordId, page: String(representativePage) } }} className="underline">
            page {representativePage}
          </Link>
          .
        </div>
      )}
    </div>
  );
}
