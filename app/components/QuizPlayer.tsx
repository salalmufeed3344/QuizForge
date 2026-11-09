"use client";

import { useMemo, useState } from "react";
import type { QuizQuestion } from "@/app/lib/types";

interface Props {
  questions: QuizQuestion[];
  onRetake: () => void;
  onNewNotes: () => void;
}

export default function QuizPlayer({ questions, onRetake, onNewNotes }: Props) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const q = questions[index];
  const score = useMemo(() => answers.filter(Boolean).length, [answers]);
  const total = questions.length;

  function pick(i: number) {
    if (selected !== null) return;
    setSelected(i);
    setAnswers((prev) => [...prev, i === q.correctIndex]);
  }

  function next() {
    if (index + 1 >= total) {
      setFinished(true);
    } else {
      setIndex(index + 1);
      setSelected(null);
    }
  }

  if (finished) {
    const pct = Math.round((score / total) * 100);
    const verdict =
      pct >= 90
        ? "Excellent — you know this cold."
        : pct >= 70
          ? "Solid. Review the ones you missed below."
          : pct >= 50
            ? "Getting there — a second pass will help."
            : "Worth another read of the notes, then retake it.";
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
        <p className="text-sm font-medium text-stone-500">Your score</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight text-stone-900">
          {score}
          <span className="text-2xl text-stone-400"> / {total}</span>
        </p>
        <p className="mt-2 text-stone-600">{verdict}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={onRetake}
            className="rounded-full bg-lime-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-lime-900"
          >
            Retake quiz
          </button>
          <button
            onClick={onNewNotes}
            className="rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            New notes
          </button>
        </div>

        <div className="mt-8 border-t border-stone-100 pt-6">
          <h3 className="text-sm font-semibold text-stone-900">Review</h3>
          <ol className="mt-4 space-y-5">
            {questions.map((item, i) => (
              <li key={i} className="text-sm">
                <p className="font-medium text-stone-900">
                  <span
                    className={
                      answers[i]
                        ? "mr-2 inline-block rounded-full bg-lime-100 px-2 py-0.5 text-xs font-semibold text-lime-800"
                        : "mr-2 inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
                    }
                  >
                    {answers[i] ? "Correct" : "Missed"}
                  </span>
                  {item.question}
                </p>
                <p className="mt-1 text-stone-600">
                  Answer:{" "}
                  <span className="font-medium text-stone-900">
                    {item.options[item.correctIndex]}
                  </span>
                </p>
                <p className="mt-0.5 text-stone-500">{item.explanation}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
      <div className="flex items-center justify-between text-sm text-stone-500">
        <span>
          Question {index + 1} of {total}
        </span>
        <span>
          Score so far: {score}/{answers.length}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-lime-700 transition-all"
          style={{ width: `${(index / total) * 100}%` }}
        />
      </div>

      <h2 className="mt-6 text-lg font-semibold leading-snug text-stone-900 sm:text-xl">
        {q.question}
      </h2>

      <div className="mt-5 space-y-3">
        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isPicked = i === selected;
          let cls =
            "border-stone-200 bg-white hover:border-lime-700 hover:bg-lime-50/50";
          if (selected !== null) {
            if (isCorrect) cls = "border-lime-600 bg-lime-50";
            else if (isPicked) cls = "border-red-400 bg-red-50";
            else cls = "border-stone-200 bg-white opacity-60";
          }
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={selected !== null}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-[15px] text-stone-800 transition ${cls}`}
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white text-xs font-semibold text-stone-600">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
              {selected !== null && isCorrect && (
                <span className="ml-auto text-xs font-semibold text-lime-700">
                  Correct
                </span>
              )}
              {selected !== null && isPicked && !isCorrect && (
                <span className="ml-auto text-xs font-semibold text-red-600">
                  Not quite
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div className="mt-5 rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
          <span className="font-semibold text-stone-900">Why: </span>
          {q.explanation}
        </div>
      )}

      <div className="mt-6 flex justify-end">
        <button
          onClick={next}
          disabled={selected === null}
          className="rounded-full bg-lime-800 px-6 py-2.5 text-sm font-medium text-white hover:bg-lime-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {index + 1 >= total ? "See my score" : "Next question"}
        </button>
      </div>
    </div>
  );
}
