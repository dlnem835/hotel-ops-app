import type { CSSProperties } from "react";
import { ONE_EYRIE } from "./oneEyrieColors";

/** Centered overlay — matches Settings “New Team Member” modal */
export const ONE_EYRIE_MODAL_OVERLAY: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.72)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 999,
};

/** Modal panel shell — gold border, dark row background, subtle glow */
export const ONE_EYRIE_MODAL_BOX: CSSProperties = {
  width: "720px",
  maxWidth: "96vw",
  background: ONE_EYRIE.row,
  border: `1px solid ${ONE_EYRIE.gold}`,
  borderRadius: "16px",
  boxShadow: `0 0 26px ${ONE_EYRIE.goldGlow}`,
  padding: "24px",
};

export const ONE_EYRIE_MODAL_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "22px",
};

export const ONE_EYRIE_MODAL_CLOSE_BUTTON: CSSProperties = {
  background: "transparent",
  border: "none",
  color: ONE_EYRIE.text,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  flexShrink: 0,
};

export const ONE_EYRIE_MODAL_FOOTER: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "24px",
};

export type OneEyrieModalStyleBundle = {
  modalOverlay: CSSProperties;
  modalBox: CSSProperties;
  modalHeader: CSSProperties;
  closeButton: CSSProperties;
  modalFooter: CSSProperties;
};

export function createOneEyrieModalStyles(): OneEyrieModalStyleBundle {
  return {
    modalOverlay: ONE_EYRIE_MODAL_OVERLAY,
    modalBox: ONE_EYRIE_MODAL_BOX,
    modalHeader: ONE_EYRIE_MODAL_HEADER,
    closeButton: ONE_EYRIE_MODAL_CLOSE_BUTTON,
    modalFooter: ONE_EYRIE_MODAL_FOOTER,
  };
}
