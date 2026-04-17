export default function AdvisorCard({
  eyebrow,
  title,
  body,
  icon,
  footer,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  icon?: string;
  footer?: React.ReactNode;
}) {
  return (
    <div className="advisor-card group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {eyebrow && (
            <p className="text-label-md font-semibold uppercase tracking-wider text-primary mb-2">
              {eyebrow}
            </p>
          )}
          <h3 className="font-headline text-headline-sm text-on-surface mb-2">
            {title}
          </h3>
          {body && (
            <p className="font-body text-body-md text-on-surface-variant">
              {body}
            </p>
          )}
        </div>
        {icon && (
          <div className="shrink-0 w-12 h-12 rounded-xl bg-surface-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-primary">{icon}</span>
          </div>
        )}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
