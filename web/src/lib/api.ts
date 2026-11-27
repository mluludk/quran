export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export interface SurahSummary {
  id: number;
  name_arabic: string;
  name_transliteration: string;
  name_translation: string;
  revelation_type: string;
  ayah_count: number;
}

export interface PageLineItem {
  item_type: "surah_header" | "basmala" | "word" | "ayah_end" | "ornament";
  word_id: number | null;
  surah_id: number | null;
  ayah_id: number | null;
  ayah_number: number | null;
  position: number;
  display_text: string;
  source_glyph_code: string;
  glyph_codes: number[] | null;
}

export interface PageLine {
  line_number: number;
  line_type: string;
  is_centered: boolean;
  items: PageLineItem[];
}

export interface MushafPageResponse {
  edition: string;
  page_number: number;
  juz_number: number | null;
  hizb_number: number | null;
  font_asset_key: string;
  surahs_on_page: {
    id: number;
    name_arabic: string;
    first_ayah: number;
    last_ayah: number;
  }[] | null;
  lines: PageLine[];
}

export interface MorphSegment {
  segment_number: number;
  segment_arabic: string;
  pos: string;
  root_id: number | null;
  root: string;
  lemma_id: number | null;
  lemma: string;
  data: { tags?: string };
  source: string;
}

export interface IrabNode {
  node_id: number;
  segment_number: number;
  role_arabic: string;
  role_latin: string;
  irab_status: string;
  irab_sign: string;
  amil: string;
  explanation: string;
  opinion: string;
  source: string;
}

export interface IrabRelation {
  id: number;
  relation_type: string;
  description: string;
  source_word_id: number;
  source_arabic: string;
  target_word_id: number;
  target_arabic: string;
}

export interface WordDetailResponse {
  word_id: number;
  word_number: number;
  arabic_text: string;
  ayah_id: number;
  surah_id: number;
  surah_name: string;
  ayah_number: number;
  page_number: number | null;
  translation_id: string;
  morphology: MorphSegment[] | null;
  irab: IrabNode[] | null;
  relations?: IrabRelation[] | null;
}

export interface SearchWordHit {
  word_id: number;
  arabic_text: string;
  surah_id: number;
  surah_name: string;
  ayah_number: number;
  word_number: number;
  page_number: number | null;
  translation_id: string;
}

export interface BookmarkItem {
  id: number;
  page_number: number | null;
  ayah_id: number | null;
  note: string;
  created_at: string;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

export async function fetchSurahs(): Promise<SurahSummary[]> {
  const res = await apiFetch<{ data: SurahSummary[] }>("/surahs");
  return res.data ?? [];
}

export async function fetchPage(page: number): Promise<MushafPageResponse> {
  return apiFetch<MushafPageResponse>(`/pages/${page}`);
}

export interface AyahIrabNode {
  node_id: number;
  word_id: number;
  word_number: number;
  arabic_text: string;
  segment_number: number;
  sequence_order: number;
  role_arabic: string;
  role_latin: string;
  irab_status: string;
  irab_sign: string;
  amil: string;
  explanation: string;
}

export interface AyahIrabRelation {
  id: number;
  source_node_id: number;
  target_node_id: number;
  source_word_id: number;
  target_word_id: number;
  relation_type: string;
  description: string;
}

export interface AyahIrabResponse {
  ayah_id: number;
  surah_id: number;
  ayah_number: number;
  words: {
    word_id: number;
    word_number: number;
    arabic_text: string;
    translation_id: string;
  }[];
  analyses: {
    analysis_id: number;
    opinion_label: string;
    summary: string;
    source: { name: string; author: string };
    nodes: AyahIrabNode[];
    relations: AyahIrabRelation[] | null;
  }[];
}

export async function fetchWordDetail(wordId: number): Promise<WordDetailResponse> {
  return apiFetch<WordDetailResponse>(`/words/${wordId}`);
}

export async function fetchAyahIrab(surah: number, ayah: number): Promise<AyahIrabResponse> {
  return apiFetch<AyahIrabResponse>(`/ayahs/${surah}/${ayah}/irab`);
}

export interface RootFamilyMember {
  lemma_id: number;
  lemma: string;
  pos: string;
  category: "Fi'il" | "Isim" | "Masdar" | "Harf" | string;
  pattern_label: string;
  occurrence_count: number;
  sample_word_id: number;
  sample_arabic: string;
  sample_translation: string;
  sample_surah_id: number;
  sample_surah_name: string;
  sample_ayah_number: number;
  sample_page: number | null;
}

export interface RootFamilyResponse {
  root: {
    id: number;
    arabic_text: string;
    occurrence_count: number;
    lemma_count: number;
  };
  family: RootFamilyMember[] | null;
}

export async function fetchRootFamily(rootId: number): Promise<RootFamilyResponse> {
  return apiFetch<RootFamilyResponse>(`/roots/${rootId}/family`);
}

export async function fetchRootOccurrences(rootId: number, limit = 20, offset = 0) {
  return apiFetch<{
    data: SearchWordHit[] | null;
    pagination: { total: number; limit: number; offset: number };
  }>(`/roots/${rootId}/occurrences?limit=${limit}&offset=${offset}`);
}

export async function searchArabic(q: string, limit = 20, offset = 0) {
  return apiFetch<{
    data: SearchWordHit[] | null;
    pagination: { total: number; limit: number; offset: number };
  }>(`/search/arabic?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`);
}

export async function searchRoots(q: string, limit = 20) {
  const res = await apiFetch<{
    data: { id: number; arabic_text: string; occurrence_count: number }[] | null;
  }>(`/search/roots?q=${encodeURIComponent(q)}&limit=${limit}`);
  return res.data ?? [];
}

export async function listBookmarks(): Promise<BookmarkItem[]> {
  const res = await apiFetch<{ data: BookmarkItem[] | null }>("/bookmarks");
  return res.data ?? [];
}

export async function createBookmark(pageNumber: number, note = ""): Promise<BookmarkItem> {
  return apiFetch<BookmarkItem>("/bookmarks", {
    method: "POST",
    body: JSON.stringify({ page_number: pageNumber, note }),
  });
}

export async function deleteBookmark(id: number): Promise<void> {
  return apiFetch<void>(`/bookmarks/${id}`, { method: "DELETE" });
}

export async function getReadingProgress(): Promise<{ page_number: number }> {
  return apiFetch<{ page_number: number }>("/reading-progress");
}

export async function putReadingProgress(pageNumber: number): Promise<void> {
  await apiFetch("/reading-progress", {
    method: "PUT",
    body: JSON.stringify({ page_number: pageNumber }),
  });
}
