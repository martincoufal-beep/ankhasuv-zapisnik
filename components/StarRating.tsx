"use client";

import { useState } from "react";

function Star({ fill, size }: { fill: 0 | 0.5 | 1; size: number }) {
  const path =
    "M12 2.6l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.1l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8L12 2.6z";
  return (
    <span
      className="relative inline-block"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="absolute inset-0 text-line"
        fill="currentColor"
      >
        <path d={path} />
      </svg>
      {fill > 0 && (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: fill === 1 ? "100%" : "50%" }}
        >
          <svg
            viewBox="0 0 24 24"
            width={size}
            height={size}
            className="text-brass"
            fill="currentColor"
          >
            <path d={path} />
          </svg>
        </span>
      )}
    </span>
  );
}

/** Zobrazení hodnocení: value je 0–10 (pět hvězd s polovinami). */
export function StarDisplay({
  value,
  size = 14,
}: {
  value: number;
  size?: number;
}) {
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`Hodnocení ${value / 2} z 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = value >= (i + 1) * 2 ? 1 : value === i * 2 + 1 ? 0.5 : 0;
        return <Star key={i} fill={fill} size={size} />;
      })}
    </span>
  );
}

/** Vstup hodnocení s polovinami hvězd. value 0–10 nebo null (bez hodnocení). */
export function StarInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  const size = 26;

  return (
    <div className="flex items-center gap-3">
      <div
        className="flex items-center gap-0.5"
        onMouseLeave={() => setHover(null)}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const fill =
            shown >= (i + 1) * 2 ? 1 : shown === i * 2 + 1 ? 0.5 : 0;
          return (
            <span key={i} className="relative">
              <Star fill={fill} size={size} />
              <button
                type="button"
                aria-label={`${i + 0.5} hvězdy`}
                onMouseEnter={() => setHover(i * 2 + 1)}
                onFocus={() => setHover(i * 2 + 1)}
                onClick={() => onChange(i * 2 + 1)}
                className="absolute inset-y-0 left-0 w-1/2"
              />
              <button
                type="button"
                aria-label={`${i + 1} hvězd`}
                onMouseEnter={() => setHover((i + 1) * 2)}
                onFocus={() => setHover((i + 1) * 2)}
                onClick={() => onChange((i + 1) * 2)}
                className="absolute inset-y-0 right-0 w-1/2"
              />
            </span>
          );
        })}
      </div>
      <span className="min-w-10 text-sm tabular-nums text-muted">
        {value !== null ? `${value / 2} / 5` : "—"}
      </span>
      {value !== null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="transition-quick text-xs text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          zrušit
        </button>
      )}
    </div>
  );
}
