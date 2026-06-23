import React, { useState, useEffect, useRef } from "react";
import { Search, SlidersHorizontal, ArrowUpDown, Calendar, ExternalLink, Printer, Upload, AlertCircle, Check, Loader2, QrCode, Camera } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { Dialog } from "../components/ui/Dialog";
import { importOrders, verifyReturnOrder, fetchPaginatedOrders } from "../lib/db";
import { Html5Qrcode } from "html5-qrcode";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function OrdersPage({ orders, onRefreshData, ordersLoading }) {
  const [activeChannel, setActiveChannel] = useState("All"); // 'All', 'Shopee', 'TikTok/Tokopedia', 'Offline'
  const [activeStatus, setActiveStatus] = useState("All"); // 'All', 'pengiriman sukses', 'pembatalan', 'pengembalian retur', 'pengiriman gagal'
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
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

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Paginated database state managed by TanStack Query
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [
      "paginatedOrders",
      currentPage,
      rowsPerPage,
      debouncedSearchQuery,
      activeChannel,
      activeStatus,
      timeRange,
      customStartDate,
      customEndDate
    ],
    queryFn: () =>
      fetchPaginatedOrders({
        page: currentPage,
        pageSize: rowsPerPage,
        searchQuery: debouncedSearchQuery,
        channel: activeChannel,
        status: activeStatus,
        timeRange,
        customStartDate,
        customEndDate
      }),
    placeholderData: (previousData) => previousData,
  });

  const localOrders = data?.orders || [];
  const totalCount = data?.totalCount || 0;
  const localLoading = isLoading;

  // QR Scan states
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanResult, setScanResult] = useState("");
  const [scanError, setScanError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [matchedReturnOrder, setMatchedReturnOrder] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const scannerRef = useRef(null);

  // Search input debounce logic
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // Sync/Re-fetch when parent orders prop changes (due to imports, sync revalidations, etc.)
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["paginatedOrders"] });
  }, [orders, queryClient]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeChannel, activeStatus, debouncedSearchQuery, timeRange, customStartDate, customEndDate]);

  const handleQrScanSuccess = async (trackingId) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setScanResult(trackingId);
    setScanError("");
    setSuccessMessage("");

    // Stop scanner immediately to avoid multiple scans
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.error("Error stopping scanner on success:", err);
      }
    }

    try {
      const result = await verifyReturnOrder(trackingId);
      if (result) {
        const matched = result.order;
        const channelName = result.platform === "shopee" ? "Shopee" : "TikTok/Tokopedia";

        let productName = matched.product_name;
        if (!productName && matched.raw_data) {
          const keys = Object.keys(matched.raw_data);
          const nameKey = keys.find(k => k.toLowerCase() === "product name" || k.toLowerCase() === "product_name");
          if (nameKey) productName = matched.raw_data[nameKey];
        }

        let variation = matched.variation;
        if (!variation && matched.raw_data) {
          const keys = Object.keys(matched.raw_data);
          const varKey = keys.find(k => k.toLowerCase() === "variation" || k.toLowerCase() === "varian");
          if (varKey) variation = matched.raw_data[varKey];
        }

        let quantity = matched.quantity;
        if (!quantity && matched.raw_data) {
          const keys = Object.keys(matched.raw_data);
          const qtyKey = keys.find(k => k.toLowerCase() === "quantity" || k.toLowerCase() === "qty");
          if (qtyKey) quantity = parseInt(matched.raw_data[qtyKey], 10);
        }

        setMatchedReturnOrder({
          order_id: matched.order_id,
          customer: matched.recipient || matched.buyer_username || (matched.raw_data ? (matched.raw_data.Recipient || matched.raw_data.recipient_name || matched.raw_data.customer) : "Pembeli"),
          product_name: productName || "Produk",
          variation: variation || "",
          quantity: quantity || 1,
          channel: channelName,
          tracking_id: matched.tracking_id || trackingId
        });

        setSuccessMessage("Pesanan ini telah tercheck kalau sudah diretur dan diterima oleh store.");

        if (onRefreshData) {
          await onRefreshData();
        }

        setTimeout(() => {
          setIsScanModalOpen(false);
          setMatchedReturnOrder(null);
          setScanResult("");
          setSuccessMessage("");
          setIsVerifying(false);

          // Apply filters requested by user
          setActiveStatus("pengembalian retur"); // 'pengembalian retur' status corresponds to Retur
          setTimeRange("all"); // 'all' time range corresponds to 'semua waktu'
          setActiveChannel(channelName); // channel of the verified return order
        }, 4000);

      } else {
        setScanError(`Tidak ada pesanan cocok dengan ID Tracking / Resi "${trackingId}"`);
        setIsVerifying(false);

        // Restart scanner after 3.5 seconds so they can scan another code
        setTimeout(() => {
          setScanResult("");
          setScanError("");
          if (isScanModalOpen && scannerRef.current && !scannerRef.current.isScanning) {
            scannerRef.current.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 250, height: 250 } },
              (decodedText) => handleQrScanSuccess(decodedText),
              () => { }
            ).catch(err => console.error("Failed to restart scanner:", err));
          }
        }, 3500);
      }
    } catch (err) {
      console.error("Error verifying return order:", err);
      setScanError(`Error verifikasi: ${err.message || err}`);
      setIsVerifying(false);
    }
  };

  const handleCloseScanModal = () => {
    setIsScanModalOpen(false);
    setMatchedReturnOrder(null);
    setScanResult("");
    setScanError("");
    setSuccessMessage("");
    setIsVerifying(false);
  };

  useEffect(() => {
    let html5QrCode;
    let isMounted = true;

    if (isScanModalOpen && !matchedReturnOrder) {
      const timer = setTimeout(() => {
        const element = document.getElementById("reader");
        if (element && isMounted) {
          html5QrCode = new Html5Qrcode("reader");
          scannerRef.current = html5QrCode;

          html5QrCode.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText) => {
              if (isMounted) {
                handleQrScanSuccess(decodedText);
              }
            },
            () => { }
          ).catch(err => {
            console.error("Failed to start camera scan:", err);
            if (isMounted) {
              setScanError("Kamera gagal diakses. Pastikan izin kamera telah diberikan.");
            }
          });
        }
      }, 150);

      return () => {
        isMounted = false;
        clearTimeout(timer);
        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              html5QrCode.stop().catch(err => {
                console.error("Failed to stop scanner in promise:", err);
              });
            }
          } catch (err) {
            console.error("Failed to stop scanner synchronously in cleanup:", err);
          }
        }
        scannerRef.current = null;
      };
    }
  }, [isScanModalOpen, !matchedReturnOrder]);

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

  const totalRows = totalCount;
  const totalPages = Math.ceil(totalRows / rowsPerPage) || 1;
  const coercedCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (coercedCurrentPage - 1) * rowsPerPage;
  const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
  const paginatedOrders = localOrders;

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
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${activeChannel === chan
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
              className="glass-input !pl-9 w-full"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            icon={QrCode}
            onClick={() => setIsScanModalOpen(true)}
            className="border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/40 text-slate-700 dark:text-slate-300 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Scan Retur QR
          </Button>
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
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap ${activeStatus === stat.id
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
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all cursor-pointer whitespace-nowrap ${timeRange === t.id
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
                {totalRows === 0 ? "Menampilkan 0 pesanan" : `Menampilkan ${startIndex + 1}–${endIndex} dari ${totalRows} pesanan hasil filter saat ini.`}
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
                <TableHead className="text-center">Retur</TableHead>
                <TableHead className="w-20 text-center">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersLoading || localLoading ? (
                Array.from({ length: rowsPerPage }).map((_, idx) => (
                  <TableRow key={`skeleton-${idx}`}>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-24" /></TableCell>
                    <TableCell><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-16" /></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-28" /></TableCell>
                    <TableCell><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-20" /></TableCell>
                    <TableCell className="text-right"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-20 ml-auto" /></TableCell>
                    <TableCell className="text-center"><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-24 mx-auto" /></TableCell>
                    <TableCell className="text-center"><div className="h-5 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-8 mx-auto" /></TableCell>
                    <TableCell className="text-center"><div className="h-8 bg-slate-200 dark:bg-slate-800 rounded animate-pulse w-8 mx-auto" /></TableCell>
                  </TableRow>
                ))
              ) : (
                paginatedOrders.map((order) => (
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
                    <TableCell className="text-center">
                      {order.retur_check ? (
                        <span className="text-emerald-500 font-bold text-lg" title={order.retur_checked_at ? `Checked at: ${new Date(order.retur_checked_at).toLocaleString()}` : 'Checked'}>✓</span>
                      ) : (
                        <span className="text-rose-500 font-bold text-lg">✕</span>
                      )}
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
                ))
              )}
              {!ordersLoading && !localLoading && paginatedOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-slate-400 dark:text-slate-500">
                    Tidak ada pesanan yang sesuai dengan filter atau pencarian Anda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination and Row Limit selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-850">
            {/* Rows Per Page Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Baris per halaman:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="glass-input py-1 px-2.5 text-xs h-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Page navigation */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={coercedCurrentPage === 1}
                className="h-8 px-2.5 text-xs cursor-pointer border-slate-200 dark:border-slate-800 disabled:opacity-50"
              >
                Sebelumnya
              </Button>

              {/* Page numbers */}
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === 1 || page === totalPages || Math.abs(page - coercedCurrentPage) <= 1;
                  })
                  .map((page, index, array) => {
                    const isPrevEllipsis = index > 0 && page - array[index - 1] > 1;
                    return (
                      <React.Fragment key={page}>
                        {isPrevEllipsis && (
                          <span className="px-2 text-slate-400 text-xs select-none">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`w-8 h-8 text-xs font-semibold rounded transition-colors cursor-pointer border ${coercedCurrentPage === page
                              ? "bg-violet-600 border-violet-600 text-white"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                            }`}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    );
                  })}
              </div>

              {/* Mobile page indicator */}
              <span className="sm:hidden text-xs text-slate-500 dark:text-slate-400 px-2 font-medium">
                Halaman {coercedCurrentPage} dari {totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={coercedCurrentPage === totalPages}
                className="h-8 px-2.5 text-xs cursor-pointer border-slate-200 dark:border-slate-800 disabled:opacity-50"
              >
                Selanjutnya
              </Button>
            </div>
          </div>
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

      {/* QR Code Scanner Dialog modal */}
      <Dialog
        isOpen={isScanModalOpen}
        onClose={handleCloseScanModal}
        title="Scan QR Code Barang Retur"
        className="max-w-md"
      >
        <div className="space-y-4 pt-1">
          {scanError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{scanError}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {!matchedReturnOrder ? (
            <div className="space-y-3">
              <div className="text-center py-2 text-xs text-slate-500 dark:text-slate-400">
                Posisikan QR Code / Barcode label resi pengiriman barang retur di dalam kotak pemindaian di bawah ini.
              </div>

              {/* Camera viewport container */}
              <div className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-200 dark:border-slate-800 aspect-video flex items-center justify-center">
                <div id="reader" className="w-full h-full"></div>
                {isVerifying && (
                  <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-10">
                    <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
                    <span className="text-xs text-slate-205">Mencocokkan data resi...</span>
                  </div>
                )}
              </div>

              {scanResult && (
                <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-xs font-mono flex items-center gap-2">
                  <span className="text-slate-400 shrink-0 font-sans">Terbaca:</span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold truncate">{scanResult}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-in zoom-in-95 duration-300">
              <div className="flex flex-col items-center justify-center gap-2 text-center py-4 bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/20 rounded-xl">
                <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Check className="w-6 h-6 stroke-[3]" />
                </div>
                <h4 className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                  Verifikasi Berhasil!
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 px-6 max-w-xs mt-1">
                  Pesanan telah diverifikasi sebagai retur dan diterima oleh toko.
                </p>
              </div>

              <div className="space-y-2.5 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-205 dark:border-slate-805 p-4 rounded-xl text-xs">
                <div className="grid grid-cols-3 gap-y-2 text-slate-600 dark:text-slate-450">
                  <span className="font-semibold">ID Pesanan:</span>
                  <span className="col-span-2 font-mono font-bold text-slate-800 dark:text-slate-200 select-all">{matchedReturnOrder.order_id}</span>

                  <span className="font-semibold">Saluran:</span>
                  <span className="col-span-2">
                    <Badge>{matchedReturnOrder.channel}</Badge>
                  </span>

                  <span className="font-semibold">Pembeli:</span>
                  <span className="col-span-2 font-semibold text-slate-800 dark:text-slate-200">{matchedReturnOrder.customer}</span>

                  <span className="font-semibold">Produk:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200 truncate" title={matchedReturnOrder.product_name}>
                    {matchedReturnOrder.product_name}
                  </span>

                  {matchedReturnOrder.variation && (
                    <>
                      <span className="font-semibold">Varian:</span>
                      <span className="col-span-2 text-slate-505 dark:text-slate-400">{matchedReturnOrder.variation}</span>
                    </>
                  )}

                  <span className="font-semibold">Jumlah:</span>
                  <span className="col-span-2 font-mono font-semibold">{matchedReturnOrder.quantity} pcs</span>

                  <span className="font-semibold">No. Resi:</span>
                  <span className="col-span-2 font-mono text-slate-505 dark:text-slate-400 truncate">{matchedReturnOrder.tracking_id}</span>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCloseScanModal}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
