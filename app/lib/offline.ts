// Offline deterministic quiz generator — no API key needed.
// Builds cloze (fill-in-the-blank) multiple-choice questions and
// term -> definition flashcards straight from the pasted notes.
// Used as the fallback when no Gemini key is configured, so the demo
// never hard-fails for a judge.

import type {
  Flashcard,
  GeneratedSet,
  MindMapNode,
  MindMapResult,
  QuizQuestion,
} from "./types";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for",
  "with", "by", "at", "from", "as", "is", "are", "was", "were", "be",
  "been", "being", "it", "its", "this", "that", "these", "those", "there",
  "here", "which", "who", "whom", "what", "when", "where", "why", "how",
  "can", "could", "will", "would", "should", "may", "might", "must",
  "shall", "do", "does", "did", "have", "has", "had", "not", "no", "yes",
  "if", "then", "than", "so", "such", "also", "into", "over", "under",
  "between", "through", "during", "before", "after", "above", "below",
  "each", "every", "all", "any", "some", "more", "most", "other", "others",
  "one", "two", "first", "second", "called", "known", "used", "using",
  "make", "makes", "made", "take", "takes", "process", "processes",
  // Weak filler words that make poor quiz blanks / flashcards
  "together", "mostly", "directly", "indirectly", "short", "term",
  "short-term", "final", "still", "inner", "outer", "light", "nearly",
  // Weak verbs / generic words that make poor quiz blanks / flashcards
  "keeps", "produces", "produced", "split", "release", "releasing",
  "happens", "gives", "give", "find", "found", "shows", "show", "means",
  "mean", "needs", "need", "helps", "help", "allows", "allow", "causes",
  "cause", "leads", "lead", "results", "result", "occurs", "occur",
  "includes", "include", "contains", "contain", "requires", "require",
  "creates", "create", "works", "work", "moves", "move", "carries",
  "carrying", "breaks", "uses", "use", "gets", "get", "goes", "go",
  "comes", "come", "seems", "seem", "looks", "look", "feels", "feel",
  "around", "without", "another", "much", "many", "main", "three", "down",
  "stage", "stages", "part", "parts", "way", "ways", "time", "times",
  "form", "forms", "place", "become", "becomes", "begins", "ends", "well",
  "back", "forward", "across", "along", "among", "within", "toward",
  "towards", "itself", "himself", "herself", "themselves", "either",
  "neither", "both", "much", "often", "sometimes", "always", "never",
]);

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 280);
}

// Simple deterministic hash -> PRNG so the same notes always give the
// same quiz (stable for demos and judging).
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface Term {
  term: string;
  count: number;
  sentences: number[]; // indexes into sentences[]
}

function extractTerms(sentences: string[]): Term[] {
  const map = new Map<string, Term>();
  sentences.forEach((sentence, si) => {
    const words = sentence.match(/[A-Za-z][A-Za-z'’-]{3,}/g) ?? [];
    const seen = new Set<string>();
    for (const raw of words) {
      const w = raw.toLowerCase();
      if (STOPWORDS.has(w) || seen.has(w)) continue;
      seen.add(w);
      const existing = map.get(w);
      if (existing) {
        existing.count += 1;
        if (!existing.sentences.includes(si)) existing.sentences.push(si);
      } else {
        map.set(w, { term: w, count: 1, sentences: [si] });
      }
    }
  });
  // Keep terms that show up in at least one solid sentence; prefer
  // repeated terms (they are usually the key concepts).
  return [...map.values()]
    .filter((t) => t.sentences.length >= 1)
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term));
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function blankTerm(sentence: string, term: string): string {
  // Replace the first case-insensitive occurrence with a blank.
  const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  return sentence.replace(re, "_____");
}

// ---------------------------------------------------------------------------
// Offline mind map — deterministic hierarchy straight from the notes.
// Root = the most frequent key term; level 2 = the next key terms; level 3
// = short phrases pulled verbatim from the sentences that mention the term.
// Nothing is invented: every label is a word or sentence from the notes.
// ---------------------------------------------------------------------------

function shortDetail(sentence: string, maxLen = 42): string {
  const s = sentence.trim();
  if (s.length <= maxLen) return s;
  const cut = s.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + "…";
}

export function generateOfflineMindMap(notes: string): MindMapResult | null {
  const sentences = splitSentences(notes);
  const terms = extractTerms(sentences);
  if (terms.length < 3 || sentences.length < 3) return null;

  const rand = seededRandom(notes.slice(0, 500) + "|mindmap");

  // Root = the topic term. Lecture notes open with the topic, so take
  // the first key term of the first sentence ("Photosynthesis is the
  // process by which…"). Plain frequency alone picks a detail word
  // like "glucose" over the topic.
  const firstWords =
    (sentences[0] ?? "").match(/[A-Za-z][A-Za-z'’-]{3,}/g) ?? [];
  const rootTerm =
    firstWords
      .map((w) => terms.find((t) => t.term === w.toLowerCase()))
      .find((t): t is (typeof terms)[number] => t !== undefined) ?? terms[0];

  const usedLabels = new Set<string>([rootTerm.term]);

  const level2: MindMapNode[] = [];
  for (const t of terms) {
    if (t.term === rootTerm.term) continue;
    if (level2.length >= 6) break;
    if (usedLabels.has(t.term)) continue;
    usedLabels.add(t.term);

    // Details: short verbatim phrases from sentences mentioning the term.
    const details: MindMapNode[] = [];
    const shuffled = shuffle(t.sentences, rand);
    for (const si of shuffled) {
      if (details.length >= 3) break;
      const detail = shortDetail(sentences[si]);
      const key = detail.toLowerCase();
      if (usedLabels.has(key)) continue;
      usedLabels.add(key);
      details.push({ label: detail, children: [] });
    }
    if (details.length === 0) continue;
    level2.push({ label: titleCase(t.term), children: details });
  }

  if (level2.length < 2) return null;
  return {
    root: { label: titleCase(rootTerm.term), children: level2 },
    source: "offline",
    note: "No AI key configured — this map was built directly from your notes. Add a Gemini API key for an AI-built map.",
  };
}

export function generateOffline(notes: string, count: number): GeneratedSet {
  const sentences = splitSentences(notes);
  const rand = seededRandom(notes.slice(0, 500) + "|" + count);
  const terms = extractTerms(sentences);

  const questions: QuizQuestion[] = [];
  const usedSentences = new Set<number>();

  // Cloze questions: blank out a key term, distractors are other terms.
  const shuffledTerms = shuffle(terms, rand);
  for (const t of shuffledTerms) {
    if (questions.length >= count) break;
    const si = t.sentences.find((i) => {
      if (usedSentences.has(i)) return false;
      // Skip if the term appears more than once in the sentence —
      // blanking it would be ambiguous.
      const occurrences =
        sentences[i].toLowerCase().split(t.term).length - 1;
      return occurrences === 1;
    });
    if (si === undefined) continue;
    const sentence = sentences[si];
    if (!sentence.toLowerCase().includes(t.term)) continue;
    const distractors = shuffle(
      terms.filter((o) => o.term !== t.term),
      rand
    )
      .slice(0, 3)
      .map((o) => titleCase(o.term));
    if (distractors.length < 3) continue;
    const options = shuffle([titleCase(t.term), ...distractors], rand);
    questions.push({
      question: `Fill in the blank: ${blankTerm(sentence, t.term)}`,
      options,
      correctIndex: options.indexOf(titleCase(t.term)),
      explanation: `From your notes: "${sentence}"`,
    });
    usedSentences.add(si);
  }

  // If the notes are thin, fall back to "which sentence is about X"
  // questions so we still return the requested count when possible.
  if (questions.length < count) {
    const remaining = shuffle(sentences, rand);
    for (const s of remaining) {
      if (questions.length >= count) break;
      if (usedSentences.has(sentences.indexOf(s))) continue;
      const termInSentence = terms.find((t) =>
        s.toLowerCase().includes(t.term)
      );
      if (!termInSentence) continue;
      const distractors = shuffle(
        sentences.filter((o) => o !== s),
        rand
      )
        .slice(0, 3)
        .map((o) => (o.length > 90 ? o.slice(0, 87) + "…" : o));
      if (distractors.length < 3) break;
      const options = shuffle(
        [s.length > 90 ? s.slice(0, 87) + "…" : s, ...distractors],
        rand
      );
      questions.push({
        question: `Which statement from your notes is about "${titleCase(termInSentence.term)}"?`,
        options,
        correctIndex: options.indexOf(
          s.length > 90 ? s.slice(0, 87) + "…" : s
        ),
        explanation: `This is the sentence from your notes that discusses ${titleCase(termInSentence.term)}.`,
      });
      usedSentences.add(sentences.indexOf(s));
    }
  }

  // Flashcards: key term on the front, its defining sentence on the back.
  const flashcards: Flashcard[] = shuffle(terms, rand)
    .slice(0, Math.max(4, Math.min(12, count + 2)))
    .map((t) => ({
      front: titleCase(t.term),
      back: sentences[t.sentences[0]],
    }));

  return {
    questions,
    flashcards,
    source: "offline",
    note: "No AI key configured — questions were built directly from your notes. Add a Gemini API key for AI-written questions.",
  };
}
