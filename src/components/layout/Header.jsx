import React from "react";
import { RefreshCw, Bell, User, Sun, Moon, Menu } from "lucide-react";
import { Button } from "../ui/Button";

export function Header({
  title,
  onSync,
  isSyncing,
  lastSynced,
  theme,
  toggleTheme,
  isSidebarOpen,
  setIsSidebarOpen,
}) {
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
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/85 dark:bg-slate-950/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-40 transition-colors duration-200">
      {/* Title & Hamburger Menu for Mobile */}
      <div className="flex items-center">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900/60 lg:hidden cursor-pointer mr-2 transition-all outline-none focus:ring-2 focus:ring-violet-500/20"
          title="Buka Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base sm:text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100 m-0 tracking-tight leading-none">
          {title}
        </h1>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* API Sync Status Info */}
        <div className="text-right hidden md:block">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sinkronisasi API</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-550">
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
          className="border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 text-xs py-1.5 px-2.5 sm:px-3"
        >
          <span className="hidden sm:inline">{isSyncing ? "Menyinkronkan..." : "Sinkronkan"}</span>
          <span className="sm:hidden">{isSyncing ? "..." : "Sync"}</span>
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

        {/* Theme Toggler */}
        <button
          onClick={toggleTheme}
          className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900/60 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-violet-500/20"
          title={theme === "dark" ? "Aktifkan Mode Terang" : "Aktifkan Mode Gelap"}
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Notification Bell */}
        <button className="relative p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900/60 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-violet-500/20">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-violet-500 rounded-full animate-pulse-subtle" />
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />

        {/* Profile User avatar */}
        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-8 h-8 rounded-lg bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400 group-hover:bg-violet-600/20 group-hover:border-violet-500/35 transition-all">
            <User className="w-4 h-4" />
          </div>
          <div className="hidden lg:block text-left">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 leading-none">Admin Unigo</p>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 leading-none mt-0.5 font-medium">Pemilik Toko</p>
          </div>
        </div>
      </div>
    </header>
  );
}
