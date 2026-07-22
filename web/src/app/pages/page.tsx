import Link from "next/link";
import { getRecord } from "@/lib/api";
import PageTextSearch from "@/components/PageTextSearch";

export default async function PageViewer({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; page?: string }>;
}) {
  const { id, page: pageParam } = await searchParams;
  if (!id) {
    return <div className="text-sm">No record id provided.</div>;
  }

  let record;
  try {
    record = await getRecord(id);
  } catch {
    return <div className="text-sm">Record not found.</div>;
  }

  const totalPages = record.total_pages ?? 0;
  const pageUrls = record.page_urls ?? [];
  const representativeIndex = record.image_url
    ? pageUrls.findIndex((u) => u.split("#")[0] === record.image_url?.split("#")[0])
    : -1;
  const representativePage = representativeIndex >= 0 ? representativeIndex + 1 : null;

  if (!totalPages || pageUrls.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={{ pathname: "/record", query: { id } }} className="text-sm" style={{ color: "var(--text-secondary)" }}>
          ← Back to record
        </Link>
        <div className="text-sm" style={{ color: "var(--text-muted)" }}>
          This record doesn&rsquo;t have a full page-by-page scan available yet.
        </div>
      </div>
    );
  }

  const current = Math.min(Math.max(parseInt(pageParam ?? "1", 10) || 1, 1), totalPages);
  const imageUrl = pageUrls[current - 1]?.split("#")[0];

  const pageLink = (p: number) => ({ pathname: "/pages", query: { id, page: String(p) } });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <Link href={{ pathname: "/record", query: { id } }} className="text-sm" style={{ color: "var(--text-secondary)" }}>
          ← Back to record
        </Link>
        <div className="font-display text-lg truncate max-w-xl" title={record.title ?? ""}>
          {record.title}
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <Link
          href={current > 1 ? pageLink(current - 1) : pageLink(1)}
          aria-disabled={current <= 1}
          className="px-3 py-1.5 text-sm rounded"
          style={{
            background: "var(--series-1)",
            color: "white",
            opacity: current <= 1 ? 0.4 : 1,
            pointerEvents: current <= 1 ? "none" : "auto",
          }}
        >
          ← Previous
        </Link>

        <form action="/pages" method="GET" className="flex items-center gap-2">
          <input type="hidden" name="id" value={id} />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            Page
          </span>
          <input
            type="number"
            name="page"
            min={1}
            max={totalPages}
            defaultValue={current}
            className="w-20 rounded px-2 py-1 text-sm border text-center"
            style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
          />
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            of {totalPages}
          </span>
          <button type="submit" className="px-2 py-1 text-xs rounded border" style={{ borderColor: "var(--border)" }}>
            Go
          </button>
        </form>

        <Link
          href={current < totalPages ? pageLink(current + 1) : pageLink(totalPages)}
          aria-disabled={current >= totalPages}
          className="px-3 py-1.5 text-sm rounded"
          style={{
            background: "var(--series-1)",
            color: "white",
            opacity: current >= totalPages ? 0.4 : 1,
            pointerEvents: current >= totalPages ? "none" : "auto",
          }}
        >
          Next →
        </Link>
      </div>

      <div className="paper-card p-2 rounded flex justify-center">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`Page ${current} of ${totalPages}`} className="max-w-full rounded-sm" />
        ) : (
          <div className="text-sm py-12" style={{ color: "var(--text-muted)" }}>
            Image unavailable for this page.
          </div>
        )}
      </div>

      <div className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
        Scanned page images are served directly from the National Archives Catalog. Transcription/analysis on
        this record page only covers the one representative page identified during analysis, not every page shown here.
      </div>

      <PageTextSearch
        recordId={id}
        title={record.title}
        text={record.text}
        caption={record.caption}
        photoDescription={record.photo_description}
        textSource={record.text_source}
        currentPage={current}
        representativePage={representativePage}
      />
    </div>
  );
}
