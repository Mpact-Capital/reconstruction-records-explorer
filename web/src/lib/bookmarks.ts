const BUCKETS_KEY = "rre_buckets_v1";
const BOOKMARKS_KEY = "rre_bookmarks_v1";

export type Bucket = {
  id: string;
  name: string;
  createdAt: number;
};

export type Bookmark = {
  id: string;
  bucketId: string;
  recordId: string;
  title: string | null;
  page: number | null;
  excerpt: string | null;
  createdAt: number;
};

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getBuckets(): Bucket[] {
  return readJSON<Bucket[]>(BUCKETS_KEY, []).sort((a, b) => a.createdAt - b.createdAt);
}

export function createBucket(name: string): Bucket {
  const buckets = getBuckets();
  const bucket: Bucket = { id: newId(), name: name.trim() || "Untitled bucket", createdAt: Date.now() };
  writeJSON(BUCKETS_KEY, [...buckets, bucket]);
  return bucket;
}

export function renameBucket(id: string, name: string): void {
  const buckets = getBuckets().map((b) => (b.id === id ? { ...b, name: name.trim() || b.name } : b));
  writeJSON(BUCKETS_KEY, buckets);
}

export function deleteBucket(id: string): void {
  writeJSON(
    BUCKETS_KEY,
    getBuckets().filter((b) => b.id !== id)
  );
  writeJSON(
    BOOKMARKS_KEY,
    getBookmarks().filter((bm) => bm.bucketId !== id)
  );
}

export function getBookmarks(): Bookmark[] {
  return readJSON<Bookmark[]>(BOOKMARKS_KEY, []).sort((a, b) => b.createdAt - a.createdAt);
}

export function getBookmarksForBucket(bucketId: string): Bookmark[] {
  return getBookmarks().filter((bm) => bm.bucketId === bucketId);
}

export function addBookmark(input: {
  bucketId: string;
  recordId: string;
  title: string | null;
  page?: number | null;
  excerpt?: string | null;
}): Bookmark {
  const bookmark: Bookmark = {
    id: newId(),
    bucketId: input.bucketId,
    recordId: input.recordId,
    title: input.title,
    page: input.page ?? null,
    excerpt: input.excerpt ?? null,
    createdAt: Date.now(),
  };
  writeJSON(BOOKMARKS_KEY, [...getBookmarks(), bookmark]);
  return bookmark;
}

export function removeBookmark(id: string): void {
  writeJSON(
    BOOKMARKS_KEY,
    getBookmarks().filter((bm) => bm.id !== id)
  );
}
