"use client";

import type { ReactNode } from "react";

type OneEyrieIosSwitchProps = {
  checked: boolean;
  label: string;
  icon: ReactNode;
  onChange: (checked: boolean) => void;
};

export default function OneEyrieIosSwitch({
  checked,
  label,
  icon,
  onChange,
}: OneEyrieIosSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`one-eyrie-ios-switch-row${checked ? " one-eyrie-ios-switch-row--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="one-eyrie-ios-switch-row__icon" aria-hidden>
        {icon}
      </span>
      <span className="one-eyrie-ios-switch-row__label">{label}</span>
      <span className="one-eyrie-ios-switch" aria-hidden>
        <span className="one-eyrie-ios-switch__thumb" />
      </span>
    </button>
  );
}
