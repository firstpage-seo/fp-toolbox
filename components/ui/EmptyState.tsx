interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
}

/** Dashed empty-state block for filtered lists and result panels. */
export default function EmptyState({ icon = "🔍", title, description }: EmptyStateProps) {
  return (
    <div className="rounded-[14px] border-2 border-dashed border-border bg-surface/50 px-6 py-12 text-center">
      <div className="text-3xl" aria-hidden>
        {icon}
      </div>
      <p className="mt-3 text-sm font-bold text-navy">{title}</p>
      {description ? (
        <p className="mt-1 text-sm text-muted">{description}</p>
      ) : null}
    </div>
  );
}
