"use client";

import { useState } from "react";
import Flashcards from "@/app/components/Flashcards";
import QuizPlayer from "@/app/components/QuizPlayer";
import MindMapView from "@/app/components/MindMapView";
import DiagramView from "@/app/components/DiagramView";
import type {
  DiagramResult,
  GeneratedSet,
  MindMapResult,
} from "@/app/lib/types";

const SAMPLE_NOTES = `Photosynthesis is the process by which green plants, algae, and some bacteria convert light energy into chemical energy stored in glucose. It takes place mainly in the leaves, inside organelles called chloroplasts. Chlorophyll, the green pigment in chloroplasts, absorbs sunlight, mostly in the blue and red parts of the spectrum, and reflects green light, which is why plants look green.

Photosynthesis has two main stages. The light-dependent reactions happen in the thylakoid membranes of the chloroplast. Water molecules are split, releasing oxygen gas as a byproduct, and the energy from sunlight is used to produce ATP and NADPH, two short-term energy carriers. The light-independent reactions, also called the Calvin cycle, take place in the stroma, the fluid surrounding the thylakoids. Carbon dioxide from the air is fixed into organic molecules using the ATP and NADPH made in the first stage, eventually producing glucose.

Cellular respiration is the opposite process in many ways. It breaks down glucose in the presence of oxygen to release energy as ATP, producing carbon dioxide and water as waste products. It happens in three stages: glycolysis in the cytoplasm, the Krebs cycle in the mitochondria, and the electron transport chain on the inner mitochondrial membrane. Glycolysis splits one glucose molecule into two molecules of pyruvate and produces a small net gain of two ATP. The Krebs cycle completes the breakdown of pyruvate, releasing carbon dioxide and carrying high-energy electrons to the final stage. The electron transport chain produces most of the ATP, around 34 molecules per glucose, using oxygen as the final electron acceptor. Without oxygen, cells can still make a little ATP through fermentation, but far less efficiently.

Together, photosynthesis and cellular respiration form a cycle. The oxygen released by photosynthesis is used in respiration, and the carbon dioxide released by respiration is used in photosynthesis. This exchange keeps the balance of gases in the atmosphere and powers nearly all life on Earth, directly or indirectly.`;

export default function Home() {
  const [notes, setNotes] = useState("");
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedSet | null>(null);
  const [view, setView] = useState<"quiz" | "cards" | "mindmap" | "diagram">(
    "quiz"
  );
  const [quizKey, setQuizKey] = useState(0);

  // Visuals load lazily — only when a tab is first opened, so the quiz
  // generation never pays for an extra AI call up front.
  const [mindMap, setMindMap] = useState<MindMapResult | null>(null);
  const [mindMapLoading, setMindMapLoading] = useState(false);
  const [mindMapError, setMindMapError] = useState<string | null>(null);
  const [diagram, setDiagram] = useState<DiagramResult | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [diagramNeedsKey, setDiagramNeedsKey] = useState(false);

  async function loadMindMap() {
    if (mindMap || mindMapLoading) return;
    setMindMapLoading(true);
    setMindMapError(null);
    try {
      const res = await fetch("/api/visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, mode: "mindmap" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMindMapError(data.error ?? "Could not build a mind map.");
        return;
      }
      setMindMap(data as MindMapResult);
    } catch {
      setMindMapError("Could not reach the server. Check your connection and try again.");
    } finally {
      setMindMapLoading(false);
    }
  }

  async function loadDiagram(regenerate = false) {
    if ((diagram && !regenerate) || diagramLoading) return;
    setDiagramLoading(true);
    setDiagramError(null);
    setDiagramNeedsKey(false);
    try {
      const res = await fetch("/api/visuals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, mode: "diagram", regenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsKey) setDiagramNeedsKey(true);
        else setDiagramError(data.error ?? "Could not build a diagram.");
        return;
      }
      setDiagram(data as DiagramResult);
    } catch {
      setDiagramError("Could not reach the server. Check your connection and try again.");
    } finally {
      setDiagramLoading(false);
    }
  }

  function openTab(tab: "quiz" | "cards" | "mindmap" | "diagram") {
    setView(tab);
    if (tab === "mindmap") loadMindMap();
    if (tab === "diagram") loadDiagram();
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, count }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      setResult(data as GeneratedSet);
      setView("quiz");
      setQuizKey((k) => k + 1);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setMindMap(null);
    setMindMapError(null);
    setDiagram(null);
    setDiagramError(null);
    setDiagramNeedsKey(false);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:pt-14">
      <header className="flex items-center justify-between">
        <p className="text-lg font-semibold tracking-tight text-stone-900">
          QuizForge
        </p>
        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
          Built for IceHacks 2026
        </span>
      </header>

      {!result && (
        <>
          <section className="mt-12 sm:mt-16">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-stone-900 sm:text-5xl">
              Turn lecture notes into a quiz.
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-stone-600">
              Paste your notes. Get multiple-choice questions with
              explanations, flashcards to drill the key terms, a mind map of
              the ideas, and a diagram of the process — all built from the
              same notes.
            </p>
          </section>

          <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
            <label
              htmlFor="notes"
              className="text-sm font-semibold text-stone-900"
            >
              Your lecture notes
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={11}
              placeholder="Paste a few paragraphs of lecture notes here — the more complete the sentences, the better the questions…"
              className="mt-3 w-full resize-y rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3 text-[15px] leading-relaxed text-stone-800 outline-none placeholder:text-stone-400 focus:border-lime-700 focus:bg-white focus:ring-2 focus:ring-lime-700/15"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-stone-400">
              <span>{notes.trim().length} characters</span>
              <span>At least 100 characters, full sentences work best</span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-stone-700">
                Questions:
              </span>
              {[5, 10, 15].map((n) => (
                <button
                  key={n}
                  onClick={() => setCount(n)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                    count === n
                      ? "bg-stone-900 text-white"
                      : "border border-stone-300 text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setNotes(SAMPLE_NOTES)}
                className="ml-auto text-sm font-medium text-lime-800 underline underline-offset-2 hover:text-lime-900"
              >
                Try sample notes
              </button>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              onClick={generate}
              disabled={loading || notes.trim().length < 100}
              className="mt-5 w-full rounded-full bg-lime-800 px-6 py-3.5 text-base font-medium text-white hover:bg-lime-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Reading your notes…" : "Generate my quiz"}
            </button>
            <p className="mt-3 text-center text-xs text-stone-400">
              Nothing is stored. Notes are sent to Google&apos;s Gemini API
              only when an API key is configured on the server.
            </p>
          </section>

          <section className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "1. Paste notes",
                body: "Any subject — biology, history, law. Full sentences beat bullet fragments.",
              },
              {
                title: "2. Get a quiz — and visuals",
                body: "Multiple-choice questions with a short explanation for every answer, plus a mind map and a diagram of the process.",
              },
              {
                title: "3. Test yourself",
                body: "Score, review your misses, flip through flashcards, and trace the ideas on the map.",
              },
            ].map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-stone-200 bg-white p-5"
              >
                <h3 className="text-sm font-semibold text-stone-900">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  {s.body}
                </p>
              </div>
            ))}
          </section>
        </>
      )}

      {result && (
        <>
          <section className="mt-10">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                Your study pack is ready
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  result.source === "gemini"
                    ? "bg-lime-100 text-lime-800"
                    : "bg-amber-100 text-amber-800"
                }`}
              >
                {result.source === "gemini"
                  ? "AI-generated with Gemini"
                  : "Offline mode — built from your notes"}
              </span>
              <button
                onClick={reset}
                className="ml-auto text-sm font-medium text-stone-600 underline underline-offset-2 hover:text-stone-900"
              >
                New notes
              </button>
            </div>
            {result.note && (
              <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {result.note}
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={() => openTab("quiz")}
                className={`rounded-full px-5 py-2 text-sm font-medium ${
                  view === "quiz"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-300 text-stone-700 hover:bg-stone-50"
                }`}
              >
                Quiz ({result.questions.length})
              </button>
              <button
                onClick={() => openTab("cards")}
                className={`rounded-full px-5 py-2 text-sm font-medium ${
                  view === "cards"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-300 text-stone-700 hover:bg-stone-50"
                }`}
              >
                Flashcards ({result.flashcards.length})
              </button>
              <button
                onClick={() => openTab("mindmap")}
                className={`rounded-full px-5 py-2 text-sm font-medium ${
                  view === "mindmap"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-300 text-stone-700 hover:bg-stone-50"
                }`}
              >
                Mind Map
              </button>
              <button
                onClick={() => openTab("diagram")}
                className={`rounded-full px-5 py-2 text-sm font-medium ${
                  view === "diagram"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-300 text-stone-700 hover:bg-stone-50"
                }`}
              >
                Diagram
              </button>
            </div>

            <div className="mt-5">
              {view === "quiz" ? (
                <QuizPlayer
                  key={quizKey}
                  questions={result.questions}
                  onRetake={() => setQuizKey((k) => k + 1)}
                  onNewNotes={reset}
                />
              ) : view === "cards" ? (
                <Flashcards cards={result.flashcards} />
              ) : view === "mindmap" ? (
                mindMapLoading ? (
                  <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
                    Building your mind map…
                  </div>
                ) : mindMapError ? (
                  <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-red-700">
                    {mindMapError}
                  </div>
                ) : mindMap ? (
                  <MindMapView data={mindMap} />
                ) : null
              ) : diagramLoading ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
                  Drawing your diagram…
                </div>
              ) : diagramNeedsKey ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
                  <p className="text-sm font-semibold text-stone-900">
                    Diagrams need AI
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-stone-600">
                    A diagram has to be drawn from your notes by AI — a
                    made-up one would teach you the wrong thing. Add a Gemini
                    API key on the server and this tab will draw flowcharts
                    and timelines from your notes.
                  </p>
                </div>
              ) : diagramError ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-red-700">
                  {diagramError}
                </div>
              ) : diagram ? (
                <DiagramView
                  data={diagram}
                  onRegenerate={() => loadDiagram(true)}
                  regenerating={diagramLoading}
                />
              ) : null}
            </div>
          </section>
        </>
      )}

      <footer className="mt-14 border-t border-stone-200 pt-5 text-xs text-stone-400">
        QuizForge — built during IceHacks 2026 (Nov 9–15). Paste notes, get a
        quiz, flashcards, a mind map, and a diagram. Learn faster.
      </footer>
    </main>
  );
}
