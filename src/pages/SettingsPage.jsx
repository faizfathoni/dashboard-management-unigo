import React, { useState } from "react";
import { Store, ShieldAlert, KeyRound, Save, HelpCircle, Check, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";

export function SettingsPage() {
  const [storeInfo, setStoreInfo] = useState({
    name: "Toko Utama Unigo",
    phone: "081234567890",
    email: "kontak@unigo.store",
    address: "Jl. Margonda Raya No. 100, Kota Depok, Jawa Barat",
  });

  const [apiKeys, setApiKeys] = useState({
    shopeeShopId: "SHP_9081234",
    shopeeSecret: "••••••••••••••••••••••••••••",
    tiktokSellerId: "TT_4311029",
    tiktokSecret: "••••••••••••••••••••••••••••",
  });

  const [isSaved, setIsSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
    }, 3000);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Save confirmation toast */}
      {isSaved && (
        <div className="fixed bottom-4 right-4 z-50 p-4 rounded-xl bg-emerald-500 text-white shadow-xl flex items-center gap-2 animate-bounce">
          <Check className="w-5 h-5" />
          <span className="text-sm font-semibold">Pengaturan berhasil disimpan!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: General Profile Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Store Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Store className="w-5 h-5 text-violet-400" />
                <CardTitle>Profil Toko Utama</CardTitle>
              </div>
              <CardDescription>Informasi mendasar mengenai toko retail utama Anda.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">Nama Toko</label>
                  <input
                    type="text"
                    value={storeInfo.name}
                    onChange={(e) => setStoreInfo({ ...storeInfo, name: e.target.value })}
                    className="glass-input"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300">Nomor Whatsapp</label>
                  <input
                    type="text"
                    value={storeInfo.phone}
                    onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                    className="glass-input"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Email Kontak Toko</label>
                <input
                  type="email"
                  value={storeInfo.email}
                  onChange={(e) => setStoreInfo({ ...storeInfo, email: e.target.value })}
                  className="glass-input"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-300">Alamat Fisik Toko</label>
                <textarea
                  value={storeInfo.address}
                  onChange={(e) => setStoreInfo({ ...storeInfo, address: e.target.value })}
                  rows={3}
                  className="glass-input resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Card 2: Marketplace API Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-violet-400" />
                <CardTitle>Kredensial API Marketplace</CardTitle>
              </div>
              <CardDescription>
                Konfigurasi API Secret Key untuk menarik data pesanan secara otomatis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Shopee Integration Credentials */}
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-orange-400">Shopee Seller Center</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-400">Shopee Shop ID</label>
                    <input
                      type="text"
                      value={apiKeys.shopeeShopId}
                      onChange={(e) => setApiKeys({ ...apiKeys, shopeeShopId: e.target.value })}
                      className="glass-input text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-400">Partner Key / Secret</label>
                    <input
                      type="password"
                      value={apiKeys.shopeeSecret}
                      onChange={(e) => setApiKeys({ ...apiKeys, shopeeSecret: e.target.value })}
                      className="glass-input text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* TikTok Shop Integration Credentials */}
              <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-400">TikTok Shop Seller Center</span>
                  <span className="text-[10px] text-emerald-400 font-semibold">Active</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-400">TikTok Seller ID</label>
                    <input
                      type="text"
                      value={apiKeys.tiktokSellerId}
                      onChange={(e) => setApiKeys({ ...apiKeys, tiktokSellerId: e.target.value })}
                      className="glass-input text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] text-slate-400">App Secret Key</label>
                    <input
                      type="password"
                      value={apiKeys.tiktokSecret}
                      onChange={(e) => setApiKeys({ ...apiKeys, tiktokSecret: e.target.value })}
                      className="glass-input text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Multi-Store Info & Action Button */}
        <div className="space-y-6">
          {/* Card 3: Multi-Store Feature Info (Scale-up) */}
          <Card className="relative overflow-hidden">
            {/* Shimmer background to make it look premium */}
            <div className="absolute inset-0 bg-gradient-to-tr from-violet-600/10 via-transparent to-transparent pointer-events-none" />
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Users className="w-5 h-5 text-fuchsia-400" />
                <CardTitle>Fitur Multi-Toko</CardTitle>
              </div>
              <CardDescription>Skalakan bisnis dengan cabang tak terbatas.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-850/80 text-xs text-slate-400 space-y-2.5">
                <p>
                  Di masa mendatang, Anda dapat menambahkan **banyak toko (Multi-Store)** ke dalam satu dashboard tunggal ini.
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <span>Kelola inventory cabang terpisah</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <span>Laporan penjualan terkonsolidasi</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-violet-400 shrink-0 mt-0.5" />
                    <span>Akses khusus admin cabang (multi-user)</span>
                  </div>
                </div>
              </div>

              {/* Fake Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-violet-950/10 border border-violet-900/30">
                <div className="text-left">
                  <p className="text-xs font-semibold text-violet-300">Aktifkan Multi-Toko</p>
                  <p className="text-[10px] text-violet-400 mt-0.5">Segera Hadir / Premium</p>
                </div>
                <div className="w-10 h-6 rounded-full bg-slate-800 p-1 flex items-center justify-start cursor-not-allowed">
                  <div className="w-4 h-4 rounded-full bg-slate-600 shadow" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Trigger Card */}
          <Card>
            <CardContent className="p-0 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-850 rounded-lg text-xs">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
                <span className="text-slate-400">
                  Perubahan kredensial API dapat mempengaruhi penarikan data pesanan marketplace.
                </span>
              </div>
              <Button
                variant="primary"
                type="submit"
                icon={Save}
                className="w-full py-2.5 font-bold"
              >
                Simpan Perubahan
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}
