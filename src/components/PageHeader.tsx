import type { ReactNode } from 'react';

export function PageHeader({ title, desc, actions }: { title: string; desc?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-4">
      <div>
        <h1 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h1>
        {desc && <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{desc}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
