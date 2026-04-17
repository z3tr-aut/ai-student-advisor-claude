export default function SuggestionChip({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick?: () => void;
  icon?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="suggestion-chip flex items-center gap-2"
    >
      {icon && <span className="material-symbols-outlined text-base">{icon}</span>}
      <span>{label}</span>
    </button>
  );
}
