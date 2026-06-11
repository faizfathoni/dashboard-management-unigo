import React from "react";
import { TrendingUp, Package, ShoppingBag, XCircle, AlertCircle, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from "recharts";

export function DashboardOverview({ orders, inventoryLogs, products }) {
  // 1. Calculate dynamic statistics
  const successOrders = orders.filter((o) => o.status === "pengiriman sukses");
  const totalRevenue = successOrders.reduce((sum, o) => sum + o.total, 0);

  // Stock items counters
  const totalIncoming = inventoryLogs
    .filter((l) => l.type === "masuk")
    .reduce((sum, l) => sum + l.qty, 0);

  const totalOutgoing = inventoryLogs
    .filter((l) => l.type === "keluar")
    .reduce((sum, l) => sum + l.qty, 0);

  const totalProducts = products.length;
  const lowStockProducts = products.filter((p) => p.stock <= 20).length;

  // Order status counters
  const countByStatus = (statusName) => orders.filter((o) => o.status === statusName).length;
  const statusCounts = {
    success: countByStatus("pengiriman sukses"),
    cancelled: countByStatus("pembatalan"),
    returned: countByStatus("pengembalian retur"),
    failed: countByStatus("pengiriman gagal"),
  };

  // 2. Prepare chart data
  // Channel Breakdown
  const channelRevenue = orders.reduce((acc, order) => {
    if (order.status === "pengiriman sukses") {
      acc[order.channel] = (acc[order.channel] || 0) + order.total;
    }
    return acc;
  }, {});

  const channelChartData = [
    { name: "Shopee", sales: channelRevenue["Shopee"] || 0, color: "#f97316" },
    { name: "TikTok Shop", sales: channelRevenue["TikTok Shop"] || 0, color: "#ec4899" },
    { name: "Offline", sales: channelRevenue["Offline"] || 0, color: "#0ea5e9" },
  ];

  // Status Breakdown Chart Data
  const statusChartData = [
    { name: "Sukses", value: statusCounts.success, color: "#10b981" },
    { name: "Batal", value: statusCounts.cancelled, color: "#ef4444" },
    { name: "Retur", value: statusCounts.returned, color: "#f59e0b" },
    { name: "Gagal", value: statusCounts.failed, color: "#f43f5e" },
  ];

  // Helper format currency
  const formatIDR = (num) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  // Custom tooltips for graphs
  const CustomTooltipSales = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950/90 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs">
          <p className="font-semibold text-slate-200">{payload[0].name}</p>
          <p className="text-violet-400 mt-1 font-semibold">
            Sales: {formatIDR(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomTooltipStatus = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950/90 border border-slate-800 p-2.5 rounded-lg shadow-xl text-xs">
          <p className="font-semibold text-slate-200">{payload[0].name}</p>
          <p className="text-violet-400 mt-1 font-semibold">
            Jumlah: {payload[0].value} Pesanan
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Sales */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">Total Pendapatan</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">{formatIDR(totalRevenue)}</h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span className="text-emerald-400 flex items-center"><ArrowUpRight className="w-3.5 h-3.5" /> +12%</span> vs bulan lalu
            </p>
          </div>
        </Card>

        {/* Metric 2: Stock Inflow */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">Barang Masuk</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <ArrowDownRight className="w-4 h-4 rotate-180" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">{totalIncoming} pcs</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Total restock produk bulan ini
            </p>
          </div>
        </Card>

        {/* Metric 3: Stock Outflow */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">Barang Keluar</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">{totalOutgoing} pcs</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Barang terjual & didistribusikan
            </p>
          </div>
        </Card>

        {/* Metric 4: Low Stock Warnings */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-400">Stok Menipis</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-100">{lowStockProducts} item</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
              {lowStockProducts > 0 ? (
                <span className="text-amber-400 font-semibold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> Perlu restock segera
                </span>
              ) : (
                <span className="text-emerald-400 font-semibold">Stok aman</span>
              )}
            </p>
          </div>
        </Card>
      </div>

      {/* Graphs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph 1: Revenue by Sales Channels */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Omset per Saluran Penjualan</CardTitle>
            <CardDescription>Pendapatan berhasil dibukukan dari pesanan yang sukses.</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelChartData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `Rp ${val / 1000}k`}
                />
                <Tooltip content={<CustomTooltipSales />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                <Bar dataKey="sales" radius={[8, 8, 0, 0]}>
                  {channelChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Graph 2: Order Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Status Pesanan</CardTitle>
            <CardDescription>Rincian status pengiriman marketplace & offline.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            {/* Pie Chart / Donut Chart */}
            <div className="w-full h-44 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltipStatus />} />
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Labels and Stats */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4 w-full text-xs">
              {statusChartData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-400 font-medium">{item.name}</span>
                  <span className="ml-auto font-bold text-slate-200">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration widgets & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Marketplace Integration Health */}
        <Card>
          <CardHeader>
            <CardTitle>Status Integrasi API</CardTitle>
            <CardDescription>Koneksi real-time ke toko marketplace Anda.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Shopee connection card */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-400 font-bold text-sm">
                  S
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Shopee API</p>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Terhubung
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-slate-950 px-2 py-0.5 border border-slate-800 text-slate-400 rounded-md">
                100% OK
              </span>
            </div>

            {/* TikTok Shop connection card */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-400 font-bold text-sm">
                  TT
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">TikTok Shop API</p>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Terhubung
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-slate-950 px-2 py-0.5 border border-slate-800 text-slate-400 rounded-md">
                100% OK
              </span>
            </div>

            {/* Offline Sales connection card */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400 font-bold text-sm">
                  OF
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-200">Offline Store Cashier</p>
                  <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sinkron Lokal
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-slate-950 px-2 py-0.5 border border-slate-800 text-slate-400 rounded-md">
                Standby
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activities Feed */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Aktivitas Terkini</CardTitle>
              <CardDescription>Log transaksi barang & pesanan terbaru.</CardDescription>
            </div>
            <Activity className="w-4 h-4 text-slate-500" />
          </CardHeader>
          <CardContent className="space-y-4 max-h-56 overflow-y-auto pr-1">
            {/* Merge logs & orders into a timeline */}
            {orders.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-start gap-3 text-xs border-b border-slate-850 pb-2">
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-violet-500" />
                <div className="flex-1">
                  <p className="text-slate-300">
                    Pesanan baru dari <span className="font-semibold text-slate-200">{order.customer}</span> senilai <span className="font-mono text-violet-400 font-bold">{formatIDR(order.total)}</span> masuk melalui <span className="font-semibold">{order.channel}</span>.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(order.date).toLocaleString("id-ID")}
                  </p>
                </div>
                <Badge variant={order.status}>{order.status}</Badge>
              </div>
            ))}

            {inventoryLogs.slice(0, 3).map((log) => (
              <div key={log.id} className="flex items-start gap-3 text-xs border-b border-slate-850 pb-2">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                    log.type === "masuk" ? "bg-emerald-500" : "bg-rose-500"
                  }`}
                />
                <div className="flex-1">
                  <p className="text-slate-300">
                    Stok <span className="font-semibold">{log.type === "masuk" ? "bertambah" : "berkurang"}</span> untuk <span className="font-semibold text-slate-200">{log.productName}</span> sebanyak <span className="font-semibold font-mono">{log.qty} pcs</span>.
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(log.date).toLocaleString("id-ID")}
                  </p>
                </div>
                <Badge variant={log.type === "masuk" ? "success" : "danger"}>
                  {log.type === "masuk" ? "In" : "Out"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
