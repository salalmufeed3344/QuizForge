"use client";

import { useEffect, useRef, useState } from "react";
import { renderMermaid } from "@/app/lib/mermaid";

interface Props {
  code: string;
  /** Called with the rendered SVG string (for export). */
  onSvg?: (svg: string) => void;
}

/**
 * Renders Mermaid source to SVG in the browser. The mermaid library is
 * loaded lazily on first use, so it never weighs down the initial page.
 * Invalid generated code shows an honest error instead of a blank box.
 */
export default function MermaidDiagram({ code, onSvg }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const onSvgRef = useRef(onSvg);
  onSvgRef.current = onSvg;

  useEffect(() => {
    let cancelled = false;
    setRendering(true);
    setError(null);
    setSvg(null);
    renderMermaid(code)
      .then((out) => {
        if (cancelled) return;
        setSvg(out);
        onSvgRef.current?.(out);
      })
      .catch(() => {
        if (cancelled) return;
        setError(
          "Could not render this diagram — the generated code was invalid. Try regenerating it."
        );
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (rendering) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        Drawing your diagram…
      </div>
    );
  }

  if (error || !svg) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-red-700">
        {error ?? "Could not render this diagram."}
      </div>
    );
  }

  return (
    <div
      className="overflow-x-auto rounded-2xl border border-stone-200 bg-white p-4 sm:p-6 [&_svg]:mx-auto [&_svg]:max-w-full [&_svg]:!h-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
