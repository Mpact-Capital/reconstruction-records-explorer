import Link from "next/link";
import { getPerson } from "@/lib/api";

export default async function PersonPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string }>;
}) {
  const { name } = await searchParams;
  if (!name) {
    return <div className="text-sm">No person specified.</div>;
  }

  let profile;
  try {
    profile = await getPerson(name);
  } catch {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm">No records found mentioning &ldquo;{name}&rdquo;.</div>
        <Link href="/" style={{ color: "var(--text-secondary)" }}>
          ← Back to search
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm" style={{ color: "var(--text-secondary)" }}>
        ← Back to search
      </Link>

      <h1 className="font-display text-2xl capitalize">{profile.name}</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="paper-card p-4 rounded">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Records mentioning this person
          </div>
          <div className="text-2xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {profile.records.length}
          </div>
        </div>
        <div className="paper-card p-4 rounded">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Dollar amounts tied to them
          </div>
          <div className="text-2xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            ${profile.total_usd.toLocaleString()}
          </div>
        </div>
        <div className="paper-card p-4 rounded">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            Financial mentions
          </div>
          <div className="text-2xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {profile.financial_mentions.length}
          </div>
        </div>
      </div>

      <div className="text-xs italic" style={{ color: "var(--text-muted)" }}>
        {profile.note}
      </div>

      {profile.financial_mentions.length > 0 && (
        <div>
          <div className="masthead-caps text-xs mb-2" style={{ color: "var(--text-muted)" }}>
            Financial timeline
          </div>
          <div className="overflow-x-auto">
            <table className="text-sm w-full border-collapse">
              <thead>
                <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                  <th className="py-1 pr-4">Date</th>
                  <th className="py-1 pr-4">Amount</th>
                  <th className="py-1 pr-4">Record</th>
                </tr>
              </thead>
              <tbody>
                {profile.financial_mentions.map((m, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--gridline)" }}>
                    <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {m.date ?? "—"}
                    </td>
                    <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {m.amount_usd ? `$${m.amount_usd.toLocaleString()}` : m.value}
                    </td>
                    <td className="py-2 pr-4">
                      <Link href={{ pathname: "/record", query: { id: m.record_id } }} style={{ color: "var(--series-1)" }}>
                        {m.title ?? m.record_id}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <div className="masthead-caps text-xs mb-2" style={{ color: "var(--text-muted)" }}>
          Records mentioning {profile.name}
        </div>
        <div className="flex flex-col gap-2">
          {profile.records.map((r) => (
            <Link
              key={r.id}
              href={{ pathname: "/record", query: { id: r.id } }}
              className="paper-card flex gap-3 p-2 rounded hover:shadow-md transition-shadow"
            >
              {r.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={r.image_url.split("#")[0]}
                  alt=""
                  className="w-14 h-16 object-cover rounded flex-shrink-0"
                  style={{ background: "var(--gridline)" }}
                />
              )}
              <div className="flex flex-col min-w-0">
                <div className="text-sm font-medium line-clamp-2">{r.title}</div>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {r.date} {r.doc_type && `· ${r.doc_type}`}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
