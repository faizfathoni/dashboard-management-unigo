import React, { useState } from "react";
import { 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Search, 
  FileText, 
  AlertTriangle, 
  Trash2, 
  Edit, 
  PlusCircle, 
  MinusCircle, 
  Check, 
  X,
  Layers,
  ShoppingBag
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../components/ui/Table";
import { Dialog } from "../components/ui/Dialog";
import { Badge } from "../components/ui/Badge";
import { 
  addStockIn, 
  updateStockIn, 
  deleteStockIn, 
  addProduct, 
  updateProduct, 
  deleteProduct 
} from "../lib/db";

export function InventoryPage({ products, rawProducts, inventoryLogs, onRefreshData }) {
  // Tabs: 'transactions' or 'products'
  const [activeSubTab, setActiveSubTab] = useState("transactions");
  const [searchQuery, setSearchQuery] = useState("");
  const [logFilter, setLogFilter] = useState("all"); // 'all', 'masuk', 'keluar'

  // Modal Open states
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);

  // Form states
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // --- stock_in Form State ---
  const [selectedProductId, setSelectedProductId] = useState(rawProducts[0]?.id || "");
  const [variantInputs, setVariantInputs] = useState({}); // { [variantId]: { qty: 0, price: 35000 } }
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [transactionNote, setTransactionNote] = useState("");

  // --- Edit Transaction State ---
  const [editingLog, setEditingLog] = useState(null);
  const [editLogQty, setEditLogQty] = useState(1);
  const [editLogPrice, setEditLogPrice] = useState(0);
  const [editLogDate, setEditLogDate] = useState("");
  const [editLogNote, setEditLogNote] = useState("");

  // --- Add Product Form State ---
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("Aksesoris");
  const [newProductVarType, setNewProductVarType] = useState("Warna");
  const [newProductHasSize, setNewProductHasSize] = useState(false);
  
  // Custom size/variant entries lists
  const [sizeInputText, setSizeInputText] = useState("");
  const [addedSizes, setAddedSizes] = useState([]); // Array of strings
  const [varInputText, setVarInputText] = useState("");
  const [addedVariants, setAddedVariants] = useState([]); // Array of strings

  // --- Edit Product Form State ---
  const [editingProduct, setEditingProduct] = useState(null);
  const [editProductName, setEditProductName] = useState("");
  const [editProductCategory, setEditProductCategory] = useState("");
  const [editProductVarType, setEditProductVarType] = useState("");
  const [editProductVariants, setEditProductVariants] = useState([]); // [{id, label, is_active}]
  const [newVariantLabelEdit, setNewVariantLabelEdit] = useState("");
  const [deletedVariantIds, setDeletedVariantIds] = useState([]);

  // Reset form inputs for Stock In when product changes or modal opens
  const initStockInForm = (productId) => {
    const prod = rawProducts.find(p => p.id === productId);
    if (!prod) return;

    setSelectedProductId(productId);
    
    // Pre-populate quantities and prices
    const inputs = {};
    const variants = prod.product_variants || [];
    
    // Fallback default price helper
    let defaultPrice = 35000;
    if (prod.name.toLowerCase().includes("bola")) defaultPrice = 25000;
    else if (prod.name.toLowerCase().includes("aero")) defaultPrice = 35000;

    variants.forEach(v => {
      inputs[v.id] = { qty: 0, price: defaultPrice };
    });
    setVariantInputs(inputs);
    setTransactionDate(new Date().toISOString().substring(0, 10));
    setTransactionNote("");
  };

  const handleProductChange = (e) => {
    initStockInForm(e.target.value);
  };

  // Adjust variant stock in quantity
  const handleVariantQtyChange = (variantId, delta) => {
    setVariantInputs(prev => {
      const current = prev[variantId] || { qty: 0, price: 35000 };
      const newQty = Math.max(0, current.qty + delta);
      return {
        ...prev,
        [variantId]: { ...current, qty: newQty }
      };
    });
  };

  const handleVariantQtyValChange = (variantId, val) => {
    const intVal = parseInt(val, 10);
    const cleanVal = isNaN(intVal) || intVal < 0 ? 0 : intVal;
    setVariantInputs(prev => {
      const current = prev[variantId] || { qty: 0, price: 35000 };
      return {
        ...prev,
        [variantId]: { ...current, qty: cleanVal }
      };
    });
  };

  const handleVariantPriceChange = (variantId, val) => {
    const floatVal = parseFloat(val);
    const cleanPrice = isNaN(floatVal) || floatVal < 0 ? 0 : floatVal;
    setVariantInputs(prev => {
      const current = prev[variantId] || { qty: 0, price: 35000 };
      return {
        ...prev,
        [variantId]: { ...current, price: cleanPrice }
      };
    });
  };

  // Submit stock_in entries to Supabase
  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    try {
      const entriesToSubmit = [];
      Object.keys(variantInputs).forEach(varId => {
        const item = variantInputs[varId];
        if (item.qty > 0) {
          entriesToSubmit.push({
            variant_id: varId,
            quantity: item.qty,
            price: item.price,
            date: transactionDate || new Date().toISOString().substring(0, 10),
            note: transactionNote || "Restock manual"
          });
        }
      });

      if (entriesToSubmit.length === 0) {
        setFormError("Masukkan jumlah (quantity) minimal pada satu varian.");
        return;
      }

      await addStockIn(entriesToSubmit);
      setFormSuccess("Transaksi barang masuk berhasil dicatat!");
      
      // Refresh Supabase state in parent
      await onRefreshData();

      // Close modal
      setTimeout(() => {
        setIsStockInOpen(false);
        setFormSuccess("");
      }, 1000);

    } catch (err) {
      setFormError("Terjadi kesalahan saat menyimpan transaksi ke database.");
    }
  };

  // Delete stock log handler
  const handleLogDelete = async (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus catatan transaksi ini? Stok barang akan disesuaikan kembali.")) {
      try {
        await deleteStockIn(id);
        await onRefreshData();
      } catch (err) {
        alert("Gagal menghapus log transaksi.");
      }
    }
  };

  // Edit stock log click handler
  const handleLogEditClick = (log) => {
    setEditingLog(log);
    setEditLogQty(log.qty);
    setEditLogPrice(log.price);
    setEditLogDate(new Date(log.date).toISOString().substring(0, 10));
    setEditLogNote(log.notes);
    setFormError("");
    setIsEditLogOpen(true);
  };

  // Submit edited stock log to Supabase
  const handleEditLogSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      if (editLogQty <= 0) {
        setFormError("Jumlah barang harus berupa angka positif.");
        return;
      }
      await updateStockIn(editingLog.id, {
        quantity: editLogQty,
        price: editLogPrice,
        date: editLogDate,
        note: editLogNote
      });
      await onRefreshData();
      setIsEditLogOpen(false);
    } catch (err) {
      setFormError("Gagal memperbarui transaksi.");
    }
  };

  // Add Size label to form
  const handleAddSize = () => {
    const trimmed = sizeInputText.trim();
    if (trimmed && !addedSizes.includes(trimmed)) {
      setAddedSizes([...addedSizes, trimmed]);
      setSizeInputText("");
    }
  };

  // Remove Size label from form
  const handleRemoveSize = (sz) => {
    setAddedSizes(addedSizes.filter(s => s !== sz));
  };

  // Add Variant label to form
  const handleAddVariantLabel = () => {
    const trimmed = varInputText.trim();
    if (trimmed && !addedVariants.includes(trimmed)) {
      setAddedVariants([...addedVariants, trimmed]);
      setVarInputText("");
    }
  };

  // Remove Variant label from form
  const handleRemoveVariantLabel = (vr) => {
    setAddedVariants(addedVariants.filter(v => v !== vr));
  };

  // Submit product creation to Supabase
  const handleAddProductSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!newProductName.trim()) {
      setFormError("Nama produk tidak boleh kosong.");
      return;
    }

    try {
      // Structure the data according to the database requirements
      let sizes = [];
      let variants = [];

      if (newProductHasSize) {
        if (addedSizes.length === 0) {
          setFormError("Masukkan minimal satu label ukuran (misal: SD, SMP) jika mengaktifkan opsi Ukuran.");
          return;
        }
        sizes = addedSizes;
        // Generate a variant for each size
        variants = addedSizes.map(s => ({
          size_label: s,
          variant_label: s
        }));
      } else {
        if (addedVariants.length === 0) {
          setFormError("Masukkan minimal satu variasi (misal: Hitam, Biru) untuk produk ini.");
          return;
        }
        variants = addedVariants.map(v => ({
          size_label: null,
          variant_label: v
        }));
      }

      await addProduct({
        name: newProductName.trim(),
        category: newProductCategory,
        variant_type: newProductVarType,
        has_size: newProductHasSize,
        sizes,
        variants
      });

      setFormSuccess("Produk baru berhasil ditambahkan!");
      await onRefreshData();

      // Reset form states
      setNewProductName("");
      setNewProductCategory("Aksesoris");
      setNewProductVarType("Warna");
      setNewProductHasSize(false);
      setAddedSizes([]);
      setAddedVariants([]);

      setTimeout(() => {
        setIsAddProductOpen(false);
        setFormSuccess("");
      }, 1000);

    } catch (err) {
      setFormError("Gagal menambahkan produk ke database.");
    }
  };

  // Edit product click handler
  const handleProductEditClick = (product) => {
    setEditingProduct(product);
    setEditProductName(product.name);
    setEditProductCategory(product.category || "Aksesoris");
    setEditProductVarType(product.variant_type || "Warna");
    setEditProductVariants(
      (product.product_variants || []).map(v => ({
        id: v.id,
        variant_label: v.variant_label,
        is_active: v.is_active,
        size_id: v.size_id
      }))
    );
    setDeletedVariantIds([]);
    setNewVariantLabelEdit("");
    setFormError("");
    setFormSuccess("");
    setIsEditProductOpen(true);
  };

  // Edit variant label in local state
  const handleEditVariantLabelChange = (idx, val) => {
    setEditProductVariants(prev =>
      prev.map((v, i) => i === idx ? { ...v, variant_label: val } : v)
    );
  };

  // Stage a variant for deletion
  const handleDeleteVariantInEdit = (idx) => {
    const variant = editProductVariants[idx];
    if (variant.id) {
      setDeletedVariantIds(prev => [...prev, variant.id]);
    }
    setEditProductVariants(prev => prev.filter((_, i) => i !== idx));
  };

  // Add new variant directly in edit mode
  const handleAddVariantInEdit = () => {
    const trimmed = newVariantLabelEdit.trim();
    if (trimmed) {
      // Check duplicate
      if (editProductVariants.some(v => v.variant_label.toLowerCase() === trimmed.toLowerCase())) {
        alert("Variasi sudah ada.");
        return;
      }
      setEditProductVariants([
        ...editProductVariants,
        {
          variant_label: trimmed,
          is_active: true,
          size_id: null // Custom color/label
        }
      ]);
      setNewVariantLabelEdit("");
    }
  };

  // Toggle variant active in edit mode
  const handleToggleVariantActive = (idx) => {
    setEditProductVariants(prev => 
      prev.map((v, i) => i === idx ? { ...v, is_active: !v.is_active } : v)
    );
  };

  // Submit product edits to Supabase
  const handleEditProductSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!editProductName.trim()) {
      setFormError("Nama produk tidak boleh kosong.");
      return;
    }

    try {
      await updateProduct(editingProduct.id, {
        name: editProductName.trim(),
        category: editProductCategory,
        variant_type: editProductVarType,
        has_size: editingProduct.has_size, // Keep original size setting for simplicity
        variants: editProductVariants,
        deletedVariantIds
      });

      setFormSuccess("Detail produk berhasil diperbarui!");
      await onRefreshData();

      setTimeout(() => {
        setIsEditProductOpen(false);
        setFormSuccess("");
      }, 1000);

    } catch (err) {
      setFormError("Gagal memperbarui data produk.");
    }
  };

  // Delete product handler
  const handleProductDelete = async (id) => {
    if (confirm("⚠️ PERINGATAN: Menghapus produk ini akan menghapus semua variasi, ukuran, dan riwayat transaksi stok barang masuk yang terkait. Aksi ini tidak dapat dibatalkan! Apakah Anda yakin?")) {
      try {
        await deleteProduct(id);
        await onRefreshData();
      } catch (err) {
        alert("Gagal menghapus produk.");
      }
    }
  };

  // Open transaction recorder
  const handleOpenStockIn = () => {
    if (rawProducts.length === 0) {
      alert("Belum ada data produk terdaftar. Silakan tambahkan produk terlebih dahulu.");
      return;
    }
    initStockInForm(rawProducts[0]?.id);
    setFormError("");
    setFormSuccess("");
    setIsStockInOpen(true);
  };

  // Filter logs by type and search query
  const filteredLogs = inventoryLogs
    .filter(log => logFilter === "all" || log.type === logFilter)
    .filter(log => 
      log.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.notes && log.notes.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  // Filter products by search query
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Currency helper
  const formatIDR = (num) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs Selector */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => {
            setActiveSubTab("transactions");
            setSearchQuery("");
          }}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "transactions"
              ? "border-violet-500 text-slate-100"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
          Transaksi Barang Masuk
        </button>
        <button
          onClick={() => {
            setActiveSubTab("products");
            setSearchQuery("");
          }}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeSubTab === "products"
              ? "border-violet-500 text-slate-100"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Layers className="w-4 h-4 text-violet-400" />
          Kelola Produk & Varian (CRUD)
        </button>
      </div>

      {activeSubTab === "transactions" ? (
        <>
          {/* Summary Cards Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400">Total Varian Terdaftar</span>
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-100">{products.length} SKU</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Model barang di database</p>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400">Total Pemasukan (Barang Masuk)</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-100">
                  {inventoryLogs.filter((l) => l.type === "masuk").reduce((sum, l) => sum + l.qty, 0)} pcs
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Stok masuk tercatat di Supabase</p>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400">Nilai Pembelian Barang</span>
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 font-bold">
                  Rp
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-slate-100">
                  {formatIDR(
                    inventoryLogs.filter((l) => l.type === "masuk").reduce((sum, l) => sum + (l.qty * l.price), 0)
                  )}
                </h3>
                <p className="text-xs text-slate-500 mt-1 font-medium">Total modal aset masuk</p>
              </div>
            </Card>
          </div>

          {/* Core Table Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column (Span 2) - Incoming Logs List */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>Riwayat Transaksi Stok</CardTitle>
                  <CardDescription>Catatan pemasukan Supabase dan pengeluaran simulasi offline/marketplace.</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari barang/catatan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input pl-9 w-44"
                    />
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    onClick={handleOpenStockIn}
                  >
                    Catat Barang Masuk
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Nama Barang</TableHead>
                      <TableHead className="text-center">Jumlah</TableHead>
                      <TableHead className="text-right">Harga Beli</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs text-slate-400">
                          {new Date(log.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.type === "masuk" ? "success" : "danger"}>
                            {log.type === "masuk" ? "Masuk" : "Keluar"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-200">
                          {log.productName}
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold">
                          {log.type === "masuk" ? "+" : "-"}
                          {log.qty} pcs
                        </TableCell>
                        <TableCell className="text-right font-mono text-slate-300">
                          {log.type === "masuk" ? formatIDR(log.price) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-400 font-semibold">
                          {log.type === "masuk" ? formatIDR(log.qty * log.price) : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-slate-400 max-w-[150px] truncate italic" title={log.notes}>
                          {log.notes}
                        </TableCell>
                        <TableCell className="text-center">
                          {log.type === "masuk" ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => handleLogEditClick(log)}
                                className="p-1 text-slate-400 hover:text-violet-400 transition-colors"
                                title="Edit Transaksi"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleLogDelete(log.id)}
                                className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                                title="Hapus Transaksi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-600 text-[10px] italic">Simulasi</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                          Tidak ada data transaksi ditemukan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Right Column (Span 1) - Current Stock Levels */}
            <Card>
              <CardHeader className="border-b border-slate-800/40 pb-3">
                <CardTitle>Stok Barang Saat Ini</CardTitle>
                <CardDescription>Stok real-time (Pemasukan - Penjualan) untuk masing-masing varian.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 max-h-[500px] overflow-y-auto space-y-3 pr-1">
                {products.map((item) => (
                  <div 
                    key={item.id}
                    className="p-3 rounded-lg bg-slate-900/40 border border-slate-850 hover:border-slate-800 transition-colors flex items-center justify-between"
                  >
                    <div>
                      <p className="font-mono text-[10px] text-violet-400 font-semibold">{item.sku}</p>
                      <h4 className="text-xs font-bold text-slate-200 mt-0.5">{item.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Kategori: <span className="text-slate-400">{item.category}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <span 
                        className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                          item.stock <= 10
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                            : item.stock <= 25
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                        }`}
                      >
                        {item.stock} pcs
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1.5 font-mono">{formatIDR(item.price)}</p>
                    </div>
                  </div>
                ))}
                {products.length === 0 && (
                  <p className="text-center py-10 text-xs text-slate-500">Belum ada variasi produk terdaftar.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        /* Kelola Produk Tab (CRUD Products) */
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Master Data Produk & Varian</CardTitle>
              <CardDescription>Tambah, ubah, dan hapus master data produk beserta detail variasi/ukuran.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input pl-9 w-44"
                />
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setFormError("");
                  setFormSuccess("");
                  setIsAddProductOpen(true);
                }}
              >
                Tambah Produk
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama Produk</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Tipe Varian</TableHead>
                  <TableHead className="text-center">Menggunakan Ukuran</TableHead>
                  <TableHead>Variasi Terdaftar</TableHead>
                  <TableHead className="text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rawProducts
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((product) => {
                    // Extract sizes list
                    const sizesList = (product.product_sizes || []).map(s => s.size_label).join(", ");
                    // Extract active variants list
                    const variantsList = (product.product_variants || [])
                      .map(v => v.variant_label + (!v.is_active ? " (non-aktif)" : ""))
                      .join(", ");

                    return (
                      <TableRow key={product.id}>
                        <TableCell className="font-bold text-slate-200">
                          {product.name}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400">
                            {product.category || "Lainnya"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-slate-300">
                          {product.variant_type || "Warna"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.has_size ? "success" : "secondary"}>
                            {product.has_size ? "Ya" : "Tidak"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate text-xs text-slate-400" title={variantsList || sizesList}>
                          {product.has_size ? `Ukuran: ${sizesList}` : `Varian: ${variantsList}`}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleProductEditClick(product)}
                              className="p-1 text-slate-400 hover:text-violet-400 transition-colors"
                              title="Edit Detail Produk"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleProductDelete(product.id)}
                              className="p-1 text-slate-400 hover:text-rose-400 transition-colors"
                              title="Hapus Produk & Data Terkait"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {rawProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-500">
                      Belum ada produk di database. Silakan tambah produk baru.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* --- POPUP 1: CATAT BARANG MASUK (FLEXIBLE FORM WITH + BUTTONS) --- */}
      <Dialog
        isOpen={isStockInOpen}
        onClose={() => setIsStockInOpen(false)}
        title="Catat Barang Masuk (Restock)"
      >
        <form onSubmit={handleStockInSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* Product dropdown selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Pilih Produk Utama</label>
            <select
              value={selectedProductId}
              onChange={handleProductChange}
              className="glass-input w-full bg-slate-900 text-sm"
            >
              {rawProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Flexible variant quantity editor grid */}
          <div className="flex flex-col gap-2 border border-slate-800 rounded-lg p-3 bg-slate-950/40">
            <label className="text-xs font-semibold text-slate-400 border-b border-slate-800 pb-1.5 mb-1">
              Variasi & Jumlah Masuk
            </label>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1">
              {rawProducts
                .find(p => p.id === selectedProductId)
                ?.product_variants?.filter(v => v.is_active)
                .map((variant) => {
                  const sizeLabel = variant.product_sizes?.size_label || "";
                  const label = sizeLabel ? `Ukuran ${sizeLabel}` : variant.variant_label;
                  const inputData = variantInputs[variant.id] || { qty: 0, price: 35000 };

                  return (
                    <div key={variant.id} className="flex items-center justify-between gap-4 py-1 border-b border-slate-900/35 last:border-b-0">
                      <span className="text-xs font-bold text-slate-200 min-w-[100px]">{label}</span>
                      
                      {/* Price field per variant */}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">Rp</span>
                        <input
                          type="number"
                          value={inputData.price}
                          onChange={(e) => handleVariantPriceChange(variant.id, e.target.value)}
                          placeholder="Harga Beli"
                          className="glass-input w-20 py-0.5 text-center text-xs font-mono"
                        />
                      </div>

                      {/* Quantity adjuster with - [+] + */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleVariantQtyChange(variant.id, -1)}
                          className="text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          <MinusCircle className="w-5 h-5" />
                        </button>
                        <input
                          type="number"
                          value={inputData.qty}
                          onChange={(e) => handleVariantQtyValChange(variant.id, e.target.value)}
                          className="glass-input w-12 py-0.5 text-center text-xs font-bold font-mono"
                          min="0"
                        />
                        <button
                          type="button"
                          onClick={() => handleVariantQtyChange(variant.id, 1)}
                          className="text-violet-400 hover:text-violet-300 transition-colors"
                        >
                          <PlusCircle className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              
              {(!rawProducts.find(p => p.id === selectedProductId)?.product_variants || 
                rawProducts.find(p => p.id === selectedProductId)?.product_variants?.filter(v => v.is_active).length === 0) && (
                <p className="text-center py-4 text-xs text-slate-500">Produk ini tidak memiliki variasi aktif.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Transaction Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Tanggal Masuk</label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                required
                className="glass-input w-full text-xs font-mono"
              />
            </div>

            {/* Note field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Catatan</label>
              <input
                type="text"
                placeholder="e.g. Restock supplier"
                value={transactionNote}
                onChange={(e) => setTransactionNote(e.target.value)}
                className="glass-input w-full text-xs"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3 mt-4">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsStockInOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Simpan Transaksi
            </Button>
          </div>
        </form>
      </Dialog>

      {/* --- POPUP 2: EDIT TRANSACTION LOG --- */}
      <Dialog
        isOpen={isEditLogOpen}
        onClose={() => setIsEditLogOpen(false)}
        title="Ubah Transaksi Barang Masuk"
      >
        <form onSubmit={handleEditLogSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-400">Nama Produk / Varian</label>
            <p className="text-sm font-bold text-slate-200">{editingLog?.productName}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Jumlah (Qty)</label>
              <input
                type="number"
                value={editLogQty}
                onChange={(e) => setEditLogQty(parseInt(e.target.value, 10) || 0)}
                min="1"
                required
                className="glass-input w-full font-mono text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Harga Beli Satuan (Rp)</label>
              <input
                type="number"
                value={editLogPrice}
                onChange={(e) => setEditLogPrice(parseFloat(e.target.value) || 0)}
                min="0"
                required
                className="glass-input w-full font-mono text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Tanggal Masuk</label>
            <input
              type="date"
              value={editLogDate}
              onChange={(e) => setEditLogDate(e.target.value)}
              required
              className="glass-input w-full text-xs font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Catatan</label>
            <input
              type="text"
              value={editLogNote}
              onChange={(e) => setEditLogNote(e.target.value)}
              className="glass-input w-full text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3 mt-4">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditLogOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Dialog>

      {/* --- POPUP 3: TAMBAH PRODUK BARU --- */}
      <Dialog
        isOpen={isAddProductOpen}
        onClose={() => setIsAddProductOpen(false)}
        title="Tambah Produk & Varian Baru"
      >
        <form onSubmit={handleAddProductSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Nama Produk</label>
            <input
              type="text"
              placeholder="e.g. Kaos Kaki Bola, Sepatu Futsal"
              value={newProductName}
              onChange={(e) => setNewProductName(e.target.value)}
              required
              className="glass-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Kategori</label>
              <input
                type="text"
                placeholder="e.g. Aksesoris, Pakaian"
                value={newProductCategory}
                onChange={(e) => setNewProductCategory(e.target.value)}
                required
                className="glass-input w-full text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Tipe Varian</label>
              <input
                type="text"
                placeholder="e.g. Warna, Ukuran"
                value={newProductVarType}
                onChange={(e) => setNewProductVarType(e.target.value)}
                required
                className="glass-input w-full text-xs"
              />
            </div>
          </div>

          {/* Toggle has size */}
          <div className="flex items-center gap-2 py-1.5 border-t border-b border-slate-900">
            <input
              type="checkbox"
              id="hasSizeCheckbox"
              checked={newProductHasSize}
              onChange={(e) => {
                setNewProductHasSize(e.target.checked);
                // Switch default type accordingly
                setNewProductVarType(e.target.checked ? "Ukuran" : "Warna");
              }}
              className="w-4 h-4 text-violet-600 bg-slate-900 border-slate-800 rounded focus:ring-violet-500 cursor-pointer"
            />
            <label htmlFor="hasSizeCheckbox" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">
              Produk memiliki ukuran (misal: SD, SMP, L, XL)
            </label>
          </div>

          {newProductHasSize ? (
            /* Size Input Interface */
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Daftar Ukuran</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. SD, SMP, M, L"
                  value={sizeInputText}
                  onChange={(e) => setSizeInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSize())}
                  className="glass-input flex-1 text-xs"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddSize}>
                  Tambah
                </Button>
              </div>

              {/* Added sizes tags */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {addedSizes.map((s) => (
                  <span key={s} className="px-2 py-1 rounded bg-violet-600/25 border border-violet-500/35 text-[10px] font-bold text-violet-300 flex items-center gap-1.5">
                    {s}
                    <button type="button" onClick={() => handleRemoveSize(s)} className="hover:text-rose-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {addedSizes.length === 0 && (
                  <p className="text-[10px] text-slate-500 italic">Belum ada ukuran ditambahkan.</p>
                )}
              </div>
            </div>
          ) : (
            /* Custom Colors/Variants Input Interface */
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-300">Daftar Varian (Warna / Lainnya)</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="e.g. Hitam, Merah, Biru"
                  value={varInputText}
                  onChange={(e) => setVarInputText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddVariantLabel())}
                  className="glass-input flex-1 text-xs"
                />
                <Button type="button" variant="secondary" size="sm" onClick={handleAddVariantLabel}>
                  Tambah
                </Button>
              </div>

              {/* Added variants tags */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {addedVariants.map((v) => (
                  <span key={v} className="px-2 py-1 rounded bg-violet-600/25 border border-violet-500/35 text-[10px] font-bold text-violet-300 flex items-center gap-1.5">
                    {v}
                    <button type="button" onClick={() => handleRemoveVariantLabel(v)} className="hover:text-rose-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {addedVariants.length === 0 && (
                  <p className="text-[10px] text-slate-500 italic">Belum ada variasi ditambahkan.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3 mt-4">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsAddProductOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Simpan Produk
            </Button>
          </div>
        </form>
      </Dialog>

      {/* --- POPUP 4: EDIT PRODUCT & VARIANTS --- */}
      <Dialog
        isOpen={isEditProductOpen}
        onClose={() => setIsEditProductOpen(false)}
        title="Ubah Master Produk"
      >
        <form onSubmit={handleEditProductSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-300">Nama Produk</label>
            <input
              type="text"
              value={editProductName}
              onChange={(e) => setEditProductName(e.target.value)}
              required
              className="glass-input w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Kategori</label>
              <input
                type="text"
                value={editProductCategory}
                onChange={(e) => setEditProductCategory(e.target.value)}
                required
                className="glass-input w-full text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-300">Tipe Varian</label>
              <input
                type="text"
                value={editProductVarType}
                onChange={(e) => setEditProductVarType(e.target.value)}
                required
                className="glass-input w-full text-xs"
              />
            </div>
          </div>

          {/* Manage existing variants list */}
          <div className="flex flex-col gap-2 border border-slate-800 rounded-lg p-3 bg-slate-950/40">
            <label className="text-xs font-semibold text-slate-400 border-b border-slate-800 pb-1.5">
              Kelola Variasi Aktif
            </label>
            
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {editProductVariants.map((variant, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 py-1 border-b border-slate-900/40 last:border-b-0">
                  <input
                    type="text"
                    value={variant.variant_label}
                    onChange={(e) => handleEditVariantLabelChange(idx, e.target.value)}
                    required
                    className={`glass-input text-xs py-1 px-2 flex-1 bg-slate-900 border-slate-800 ${
                      variant.is_active ? "text-slate-200 font-bold" : "text-slate-500 line-through"
                    }`}
                  />
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleVariantActive(idx)}
                      className={`px-2 py-1 text-[10px] font-bold rounded border cursor-pointer select-none transition-all ${
                        variant.is_active
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-400"
                          : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-400"
                      }`}
                    >
                      {variant.is_active ? "Aktif" : "Non-aktif"}
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => handleDeleteVariantInEdit(idx)}
                      className="p-1 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                      title="Hapus Varian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new variant element inside edit product screen */}
            <div className="flex items-center gap-2 border-t border-slate-900 pt-2.5 mt-2">
              <input
                type="text"
                placeholder={editingProduct?.has_size ? "Tambah ukuran baru..." : "Tambah warna/variasi baru..."}
                value={newVariantLabelEdit}
                onChange={(e) => setNewVariantLabelEdit(e.target.value)}
                className="glass-input flex-1 text-xs py-1"
              />
              <Button type="button" variant="secondary" size="xs" onClick={handleAddVariantInEdit}>
                Tambah Varian
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3 mt-4">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditProductOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
