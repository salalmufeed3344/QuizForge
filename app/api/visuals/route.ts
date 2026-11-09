import { NextRequest, NextResponse } from "next/server";
import { generateOfflineMindMap } from "@/app/lib/offline";
import {
  generateDiagram,
  generateMindMap,
} from "@/app/lib/gemini";
import type { DiagramResult, MindMapResult } from "@/app/lib/types";

const MIN_NOTES = 100;
const MAX_NOTES = 20000;

type VisualsBody = {
  notes?: unknown;
  mode?: unknown;
  regenerate?: unknown;
};

/**
 * POST /api/visuals
 * { notes, mode: "mindmap" | "diagram", regenerate?: boolean }
 *
 * Mind map: Gemini when a key is configured, offline hierarchy otherwise
 * (mirrors the quiz route's fallback — the tab never hard-fails).
 * Diagram: Gemini only. Without a key the route says so honestly
 * (needsKey) instead of inventing a diagram.
 */
export async function POST(req: NextRequest) {
  let body: VisualsBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const mode = body.mode === "diagram" ? "diagram" : "mindmap";
  const regenerate = body.regenerate === true;

  if (notes.length < MIN_NOTES) {
    return NextResponse.json(
      {
        error: `Paste at least ${MIN_NOTES} characters of notes — a few solid paragraphs work best.`,
      },
      { status: 400 }
    );
  }
  if (notes.length > MAX_NOTES) {
    return NextResponse.json(
      { error: `Notes are too long — keep them under ${MAX_NOTES} characters.` },
      { status: 400 }
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (mode === "mindmap") {
    if (apiKey) {
      const ai = await generateMindMap(notes, apiKey);
      if (ai) {
        const result: MindMapResult = { ...ai, source: "gemini" };
        return NextResponse.json(result);
      }
      // Gemini failed — fall through to the offline map.
    }
    const offline = generateOfflineMindMap(notes);
    if (!offline) {
      return NextResponse.json(
        {
          error:
            "Could not build a mind map from these notes — try longer notes with full sentences.",
        },
        { status: 422 }
      );
    }
    return NextResponse.json(offline);
  }

  // Diagram: AI only, no fake fallback.
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Diagrams need AI — add your Gemini API key to generate one from your notes.",
        needsKey: true,
      },
      { status: 503 }
    );
  }
  const diagram: DiagramResult | null = await generateDiagram(
    notes,
    apiKey,
    regenerate
  );
  if (!diagram) {
    return NextResponse.json(
      {
        error:
          "The AI could not build a diagram from these notes — they may not describe a clear process or sequence. Try notes with steps, stages, or a timeline.",
      },
      { status: 422 }
    );
  }
  return NextResponse.json(diagram);
}
