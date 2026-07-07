type ReportsEmptyTabStateProps = {
  title: string;
  description: string;
};

export default function ReportsEmptyTabState({
  title,
  description,
}: ReportsEmptyTabStateProps) {
  return (
    <div className="reports-empty-tab">
      <h2 className="reports-empty-tab__title">{title}</h2>
      <p className="reports-empty-tab__description">{description}</p>
    </div>
  );
}
