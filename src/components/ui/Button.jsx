import React from "react";

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  onClick,
  type = "button",
  icon: Icon,
  isLoading = false,
  ...props
}) {
  const baseStyles =
    "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/40 select-none active:scale-95 disabled:pointer-events-none disabled:opacity-50";

  const variants = {
    primary: "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-600/10 border border-violet-500/20",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80",
    outline: "bg-transparent hover:bg-slate-800/50 text-slate-300 border border-slate-700 hover:text-slate-100",
    ghost: "bg-transparent hover:bg-slate-800/40 text-slate-400 hover:text-slate-200",
    danger: "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/10 border border-rose-500/20",
    success: "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/10 border border-emerald-500/20",
  };

  const sizes = {
    sm: "px-2.5 py-1.5 text-xs gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-5 py-2.5 text-base gap-2.5",
  };

  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      onClick={onClick}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-0.5 mr-1 h-4 w-4 text-current"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!isLoading && Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </button>
  );
}
