const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type SearchResult = {
  id: string;
  title: string | null;
  date: string | null;
  doc_type: string | null;
  collection: string | null;
  image_url: string | null;
  local_image_path: string | null;
  rights: string | null;
  snippet: string | null;
  rank: number;
};

export type SearchResponse = {
  results: SearchResult[];
  facets: { doc_type: { doc_type: string | null; count: number }[] };
  limit: number;
  offset: number;
};

export type Entity = {
  type: string;
  value: string;
  amount_usd: number | null;
  associated_person: string | null;
};

export type RecordTable = { caption: string | null; rows: string[][] };

export type RecordDetail = {
  id: string;
  source: string;
  title: string | null;
  date: string | null;
  collection: string | null;
  record_group: string | null;
  text: string | null;
  text_source: string | null;
  rights: string | null;
  source_url: string | null;
  image_url: string | null;
  local_image_path: string | null;
  doc_type: string | null;
  caption: string | null;
  layout: string | null;
  photo_description: string | null;
  analysis_confidence: number | null;
  mismatch_flags: string[];
  entities: Entity[];
  tables: RecordTable[];
};

export type PersonRecord = {
  id: string;
  title: string | null;
  date: string | null;
  doc_type: string | null;
  image_url: string | null;
  local_image_path: string | null;
  source_url: string | null;
};

export type FinancialMention = {
  value: string;
  amount_usd: number | null;
  associated_person: string | null;
  record_id: string;
  title: string | null;
  date: string | null;
};

export type PersonProfile = {
  name: string;
  records: PersonRecord[];
  financial_mentions: FinancialMention[];
  total_usd: number;
  note: string;
};

export type Aggregate = {
  by_doc_type: { doc_type: string | null; count: number }[];
  by_decade: { decade: number; count: number }[];
  top_people: { name: string; mentions: number }[];
  top_places: { name: string; mentions: number }[];
  financial_totals: {
    person_linked_total_usd: number;
    person_linked_mentions: number;
    all_dollar_mentions: number;
    largest_amounts: FinancialMention[];
    note: string;
  };
};

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) throw new Error("not_found");
    throw new Error(`API error ${res.status}`);
  }
  return res.json();
}

export function search(params: {
  q?: string;
  doc_type?: string;
  collection?: string;
  person?: string;
  place?: string;
  decade?: string;
  limit?: number;
  offset?: number;
}): Promise<SearchResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.doc_type) qs.set("doc_type", params.doc_type);
  if (params.collection) qs.set("collection", params.collection);
  if (params.person) qs.set("person", params.person);
  if (params.place) qs.set("place", params.place);
  if (params.decade) qs.set("decade", params.decade);
  qs.set("limit", String(params.limit ?? 25));
  qs.set("offset", String(params.offset ?? 0));
  return getJSON(`/search?${qs.toString()}`);
}

export type FacetValue = { value: string | number; count: number };

export function getFacetOptions(field: "person" | "place" | "collection" | "decade"): Promise<{
  field: string;
  values: FacetValue[];
  truncated: boolean;
}> {
  return getJSON(`/facets/${field}`);
}

export function getRecord(id: string): Promise<RecordDetail> {
  return getJSON(`/record/${encodeURIComponent(id)}`);
}

export function getPerson(name: string): Promise<PersonProfile> {
  return getJSON(`/person/${encodeURIComponent(name)}`);
}

export function getAggregate(): Promise<Aggregate> {
  return getJSON(`/aggregate`);
}
