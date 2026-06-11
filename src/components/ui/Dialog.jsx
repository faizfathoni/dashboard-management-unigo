import React, { useEffect } from "react";
import { X } from "lucide-react";

export function Dialog({ isOpen, onClose, children, title, className = "" }) {
  // Prevent body scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Content Container */}
      <div
        className={`glass-panel w-full max-w-lg rounded-xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 z-10 p-6 ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          {title && (
            <h3 className="text-lg font-semibold text-slate-100 tracking-tight">
              {title}
            </h3>
          )}
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 rounded-md p-1 hover:bg-slate-800/60 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto pr-1">
          {children}
        </div>
      </div>
    </div>
  );
}
