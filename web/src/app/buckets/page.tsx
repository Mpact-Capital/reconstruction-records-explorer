"use client";

import { useState } from "react";
import Link from "next/link";
import {
  getBuckets,
  getBookmarksForBucket,
  createBucket,
  renameBucket,
  deleteBucket,
  removeBookmark,
} from "@/lib/bookmarks";

export default function BucketsPage() {
  const [, setTick] = useState(0);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newBucketName, setNewBucketName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const buckets = getBuckets();
  const effectiveActiveId = activeId && buckets.some((b) => b.id === activeId) ? activeId : (buckets[0]?.id ?? null);
  const bookmarks = effectiveActiveId ? getBookmarksForBucket(effectiveActiveId) : [];

  function refresh() {
    setTick((t) => t + 1);
  }

  function handleCreate() {
    if (!newBucketName.trim()) return;
    const b = createBucket(newBucketName.trim());
    setNewBucketName("");
    setActiveId(b.id);
    refresh();
  }

  function handleDelete(id: string) {
    if (!window.confirm("Delete this bucket and all its bookmarks?")) return;
    deleteBucket(id);
    if (effectiveActiveId === id) setActiveId(null);
    refresh();
  }

  function handleRename(id: string) {
    renameBucket(id, renameValue);
    setRenamingId(null);
    refresh();
  }

  function handleRemoveBookmark(id: string) {
    removeBookmark(id);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl">Research Buckets</h1>
      <p className="text-sm max-w-2xl" style={{ color: "var(--text-secondary)" }}>
        Save records, specific pages, or highlighted passages into named buckets while you research. Buckets are
        stored only in this browser &mdash; they are not synced to any account or server, and won&rsquo;t carry over
        to a different browser or device.
      </p>

      <div className="flex gap-6 flex-wrap">
        <div className="flex flex-col gap-2 min-w-[220px]">
          <div className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
            Buckets
          </div>
          {buckets.length === 0 && (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              No buckets yet. Create one below, or use the &ldquo;☆ Bookmark&rdquo; button on any record.
            </div>
          )}
          <div className="flex flex-col gap-1">
            {buckets.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-1 px-2 py-1.5 rounded text-sm"
                style={{
                  background: effectiveActiveId === b.id ? "var(--surface-raised)" : "transparent",
                  border: "1px solid var(--border)",
                }}
              >
                {renamingId === b.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(b.id)}
                    onKeyDown={(e) => e.key === "Enter" && handleRename(b.id)}
                    className="text-sm border rounded px-1 py-0.5 flex-1"
                    style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  />
                ) : (
                  <button type="button" className="flex-1 text-left" onClick={() => setActiveId(b.id)}>
                    {b.name}
                  </button>
                )}
                <button
                  type="button"
                  title="Rename"
                  className="text-xs px-1"
                  style={{ color: "var(--text-muted)" }}
                  onClick={() => {
                    setRenamingId(b.id);
                    setRenameValue(b.name);
                  }}
                >
                  ✎
                </button>
                <button
                  type="button"
                  title="Delete bucket"
                  className="text-xs px-1"
                  style={{ color: "var(--series-6)" }}
                  onClick={() => handleDelete(b.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-1 pt-2">
            <input
              type="text"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="New bucket name"
              className="text-sm border rounded px-2 py-1 flex-1"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            />
            <button
              type="button"
              onClick={handleCreate}
              className="text-xs px-2 py-1 rounded text-white"
              style={{ background: "var(--series-1)" }}
            >
              + New
            </button>
          </div>
        </div>

        <div className="flex-1 min-w-[280px] flex flex-col gap-3">
          <div className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
            {effectiveActiveId ? `Saved in "${buckets.find((b) => b.id === effectiveActiveId)?.name}"` : "Select a bucket"}
          </div>
          {effectiveActiveId && bookmarks.length === 0 && (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Nothing saved here yet.
            </div>
          )}
          <div className="flex flex-col gap-2">
            {bookmarks.map((bm) => (
              <div key={bm.id} className="paper-card p-3 rounded flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={
                      bm.page
                        ? { pathname: "/pages", query: { id: bm.recordId, page: String(bm.page) } }
                        : { pathname: "/record", query: { id: bm.recordId } }
                    }
                    className="text-sm font-medium underline"
                  >
                    {bm.title || bm.recordId}
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleRemoveBookmark(bm.id)}
                    className="text-xs"
                    style={{ color: "var(--series-6)" }}
                  >
                    Remove
                  </button>
                </div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {bm.page ? `Page ${bm.page} · ` : ""}
                  saved {new Date(bm.createdAt).toLocaleDateString()}
                </div>
                {bm.excerpt && (
                  <div
                    className="text-xs italic p-2 rounded"
                    style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
                  >
                    &ldquo;{bm.excerpt}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
