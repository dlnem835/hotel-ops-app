"use client";

type AdminErrorStateProps = {
  message: string;
};

export default function AdminErrorState({ message }: AdminErrorStateProps) {
  return (
    <section className="admin-portal__card">
      <h2 className="admin-portal__section-title">Unable to load data</h2>
      <p className="admin-portal__muted">{message}</p>
    </section>
  );
}
