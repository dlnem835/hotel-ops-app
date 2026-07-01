type OneEyrieWordmarkProps = {
  className?: string;
};

export default function OneEyrieWordmark({ className }: OneEyrieWordmarkProps) {
  return (
    <div className={className ? `one-eyrie-wordmark ${className}` : "one-eyrie-wordmark"}>
      <span className="one-eyrie-wordmark__line">ONE</span>
      <span className="one-eyrie-wordmark__line one-eyrie-wordmark__line--second">EYRIE</span>
    </div>
  );
}
