import React from "react";

export function Table({ children, className = "", ...props }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/20">
      <table className={`w-full text-left border-collapse text-sm text-slate-700 dark:text-slate-300 ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = "", ...props }) {
  return (
    <thead className={`bg-slate-100/85 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${className}`} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({ children, className = "", ...props }) {
  return (
    <tbody className={`divide-y divide-slate-200/60 dark:divide-slate-800/60 ${className}`} {...props}>
      {children}
    </tbody>
  );
}

export function TableFooter({ children, className = "", ...props }) {
  return (
    <tfoot className={`border-t border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/40 font-medium ${className}`} {...props}>
      {children}
    </tfoot>
  );
}

export function TableRow({ children, className = "", ...props }) {
  return (
    <tr className={`transition-colors hover:bg-slate-100/60 dark:hover:bg-slate-800/20 ${className}`} {...props}>
      {children}
    </tr>
  );
}

export function TableHead({ children, className = "", ...props }) {
  return (
    <th className={`px-4 py-3 font-semibold text-slate-500 dark:text-slate-400 select-none ${className}`} {...props}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "", ...props }) {
  return (
    <td className={`px-4 py-3 align-middle text-slate-750 dark:text-slate-300 ${className}`} {...props}>
      {children}
    </td>
  );
}
