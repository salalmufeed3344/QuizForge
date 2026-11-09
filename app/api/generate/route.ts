import { NextRequest, NextResponse } from "next/server";
import { generateOffline } from "@/app/lib/offline";
import { generateWithGemini } from "@/app/lib/gemini";
import type { GeneratedSet } from "@/app/lib/types";

const MIN_NOTES = 100;
const MAX_NOTES = 20000;

export async function POST(req: NextRequest) {
  let body: { notes?: unknown; count?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  const count =
    typeof body.count === "number" && [5, 10, 15].includes(body.count)
      ? body.count
      : 10;

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

  if (apiKey) {
    const ai = await generateWithGemini(notes, count, apiKey);
    if (ai) {
      const result: GeneratedSet = { ...ai, source: "gemini" };
      return NextResponse.json(result);
    }
    // Gemini failed (bad key, quota, network) — fall through to offline
    // so the user still gets a working quiz.
  }

  const offline = generateOffline(notes, count);
  if (offline.questions.length === 0) {
    return NextResponse.json(
      {
        error:
          "Could not build questions from these notes — try longer notes with full sentences.",
      },
      { status: 422 }
    );
  }
  return NextResponse.json(offline);
}
