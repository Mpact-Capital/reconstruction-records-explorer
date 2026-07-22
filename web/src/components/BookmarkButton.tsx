"use client";

import { useState } from "react";
import { addBookmark, createBucket, getBuckets, type Bucket } from "@/lib/bookmarks";

export default function BookmarkButton({
  recordId,
  title,
  page,
  getExcerpt,
  label = "☆ Bookmark",
}: {
  recordId: string;
  title: string | null;
  page?: number | null;
  getExcerpt?: () => string | null;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>("");
  const [newBucketName, setNewBucketName] = useState("");
  const [saved, setSaved] = useState(false);

  function toggleOpen() {
    if (!open) {
      const existing = getBuckets();
      setBuckets(existing);
      setSelectedBucket((prev) => prev || existing[0]?.id || "");
    }
    setOpen((o) => !o);
  }

  function handleSave() {
    let bucketId = selectedBucket;
    if (!bucketId && newBucketName.trim()) {
      bucketId = createBucket(newBucketName.trim()).id;
    } else if (!bucketId) {
      bucketId = createBucket("Untitled bucket").id;
    }
    addBookmark({
      bucketId,
      recordId,
      title,
      page: page ?? null,
      excerpt: getExcerpt ? getExcerpt() : null,
    });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setOpen(false);
      setNewBucketName("");
    }, 900);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggleOpen}
        className="text-xs px-2 py-1 rounded border"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {label}
      </button>
      {open && (
        <div
          className="absolute z-20 mt-1 p-3 rounded border flex flex-col gap-2 text-xs"
          style={{ background: "var(--surface-raised)", borderColor: "var(--border)", width: "240px" }}
        >
          {saved ? (
            <div style={{ color: "var(--series-1)" }}>Saved.</div>
          ) : (
            <>
              <div className="masthead-caps" style={{ color: "var(--text-muted)" }}>
                Save to research bucket
              </div>
              {buckets.length > 0 && (
                <select
                  className="border rounded px-1.5 py-1"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                  value={selectedBucket}
                  onChange={(e) => setSelectedBucket(e.target.value)}
                >
                  {buckets.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
                <span>{buckets.length > 0 ? "or new:" : "New bucket:"}</span>
              </div>
              <input
                type="text"
                value={newBucketName}
                onChange={(e) => {
                  setNewBucketName(e.target.value);
                  if (e.target.value) setSelectedBucket("");
                }}
                placeholder="e.g. Covington VA leads"
                className="border rounded px-1.5 py-1"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              />
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-2 py-1 rounded"
                  style={{ color: "var(--text-muted)" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-2 py-1 rounded text-white"
                  style={{ background: "var(--series-1)" }}
                >
                  Save
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
