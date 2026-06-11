import React from "react";
import { LayoutDashboard, Package2, ClipboardList, Settings, Store, ArrowRightLeft, X } from "lucide-react";

export function Sidebar({ activeTab, setActiveTab, isOpen, setIsOpen }) {
  const menuItems = [
    { id: "overview", label: "Dashboard", icon: LayoutDashboard },
    { id: "inventory", label: "Barang Masuk/Keluar", icon: ArrowRightLeft },
    { id: "orders", label: "Data Pesanan", icon: ClipboardList },
    { id: "settings", label: "Pengaturan Toko", icon: Settings },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 lg:sticky lg:translate-x-0 lg:flex w-64 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-950 flex flex-col shrink-0 h-screen transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {/* Brand Logo & Close Menu */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800/60 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-bold text-base sm:text-lg bg-gradient-to-r from-slate-800 to-slate-900 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              UNIGO STORE
            </span>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium tracking-widest uppercase">
              Management
            </p>
          </div>
        </div>

        {/* Close Button for Mobile Drawer */}
        <button
          onClick={() => setIsOpen(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60 lg:hidden cursor-pointer outline-none transition-all focus:ring-2 focus:ring-violet-500/20"
          title="Tutup Menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Store Switcher */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800/40">
        <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800 flex items-center justify-between group cursor-default">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Store className="w-4 h-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Toko Utama</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-400">Single Store Mode</p>
            </div>
          </div>
          <span className="text-[9px] bg-slate-200/65 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-700/80 font-mono scale-90">
            Active
          </span>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all cursor-pointer ${
                isActive
                  ? "bg-violet-600/10 border-l-2 border-violet-500 text-violet-600 dark:text-violet-300"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/40 border-l-2 border-transparent"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-violet-500 dark:text-violet-400" : "text-slate-400 dark:text-slate-500"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/60">
        <div className="text-[11px] text-slate-400 dark:text-slate-500 text-center">
          <p className="font-semibold text-slate-600 dark:text-slate-400">Multi-Store Version</p>
          <p className="mt-0.5">V1.0.0 (Beta)</p>
        </div>
      </div>
    </aside>
  );
}
