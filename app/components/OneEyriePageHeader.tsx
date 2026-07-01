import React from "react";
import {
  PAGE_HEADER_ROW,
  PAGE_SUBTITLE,
  PAGE_TITLE,
} from "@/app/lib/oneEyrieLayout";

type OneEyriePageHeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  align?: "flex-start" | "center";
  titleClassName?: string;
};

export default function OneEyriePageHeader({
  title,
  subtitle,
  actions,
  align = "flex-start",
  titleClassName,
}: OneEyriePageHeaderProps) {
  return (
    <div
      className="one-eyrie-page-header"
      style={{ ...PAGE_HEADER_ROW, alignItems: align }}
    >
      <div className="one-eyrie-page-header__title-block">
        <h1 className={titleClassName} style={PAGE_TITLE}>
          {title}
        </h1>
        {subtitle ? <p style={PAGE_SUBTITLE}>{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="one-eyrie-page-header__actions">{actions}</div>
      ) : null}
    </div>
  );
}
