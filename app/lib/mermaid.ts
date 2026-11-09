// Client-side Mermaid helpers. Mermaid is dynamically imported so its
// (large) bundle only loads when a Visuals tab opens — never on page load.
// Rendering uses plain SVG text labels (htmlLabels: false) so the SVG can
// also be rasterized to PNG via canvas; with HTML labels, foreignObject
// content would silently vanish in the export.

import type { MindMapNode } from "./types";

let initialized = false;
let renderCounter = 0;

async function getMermaid() {
  const mod = await import("mermaid");
  const mermaid = mod.default;
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "base",
      fontFamily: "ui-sans-serif, system-ui, sans-serif",
      flowchart: { htmlLabels: false },
      themeVariables: {
        primaryColor: "#ffffff",
        primaryBorderColor: "#a8a29e",
        primaryTextColor: "#1c1917",
        secondaryColor: "#f5f5f4",
        tertiaryColor: "#faf9f6",
        lineColor: "#78716c",
        textColor: "#1c1917",
        background: "#ffffff",
        // Mind map section colors — LIGHT fills so the dark node text
        // stays readable on every section (dark fills rendered
        // unreadable in the first screenshot pass).
        cScale0: "#d9f99d",
        cScale1: "#e7e5e4",
        cScale2: "#bef264",
        cScale3: "#f5f5f4",
        cScale4: "#a3e635",
        cScale5: "#d6d3d1",
        cScale6: "#ecfccb",
        cScale7: "#fafaf9",
      },
    });
    initialized = true;
  }
  return mermaid;
}

/** Render Mermaid source to an SVG string. Throws on invalid syntax. */
export async function renderMermaid(code: string): Promise<string> {
  const mermaid = await getMermaid();
  renderCounter += 1;
  const id = `qf-mermaid-${renderCounter}-${Date.now().toString(36)}`;
  const { svg } = await mermaid.render(id, code);
  return svg;
}

/**
 * Strip characters that break Mermaid mindmap syntax, collapse whitespace,
 * and cap length. Labels come from notes or from the model, so never trust
 * them verbatim.
 */
export function sanitizeMermaidLabel(label: string): string {
  const clean = label
    .replace(/[\r\n]+/g, " ")
    .replace(/[()[\]{}#"`:;]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  // Mind map nodes clip long text mid-word, so cut at a word boundary
  // with an ellipsis. (The Outline view shows the full label.)
  if (clean.length <= 30) return clean;
  const cut = clean.slice(0, 30);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 15 ? cut.slice(0, lastSpace) : cut) + "…";
}

/** Convert a MindMapNode hierarchy to Mermaid mindmap syntax. */
export function mindMapToMermaid(root: MindMapNode): string {
  const lines: string[] = ["mindmap"];
  const seen = new Set<string>();

  function walk(node: MindMapNode, depth: number) {
    // Root gets the double-circle shape; deeper nodes are plain text.
    const label = sanitizeMermaidLabel(node.label) || "Idea";
    const indent = "  ".repeat(depth);
    if (depth === 1) {
      lines.push(`${indent}root((${label}))`);
    } else {
      // Dedupe sibling labels — Mermaid gets confused by identical
      // node text at the same level.
      let unique = label;
      let n = 2;
      while (seen.has(`${depth}:${unique.toLowerCase()}`)) {
        unique = `${label} ${n}`;
        n += 1;
      }
      seen.add(`${depth}:${unique.toLowerCase()}`);
      lines.push(`${indent}${unique}`);
    }
    for (const child of node.children) walk(child, depth + 1);
  }

  walk(root, 1);
  return lines.join("\n");
}

/** Rasterize a Mermaid SVG string to a PNG blob (2x for crispness). */
export async function svgToPng(svg: string): Promise<Blob> {
  const width = parseSvgDimension(svg, "width");
  const height = parseSvgDimension(svg, "height");
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available in this browser.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterize the diagram."));
      img.src = url;
    });
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  } finally {
    URL.revokeObjectURL(url);
  }

  const png = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  if (!png) throw new Error("Could not create the PNG file.");
  return png;
}

function parseSvgDimension(svg: string, attr: "width" | "height"): number {
  // Prefer the viewBox (the true drawing size); fall back to the
  // width/height attributes, then a sane default.
  const viewBox = svg.match(/viewBox="[^"]*"/)?.[0];
  if (viewBox) {
    const parts = viewBox
      .replace('viewBox="', "")
      .replace('"', "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
      return attr === "width" ? parts[2] : parts[3];
    }
  }
  const m = svg.match(new RegExp(`${attr}="([0-9.]+)`));
  const value = m ? Number(m[1]) : NaN;
  return Number.isFinite(value) && value > 0 ? value : 1200;
}

/** Trigger a browser download of a text/blob payload. */
export function downloadFile(
  filename: string,
  data: BlobPart,
  mime: string
): void {
  const blob =
    data instanceof Blob ? data : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
