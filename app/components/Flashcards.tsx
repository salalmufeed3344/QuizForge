"use client";

import { useState } from "react";
import type { Flashcard } from "@/app/lib/types";

interface Props {
  cards: Flashcard[];
}

export default function Flashcards({ cards }: Props) {
  const [order, setOrder] = useState<number[]>(() =>
    cards.map((_, i) => i)
  );
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[order[index]];
  const total = cards.length;

  function shuffleOrder() {
    const arr = [...order];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setOrder(arr);
    setIndex(0);
    setFlipped(false);
  }

  function go(delta: number) {
    setIndex((i) => Math.min(total - 1, Math.max(0, i + delta)));
    setFlipped(false);
  }

  if (!card || cards.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
        No flashcards were generated from these notes.
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => setFlipped((f) => !f)}
        className="block w-full rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm transition hover:border-lime-700 sm:min-h-[240px] sm:p-10"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-stone-400">
          {flipped ? "Definition" : "Term"} — click to flip
        </p>
        <p className="mt-4 text-xl font-semibold leading-snug text-stone-900 sm:text-2xl">
          {flipped ? card.back : card.front}
        </p>
      </button>

      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
        >
          ← Previous
        </button>
        <span className="text-sm text-stone-500">
          {index + 1} / {total}
        </span>
        <div className="flex gap-2">
          <button
            onClick={shuffleOrder}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Shuffle
          </button>
          <button
            onClick={() => go(1)}
            disabled={index === total - 1}
            className="rounded-full bg-lime-800 px-4 py-2 text-sm font-medium text-white hover:bg-lime-900 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}
