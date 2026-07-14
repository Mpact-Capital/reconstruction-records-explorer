import Link from "next/link";
import { getFacetOptions, search } from "@/lib/api";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    doc_type?: string;
    person?: string;
    place?: string;
    collection?: string;
    decade?: string;
  }>;
}) {
  const { q = "", doc_type = "", person = "", place = "", collection = "", decade = "" } = await searchParams;

  const [data, peopleFacet, placesFacet, collectionsFacet, decadesFacet] = await Promise.all([
    search({ q, doc_type: doc_type || undefined, person: person || undefined, place: place || undefined, collection: collection || undefined, decade: decade || undefined, limit: 30 }),
    getFacetOptions("person"),
    getFacetOptions("place"),
    getFacetOptions("collection"),
    getFacetOptions("decade"),
  ]);

  // Carry every active filter forward when a link only changes one of them
  const baseQuery: Record<string, string> = {};
  if (q) baseQuery.q = q;
  if (doc_type) baseQuery.doc_type = doc_type;
  if (person) baseQuery.person = person;
  if (place) baseQuery.place = place;
  if (collection) baseQuery.collection = collection;
  if (decade) baseQuery.decade = decade;

  return (
    <div className="flex flex-col gap-6">
      <form className="paper-card flex flex-col gap-3 p-4 rounded" action="/" method="GET">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search keywords, themes, or events (e.g. schools, marriage, wages, riot)..."
          className="rounded px-3 py-2 text-sm border"
          style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="flex flex-col gap-1">
            <label className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
              Person
            </label>
            <input
              type="text"
              name="person"
              list="person-options"
              defaultValue={person}
              placeholder="Any name"
              className="rounded px-2 py-1.5 text-sm border capitalize"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            />
            <datalist id="person-options">
              {peopleFacet.values.map((v) => (
                <option key={v.value} value={String(v.value)} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1">
            <label className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
              Region / Place
            </label>
            <input
              type="text"
              name="place"
              list="place-options"
              defaultValue={place}
              placeholder="Any place"
              className="rounded px-2 py-1.5 text-sm border capitalize"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            />
            <datalist id="place-options">
              {placesFacet.values.map((v) => (
                <option key={v.value} value={String(v.value)} />
              ))}
            </datalist>
          </div>

          <div className="flex flex-col gap-1">
            <label className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
              Decade
            </label>
            <select
              name="decade"
              defaultValue={decade}
              className="rounded px-2 py-1.5 text-sm border"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            >
              <option value="">Any decade</option>
              {decadesFacet.values.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.value}s ({v.count})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
              Collection
            </label>
            <select
              name="collection"
              defaultValue={collection}
              className="rounded px-2 py-1.5 text-sm border"
              style={{ borderColor: "var(--border)", background: "var(--surface-raised)" }}
            >
              <option value="">Any collection</option>
              {Array.from(
                collectionsFacet.values.reduce((groups, v) => {
                  const g = v.group ?? "Other";
                  if (!groups.has(g)) groups.set(g, []);
                  groups.get(g)!.push(v);
                  return groups;
                }, new Map<string, typeof collectionsFacet.values>())
              ).map(([group, values]) => (
                <optgroup key={group} label={group}>
                  {values.map((v) => (
                    <option key={v.value} value={String(v.value)} title={String(v.value)}>
                      {String(v.value).length > 55 ? String(v.value).slice(0, 55) + "…" : v.value} ({v.count})
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            className="px-4 py-2 text-sm rounded text-white"
            style={{ background: "var(--series-1)" }}
          >
            Search
          </button>
          {(q || doc_type || person || place || collection || decade) && (
            <Link href="/" className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Clear all filters
            </Link>
          )}
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <aside className="flex flex-col gap-2">
          <div className="masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
            Document type
          </div>
          <Link
            href={{ pathname: "/", query: { ...baseQuery, doc_type: undefined } }}
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
                href={{ pathname: "/", query: { ...baseQuery, doc_type: f.doc_type! } }}
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
