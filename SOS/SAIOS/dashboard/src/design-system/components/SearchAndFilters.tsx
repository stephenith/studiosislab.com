import { SearchBar } from "./SearchBar";

export type FilterChip = {
  id: string;
  label: string;
};

type Props = {
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterChip[];
  activeFilterId?: string;
  onFilterChange?: (id: string) => void;
  className?: string;
};

export function SearchAndFilters({
  searchValue = "",
  searchPlaceholder = "Search…",
  onSearchChange,
  filters = [],
  activeFilterId,
  onFilterChange,
  className = "",
}: Props) {
  return (
    <div className={`ds-search-filters${className ? ` ${className}` : ""}`}>
      {filters.length > 0 ? (
        <div className="ds-search-filters-filters" role="tablist" aria-label="Filters">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              className={
                activeFilterId === f.id ? "ds-chip active" : "ds-chip"
              }
              aria-pressed={activeFilterId === f.id}
              aria-selected={activeFilterId === f.id}
              onClick={() => onFilterChange?.(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      ) : (
        <div />
      )}
      <SearchBar
        value={searchValue}
        placeholder={searchPlaceholder}
        onChange={onSearchChange}
        aria-label={searchPlaceholder}
      />
    </div>
  );
}
