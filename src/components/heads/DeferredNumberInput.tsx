"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  onCommit: (value: number) => void;
  /** Fires once when the field loses focus after editing. */
  onCommitEnd?: () => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

function isTypingKey(key: string): boolean {
  return (
    key.length === 1 ||
    key === "Backspace" ||
    key === "Delete" ||
    key === "ArrowLeft" ||
    key === "ArrowRight" ||
    key === "Home" ||
    key === "End"
  );
}

export function DeferredNumberInput({
  value,
  onCommit,
  onCommitEnd,
  disabled,
  min,
  max,
  step,
  className,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const typingRef = useRef(false);

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
        typingRef.current = false;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
          return;
        }
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          typingRef.current = false;
          return;
        }
        if (isTypingKey(e.key)) {
          typingRef.current = true;
        }
      }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (!typingRef.current) {
          commit(next);
        }
      }}
      onBlur={() => {
        setFocused(false);
        typingRef.current = false;
        commit(draft);
        onCommitEnd?.();
      }}
      onWheel={(e) => {
        if (focused) e.preventDefault();
      }}
    />
  );
}