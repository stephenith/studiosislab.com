type Props = {
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  onSubmit?: () => void;
  "aria-label"?: string;
  className?: string;
};

export function SearchBar({
  value,
  placeholder = "Search…",
  onChange,
  onSubmit,
  "aria-label": ariaLabel = "Search",
  className = "",
}: Props) {
  return (
    <label className={`ds-search${className ? ` ${className}` : ""}`}>
      <span className="ds-search-icon" aria-hidden>
        ⌕
      </span>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.();
        }}
      />
    </label>
  );
}
