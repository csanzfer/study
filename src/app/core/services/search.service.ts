import { Injectable, effect, inject, signal } from '@angular/core';
import MiniSearch from 'minisearch';
import { TaiBlock, Topic } from '../models/study.models';
import { StudyStoreService } from './study-store.service';

export interface SnippetSegment {
  text: string;
  highlight: boolean;
}

export interface TopicSearchResult {
  topic: Topic;
  block?: TaiBlock;
  score: number;
  matchedTerms: string[];
  matchedFields: string[];
  matchedTags: string[];
  snippet: SnippetSegment[];
}

interface IndexedTopicDoc {
  id: string;
  title: string;
  tagsText: string;
  plainText: string;
}

const SNIPPET_BEFORE = 55;
const SNIPPET_AFTER = 105;

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function buildHighlightedSnippet(
  plainText: string,
  terms: string[],
): SnippetSegment[] {
  const cleanText = plainText.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    return [];
  }

  const normalizedTerms = Array.from(
    new Set(
      terms
        .map((term) => normalizeSearchText(term).trim())
        .filter((term) => term.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length);

  if (normalizedTerms.length === 0) {
    const preview = cleanText.length > 140 ? `${cleanText.slice(0, 140).trimEnd()}…` : cleanText;
    return [{ text: preview, highlight: false }];
  }

  const normalizedText = normalizeSearchText(cleanText);
  let firstMatchIndex = -1;

  for (const term of normalizedTerms) {
    const idx = normalizedText.indexOf(term);
    if (idx !== -1 && (firstMatchIndex === -1 || idx < firstMatchIndex)) {
      firstMatchIndex = idx;
    }
  }

  if (firstMatchIndex === -1) {
    const preview = cleanText.length > 140 ? `${cleanText.slice(0, 140).trimEnd()}…` : cleanText;
    return [{ text: preview, highlight: false }];
  }

  const start = Math.max(0, firstMatchIndex - SNIPPET_BEFORE);
  const end = Math.min(cleanText.length, firstMatchIndex + SNIPPET_AFTER);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < cleanText.length ? '…' : '';
  const windowText = cleanText.slice(start, end);
  const windowNormalized = normalizeSearchText(windowText);

  // Collect non-overlapping highlight ranges within the snippet window.
  const ranges: { start: number; end: number }[] = [];
  for (const term of normalizedTerms) {
    let searchFrom = 0;
    while (searchFrom < windowNormalized.length) {
      const idx = windowNormalized.indexOf(term, searchFrom);
      if (idx === -1) {
        break;
      }
      ranges.push({ start: idx, end: idx + term.length });
      searchFrom = idx + term.length;
    }
  }

  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end) {
      merged.push({ ...range });
    } else if (range.end > last.end) {
      last.end = range.end;
    }
  }

  const segments: SnippetSegment[] = [];
  if (prefix) {
    segments.push({ text: prefix, highlight: false });
  }

  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) {
      segments.push({ text: windowText.slice(cursor, range.start), highlight: false });
    }
    segments.push({ text: windowText.slice(range.start, range.end), highlight: true });
    cursor = range.end;
  }

  if (cursor < windowText.length) {
    segments.push({ text: windowText.slice(cursor), highlight: false });
  }

  if (suffix) {
    segments.push({ text: suffix, highlight: false });
  }

  return segments;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly store = inject(StudyStoreService);
  private miniSearch = this.createIndex();

  readonly indexVersion = signal(0);

  constructor() {
    effect(() => {
      const topics = this.store.topics();
      this.rebuildIndex(topics);
    });
  }

  rebuildIndex(topics: Topic[]): void {
    const nextIndex = this.createIndex();
    const docs: IndexedTopicDoc[] = topics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      tagsText: topic.tags.join(' '),
      plainText: topic.plainText ?? '',
    }));

    if (docs.length > 0) {
      nextIndex.addAll(docs);
    }

    this.miniSearch = nextIndex;
    this.indexVersion.update((v) => v + 1);
  }

  search(rawQuery: string, limit = 20): TopicSearchResult[] {
    // Track indexVersion so computed() consumers react when topics change.
    this.indexVersion();

    const query = rawQuery.trim();
    if (!query) {
      return [];
    }

    const searchOptions = {
      boost: { title: 3, tagsText: 2, plainText: 1 },
      prefix: true,
      fuzzy: 0.2,
    };

    let hits = this.miniSearch.search(query, {
      ...searchOptions,
      combineWith: 'AND',
    });

    if (hits.length === 0 && query.includes(' ')) {
      hits = this.miniSearch.search(query, {
        ...searchOptions,
        combineWith: 'OR',
      });
    }

    const queryTokens = query
      .split(/\s+/)
      .map((token) => token.trim())
      .filter(Boolean);

    const results: TopicSearchResult[] = [];
    for (const hit of hits.slice(0, limit)) {
      const topic = this.store.getTopicById(String(hit.id));
      if (!topic) {
        continue;
      }

      const matchedTerms = Array.from(new Set([...hit.terms, ...queryTokens]));
      const matchedFields = Array.from(
        new Set(Object.values(hit.match).flatMap((fields) => fields)),
      );
      const normalizedTerms = matchedTerms.map((term) => normalizeSearchText(term));
      const matchedTags = topic.tags.filter((tag) => {
        const normalizedTag = normalizeSearchText(tag);
        return normalizedTerms.some((term) => term.length > 0 && normalizedTag.includes(term));
      });

      results.push({
        topic,
        block: this.store.getBlockById(topic.blockId),
        score: hit.score,
        matchedTerms,
        matchedFields,
        matchedTags,
        snippet: buildHighlightedSnippet(topic.plainText ?? '', matchedTerms),
      });
    }

    return results;
  }

  private createIndex(): MiniSearch<IndexedTopicDoc> {
    return new MiniSearch<IndexedTopicDoc>({
      fields: ['title', 'tagsText', 'plainText'],
      storeFields: ['id'],
      processTerm: (term) => normalizeSearchText(term),
    });
  }
}
