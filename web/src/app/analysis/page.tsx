import Link from "next/link";
import { getAggregate } from "@/lib/api";

function BarRow({
  label,
  value,
  max,
  color,
  href,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  href?: { pathname: string; query: Record<string, string> };
}) {
  const pct = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  const labelEl = (
    <span className="text-xs truncate capitalize" style={{ color: "var(--text-secondary)" }} title={label}>
      {label}
    </span>
  );
  return (
    <div className="grid grid-cols-[140px_1fr_48px] items-center gap-2">
      {href ? <Link href={href}>{labelEl}</Link> : labelEl}
      <div className="h-3 rounded" style={{ background: "var(--gridline)" }}>
        <div
          className="h-3 rounded"
          style={{ width: `${pct}%`, background: color }}
          title={`${label}: ${value}`}
        />
      </div>
      <span className="text-xs text-right" style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
        {value.toLocaleString()}
      </span>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="paper-card p-4 rounded">
      <div className="text-xs" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-2xl font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
    </div>
  );
}

export default async function AnalysisPage() {
  const data = await getAggregate();

  const docTypes = data.by_doc_type.filter((d) => d.doc_type).slice(0, 10);
  const maxDocType = Math.max(...docTypes.map((d) => d.count), 1);

  const decades = data.by_decade;
  const maxDecade = Math.max(...decades.map((d) => d.count), 1);

  const topPeople = data.top_people.slice(0, 12);
  const maxPeople = Math.max(...topPeople.map((p) => p.mentions), 1);

  const topPlaces = data.top_places.slice(0, 12);
  const maxPlaces = Math.max(...topPlaces.map((p) => p.mentions), 1);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl">Analysis</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Total records" value={docTypes.reduce((s, d) => s + d.count, 0).toLocaleString()} />
        <StatTile
          label="Person-linked $ total"
          value={`$${data.financial_totals.person_linked_total_usd.toLocaleString()}`}
        />
        <StatTile label="Person-linked mentions" value={String(data.financial_totals.person_linked_mentions)} />
        <StatTile label="All dollar figures found" value={String(data.financial_totals.all_dollar_mentions)} />
      </div>
      <div className="text-xs italic -mt-4" style={{ color: "var(--text-muted)" }}>
        {data.financial_totals.note}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="section-heading masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
          Documents by type
        </h2>
        <div className="flex flex-col gap-2">
          {docTypes.map((d) => (
            <BarRow
              key={d.doc_type}
              label={d.doc_type!}
              value={d.count}
              max={maxDocType}
              color="var(--series-1)"
              href={{ pathname: "/", query: { doc_type: d.doc_type! } }}
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-heading masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
          Volume by decade
        </h2>
        <div className="flex flex-col gap-2">
          {decades.map((d) => (
            <BarRow key={d.decade} label={`${d.decade}s`} value={d.count} max={maxDecade} color="var(--series-2)" />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="section-heading masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
            Most-mentioned people
          </h2>
          <div className="flex flex-col gap-2">
            {topPeople.map((p) => (
              <BarRow
                key={p.name}
                label={p.name}
                value={p.mentions}
                max={maxPeople}
                color="var(--series-5)"
                href={{ pathname: "/person", query: { name: p.name } }}
              />
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="section-heading masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
            Most-mentioned places
          </h2>
          <div className="flex flex-col gap-2">
            {topPlaces.map((p) => (
              <BarRow key={p.name} label={p.name} value={p.mentions} max={maxPlaces} color="var(--series-3)" />
            ))}
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="section-heading masthead-caps text-xs" style={{ color: "var(--text-muted)" }}>
          Largest dollar figures found (not necessarily personal transactions — see note above)
        </h2>
        <div className="overflow-x-auto">
          <table className="text-sm w-full border-collapse">
            <thead>
              <tr className="text-left" style={{ color: "var(--text-muted)" }}>
                <th className="py-1 pr-4">Amount</th>
                <th className="py-1 pr-4">As written</th>
                <th className="py-1 pr-4">Record</th>
              </tr>
            </thead>
            <tbody>
              {data.financial_totals.largest_amounts.map((a, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--gridline)" }}>
                  <td className="py-2 pr-4" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {a.amount_usd ? `$${a.amount_usd.toLocaleString()}` : "—"}
                  </td>
                  <td className="py-2 pr-4" style={{ color: "var(--text-secondary)" }}>
                    {a.value}
                  </td>
                  <td className="py-2 pr-4">
                    <Link href={{ pathname: "/record", query: { id: a.record_id } }} style={{ color: "var(--series-1)" }}>
                      {a.title ?? a.record_id}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
