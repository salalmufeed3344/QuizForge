"use client";

import { useCallback, useState } from "react";
import MermaidDiagram from "./MermaidDiagram";
import { downloadFile, svgToPng } from "@/app/lib/mermaid";
import type { DiagramResult } from "@/app/lib/types";

interface Props {
  data: DiagramResult;
  onRegenerate: () => void;
  regenerating: boolean;
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "diagram"
  );
}

export default function DiagramView({ data, onRegenerate, regenerating }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const onSvg = useCallback((out: string) => setSvg(out), []);

  const base = `quizforge-${data.diagramType}-${slugify(data.title)}`;

  function downloadSvg() {
    if (!svg) return;
    downloadFile(`${base}.svg`, svg, "image/svg+xml");
  }

  async function downloadPng() {
    if (!svg) return;
    setExporting(true);
    setExportError(null);
    try {
      const png = await svgToPng(svg);
      downloadFile(`${base}.png`, png, "image/png");
    } catch {
      setExportError("PNG export failed in this browser — the SVG download still works.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-stone-900">{data.title}</h2>
        <span className="rounded-full bg-lime-100 px-3 py-1 text-xs font-medium text-lime-800">
          AI-generated with Gemini
        </span>
        <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-500">
          {data.diagramType === "timeline" ? "Timeline" : "Flowchart"}
        </span>
      </div>

      <p className="mt-3 text-sm text-stone-500">
        Built from the process or sequence in your notes — every step comes
        from the text you pasted.
      </p>

      <div className="mt-4">
        <MermaidDiagram code={data.mermaidCode} onSvg={onSvg} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="rounded-full bg-lime-800 px-5 py-2 text-sm font-medium text-white hover:bg-lime-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
        <button
          onClick={downloadSvg}
          disabled={!svg}
          className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
        >
          Download SVG
        </button>
        <button
          onClick={downloadPng}
          disabled={!svg || exporting}
          className="rounded-full border border-stone-300 px-5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
        >
          {exporting ? "Exporting…" : "Download PNG"}
        </button>
      </div>

      {exportError && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {exportError}
        </p>
      )}

      <details className="mt-5 rounded-2xl border border-stone-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-stone-700">
          View Mermaid code
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-stone-50 p-4 text-xs leading-relaxed text-stone-700">
          {data.mermaidCode}
        </pre>
      </details>
    </div>
  );
}
