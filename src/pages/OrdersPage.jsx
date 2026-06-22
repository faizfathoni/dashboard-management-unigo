import React, { useState } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, Calendar, ExternalLink, Printer, Upload, AlertCircle, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Dialog } from "../components/ui/Dialog";
import { importOrders } from "../lib/db";

export function OrdersPage({ orders, onRefreshData }) {
  const [activeChannel, setActiveChannel] = useState("All"); // 'All', 'Shopee', 'TikTok/Tokopedia', 'Offline'
  const [activeStatus, setActiveStatus] = useState("All"); // 'All', 'pengiriman sukses', 'pembatalan', 'pengembalian retur', 'pengiriman gagal'
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  // CSV Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvError, setCsvError] = useState("");
  const [csvSuccess, setCsvSuccess] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [parsedSummary, setParsedSummary] = useState(null);
  const [parsedRecords, setParsedRecords] = useState([]);
  const [importProgress, setImportProgress] = useState(0);

  // Time filter states
  const [timeRange, setTimeRange] = useState("all"); // 'all', 'today', 'yesterday', '7days', '30days', 'custom'
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  const parseCSV = (text) => {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          row[row.length - 1] += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push('');
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++;
        }
        lines.push(row);
        row = [''];
      } else {
        row[row.length - 1] += char;
      }
    }
    if (row.length > 1 || row[0] !== '') {
      lines.push(row);
    }
    return lines;
  };

  const parseCSVDate = (dateStr) => {
    if (!dateStr) return null;
    const cleaned = dateStr.trim();
    if (!cleaned) return null;
    
    // Try matching DD/MM/YYYY HH:mm:ss
    const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
    const match = cleaned.match(dmyRegex);
    if (match) {
      const [_, day, month, year, hour, minute, second] = match;
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second)).toISOString();
    }
    
    const parsed = new Date(cleaned);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setCsvFile(file);
    setCsvError("");
    setCsvSuccess("");
    setParsedSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const rows = parseCSV(text);
        if (rows.length < 2) {
          setCsvError("File CSV kosong atau tidak memiliki data baris.");
          return;
        }

        const rawHeaders = rows[0];
        const headers = rawHeaders.map(h => h.trim().replace(/^\uFEFF/, '').replace(/^"|"$/g, ''));

        const orderIdIdx = headers.findIndex(h => h.toLowerCase() === "order id" || h.toLowerCase() === "order_id");
        if (orderIdIdx === -1) {
          setCsvError("Kolom 'Order ID' tidak ditemukan di header CSV.");
          return;
        }

        const dataRows = rows.slice(1).filter(r => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
        
        setParsedSummary({
          filename: file.name,
          totalRows: dataRows.length
        });

        setParsedRecords({ headers, dataRows });
      } catch (err) {
        console.error("Error reading file:", err);
        setCsvError("Gagal membaca file CSV. Format file mungkin tidak valid.");
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async (e) => {
    e.preventDefault();
    if (!parsedSummary || parsedRecords.dataRows.length === 0) {
      setCsvError("Silakan pilih file CSV terlebih dahulu.");
      return;
    }

    setIsImporting(true);
    setCsvError("");
    setCsvSuccess("");

    try {
      const { headers, dataRows } = parsedRecords;

      const getVal = (row, headerName) => {
        const idx = headers.findIndex(h => h.toLowerCase() === headerName.toLowerCase());
        if (idx === -1) return null;
        const val = row[idx];
        return val !== undefined ? val.trim() : null;
      };

      const mappedOrders = dataRows.map((row) => {
        const orderIdRaw = getVal(row, "Order ID") || getVal(row, "order_id");
        const orderId = orderIdRaw ? orderIdRaw.trim() : "";
        let orderStatus = getVal(row, "Order Status") || getVal(row, "status");
        const cancelReturnType = getVal(row, "Cancelation/Return Type") || getVal(row, "cancelation_return_type");
        if (cancelReturnType && cancelReturnType.trim().toLowerCase() === "return/refund") { 
          orderStatus = "Return/Refund";
        }
        
        const productName = getVal(row, "Product Name") || getVal(row, "product_name");
        const variation = getVal(row, "Variation") || getVal(row, "varian");
        const quantity = parseInt(getVal(row, "Quantity") || getVal(row, "qty") || "1", 10);
        
        const priceStr = getVal(row, "SKU Subtotal After Discount") || getVal(row, "price") || getVal(row, "SKU Unit Original Price") || "0";
        const price = parseFloat(priceStr.replace(/[^0-9\.\-]/g, '')) || 0;

        const shipFeeStr = getVal(row, "Shipping Fee After Discount") || getVal(row, "shipping_fee") || "0";
        const shippingFee = parseFloat(shipFeeStr.replace(/[^0-9\.\-]/g, '')) || 0;

        const amountStr = getVal(row, "Order Amount") || getVal(row, "total") || "0";
        const orderAmount = parseFloat(amountStr.replace(/[^0-9\.\-]/g, '')) || price + shippingFee;

        const buyerUsername = getVal(row, "Buyer Username") || getVal(row, "buyer_username");
        const recipientName = getVal(row, "Recipient") || getVal(row, "customer") || getVal(row, "recipient_name");
        const province = getVal(row, "Province") || getVal(row, "provinsi");
        const city = getVal(row, "Regency and City") || getVal(row, "city") || getVal(row, "kota");
        const paymentMethod = getVal(row, "Payment Method") || getVal(row, "payment_method");
        
        const createdTimeStr = getVal(row, "Created Time") || getVal(row, "created_time") || getVal(row, "date");
        const createdTime = parseCSVDate(createdTimeStr);

        const raw_data = {};
        headers.forEach((h, i) => {
          raw_data[h] = row[i] !== undefined ? row[i] : null;
        });

        return {
          platform: "tiktok",
          order_id: orderId,
          status: orderStatus,
          product_name: productName,
          variation,
          quantity,
          price,
          shipping_fee: shippingFee,
          order_amount: orderAmount,
          buyer_username: buyerUsername,
          recipient_name: recipientName,
          province,
          city,
          payment_method: paymentMethod,
          created_time: createdTime,
          raw_data
        };
      });

      const validOrders = mappedOrders.filter(o => o.order_id && o.order_id.trim() !== "");
      if (validOrders.length === 0) {
        setCsvError("Tidak ada order yang valid dengan Order ID.");
        setIsImporting(false);
        return;
      }

      // Merge multi-item orders with duplicate order_id before sending to database
      const groupedOrdersMap = {};
      validOrders.forEach((order) => {
        const id = order.order_id;
        if (!groupedOrdersMap[id]) {
          groupedOrdersMap[id] = { ...order };
        } else {
          const existing = groupedOrdersMap[id];
          if (order.product_name && !existing.product_name.toLowerCase().includes(order.product_name.toLowerCase())) {
            existing.product_name = `${existing.product_name} + ${order.product_name}`;
          }
          if (order.variation) {
            if (!existing.variation) {
              existing.variation = order.variation;
            } else if (!existing.variation.toLowerCase().includes(order.variation.toLowerCase())) {
              existing.variation = `${existing.variation}, ${order.variation}`;
            }
          }
          existing.quantity = (existing.quantity || 0) + (order.quantity || 0);
          existing.price = (existing.price || 0) + (order.price || 0);
        }
      });
      const deDuplicatedOrders = Object.values(groupedOrdersMap);

      setImportProgress(0);
      await importOrders("tiktok", csvFile.name, deDuplicatedOrders, (prog) => {
        setImportProgress(prog);
      });

      setCsvSuccess(`Berhasil mengimpor ${deDuplicatedOrders.length} pesanan ke database!`);
      
      if (onRefreshData) {
        await onRefreshData();
      }

      setTimeout(() => {
        setIsImportModalOpen(false);
        setCsvFile(null);
        setParsedSummary(null);
        setCsvSuccess("");
        setImportProgress(0);
      }, 2000);

    } catch (err) {
      console.error("Import error:", err);
      setCsvError(`Gagal melakukan impor: ${err.message || err}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Filter channels
  const channels = ["All", "Shopee", "TikTok/Tokopedia", "Offline"];

  // Filter statuses
  const statuses = [
    { id: "All", label: "Semua Status" },
    { id: "perlu dikirim", label: "Perlu Dikirim" },
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

    const matchesTimeRange = (() => {
      if (timeRange === "all") return true;
      if (!order.date) return false;
      const orderDate = new Date(order.date);
      if (isNaN(orderDate.getTime())) return false;

      const now = new Date();
      
      // 'today': from 00:00:00 today to now
      if (timeRange === "today") {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return orderDate >= startOfToday && orderDate <= now;
      }
      
      // 'yesterday': from 00:00:00 yesterday to 23:59:59 yesterday
      if (timeRange === "yesterday") {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
        return orderDate >= startOfYesterday && orderDate <= endOfYesterday;
      }
      
      // '7days': last 7 days (from 7 days ago at 00:00:00 to now)
      if (timeRange === "7days") {
        const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        return orderDate >= sevenDaysAgo && orderDate <= now;
      }
      
      // '30days': last 30 days (from 30 days ago at 00:00:00 to now)
      if (timeRange === "30days") {
        const thirtyDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
        return orderDate >= thirtyDaysAgo && orderDate <= now;
      }
      
      // 'custom': custom range selected by user
      if (timeRange === "custom") {
        if (!customStartDate && !customEndDate) return true;
        
        let start = null;
        if (customStartDate) {
          start = new Date(customStartDate);
          start.setHours(0, 0, 0, 0);
        }
        
        let end = null;
        if (customEndDate) {
          end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
        }
        
        if (start && orderDate < start) return false;
        if (end && orderDate > end) return false;
        return true;
      }
      
      return true;
    })();

    return matchesChannel && matchesStatus && matchesSearch && matchesTimeRange;
  });

  return (
    <div className="space-y-6">
      {/* Search and Channels Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-100/50 dark:bg-slate-900/20 p-4 rounded-xl border border-slate-200 dark:border-slate-800/60">
        {/* Marketplace Channels Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0 shrink-0">
          {channels.map((chan) => (
            <button
              key={chan}
              onClick={() => setActiveChannel(chan)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeChannel === chan
                  ? "bg-violet-600 text-white shadow-md"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/60"
              }`}
            >
              {chan === "All" ? "Semua Saluran" : chan}
            </button>
          ))}
        </div>

        {/* Search Input bar */}
        <div className="flex flex-col sm:flex-row gap-2 flex-1 max-w-md w-full">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Cari ID Pesanan / nama pembeli..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="glass-input pl-9 w-full"
            />
          </div>
          {activeChannel === "TikTok/Tokopedia" && (
            <Button
              variant="outline"
              size="sm"
              icon={Upload}
              onClick={() => setIsImportModalOpen(true)}
              className="border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
            >
              Import CSV
            </Button>
          )}
        </div>
      </div>

      {/* Status filter chips Row */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 -mt-2">
        <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
        <span className="text-xs text-slate-500 dark:text-slate-450 shrink-0 select-none">Status:</span>
        <div className="flex gap-1.5">
          {statuses.map((stat) => (
            <button
              key={stat.id}
              onClick={() => setActiveStatus(stat.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                activeStatus === stat.id
                  ? "bg-violet-500/10 dark:bg-violet-500/15 border-violet-500/30 dark:border-violet-500/40 text-violet-600 dark:text-violet-300"
                  : "bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-850 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
              }`}
            >
              {stat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Time Range filter chips Row */}
      <div className="flex flex-wrap items-center gap-3 bg-slate-100/50 dark:bg-slate-900/10 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800/40 -mt-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="text-xs text-slate-500 dark:text-slate-450 shrink-0 select-none">Waktu:</span>
          <div className="flex gap-1.5">
            {[
              { id: "all", label: "Semua Waktu" },
              { id: "today", label: "Hari Ini" },
              { id: "yesterday", label: "Kemarin" },
              { id: "7days", label: "7 Hari Terakhir" },
              { id: "30days", label: "30 Hari Terakhir" },
              { id: "custom", label: "Rentang Tanggal" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTimeRange(t.id)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap ${
                  timeRange === t.id
                    ? "bg-violet-500/10 dark:bg-violet-500/15 border-violet-500/30 dark:border-violet-500/40 text-violet-600 dark:text-violet-300"
                    : "bg-white dark:bg-slate-950 border-slate-250 dark:border-slate-850 text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {timeRange === "custom" && (
          <div className="flex items-center gap-2 animate-in slide-in-from-left duration-200">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="glass-input text-[11px] py-1 px-2 h-7"
            />
            <span className="text-slate-400 text-xs">s/d</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="glass-input text-[11px] py-1 px-2 h-7"
            />
          </div>
        )}
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
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium font-mono uppercase bg-slate-100 dark:bg-slate-950/60 px-2.5 py-1 rounded border border-slate-200 dark:border-slate-850">
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
                  <TableCell className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                    {order.id}
                  </TableCell>
                  <TableCell>
                    <Badge>{order.channel}</Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                    {order.customer}
                  </TableCell>
                  <TableCell className="text-slate-500 dark:text-slate-400">
                    {new Date(order.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
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
                  <TableCell colSpan={7} className="text-center py-12 text-slate-400 dark:text-slate-500">
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
            <div className="grid grid-cols-2 gap-4 bg-slate-105/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-3 rounded-lg text-xs">
              <div>
                <p className="text-slate-500 dark:text-slate-400 font-semibold">Saluran Integrasi</p>
                <div className="mt-1 flex items-center gap-1.5 font-bold">
                  <Badge>{selectedOrder.channel}</Badge>
                </div>
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400 font-semibold">Status Pengiriman</p>
                <div className="mt-1 font-bold">
                  <Badge>{selectedOrder.status}</Badge>
                </div>
              </div>
            </div>

            {/* Buyer information */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Informasi Pelanggan
              </h4>
              <div className="bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-850 p-3 rounded-lg text-xs space-y-1">
                <p className="text-slate-600 dark:text-slate-300">
                  Nama Pembeli: <span className="font-semibold text-slate-850 dark:text-slate-100">{selectedOrder.customer}</span>
                </p>
                {selectedOrder.buyerUsername && (
                  <p className="text-slate-600 dark:text-slate-300">
                    Username: <span className="font-semibold text-slate-850 dark:text-slate-100">@{selectedOrder.buyerUsername}</span>
                  </p>
                )}
                <p className="text-slate-600 dark:text-slate-300">
                  Tanggal Pemesanan:{" "}
                  <span className="font-semibold text-slate-850 dark:text-slate-100">
                    {new Date(selectedOrder.date).toLocaleString("id-ID")}
                  </span>
                </p>
                {selectedOrder.paymentMethod && (
                  <p className="text-slate-600 dark:text-slate-300">
                    Metode Pembayaran: <span className="font-semibold text-slate-850 dark:text-slate-100">{selectedOrder.paymentMethod}</span>
                  </p>
                )}
                {(selectedOrder.city || selectedOrder.province) && (
                  <p className="text-slate-600 dark:text-slate-300">
                    Alamat: <span className="font-semibold text-slate-850 dark:text-slate-100">{[selectedOrder.city, selectedOrder.province].filter(Boolean).join(", ")}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Ordered items list */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Daftar Barang Belanjaan
              </h4>
              <div className="border border-slate-200 dark:border-slate-850 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-100/40 dark:bg-slate-950/40">
                      <TableHead className="py-2 text-[10px]">Nama Barang</TableHead>
                      <TableHead className="py-2 text-[10px] text-center">Qty</TableHead>
                      <TableHead className="py-2 text-[10px] text-right">Harga Satuan</TableHead>
                      <TableHead className="py-2 text-[10px] text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-[11px]">
                    {selectedOrder.items.map((item, idx) => (
                      <TableRow key={idx} className="hover:bg-transparent">
                        <TableCell className="py-2.5 font-semibold text-slate-800 dark:text-slate-200">
                          {item.name}
                        </TableCell>
                        <TableCell className="py-2.5 text-center font-mono font-semibold">
                          {item.qty}
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-mono">
                          {formatIDR(item.price)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-mono font-bold text-slate-850 dark:text-slate-100">
                          {formatIDR(item.price * item.qty)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Calculations and sums */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Subtotal Produk</span>
                <span className="font-mono">{formatIDR(selectedOrder.total - (selectedOrder.shippingFee || 0))}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Biaya Pengiriman</span>
                <span className="font-mono text-slate-700 dark:text-slate-350">
                  {selectedOrder.shippingFee ? formatIDR(selectedOrder.shippingFee) : "Gratis Ongkir"}
                </span>
              </div>
              <div className="flex justify-between text-slate-800 dark:text-slate-200 text-sm font-bold border-t border-slate-200 dark:border-slate-850 pt-2">
                <span>Total Belanja</span>
                <span className="font-mono text-violet-600 dark:text-violet-400">{formatIDR(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Dialog footer buttons */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
                Tutup
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={Printer}
                onClick={() => alert("Cetak invoice berhasil dikirim ke printer thermal.")}
                className="border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300"
              >
                Cetak Label
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* CSV Import Dialog modal */}
      <Dialog
        isOpen={isImportModalOpen}
        onClose={() => {
          if (!isImporting) {
            setIsImportModalOpen(false);
            setCsvFile(null);
            setParsedSummary(null);
            setCsvError("");
            setCsvSuccess("");
          }
        }}
        title="Import CSV Pesanan TikTok/Tokopedia"
        className="max-w-md"
      >
        <form onSubmit={handleImportSubmit} className="space-y-4 pt-1">
          {csvError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          {csvSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{csvSuccess}</span>
            </div>
          )}



          {/* File Upload Zone */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 font-medium">
              File CSV Pesanan
            </label>
            <div className="border border-dashed border-slate-300 dark:border-slate-800 hover:border-violet-500 dark:hover:border-violet-400 transition-colors rounded-xl p-6 bg-slate-50/40 dark:bg-slate-950/20 text-center relative group">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={isImporting}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
              />
              <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {csvFile ? csvFile.name : "Klik atau seret file CSV ke sini"}
                </span>
                <span className="text-[10px] text-slate-450 dark:text-slate-500">
                  Format file harus berupa .csv (maksimal 5MB)
                </span>
              </div>
            </div>
          </div>

          {/* Summary Preview */}
          {parsedSummary && (
            <div className="bg-slate-100/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-850 p-3 rounded-lg text-xs space-y-1.5 animate-in fade-in duration-200">
              <h4 className="font-semibold text-slate-800 dark:text-slate-205">
                Informasi File Terbaca:
              </h4>
              <div className="grid grid-cols-2 gap-y-1 text-slate-600 dark:text-slate-400">
                <span>Nama File:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{parsedSummary.filename}</span>
                <span>Jumlah Order:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{parsedSummary.totalRows} Baris</span>
              </div>
            </div>
          )}

          {isImporting && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-700 dark:text-slate-350">
                <span>Memproses unggah database...</span>
                <span className="font-mono text-violet-600 dark:text-violet-400">{importProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-300 rounded-full" 
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isImporting}
              onClick={() => {
                setIsImportModalOpen(false);
                setCsvFile(null);
                setParsedSummary(null);
                setCsvError("");
                setCsvSuccess("");
              }}
            >
              Batal
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isImporting || !parsedSummary}
              icon={isImporting ? Loader2 : Check}
              className={`w-full sm:w-auto justify-center ${isImporting ? "animate-pulse" : ""}`}
            >
              {isImporting ? "Mengimpor..." : "Proses Impor"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
