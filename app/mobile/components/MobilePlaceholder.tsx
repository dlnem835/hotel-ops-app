import Link from "next/link";

type MobilePlaceholderProps = {
  title: string;
};

export default function MobilePlaceholder({ title }: MobilePlaceholderProps) {
  return (
    <div className="one-eyrie-mobile__inner">
      <Link href="/mobile" className="one-eyrie-mobile-back">
        ← Home
      </Link>
      <h1 className="one-eyrie-mobile-page-title">{title}</h1>
      <div className="one-eyrie-mobile-placeholder">
        {title} is coming soon. This is a Phase 1 placeholder.
      </div>
    </div>
  );
}
