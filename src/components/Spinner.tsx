type Props = {
  className?: string;
};

/** Decorative: the button or status text beside it carries the loading message. */
export function Spinner({ className = "size-4" }: Props) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-hidden
    />
  );
}
