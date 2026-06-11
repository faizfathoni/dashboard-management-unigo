import React, { useState } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, Calendar, ExternalLink, Printer } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Dialog } from "../components/ui/Dialog";

export function OrdersPage({ orders }) {
  const [activeChannel, setActiveChannel] = useState("All"); // 'All', 'Shopee', 'TikTok Shop', 'Offline'
  const [activeStatus, setActiveStatus] = useState("All"); // 'All', 'pengiriman sukses', 'pembatalan', 'pengembalian retur', 'pengiriman gagal'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Filter channels
  const channels = ["All", "Shopee", "TikTok Shop", "Offline"];

  // Filter statuses
  const statuses = [
    { id: "All", label: "Semua Status" },
    { id: "pengiriman sukses", label: "Pengiriman Sukses" },
    { id: "pembatalan", label: "Pembatalan" },
    { id: "pengembalian retur", label: "Retur" },
    { id: "pengiriman gagal", label: "Pengiriman Gagal" },
  ];

  // Helper format currency
  const formatIDR = (num) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Perform search and filters
  const filteredOrders = orders.filter((order) => {
    const matchesChannel = activeChannel === "All" || order.channel === activeChannel;
    const matchesStatus = activeStatus === "All" || order.status === activeStatus;
    const matchesSearch =
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesChannel && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Channels Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/20 p-4 rounded-xl border border-slate-800/60">
        {/* Marketplace Channels Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 shrink-0">
          {channels.map((chan) => (
            <button
              key={chan}
              onClick={() => setActiveChannel(chan)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeChannel === chan
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/10"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
              }`}
            >
              {chan === "All" ? "Semua Saluran" : chan}
            </button>
          ))}
        </div>

        {/* Search Input bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Cari ID Pesanan / nama pembeli..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-input pl-9 w-full"
          />
        </div>
      </div>

      {/* Status filter chips Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mt-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500 shrink-0 select-none">Status:</span>
        <div className="flex gap-1.5">
          {statuses.map((stat) => (
            <button
              key={stat.id}
              onClick={() => setActiveStatus(stat.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                activeStatus === stat.id
                  ? "bg-violet-500/15 border-violet-500/40 text-violet-300"
                  : "bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300"
              }`}
            >
              {stat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table Card */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Daftar Pesanan Toko</CardTitle>
              <CardDescription>
                Menampilkan {filteredOrders.length} pesanan hasil filter saat ini.
              </CardDescription>
            </div>
            <span className="text-[10px] text-slate-500 font-medium font-mono uppercase bg-slate-950/60 px-2.5 py-1 rounded border border-slate-850">
              Database Sync
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID Pesanan</TableHead>
                <TableHead>Saluran</TableHead>
                <TableHead>Pembeli</TableHead>
                <TableHead>Tanggal Masuk</TableHead>
                <TableHead className="text-right">Total Transaksi</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="w-20 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer" onClick={() => setSelectedOrder(order)}>
                  <TableCell className="font-mono text-xs font-semibold text-slate-300 hover:text-violet-400 transition-colors">
                    {order.id}
                  </TableCell>
                  <TableCell>
                    <Badge>{order.channel}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-200">
                    {order.customer}
                  </TableCell>
                  <TableCell className="text-slate-400">
                    {new Date(order.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-200">
                    {formatIDR(order.total)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge>{order.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedOrder(order)}
                      icon={ExternalLink}
                      className="h-8 w-8 p-0"
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                    Tidak ada pesanan yang sesuai dengan filter atau pencarian Anda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Detail Dialog modal */}
      <Dialog
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={`Rincian Pesanan - ${selectedOrder?.id}`}
      >
        {selectedOrder && (
          <div className="space-y-4 pt-1">
            {/* Meta status details */}
            <div className="grid grid-cols-2 gap-4 bg-slate-900/40 border border-slate-800 p-3 rounded-lg text-xs">
              <div>
                <p className="text-slate-500 font-semibold">Saluran Integrasi</p>
                <p className="text-slate-200 mt-1 flex items-center gap-1.5 font-bold">
                  <Badge>{selectedOrder.channel}</Badge>
                </p>
              </div>
              <div>
                <p className="text-slate-500 font-semibold">Status Pengiriman</p>
                <p className="text-slate-200 mt-1 font-bold">
                  <Badge>{selectedOrder.status}</Badge>
                </p>
              </div>
            </div>

            {/* Buyer information */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Informasi Pelanggan
              </h4>
              <div className="bg-slate-900/20 border border-slate-850 p-3 rounded-lg text-xs space-y-1">
                <p className="text-slate-300">
                  Nama Pembeli: <span className="font-semibold text-slate-100">{selectedOrder.customer}</span>
                </p>
                <p className="text-slate-300">
                  Tanggal Pemesanan:{" "}
                  <span className="font-semibold text-slate-100">
                    {new Date(selectedOrder.date).toLocaleString("id-ID")}
                  </span>
                </p>
              </div>
            </div>

            {/* Ordered items list */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Daftar Barang Belanjaan
              </h4>
              <div className="border border-slate-850 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-950/40">
                      <TableHead className="py-2 text-[10px]">Nama Barang</TableHead>
                      <TableHead className="py-2 text-[10px] text-center">Qty</TableHead>
                      <TableHead className="py-2 text-[10px] text-right">Harga Satuan</TableHead>
                      <TableHead className="py-2 text-[10px] text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-[11px]">
                    {selectedOrder.items.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-transparent">
                        <TableCell className="py-2.5 font-semibold text-slate-200">
                          {item.name}
                        </TableCell>
                        <TableCell className="py-2.5 text-center font-mono font-semibold">
                          {item.qty}
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-mono">
                          {formatIDR(item.price)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-mono font-bold text-slate-100">
                          {formatIDR(item.price * item.qty)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Calculations and sums */}
            <div className="border-t border-slate-800 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal Produk</span>
                <span className="font-mono">{formatIDR(selectedOrder.total)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Biaya Pengiriman</span>
                <span className="font-mono text-emerald-400">Gratis Ongkir</span>
              </div>
              <div className="flex justify-between text-slate-200 text-sm font-bold border-t border-slate-850 pt-2">
                <span>Total Belanja</span>
                <span className="font-mono text-violet-400">{formatIDR(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Dialog footer buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
                Tutup
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Printer}
                onClick={() => alert("Cetak invoice berhasil dikirim ke printer thermal.")}
                className="border-slate-800 hover:border-slate-700 bg-slate-900/40"
              >
                Cetak Label
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
