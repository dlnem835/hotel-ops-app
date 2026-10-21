"use client";

import type { CSSProperties } from "react";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type OneEyrieSegmentedToggleProps<T extends string> = {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
};

export default function OneEyrieSegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: OneEyrieSegmentedToggleProps<T>) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  return (
    <div
      className={`one-eyrie-segmented${className ? ` ${className}` : ""}`}
      role="radiogroup"
      aria-label={ariaLabel}
      data-count={options.length}
      style={
        {
          "--oe-segment-count": String(options.length),
          "--oe-segment-index": String(selectedIndex),
        } as CSSProperties
      }
    >
      <span className="one-eyrie-segmented__thumb" aria-hidden />
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`one-eyrie-segmented__option${
              selected ? " one-eyrie-segmented__option--selected" : ""
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
