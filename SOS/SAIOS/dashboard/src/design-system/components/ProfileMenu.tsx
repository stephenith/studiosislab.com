type Props = {
  initials?: string;
  label?: string;
  onClick?: () => void;
};

export function ProfileMenu({
  initials = "F",
  label = "Founder",
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className="ds-profile"
      onClick={onClick}
      aria-label={`Profile menu · ${label}`}
    >
      <span className="ds-avatar" aria-hidden>
        {initials}
      </span>
      <span className="ds-profile-label muted">{label}</span>
      <span className="ds-profile-caret" aria-hidden>
        ▾
      </span>
    </button>
  );
}
