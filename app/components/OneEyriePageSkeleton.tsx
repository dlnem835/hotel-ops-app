type OneEyriePageSkeletonProps = {
  variant?: "cards" | "list";
  rows?: number;
};

export default function OneEyriePageSkeleton({
  variant = "cards",
  rows,
}: OneEyriePageSkeletonProps) {
  const count = rows ?? (variant === "list" ? 6 : 4);

  return (
    <div
      className={`one-eyrie-page-skeleton one-eyrie-page-skeleton--${variant}`}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading</span>
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={`one-eyrie-skeleton ${
            variant === "list" ? "one-eyrie-skeleton--row" : "one-eyrie-skeleton--card"
          }`}
        />
      ))}
    </div>
  );
}
