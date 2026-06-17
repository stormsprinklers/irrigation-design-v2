"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number;
  onCommit: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function DeferredNumberInput({
  value,
  onCommit,
  disabled,
  min,
  max,
  step,
  className,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  function commit(raw: string) {
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed === "-") return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    onCommit(parsed);
  }

  return (
    <input
      type="number"
      className={className}
      value={focused ? draft : String(value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        commit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
