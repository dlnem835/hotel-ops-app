type OneEyrieWordmarkProps = {
  className?: string;
};

export default function OneEyrieWordmark({ className }: OneEyrieWordmarkProps) {
  return (
    <div className={className ? `one-eyrie-wordmark ${className}` : "one-eyrie-wordmark"}>
      ONE EYRIE
    </div>
  );
}
