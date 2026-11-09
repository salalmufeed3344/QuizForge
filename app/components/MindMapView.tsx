"use client";

import { useMemo, useState } from "react";
import MermaidDiagram from "./MermaidDiagram";
import { mindMapToMermaid } from "@/app/lib/mermaid";
import type { MindMapNode, MindMapResult } from "@/app/lib/types";

interface Props {
  data: MindMapResult;
}

function TreeNode({ node, depth }: { node: MindMapNode; depth: number }) {
  const [open, setOpen] = useState(true);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <button
        onClick={() => hasChildren && setOpen((o) => !o)}
        className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-sm ${
          depth === 0
            ? "font-semibold text-stone-900"
            : "text-stone-700 hover:bg-stone-50"
        }`}
      >
        <span className="mt-0.5 w-4 shrink-0 text-stone-400">
          {hasChildren ? (open ? "▾" : "▸") : "•"}
        </span>
        <span>{node.label}</span>
      </button>
      {hasChildren && open && (
        <ul className="ml-4 border-l border-stone-200 pl-2">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function MindMapView({ data }: Props) {
  const [mode, setMode] = useState<"map" | "outline">("map");
  const code = useMemo(() => mindMapToMermaid(data.root), [data]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            data.source === "gemini"
              ? "bg-lime-100 text-lime-800"
              : "bg-amber-100 text-amber-800"
          }`}
        >
          {data.source === "gemini"
            ? "AI-built with Gemini"
            : "Offline mode — built from your notes"}
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setMode("map")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              mode === "map"
                ? "bg-stone-900 text-white"
                : "border border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMode("outline")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              mode === "outline"
                ? "bg-stone-900 text-white"
                : "border border-stone-300 text-stone-700 hover:bg-stone-50"
            }`}
          >
            Outline
          </button>
        </div>
      </div>

      {data.note && (
        <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {data.note}
        </p>
      )}

      <p className="mt-4 text-sm text-stone-500">
        Three levels — topic, subtopics, details — all taken from your notes.
        Nothing here was invented.
      </p>

      <div className="mt-4">
        {mode === "map" ? (
          <MermaidDiagram code={code} />
        ) : (
          <div className="rounded-2xl border border-stone-200 bg-white p-5">
            <ul>
              <TreeNode node={data.root} depth={0} />
            </ul>
            <p className="mt-3 text-xs text-stone-400">
              Tap a row to expand or collapse it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
