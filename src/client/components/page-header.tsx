export function PageHeader({
  title,
  eyebrow,
  actions,
  children,
}: {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="border-b border-line bg-white px-4 pt-14 pb-0 md:px-8 md:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-xs font-semibold text-muted">{eyebrow}</div>}
          <h1 className="truncate text-xl font-bold md:text-2xl">{title}</h1>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
