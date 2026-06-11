import React from "react";
import { RefreshCw, Bell, User } from "lucide-react";
import { Button } from "../ui/Button";

export function Header({ title, onSync, isSyncing, lastSynced }) {
  // Format last synced time to a human readable Indonesian format
  const formatLastSynced = (dateString) => {
    if (!dateString) return "Belum pernah disinkronkan";
    const date = new Date(dateString);
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Title */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 m-0 tracking-tight leading-none">
          {title}
        </h1>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        {/* API Sync Status Info */}
        <div className="text-right hidden sm:block">
          <p className="text-xs font-semibold text-slate-300">Sinkronisasi API</p>
          <p className="text-[10px] text-slate-500">
            Terakhir: {formatLastSynced(lastSynced)}
          </p>
        </div>

        {/* Sync Trigger Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          isLoading={isSyncing}
          icon={RefreshCw}
          className="border-slate-800 hover:border-slate-700 bg-slate-900/40 text-slate-300"
        >
          {isSyncing ? "Menyinkronkan..." : "Sinkronkan Marketplace"}
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-800" />

        {/* Notification Bell */}
        <button className="relative p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 transition-all cursor-pointer">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full animate-pulse-subtle" />
        </button>

        {/* Profile User avatar */}
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-600/20 group-hover:border-violet-500/35 transition-all">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-xs font-semibold text-slate-300 leading-none">Admin Unigo</p>
            <p className="text-[9px] text-slate-500 leading-none mt-0.5">Pemilik Toko</p>
          </div>
        </div>
      </div>
    </header>
  );
}
