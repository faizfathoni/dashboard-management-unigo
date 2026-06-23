import React, { useState, useMemo, useRef } from "react";
import { TrendingUp, Package, ShoppingBag, XCircle, AlertCircle, ArrowUpRight, ArrowDownRight, Activity, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Dialog } from "../components/ui/Dialog";
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
  // States
  const [selectedDate, setSelectedDate] = useState("2026-06-22"); // Defaults to today 2026-06-22
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false);
  const [statusPlatform, setStatusPlatform] = useState("All");
  const dateInputRef = useRef(null);

  // Helper: extract local YYYY-MM-DD from date string
  const getLocalDateString = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const offset = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offset);
    return localDate.toISOString().split("T")[0];
  };

  // Filtered orders based on selected date (for metrics)
  const filteredOrders = useMemo(() => {
    if (!selectedDate) return orders;
    return orders.filter((o) => getLocalDateString(o.date) === selectedDate);
  }, [orders, selectedDate]);

  // Filtered inventory logs based on selected date
  const filteredInventoryLogs = useMemo(() => {
    if (!selectedDate) return inventoryLogs;
    return inventoryLogs.filter((l) => getLocalDateString(l.date) === selectedDate);
  }, [inventoryLogs, selectedDate]);

  // 1. Calculate dynamic statistics
  const successOrders = filteredOrders.filter((o) => o.status === "pengiriman sukses");
  const totalRevenue = successOrders.reduce((sum, o) => sum + o.total, 0);

  const totalIncoming = filteredInventoryLogs
    .filter((l) => l.type === "masuk")
    .reduce((sum, l) => sum + l.qty, 0);

  const totalOutgoing = filteredInventoryLogs
    .filter((l) => l.type === "keluar")
    .reduce((sum, l) => sum + l.qty, 0);

  // Compute products and variants stock up to the selected date to keep low-stock history accurate
  const productsWithStockAtDate = useMemo(() => {
    if (!selectedDate) return products;

    const filterDateEnd = new Date(selectedDate);
    filterDateEnd.setHours(23, 59, 59, 999);

    return products.map((p) => {
      // Find all incoming stock logs up to the end of selected day
      const variantIncomingLogs = inventoryLogs.filter(log => {
        const logDate = new Date(log.date);
        return log.productId === p.id && log.type === "masuk" && logDate <= filterDateEnd;
      });
      const totalIncoming = variantIncomingLogs.reduce((sum, log) => sum + (log.qty || 0), 0);

      // Find all outgoing stock logs up to the end of selected day
      const variantOutgoingLogs = inventoryLogs.filter(log => {
        const logDate = new Date(log.date);
        return log.productId === p.id && log.type === "keluar" && logDate <= filterDateEnd;
      });
      const totalOutgoing = variantOutgoingLogs.reduce((sum, log) => sum + (log.qty || 0), 0);

      const stock = Math.max(0, totalIncoming - totalOutgoing);
      return {
        ...p,
        stock
      };
    });
  }, [products, inventoryLogs, selectedDate]);

  const lowStockProductsList = useMemo(() => {
    return productsWithStockAtDate.filter((p) => p.stock <= 20);
  }, [productsWithStockAtDate]);

  const lowStockCount = lowStockProductsList.length;

  // Order status counters (filtered by selectedDate AND chosen platform)
  const filteredOrdersForStatus = useMemo(() => {
    let list = orders;
    if (selectedDate) {
      list = list.filter((o) => getLocalDateString(o.date) === selectedDate);
    }
    if (statusPlatform !== "All") {
      list = list.filter((o) => o.channel === statusPlatform);
    }
    return list;
  }, [orders, selectedDate, statusPlatform]);

  const countByStatusFiltered = (statusName) => filteredOrdersForStatus.filter((o) => o.status === statusName).length;

  const statusCounts = {
    success: countByStatusFiltered("pengiriman sukses"),
    cancelled: countByStatusFiltered("pembatalan"),
    returned: countByStatusFiltered("pengembalian retur"),
    failed: countByStatusFiltered("pengiriman gagal"),
  };

  // 2. Prepare chart data
  // Channel Breakdown (responds to selectedDate)
  const channelRevenue = useMemo(() => {
    return filteredOrders.reduce((acc, order) => {
      if (order.status === "pengiriman sukses") {
        acc[order.channel] = (acc[order.channel] || 0) + order.total;
      }
      return acc;
    }, {});
  }, [filteredOrders]);

  const channelChartData = useMemo(() => [
    { name: "Shopee", sales: channelRevenue["Shopee"] || 0, color: "#f97316" },
    { name: "TikTok/Tokopedia", sales: channelRevenue["TikTok/Tokopedia"] || 0, color: "#ec4899" },
    { name: "Offline", sales: channelRevenue["Offline"] || 0, color: "#0ea5e9" },
  ], [channelRevenue]);

  // Status Breakdown Chart Data (responds to selectedDate and statusPlatform select box)
  const statusChartData = useMemo(() => [
    { name: "Sukses", value: statusCounts.success, color: "#10b981" },
    { name: "Batal", value: statusCounts.cancelled, color: "#ef4444" },
    { name: "Retur", value: statusCounts.returned, color: "#f59e0b" },
    { name: "Gagal", value: statusCounts.failed, color: "#f43f5e" },
  ], [statusCounts]);

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
        <div className="bg-white/95 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg shadow-xl text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{payload[0].name}</p>
          <p className="text-violet-650 dark:text-violet-400 mt-1 font-semibold">
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
        <div className="bg-white/95 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 p-2.5 rounded-lg shadow-xl text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{payload[0].name}</p>
          <p className="text-violet-650 dark:text-violet-400 mt-1 font-semibold">
            Jumlah: {payload[0].value} Pesanan
          </p>
        </div>
      );
    }
    return null;
  };

  // Activities timeline (merged and sorted chronologically)
  const activities = useMemo(() => {
    const list = [];

    // Add orders
    orders.forEach((order) => {
      list.push({
        id: `order-${order.id}`,
        date: new Date(order.date),
        type: "order",
        channel: order.channel,
        customer: order.customer,
        total: order.total,
        status: order.status,
        description: (
          <span>
            Pesanan baru dari <span className="font-semibold text-slate-800 dark:text-slate-200">{order.customer}</span> senilai <span className="font-mono text-violet-600 dark:text-violet-400 font-bold">{formatIDR(order.total)}</span> masuk melalui <span className="font-semibold">{order.channel}</span>.
          </span>
        ),
        badgeText: order.status,
        badgeVariant: order.status,
      });
    });

    // Add inventory logs
    inventoryLogs.forEach((log) => {
      let displayQty = `${Math.abs(log.qty)} pcs`;
      if (log.notes) {
        const match = log.notes.match(/ \|\|unit_info:([0-9.-]+):([a-z]+)\|\|/);
        if (match) {
          const uQty = parseFloat(match[1]);
          const uUnit = match[2];
          displayQty = `${Math.abs(uQty)} ${uUnit}`;
        }
      }

      list.push({
        id: `log-${log.id}`,
        date: new Date(log.date),
        type: "inventory",
        logType: log.type,
        productName: log.productName,
        qty: log.qty,
        description: (
          <span>
            Stok <span className="font-semibold text-slate-800 dark:text-slate-200">{log.type === "masuk" ? "bertambah" : "berkurang"}</span> untuk <span className="font-semibold">{log.productName}</span> sebanyak <span className="font-semibold font-mono">{displayQty}</span>.
          </span>
        ),
        badgeText: log.type === "masuk" ? "In" : "Out",
        badgeVariant: log.type === "masuk" ? "success" : "danger",
      });
    });

    // Sort chronologically descending
    return list.sort((a, b) => b.date - a.date);
  }, [orders, inventoryLogs]);

  // Filter activities by selectedDate if set
  const filteredActivities = useMemo(() => {
    if (!selectedDate) return activities;
    return activities.filter((act) => getLocalDateString(act.date) === selectedDate);
  }, [activities, selectedDate]);

  const formatActivityTime = (dateObj) => {
    return dateObj.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatActivityDate = (dateObj) => {
    return dateObj.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Date Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/40 dark:bg-slate-900/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60 backdrop-blur-sm shadow-sm transition-all duration-300">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-350">Filter Ringkasan Per Hari:</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap relative">
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            onChange={(e) => {
              const val = e.target.value;
              if (val) {
                setSelectedDate(val);
              }
            }}
            className="absolute w-0 h-0 opacity-0 pointer-events-none"
            title="Pilih Tanggal"
          />
          <button
            type="button"
            onClick={() => {
              if (dateInputRef.current) {
                if (typeof dateInputRef.current.showPicker === "function") {
                  dateInputRef.current.showPicker();
                } else {
                  dateInputRef.current.click();
                }
              }
            }}
            className="p-1.5 px-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-705 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer h-9 text-xs font-semibold"
          >
            <Calendar className="w-3.5 h-3.5 text-violet-500" />
            <span>
              {selectedDate
                ? formatActivityDate(new Date(selectedDate))
                : "Pilih Tanggal"}
            </span>
          </button>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate("")}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Semua Waktu
            </button>
          )}
          <button
            onClick={() => {
              const today = new Date();
              const offset = today.getTimezoneOffset() * 60000;
              const localToday = new Date(today.getTime() - offset);
              setSelectedDate(localToday.toISOString().split("T")[0]);
            }}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-705 text-white rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
          >
            Hari Ini
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Sales */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Pendapatan</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatIDR(totalRevenue)}</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {selectedDate ? (
                <span className="text-slate-450 dark:text-slate-500 font-semibold">
                  Pada {formatActivityDate(new Date(selectedDate))}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center">
                    <ArrowUpRight className="w-3.5 h-3.5" /> +12%
                  </span>{" "}
                  vs bulan lalu
                </span>
              )}
            </p>
          </div>
        </Card>

        {/* Metric 2: Stock Inflow */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Barang Masuk</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-650 dark:text-violet-400">
              <ArrowDownRight className="w-4 h-4 rotate-180" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalIncoming} pcs</h3>
            <p className="text-xs mt-1 font-medium text-slate-500">
              {selectedDate
                ? `Masuk pada ${formatActivityDate(new Date(selectedDate))}`
                : "Total restock produk bulan ini"}
            </p>
          </div>
        </Card>

        {/* Metric 3: Stock Outflow */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Barang Keluar</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{totalOutgoing} pcs</h3>
            <p className="text-xs mt-1 font-medium text-slate-500">
              {selectedDate
                ? `Keluar pada ${formatActivityDate(new Date(selectedDate))}`
                : "Barang terjual & didistribusikan"}
            </p>
          </div>
        </Card>

        {/* Metric 4: Low Stock Warnings */}
        <Card className="hover:scale-[1.01] transition-transform duration-300">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Stok Menipis</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{lowStockCount} item</h3>
            <p className="text-xs text-slate-500 mt-1 font-medium flex items-center gap-1">
              {lowStockCount > 0 ? (
                <button
                  onClick={() => setIsRestockDialogOpen(true)}
                  className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 hover:underline cursor-pointer focus:outline-none"
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Perlu restock segera
                </button>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Stok aman</span>
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
            {ordersLoading ? (
              <div className="w-full h-full flex items-end gap-6 px-4 pb-2 pt-4">
                <Skeleton className="h-1/3 flex-1 rounded-t-lg" />
                <Skeleton className="h-2/3 flex-1 rounded-t-lg" />
                <Skeleton className="h-1/2 flex-1 rounded-t-lg" />
              </div>
            ) : (
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
                  <Tooltip content={<CustomTooltipSales />} cursor={{ fill: "rgba(139,92,246,0.05)" }} />
                  <Bar dataKey="sales" radius={[8, 8, 0, 0]}>
                    {channelChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800/80 pb-3">
            <div>
              <CardTitle>Status Pesanan</CardTitle>
              <CardDescription>Rincian status pengiriman.</CardDescription>
            </div>
            <select
              value={statusPlatform}
              onChange={(e) => setStatusPlatform(e.target.value)}
              className="glass-input text-[11px] py-1.5 px-3 h-9 font-semibold rounded-lg cursor-pointer w-full sm:w-48 min-w-[190px] border-slate-250 dark:border-slate-800 bg-white dark:bg-slate-900"
            >
              <option value="All">Semua Saluran</option>
              <option value="Shopee">Shopee</option>
              <option value="TikTok/Tokopedia">TiktokShop/Tokopedia</option>
              <option value="Offline">Offline</option>
            </select>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center pt-3">
            {/* Pie Chart / Donut Chart */}
            {statusChartData.reduce((sum, item) => sum + item.value, 0) > 0 ? (
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
            ) : (
              <div className="w-full h-44 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl my-2">
                <span>Tidak ada data pesanan</span>
                <span className="text-[10px] mt-0.5 text-slate-450 dark:text-slate-500">Silakan pilih saluran atau tanggal lain</span>
              </div>
            )}

            {/* Labels and Stats */}
            <div className="grid grid-cols-2 gap-2 mt-4 w-full text-xs border-t border-slate-100 dark:border-slate-800/80 pt-3">
              {statusChartData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/60">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-500 dark:text-slate-400 font-medium">{item.name}</span>
                  <span className="ml-auto font-bold text-slate-850 dark:text-slate-200">{item.value}</span>
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
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/25 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-sm">
                  S
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Shopee API</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Terhubung
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-slate-200/50 dark:bg-slate-950 px-2 py-0.5 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-mono">
                100% OK
              </span>
            </div>

            {/* TikTok/Tokopedia connection card */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-600 dark:text-pink-400 font-bold text-sm">
                  TT
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-205">TikTok/Tokopedia API</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Terhubung
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-slate-200/50 dark:bg-slate-950 px-2 py-0.5 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-mono">
                100% OK
              </span>
            </div>

            {/* Offline Store Cashier connection card */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-600 dark:text-sky-400 font-bold text-sm">
                  OF
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-205">Offline Store Cashier</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" /> Sinkron Lokal
                  </p>
                </div>
              </div>
              <span className="text-[9px] bg-slate-200/50 dark:bg-slate-950 px-2 py-0.5 border border-slate-300 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-md font-mono">
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
          <CardContent className="space-y-4 max-h-72 overflow-y-auto pr-1">
            {filteredActivities.slice(0, selectedDate ? undefined : 10).map((act) => (
              <div key={act.id} className="flex items-start gap-3 text-xs border-b border-slate-200 dark:border-slate-800/60 pb-2.5 last:border-0 last:pb-0">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${act.type === "order"
                    ? "bg-violet-500"
                    : act.badgeVariant === "success"
                      ? "bg-emerald-500"
                      : "bg-rose-500"
                    }`}
                />
                <div className="flex-1">
                  <p className="text-slate-600 dark:text-slate-300">
                    {act.description}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1.5 font-medium">
                    <span>{formatActivityDate(act.date)}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-700" />
                    <span className="text-slate-500 dark:text-slate-400 font-semibold">{formatActivityTime(act.date)}</span>
                  </p>
                </div>
                <Badge variant={act.badgeVariant}>{act.badgeText}</Badge>
              </div>
            ))}
            {filteredActivities.length === 0 && (
              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-xs">
                Tidak ada aktivitas tercatat {selectedDate ? "pada tanggal ini" : "saat ini"}.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Restock Details Dialog */}
      <Dialog
        isOpen={isRestockDialogOpen}
        onClose={() => setIsRestockDialogOpen(false)}
        title={selectedDate ? `Produk Perlu Restock - Tanggal ${formatActivityDate(new Date(selectedDate))}` : "Daftar Produk Perlu Restock (Semua Waktu)"}
        className="max-w-xl"
      >
        <div className="space-y-4">
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-xs text-left text-slate-600 dark:text-slate-350">
              <thead className="bg-slate-100/60 dark:bg-slate-900/60 text-[10px] uppercase font-bold text-slate-550 border-b border-slate-250 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-2">SKU</th>
                  <th className="px-4 py-2">Nama Produk</th>
                  <th className="px-4 py-2">Kategori</th>
                  <th className="px-4 py-2 text-right">Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-850">
                {lowStockProductsList.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="px-4 py-2.5 font-mono font-semibold text-slate-500 dark:text-slate-400">{p.sku}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">{p.name}</td>
                    <td className="px-4 py-2.5">{p.category}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${p.stock <= 5 ? "text-rose-500" : "text-amber-500"}`}>
                      {p.stock} pcs
                    </td>
                  </tr>
                ))}
                {lowStockProductsList.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-slate-400 dark:text-slate-500">
                      Tidak ada produk yang perlu restock (stok aman).
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setIsRestockDialogOpen(false)}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-750 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
