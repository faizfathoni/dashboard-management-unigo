import React from "react";
import { LayoutDashboard, Package2, ClipboardList, Settings, Store, ArrowRightLeft } from "lucide-react";

export function Sidebar({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: "overview", label: "Ringkasan", icon: LayoutDashboard },
    { id: "inventory", label: "Barang Masuk/Keluar", icon: ArrowRightLeft },
    { id: "orders", label: "Data Pesanan", icon: ClipboardList },
    { id: "settings", label: "Pengaturan Toko", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950 flex flex-col shrink-0 h-screen sticky top-0">
      {/* Brand Logo */}
      <div className="p-6 border-b border-slate-800/60 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Store className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="font-bold text-lg bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            UNIGO STORE
          </span>
          <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
            Management
          </p>
        </div>
      </div>

      {/* Store Switcher */}
      <div className="p-4 border-b border-slate-800/40">
        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800 flex items-center justify-between group cursor-default">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Store className="w-4 h-4 text-violet-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">Toko Utama</p>
              <p className="text-[10px] text-slate-400">Single Store Mode</p>
            </div>
          </div>
          <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700/80 font-mono scale-90">
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
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all cursor-pointer ${isActive
                  ? "bg-violet-600/10 border-l-2 border-violet-500 text-violet-300"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border-l-2 border-transparent"
                }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-violet-400" : "text-slate-500"}`} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800/60">
        <div className="text-[11px] text-slate-500 text-center">
          <p className="font-semibold text-slate-400">Multi-Store Version</p>
          <p className="mt-0.5">V1.0.0 (Beta)</p>
        </div>
      </div>
    </aside>
  );
}
