export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export interface SurahSummary {
  id: number;
  name_arabic: string;
  name_transliteration: string;
  name_translation: string;
  revelation_type: string;
  ayah_count: number;
  first_page?: number;
}

export interface JuzSummary {
  juz_number: number;
  first_page: number;
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
  translation_id?: string;
  is_first_occurrence?: boolean;
  first_occurrence_page?: number | null;
  grammar_roles?: string[] | null;
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
  const raw = await res.text();
  // Normalize legacy QPC open-tanwin codepoints (U+0656/U+0657/U+065E) for web Arabic fonts
  const normalized = raw
    .replace(/\u065e|\\u065e/gi, "\u064c")
    .replace(/\u0657|\\u0657/gi, "\u064b")
    .replace(/\u0656|\\u0656/gi, "\u064d");
  return JSON.parse(normalized) as T;
}

export async function fetchSurahs(): Promise<SurahSummary[]> {
  const res = await apiFetch<{ data: SurahSummary[] }>("/surahs?v=2");
  return res.data ?? [];
}

export async function fetchJuzList(): Promise<JuzSummary[]> {
  const res = await apiFetch<{ data: JuzSummary[] }>("/juz");
  return res.data ?? [];
}

export async function fetchPage(page: number): Promise<MushafPageResponse> {
  return apiFetch<MushafPageResponse>(`/pages/${page}?v=6`);
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

export interface AyahIrabPhrase {
  id: number;
  phrase_type: string;
  phrase_arabic: string;
  phrase_latin: string;
  start_word_id: number;
  end_word_id: number;
  mahal_irab: string;
  explanation: string;
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
    validation_status?: string;
    confidence_score?: number;
    validation_notes?: string;
    source: { name: string; author: string; version?: string; source_url?: string };
    nodes: AyahIrabNode[];
    relations: AyahIrabRelation[] | null;
    phrases: (AyahIrabPhrase & { parent_phrase_id?: number | null })[] | null;
  }[];
}

export interface IrabValidationSummaryResponse {
  total_analyses: number;
  alternative_opinions: number;
  avg_confidence: number;
  by_status: { status: string; count: number; avg_confidence: number }[] | null;
  needs_review_sample: {
    surah_id: number;
    surah_name: string;
    ayah_number: number;
    confidence_score: number;
    notes: string;
  }[] | null;
}

export interface SarfExploreItem {
  word_id: number;
  arabic_text: string;
  translation_id: string;
  pos: string;
  lemma: string;
  root: string;
  tags: string;
  surah_id: number;
  surah_name: string;
  ayah_number: number;
  word_number: number;
  segment_number?: number;
  segment_arabic?: string;
  all_segments?: string;
}

export interface SarfExploreResponse {
  summary: {
    pos_counts: { pos: string; count: number }[] | null;
    verb_form_counts: { tag: string; count: number }[] | null;
  };
  items: SarfExploreItem[] | null;
  pagination: { total: number; limit: number; offset: number };
}

export async function fetchIrabValidationSummary(): Promise<IrabValidationSummaryResponse> {
  return apiFetch<IrabValidationSummaryResponse>("/irab/validation-summary");
}

export async function fetchSarfExplore(params?: {
  pos?: string;
  tag?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<SarfExploreResponse> {
  const sp = new URLSearchParams();
  if (params?.pos) sp.set("pos", params.pos);
  if (params?.tag) sp.set("tag", params.tag);
  if (params?.q) sp.set("q", params.q);
  if (params?.limit) sp.set("limit", String(params.limit));
  if (params?.offset) sp.set("offset", String(params.offset));
  const qs = sp.toString();
  return apiFetch<SarfExploreResponse>(`/sarf/explore${qs ? `?${qs}` : ""}`);
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

export interface VocabCollection {
  id: number;
  name: string;
  description: string;
  item_count: number;
}

export interface VocabItem {
  id: number;
  collection_id: number | null;
  collection_name: string;
  item_type: "word" | "ayah";
  word_id: number | null;
  ayah_id: number | null;
  note: string;
  mastery_level: number; // 0: Baru, 1: Belajar, 2: Dikuasai
  review_count: number;
  arabic_text: string;
  translation_id: string;
  root: string;
  surah_name: string;
  surah_id: number;
  ayah_number: number;
  page_number: number | null;
}

export interface VocabProgress {
  total_items: number;
  new_count: number;
  learning_count: number;
  mastered_count: number;
  total_reviews: number;
}

export async function listVocabCollections(): Promise<VocabCollection[]> {
  const res = await apiFetch<{ data: VocabCollection[] | null }>("/vocab/collections");
  return res.data ?? [];
}

export async function createVocabCollection(name: string): Promise<VocabCollection> {
  return apiFetch<VocabCollection>("/vocab/collections", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function listVocabItems(collectionId = 0): Promise<VocabItem[]> {
  const res = await apiFetch<{ data: VocabItem[] | null }>(`/vocab/items?collection_id=${collectionId}`);
  return res.data ?? [];
}

export async function createVocabItem(payload: {
  collection_id?: number | null;
  item_type: "word" | "ayah";
  word_id?: number | null;
  ayah_id?: number | null;
  note?: string;
}): Promise<{ id: number }> {
  return apiFetch("/vocab/items", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateVocabItem(
  id: number,
  payload: { note?: string; collection_id?: number; mastery_level?: number; reviewed?: boolean }
): Promise<void> {
  await apiFetch(`/vocab/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteVocabItem(id: number): Promise<void> {
  await apiFetch(`/vocab/items/${id}`, { method: "DELETE" });
}

export async function getVocabProgress(): Promise<VocabProgress> {
  return apiFetch<VocabProgress>("/vocab/progress");
}

export interface LearnJuzProgress {
  juz_number: number;
  unique_words: number;
  mastered_words: number;
}

export interface LearnPathStage {
  stage: number;
  title: string;
  subtitle: string;
  mode: "frequency" | "juz";
  juz_number: number;
  total_words: number;
  mastered_words: number;
  progress_pct: number;
  status: "completed" | "active" | "locked";
}

export interface LearnSummaryResponse {
  total_unique_words: number;
  mastered_words: number;
  learning_words: number;
  due_review_count?: number;
  total_correct: number;
  total_wrong: number;
  juz_progress: LearnJuzProgress[] | null;
  learning_path?: LearnPathStage[] | null;
}

export interface LearnGoalsResponse {
  daily_target: number;
  today_reviewed: number;
  today_correct: number;
  current_streak: number;
  longest_streak: number;
}

export interface GrammarQuizQuestion {
  topic: "nahwu" | "sarf";
  word_id: number;
  arabic_text: string;
  translation_id: string;
  prompt: string;
  correct_answer: string;
  choices: string[];
  explanation: string;
  surah_id: number;
  surah_name: string;
  ayah_number: number;
}

export interface LearnCard {
  word_id: number;
  normalized_word: string;
  arabic_text: string;
  translation_id: string;
  root: string;
  surah_id: number;
  surah_name: string;
  ayah_number: number;
  page_number: number | null;
  frequency: number;
  mastery_level: number;
  choices: string[];
}

export async function fetchLearnSummary(): Promise<LearnSummaryResponse> {
  return apiFetch<LearnSummaryResponse>("/learn/summary");
}

export async function fetchLearnDeck(params: {
  mode: "due" | "adaptive" | "frequency" | "juz" | "page";
  juz?: number;
  page?: number;
  onlyNew?: boolean;
  limit?: number;
  offset?: number;
}): Promise<LearnCard[]> {
  const sp = new URLSearchParams({
    mode: params.mode,
    juz: String(params.juz ?? 30),
    page: String(params.page ?? 1),
    only_new: String(params.onlyNew ?? false),
    limit: String(params.limit ?? 15),
    offset: String(params.offset ?? 0),
  });
  const res = await apiFetch<{ cards: LearnCard[] | null }>(`/learn/deck?${sp.toString()}`);
  return res.cards ?? [];
}

export async function submitLearnAnswer(
  normalizedWord: string,
  isCorrect: boolean
): Promise<{ mastery_level: number; interval_days?: number; ease_factor?: number }> {
  return apiFetch<{ mastery_level: number; interval_days?: number; ease_factor?: number }>("/learn/answer", {
    method: "POST",
    body: JSON.stringify({ normalized_word: normalizedWord, is_correct: isCorrect }),
  });
}

export async function fetchLearnGoals(): Promise<LearnGoalsResponse> {
  return apiFetch<LearnGoalsResponse>("/learn/goals");
}

export async function updateLearnGoals(dailyTarget: number): Promise<LearnGoalsResponse> {
  return apiFetch<LearnGoalsResponse>("/learn/goals", {
    method: "PUT",
    body: JSON.stringify({ daily_target: dailyTarget }),
  });
}

export async function fetchGrammarQuiz(topic: "nahwu" | "sarf", limit = 10): Promise<GrammarQuizQuestion[]> {
  const res = await apiFetch<{ questions: GrammarQuizQuestion[] | null }>(`/learn/grammar-quiz?topic=${topic}&limit=${limit}`);
  return res.questions ?? [];
}

export async function submitGrammarQuizLog(isCorrect: boolean): Promise<LearnGoalsResponse> {
  return apiFetch<LearnGoalsResponse>("/learn/quiz-log", {
    method: "POST",
    body: JSON.stringify({ is_correct: isCorrect }),
  });
}

export interface WordFrequencyResponse {
  word_id: number;
  arabic_text: string;
  normalized_word: string;
  translation_id: string;
  word_count: number;
  surah_count: number;
  makkiyah_count: number;
  madaniyah_count: number;
  root: { id: number | null; arabic_text: string; count: number };
  variations: { arabic_text: string; count: number }[] | null;
  top_surahs: {
    surah_id: number;
    name_arabic: string;
    transliteration: string;
    revelation_type: string;
    count: number;
  }[] | null;
  occurrences: {
    word_id: number;
    arabic_text: string;
    surah_id: number;
    surah_name: string;
    ayah_number: number;
    word_number: number;
    translation_id: string;
    ayah_text: string;
    page_number: number | null;
  }[] | null;
  pagination: { total: number; limit: number; offset: number };
}

export interface TopFrequencyItem {
  word_id?: number;
  sample_word_id?: number;
  root_id?: number;
  arabic_text: string;
  normalized_word?: string;
  count: number;
  translation_id?: string;
  root?: string;
}

export async function fetchWordFrequency(wordId: number, limit = 15, offset = 0): Promise<WordFrequencyResponse> {
  return apiFetch<WordFrequencyResponse>(`/words/${wordId}/frequency?limit=${limit}&offset=${offset}`);
}

export async function fetchTopFrequency(kind: "words" | "roots" = "words", limit = 25): Promise<TopFrequencyItem[]> {
  const res = await apiFetch<{ data: TopFrequencyItem[] | null }>(`/frequency/top?kind=${kind}&limit=${limit}`);
  return res.data ?? [];
}

export interface WordContextResponse {
  word_id: number;
  arabic_text: string;
  normalized_word: string;
  translation_id: string;
  root: { id: number | null; arabic_text: string };
  meaning_groups: { translation: string; count: number }[] | null;
  collocations: {
    root_id: number;
    root_text: string;
    ayah_count: number;
    sample_arabic: string;
    sample_translation: string;
  }[] | null;
  ayahs: {
    ayah_id: number;
    surah_id: number;
    surah_name: string;
    ayah_number: number;
    word_id: number;
    word_arabic: string;
    translation_id: string;
    ayah_text: string;
    page_number: number | null;
  }[] | null;
  pagination: { total: number; limit: number; offset: number };
}

export async function fetchWordContext(
  wordId: number,
  opts?: { pairRootId?: number; meaning?: string; limit?: number; offset?: number }
): Promise<WordContextResponse> {
  const sp = new URLSearchParams({
    pair_root_id: String(opts?.pairRootId ?? 0),
    meaning: opts?.meaning ?? "",
    limit: String(opts?.limit ?? 15),
    offset: String(opts?.offset ?? 0),
  });
  return apiFetch<WordContextResponse>(`/words/${wordId}/context?${sp.toString()}`);
}

export interface KnowledgeConcept {
  id: number;
  slug: string;
  name_arabic: string;
  name_latin: string;
  category: string;
  summary: string;
  source_attribution: string;
  root_text: string;
}

export interface KnowledgeConceptLink {
  id: number;
  source_slug: string;
  target_slug: string;
  source_arabic: string;
  target_arabic: string;
  relation_type: string;
  description: string;
}

export interface KnowledgeTheme {
  id: number;
  slug: string;
  title: string;
  description: string;
  ayah_count: number;
}

export interface KnowledgeOverviewResponse {
  concepts: KnowledgeConcept[] | null;
  links: KnowledgeConceptLink[] | null;
  themes: KnowledgeTheme[] | null;
}

export interface KnowledgeConceptDetailResponse {
  concept: KnowledgeConcept;
  related_concepts: {
    slug: string;
    name_arabic: string;
    name_latin: string;
    relation_type: string;
    description: string;
    direction: string;
  }[] | null;
  ayahs: {
    ayah_id: number;
    surah_id: number;
    surah_name: string;
    surah_arabic: string;
    ayah_number: number;
    arabic_text: string;
    translation_id: string;
  }[] | null;
}

export interface AyahKnowledgeResponse {
  ayah_id: number;
  surah_id: number;
  surah_name: string;
  surah_arabic: string;
  ayah_number: number;
  arabic_text: string;
  translation_id: string;
  tafsirs: {
    source_name: string;
    author: string;
    license_note: string;
    summary_text: string;
    key_points: string;
  }[] | null;
  cross_references: {
    surah_id: number;
    surah_name: string;
    ayah_number: number;
    relation_type: string;
    explanation: string;
    source_attribution: string;
    arabic_text: string;
  }[] | null;
  themes: { slug: string; title: string; note: string }[] | null;
}

export interface KnowledgeNote {
  id: number;
  title: string;
  content: string;
  tags: string;
  surah_id: number | null;
  surah_name: string;
  ayah_number: number | null;
  concept_slug: string;
  concept_latin: string;
  created_at: string;
}

export async function fetchKnowledgeOverview(): Promise<KnowledgeOverviewResponse> {
  return apiFetch<KnowledgeOverviewResponse>("/knowledge/overview");
}

export async function fetchKnowledgeConcept(slug: string): Promise<KnowledgeConceptDetailResponse> {
  return apiFetch<KnowledgeConceptDetailResponse>(`/knowledge/concepts/${encodeURIComponent(slug)}`);
}

export async function fetchKnowledgeTheme(slug: string): Promise<{
  theme: KnowledgeTheme;
  ayahs: {
    ayah_id: number;
    surah_id: number;
    surah_name: string;
    surah_arabic: string;
    ayah_number: number;
    note: string;
    concept_slug: string;
    concept_arabic: string;
    arabic_text: string;
  }[] | null;
}> {
  return apiFetch(`/knowledge/themes/${encodeURIComponent(slug)}`);
}

export async function fetchAyahKnowledge(surah: number, ayah: number): Promise<AyahKnowledgeResponse> {
  return apiFetch<AyahKnowledgeResponse>(`/ayahs/${surah}/${ayah}/knowledge`);
}

export async function fetchKnowledgeNotes(): Promise<KnowledgeNote[]> {
  const res = await apiFetch<{ notes: KnowledgeNote[] | null }>("/knowledge/notes");
  return res.notes ?? [];
}

export async function createKnowledgeNote(body: {
  title: string;
  content: string;
  tags?: string;
  surah_id?: number;
  ayah_number?: number;
  concept_slug?: string;
}): Promise<{ id: number }> {
  return apiFetch<{ id: number }>("/knowledge/notes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function deleteKnowledgeNote(id: number): Promise<void> {
  await apiFetch<void>(`/knowledge/notes/${id}`, { method: "DELETE" });
}
