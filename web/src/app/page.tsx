import Link from "next/link";
import { search } from "@/lib/api";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; doc_type?: string }>;
}) {
  const { q = "", doc_type = "" } = await searchParams;
  const data = await search({ q, doc_type: doc_type || undefined, limit: 30 });

  return (
    <div className="flex flex-col gap-6">
      <form className="flex flex-wrap gap-2" action="/" method="GET">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search records (e.g. Freedmen's Hospital, Thaddeus Stevens...)"
          className="paper-card flex-1 min-w-[280px] rounded px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="px-4 py-2 text-sm rounded text-white"
          style={{ background: "var(--series-1)" }}
        >
          Search
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <aside className="flex flex-col gap-2">
          <div className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
            Document type
          </div>
          <Link
            href={{ pathname: "/", query: { q } }}
            className="text-sm"
            style={{ color: !doc_type ? "var(--series-1)" : "var(--text-secondary)" }}
          >
            All
          </Link>
          {data.facets.doc_type
            .filter((f) => f.doc_type)
            .map((f) => (
              <Link
                key={f.doc_type}
                href={{ pathname: "/", query: { q, doc_type: f.doc_type! } }}
                className="text-sm flex justify-between"
                style={{ color: doc_type === f.doc_type ? "var(--series-1)" : "var(--text-secondary)" }}
              >
                <span>{f.doc_type}</span>
                <span style={{ color: "var(--text-muted)" }}>{f.count}</span>
              </Link>
            ))}
        </aside>

        <div className="flex flex-col gap-4">
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            {data.results.length} result{data.results.length === 1 ? "" : "s"}
          </div>
          {data.results.map((r) => (
            <Link
              key={r.id}
              href={{ pathname: "/record", query: { id: r.id } }}
              className="paper-card flex gap-4 p-3 rounded hover:shadow-md transition-shadow"
            >
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url.split("#")[0]}
                  alt=""
                  className="w-20 h-24 object-cover rounded flex-shrink-0"
                  style={{ background: "var(--gridline)" }}
                />
              ) : (
                <div
                  className="w-20 h-24 rounded flex-shrink-0"
                  style={{ background: "var(--gridline)" }}
                />
              )}
              <div className="flex flex-col gap-1 min-w-0">
                <div className="font-medium text-sm line-clamp-2">{r.title}</div>
                <div className="text-xs flex gap-2" style={{ color: "var(--text-muted)" }}>
                  {r.date && <span>{r.date}</span>}
                  {r.doc_type && <span>· {r.doc_type}</span>}
                </div>
                {r.snippet && (
                  <div
                    className="text-xs line-clamp-2"
                    style={{ color: "var(--text-secondary)" }}
                    dangerouslySetInnerHTML={{ __html: r.snippet }}
                  />
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
