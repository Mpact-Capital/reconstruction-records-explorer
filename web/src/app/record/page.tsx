import Link from "next/link";
import { getRecord } from "@/lib/api";

function EntityBadge({ type, value }: { type: string; value: string }) {
  const color: Record<string, string> = {
    person: "var(--series-1)",
    place: "var(--series-2)",
    date: "var(--series-3)",
    amount: "var(--series-6)",
    organization: "var(--series-5)",
    other: "var(--text-muted)",
  };
  const href = type === "person" ? { pathname: "/person", query: { name: value } } : null;
  const badge = (
    <span
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border"
      style={{ borderColor: "var(--border)", color: color[type] ?? "var(--text-secondary)" }}
    >
      {value}
    </span>
  );
  return href ? <Link href={href}>{badge}</Link> : badge;
}

export default async function RecordPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (!id) {
    return <div className="text-sm">No record id provided.</div>;
  }

  let record;
  try {
    record = await getRecord(id);
  } catch {
    return <div className="text-sm">Record not found.</div>;
  }

  const entitiesByType = record.entities.reduce<Record<string, typeof record.entities>>((acc, e) => {
    (acc[e.type] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className="text-sm" style={{ color: "var(--text-secondary)" }}>
        ← Back to search
      </Link>

      <h1 className="font-display text-2xl">{record.title}</h1>
      <div className="text-sm flex flex-wrap gap-3" style={{ color: "var(--text-muted)" }}>
        {record.date && <span>{record.date}</span>}
        {record.doc_type && <span>· {record.doc_type}</span>}
        {record.collection && (
          <span>
            · {record.collection_group}
            {record.collection_group && record.collection && record.collection_group !== record.collection && (
              <>: {record.collection}</>
            )}
          </span>
        )}
      </div>

      {record.mismatch_flags.length > 0 && (
        <div
          className="text-sm p-3 rounded border"
          style={{ borderColor: "var(--series-6)", color: "var(--series-6)", background: "var(--surface)" }}
        >
          <div className="font-semibold mb-1">⚠ Cross-modal mismatch flags (machine-generated, verify against source):</div>
          <ul className="list-disc list-inside">
            {record.mismatch_flags.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          {record.image_url ? (
            <div className="paper-card p-2 rounded">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={record.image_url.split("#")[0]}
                alt={record.caption ?? record.title ?? ""}
                className="w-full rounded-sm"
              />
            </div>
          ) : (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              No image available for this record.
            </div>
          )}
          {record.caption && (
            <div className="text-xs italic" style={{ color: "var(--text-secondary)" }}>
              {record.caption}
            </div>
          )}
          {record.analysis_confidence !== null && (
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Analysis confidence: {Math.round(record.analysis_confidence * 100)}%
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="masthead-caps text-xs mb-1" style={{ color: "var(--text-muted)" }}>
              Text {record.text_source ? `(${record.text_source})` : ""}
            </div>
            <div className="paper-card text-sm whitespace-pre-wrap p-3 rounded leading-relaxed">
              {record.text || "No text available."}
            </div>
          </div>

          {record.tables.length > 0 && (
            <div>
              <div className="masthead-caps text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Extracted tables
              </div>
              {record.tables.map((t, i) => (
                <div key={i} className="overflow-x-auto mb-3">
                  {t.caption && <div className="text-xs italic mb-1">{t.caption}</div>}
                  <table className="text-xs border-collapse">
                    <tbody>
                      {t.rows.map((row, ri) => (
                        <tr key={ri}>
                          {row.map((cell, ci) => (
                            <td key={ci} className="border px-2 py-1" style={{ borderColor: "var(--gridline)" }}>
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {Object.keys(entitiesByType).length > 0 && (
            <div>
              <div className="masthead-caps text-xs mb-1" style={{ color: "var(--text-muted)" }}>
                Entities
              </div>
              {Object.entries(entitiesByType).map(([type, ents]) => (
                <div key={type} className="mb-2">
                  <div className="text-xs mb-1 capitalize" style={{ color: "var(--text-muted)" }}>
                    {type}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ents.map((e, i) => (
                      <EntityBadge
                        key={i}
                        type={e.type}
                        value={e.type === "amount" && e.amount_usd ? `${e.value} ($${e.amount_usd.toLocaleString()})` : e.value}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-xs pt-2 border-t" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
            <div>Rights: {record.rights || "Not stated"}</div>
            {record.source_url && (
              <div>
                Source:{" "}
                <a href={record.source_url} target="_blank" rel="noopener noreferrer">
                  {record.source_url}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
