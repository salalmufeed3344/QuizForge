// Gemini (Google AI Studio) generation via the REST API — no SDK needed.
// Returns null on any failure so the caller can fall back to the
// offline generator instead of hard-failing the demo.

import type {
  DiagramResult,
  DiagramType,
  GeneratedSet,
  MindMapNode,
  MindMapResult,
} from "./types";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// One Gemini call: structured JSON out, parsed JSON back, null on any
// failure so the caller can fall back (or fail honestly) instead of
// hard-failing the demo.
async function callGeminiJson(
  systemPrompt: string,
  userText: string,
  responseSchema: object,
  apiKey: string
): Promise<unknown | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userText }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.7,
        },
      }),
      signal: AbortSignal.timeout(45000),
    });

    if (!res.ok) {
      console.error("Gemini request failed:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "";
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.error("Gemini generation error:", err);
    return null;
  }
}

const SYSTEM_PROMPT = `You turn lecture notes into study material. Given the notes, write clear multiple-choice quiz questions and flashcards that test real understanding, not trivia. Every question must be answerable from the notes alone. Each question needs exactly 4 options, one correct answer, and a one-sentence explanation that cites the idea from the notes. Flashcards pair a key term or concept with a short definition in plain words. Keep language simple and direct.`;

function buildSchema(count: number) {
  return {
    type: "OBJECT",
    properties: {
      questions: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            question: { type: "STRING" },
            options: {
              type: "ARRAY",
              items: { type: "STRING" },
              minItems: 4,
              maxItems: 4,
            },
            correctIndex: { type: "INTEGER", minimum: 0, maximum: 3 },
            explanation: { type: "STRING" },
          },
          required: ["question", "options", "correctIndex", "explanation"],
        },
        minItems: count,
        maxItems: count,
      },
      flashcards: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            front: { type: "STRING" },
            back: { type: "STRING" },
          },
          required: ["front", "back"],
        },
        minItems: 4,
        maxItems: 12,
      },
    },
    required: ["questions", "flashcards"],
  };
}

export async function generateWithGemini(
  notes: string,
  count: number,
  apiKey: string
): Promise<GeneratedSet | null> {
  const parsed = (await callGeminiJson(
    SYSTEM_PROMPT,
    `Create ${count} multiple-choice quiz questions and ${Math.min(12, count + 2)} flashcards from these lecture notes:\n\n${notes}`,
    buildSchema(count),
    apiKey
  )) as GeneratedSet | null;

  if (
    !parsed ||
    !Array.isArray(parsed.questions) ||
    parsed.questions.length === 0 ||
    !parsed.questions.every(
      (q) =>
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4 &&
        typeof q.explanation === "string"
    )
  ) {
    return null;
  }
  return {
    questions: parsed.questions,
    flashcards: Array.isArray(parsed.flashcards) ? parsed.flashcards : [],
    source: "gemini",
  };
}

// ---------------------------------------------------------------------------
// Mind map — 3-level hierarchy, verified against the source notes.
// ---------------------------------------------------------------------------

const MINDMAP_SYSTEM_PROMPT = `You turn lecture notes into a mind map. Given the notes, build a strict 3-level hierarchy: one root topic, 3 to 6 subtopics under it, and 2 to 4 detail nodes under each subtopic.

VERIFY-AGAINST-SOURCE RULE — this is the most important rule: every label must come from the notes. Use only concepts, terms, and facts that are actually stated in the notes. Do NOT invent, elaborate, guess, or add anything the notes do not say. If the notes are thin, use fewer nodes rather than inventing nodes. Keep labels short: root max 6 words, subtopics max 5 words, details max 7 words. Plain words only, no punctuation tricks.`;

function mindMapNodeSchema(depth: number): Record<string, unknown> {
  // depth 1 = root, depth 2 = subtopic, depth 3 = detail (leaf).
  if (depth >= 3) {
    return {
      type: "OBJECT",
      properties: { label: { type: "STRING" } },
      required: ["label"],
    };
  }
  return {
    type: "OBJECT",
    properties: {
      label: { type: "STRING" },
      children: {
        type: "ARRAY",
        items: mindMapNodeSchema(depth + 1),
        minItems: 2,
        maxItems: 6,
      },
    },
    required: ["label", "children"],
  };
}

function normalizeNode(raw: unknown, depth: number): MindMapNode | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { label?: unknown; children?: unknown };
  if (typeof obj.label !== "string" || obj.label.trim().length === 0) {
    return null;
  }
  const label = obj.label.trim().slice(0, 60);
  if (depth >= 3) return { label, children: [] };
  if (!Array.isArray(obj.children)) return null;
  const children = obj.children
    .map((c) => normalizeNode(c, depth + 1))
    .filter((c): c is MindMapNode => c !== null)
    .slice(0, 6);
  if (children.length < 2) return null;
  return { label, children };
}

export async function generateMindMap(
  notes: string,
  apiKey: string
): Promise<MindMapResult | null> {
  const parsed = await callGeminiJson(
    MINDMAP_SYSTEM_PROMPT,
    `Build a mind map from these lecture notes:\n\n${notes}`,
    {
      type: "OBJECT",
      properties: { root: mindMapNodeSchema(1) },
      required: ["root"],
    },
    apiKey
  );
  if (!parsed || typeof parsed !== "object") return null;
  const root = normalizeNode(
    (parsed as { root?: unknown }).root,
    1
  );
  if (!root) return null;
  return { root, source: "gemini" };
}

// ---------------------------------------------------------------------------
// Diagram — Gemini picks the fitting Mermaid diagram for the notes.
// ---------------------------------------------------------------------------

const DIAGRAM_SYSTEM_PROMPT = `You turn lecture notes into a Mermaid diagram. Look at the notes and pick the diagram that fits best: a flowchart if the notes describe a process, cycle, algorithm, or decision chain; a timeline if they describe a historical sequence or dated stages.

Rules:
- Output ONLY the Mermaid code — no markdown fences, no explanation, no extra text.
- Flowchart: start with "flowchart TD", use node ids A, B, C..., short labels in square brackets (max 5 words each), max 12 nodes, plain ASCII only.
- Timeline: start with "timeline", use "title ..." on the first line, then sections with events as "year : event text" lines, max 10 events.
- Every node and event must come from the notes — do not invent steps or dates the notes do not state. If the notes describe no clear process or sequence, say so by returning an empty mermaidCode string.`;

const DIAGRAM_SCHEMA = {
  type: "OBJECT",
  properties: {
    mermaidCode: { type: "STRING" },
    diagramType: { type: "STRING", enum: ["flowchart", "timeline"] },
    title: { type: "STRING" },
  },
  required: ["mermaidCode", "diagramType", "title"],
};

function cleanMermaidCode(raw: string): string {
  let code = raw.trim();
  // Defensive: strip markdown fences if the model added them anyway.
  code = code.replace(/^```(?:mermaid)?\s*/i, "").replace(/```\s*$/, "");
  return code.trim();
}

export async function generateDiagram(
  notes: string,
  apiKey: string,
  regenerate = false
): Promise<DiagramResult | null> {
  const userText =
    `Create a Mermaid diagram from these lecture notes:\n\n${notes}` +
    (regenerate
      ? "\n\nThis is a second attempt — pick a different layout, emphasis, or diagram angle than the obvious first one."
      : "");
  const parsed = (await callGeminiJson(
    DIAGRAM_SYSTEM_PROMPT,
    userText,
    DIAGRAM_SCHEMA,
    apiKey
  )) as {
    mermaidCode?: unknown;
    diagramType?: unknown;
    title?: unknown;
  } | null;

  if (!parsed || typeof parsed.mermaidCode !== "string") return null;
  const mermaidCode = cleanMermaidCode(parsed.mermaidCode);
  if (mermaidCode.length === 0 || mermaidCode.length > 4000) return null;

  // The code must open with the declared diagram type — anything else
  // is a malformed answer, not a diagram.
  const firstWord = mermaidCode.split(/\s+/)[0]?.toLowerCase();
  const diagramType = parsed.diagramType as DiagramType;
  if (
    (diagramType !== "flowchart" && diagramType !== "timeline") ||
    firstWord !== diagramType
  ) {
    return null;
  }
  if (mermaidCode.toLowerCase().includes("<script")) return null;

  return {
    mermaidCode,
    diagramType,
    title:
      typeof parsed.title === "string" && parsed.title.trim().length > 0
        ? parsed.title.trim().slice(0, 80)
        : diagramType === "timeline"
          ? "Timeline"
          : "Process diagram",
    source: "gemini",
  };
}
