import React from "react";

export function Badge({ children, variant = "default", className = "", ...props }) {
  const baseStyles =
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wider transition-colors select-none border";

  const variants = {
    default: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700",
    primary: "bg-violet-500/10 text-violet-650 dark:text-violet-300 border-violet-500/20",
    
    // Channels
    shopee: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 dark:border-orange-500/20",
    tiktok: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20 dark:border-pink-500/20",
    offline: "bg-sky-500/10 text-sky-650 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/20",
    
    // Statuses
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-505/20 dark:border-amber-500/20",
    danger: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/20",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 dark:border-blue-500/20",
  };

  // Helper map from user's business categories
  let resolvedVariant = variant;
  const label = String(children).toLowerCase();

  if (label === "shopee") resolvedVariant = "shopee";
  else if (label === "tiktok shop" || label === "tiktok") resolvedVariant = "tiktok";
  else if (label === "offline") resolvedVariant = "offline";
  else if (label === "pengiriman sukses" || label === "sukses") resolvedVariant = "success";
  else if (label === "pembatalan" || label === "batal") resolvedVariant = "danger";
  else if (label === "pengembalian retur" || label === "retur") resolvedVariant = "warning";
  else if (label === "pengiriman gagal" || label === "gagal") resolvedVariant = "danger";

  return (
    <span className={`${baseStyles} ${variants[resolvedVariant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
