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
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
  ArrowLeftRight,
  Eye
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

const Skeleton = ({ className }) => (
  <div className={`animate-pulse bg-slate-200/80 dark:bg-slate-800/80 rounded ${className}`} />
);

export function InventoryPage({
  products,
  rawProducts,
  inventoryLogs,
  onRefreshData,
  productsLoading = false,
  stockInLoading = false,
  ordersLoading = false
}) {
  // Tabs: 'transactions' or 'products'
  const [activeSubTab, setActiveSubTab] = useState("transactions");
  const [searchQuery, setSearchQuery] = useState("");
  const [logFilter, setLogFilter] = useState("all"); // 'all', 'masuk', 'keluar'

  // --- Group collapse state ---
  const [collapsedProducts, setCollapsedProducts] = useState({});

  const toggleProductCollapse = (prodId) => {
    setCollapsedProducts(prev => ({
      ...prev,
      [prodId]: !prev[prodId]
    }));
  };

  // --- Date Filter for Card 1 ---
  const [selectedStockDate, setSelectedStockDate] = useState(() => {
    return new Date().toISOString().substring(0, 10);
  });

  const dateInputRef = React.useRef(null);
  const [transactionViewMode, setTransactionViewMode] = useState("all"); // 'all' or 'tambah_stok'

  const handlePrevDate = () => {
    const d = new Date(selectedStockDate);
    d.setDate(d.getDate() - 1);
    setSelectedStockDate(d.toISOString().substring(0, 10));
  };

  const handleNextDate = () => {
    const d = new Date(selectedStockDate);
    d.setDate(d.getDate() + 1);
    const todayStr = new Date().toISOString().substring(0, 10);
    if (d.toISOString().substring(0, 10) <= todayStr) {
      setSelectedStockDate(d.toISOString().substring(0, 10));
    }
  };

  const formatSelectedStockDate = (dateStr) => {
    const todayStr = new Date().toISOString().substring(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    if (dateStr === todayStr) return "Hari Ini";
    if (dateStr === yesterdayStr) return "Kemarin";

    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  };

  const totalStockInputtedOnDate = React.useMemo(() => {
    return inventoryLogs
      .filter((l) => l.type === "masuk" && new Date(l.date).toISOString().substring(0, 10) === selectedStockDate)
      .reduce((sum, l) => sum + l.qty, 0);
  }, [inventoryLogs, selectedStockDate]);

  const totalCurrentStock = React.useMemo(() => {
    return products.reduce((sum, item) => sum + (item.stock || 0), 0);
  }, [products]);

  // Group variants by product to show boxes per product
  const groupedProducts = React.useMemo(() => {
    const groups = {};
    const filtered = products.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase())
    );
    filtered.forEach(item => {
      const pId = item.productId;
      if (!groups[pId]) {
        groups[pId] = {
          productId: pId,
          productName: item.productName,
          category: item.category,
          totalStock: 0,
          variants: []
        };
      }
      groups[pId].variants.push(item);
      groups[pId].totalStock += (item.stock || 0);
    });
    return Object.values(groups);
  }, [products, searchQuery]);

  // Modal Open states
  const [isStockInOpen, setIsStockInOpen] = useState(false);
  const [isEditLogOpen, setIsEditLogOpen] = useState(false);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isMoveStockOpen, setIsMoveStockOpen] = useState(false);

  // Form states
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // --- Move Stock State ---
  const [moveProductId, setMoveProductId] = useState("");
  const [moveSourceVariantId, setMoveSourceVariantId] = useState("");
  const [moveTargetVariantId, setMoveTargetVariantId] = useState("");
  const [moveQty, setMoveQty] = useState(1);
  const [moveUnit, setMoveUnit] = useState("pcs"); // pcs | lusin | kodi
  const [moveError, setMoveError] = useState("");
  const [moveSuccess, setMoveSuccess] = useState("");

  // --- Stock View Unit State ---
  const [stockViewUnit, setStockViewUnit] = useState("pcs"); // pcs | lusin | kodi

  // --- Stock In Unit (global per modal open) ---
  const [stockInUnit, setStockInUnit] = useState("pcs"); // pcs | lusin | kodi

  // Helper: unit multiplier
  const unitMultiplier = (unit) => {
    if (unit === "lusin") return 12;
    if (unit === "kodi") return 20;
    return 1;
  };

  // Helper: convert pcs to display unit
  const convertStock = (pcs, unit) => {
    if (unit === "lusin") {
      const isNegative = pcs < 0;
      const absPcs = Math.abs(pcs);
      const lusin = Math.floor(absPcs / 12);
      const remainder = absPcs % 12;
      const sign = isNegative ? "-" : "";
      
      if (lusin === 0 && remainder === 0) return "0 lusin";
      
      const parts = [];
      if (lusin > 0) parts.push(`${lusin} lusin`);
      if (remainder > 0) parts.push(`${remainder} pcs`);
      
      return sign + parts.join(" ");
    }
    if (unit === "kodi") {
      const isNegative = pcs < 0;
      const absPcs = Math.abs(pcs);
      const kodi = Math.floor(absPcs / 20);
      const remainder = absPcs % 20;
      const sign = isNegative ? "-" : "";
      
      if (kodi === 0 && remainder === 0) return "0 kodi";
      
      const parts = [];
      if (kodi > 0) parts.push(`${kodi} kodi`);
      if (remainder > 0) parts.push(`${remainder} pcs`);
      
      return sign + parts.join(" ");
    }
    return `${pcs} pcs`;
  };

  const parseUnitInfo = (note) => {
    if (!note) return null;
    const match = note.match(/ \|\|unit_info:([0-9.-]+):([a-z]+)\|\|/);
    if (match) {
      return {
        qty: parseFloat(match[1]),
        unit: match[2],
        cleanNote: note.replace(/ \|\|unit_info:[0-9.-]+:[a-z]+\|\|/, "")
      };
    }
    return null;
  };

  const unitLabel = (unit) => {
    if (unit === "lusin") return "lusin";
    if (unit === "kodi") return "kodi";
    return "pcs";
  };

  // --- stock_in Form State ---
  const [productBlocks, setProductBlocks] = useState([]); // [{ id, productId, quantities: { [varId]: qty } }]
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [transactionNote, setTransactionNote] = useState("");

  // --- Edit Transaction State ---
  const [editingLog, setEditingLog] = useState(null);
  const [editLogQty, setEditLogQty] = useState(1);
  const [editLogUnit, setEditLogUnit] = useState("pcs");
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
  const handleAddBlock = () => {
    setProductBlocks(prev => [...prev, {
      id: `block-${Date.now()}-${Math.random()}`,
      productId: "",
      quantities: {}
    }]);
  };

  const handleRemoveBlock = (blockId) => {
    setProductBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const handleBlockProductChange = (blockId, prodId) => {
    const prod = rawProducts.find(p => p.id === prodId);
    const initialQuantities = {};
    if (prod) {
      (prod.product_variants || []).forEach(v => {
        if (v.is_active) {
          initialQuantities[v.id] = 0;
        }
      });
    }
    setProductBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          productId: prodId,
          quantities: initialQuantities
        };
      }
      return b;
    }));
  };

  const handleVariantQtyChange = (blockId, variantId, delta) => {
    setProductBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const currentQty = b.quantities[variantId] || 0;
        return {
          ...b,
          quantities: {
            ...b.quantities,
            [variantId]: currentQty + delta // allow negative
          }
        };
      }
      return b;
    }));
  };

  const handleVariantQtyValChange = (blockId, variantId, val) => {
    const intVal = parseInt(val, 10);
    const cleanVal = isNaN(intVal) ? 0 : intVal; // allow negative values
    setProductBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return {
          ...b,
          quantities: {
            ...b.quantities,
            [variantId]: cleanVal
          }
        };
      }
      return b;
    }));
  };

  // Submit stock_in entries to Supabase (supports pcs/lusin/kodi unit)
  const handleStockInSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    try {
      const multiplier = unitMultiplier(stockInUnit);
      const entriesToSubmit = [];
      productBlocks.forEach(block => {
        if (!block.productId) return;
        const prod = rawProducts.find(p => p.id === block.productId);
        if (!prod) return;

        Object.keys(block.quantities).forEach(variantId => {
          const qtyInUnit = block.quantities[variantId] || 0;
          if (qtyInUnit !== 0) {
            const qtyInPcs = qtyInUnit * multiplier;
            const noteSuffix = ` ||unit_info:${qtyInUnit}:${stockInUnit}||`;
            const finalNote = (transactionNote || "Restock manual") + noteSuffix;
            entriesToSubmit.push({
              variant_id: variantId,
              quantity: qtyInPcs,
              date: transactionDate || new Date().toISOString().substring(0, 10),
              note: finalNote
            });
          }
        });
      });

      if (entriesToSubmit.length === 0) {
        setFormError("Pilih minimal satu variasi dengan jumlah tidak nol.");
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
        setProductBlocks([]);
        setStockInUnit("pcs");
      }, 1000);

    } catch (err) {
      setFormError("Terjadi kesalahan saat menyimpan transaksi ke database.");
    }
  };

  // --- Move Stock Handler ---
  const handleMoveStockSubmit = async (e) => {
    e.preventDefault();
    setMoveError("");
    setMoveSuccess("");

    if (!moveProductId || !moveSourceVariantId || !moveTargetVariantId) {
      setMoveError("Lengkapi semua pilihan produk dan varian.");
      return;
    }
    if (moveSourceVariantId === moveTargetVariantId) {
      setMoveError("Varian asal dan tujuan tidak boleh sama.");
      return;
    }
    if (!moveQty || moveQty <= 0) {
      setMoveError("Jumlah harus lebih dari 0.");
      return;
    }

    try {
      const qtyInPcs = moveQty * unitMultiplier(moveUnit);
      const today = new Date().toISOString().substring(0, 10);

      // Get readable labels for variants
      const prod = rawProducts.find(p => p.id === moveProductId);
      const activeVariants = (prod?.product_variants || []);
      const sourceVar = activeVariants.find(v => v.id === moveSourceVariantId);
      const targetVar = activeVariants.find(v => v.id === moveTargetVariantId);

      const sourceSizeLabel = sourceVar?.product_sizes?.size_label || "";
      const sourceVarLabel = sourceVar?.variant_label || "";
      const sourceLabel = sourceSizeLabel && sourceVarLabel ? `${sourceSizeLabel} - ${sourceVarLabel}` : (sourceSizeLabel || sourceVarLabel);

      const targetSizeLabel = targetVar?.product_sizes?.size_label || "";
      const targetVarLabel = targetVar?.variant_label || "";
      const targetLabel = targetSizeLabel && targetVarLabel ? `${targetSizeLabel} - ${targetVarLabel}` : (targetSizeLabel || targetVarLabel);

      const noteSuffixSource = ` ||unit_info:${-moveQty}:${moveUnit}||`;
      const noteSuffixTarget = ` ||unit_info:${moveQty}:${moveUnit}||`;

      // Create two entries: deduct from source, add to target
      await addStockIn([
        {
          variant_id: moveSourceVariantId,
          quantity: -qtyInPcs, // keluar dari varian asal
          date: today,
          note: `Pemindahan stok → ${targetLabel}${noteSuffixSource}`
        },
        {
          variant_id: moveTargetVariantId,
          quantity: qtyInPcs, // masuk ke varian tujuan
          date: today,
          note: `Pemindahan stok ← ${sourceLabel}${noteSuffixTarget}`
        }
      ]);

      setMoveSuccess(`Berhasil memindahkan ${moveQty} ${unitLabel(moveUnit)} (${qtyInPcs} pcs) ke ukuran tujuan!`);
      await onRefreshData();

      setTimeout(() => {
        setIsMoveStockOpen(false);
        setMoveSuccess("");
        setMoveProductId("");
        setMoveSourceVariantId("");
        setMoveTargetVariantId("");
        setMoveQty(1);
        setMoveUnit("pcs");
      }, 1500);

    } catch (err) {
      setMoveError("Gagal memindahkan stok. Silakan coba lagi.");
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
    const parsed = parseUnitInfo(log.notes);
    if (parsed) {
      setEditLogQty(parsed.qty);
      setEditLogUnit(parsed.unit);
      setEditLogNote(parsed.cleanNote);
    } else {
      setEditLogQty(log.qty);
      setEditLogUnit("pcs");
      setEditLogNote(log.notes);
    }
    setEditLogDate(new Date(log.date).toISOString().substring(0, 10));
    setFormError("");
    setIsEditLogOpen(true);
  };

  // Submit edited stock log to Supabase
  const handleEditLogSubmit = async (e) => {
    e.preventDefault();
    setFormError("");
    try {
      if (editLogQty === 0) {
        setFormError("Jumlah barang tidak boleh nol.");
        return;
      }
      const multiplier = unitMultiplier(editLogUnit);
      const qtyInPcs = editLogQty * multiplier;
      const noteSuffix = ` ||unit_info:${editLogQty}:${editLogUnit}||`;
      const finalNote = editLogNote.trim() + noteSuffix;

      await updateStockIn(editingLog.id, {
        quantity: qtyInPcs,
        date: editLogDate,
        note: finalNote
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
    setProductBlocks([]);
    setTransactionDate(new Date().toISOString().substring(0, 10));
    setTransactionNote("");
    setFormError("");
    setFormSuccess("");
    setStockInUnit("pcs"); // reset unit
    setIsStockInOpen(true);
  };

  // Filter logs by type, search query, and selectedStockDate
  const filteredLogs = inventoryLogs
    .filter(log => {
      if (transactionViewMode === "tambah_stok") {
        return log.type === "masuk";
      }
      return logFilter === "all" || log.type === logFilter;
    })
    .filter(log => new Date(log.date).toISOString().substring(0, 10) === selectedStockDate)
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
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto pb-px">
        <button
          onClick={() => {
            setActiveSubTab("transactions");
            setSearchQuery("");
          }}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeSubTab === "transactions"
              ? "border-violet-500 text-slate-800 dark:text-slate-100"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
        >
          <ArrowDownLeft className="w-4 h-4 text-emerald-555 dark:text-emerald-400" />
          Transaksi Barang Masuk
        </button>
        <button
          onClick={() => {
            setActiveSubTab("products");
            setSearchQuery("");
          }}
          className={`px-5 py-3 text-sm font-semibold transition-all border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${activeSubTab === "products"
              ? "border-violet-500 text-slate-800 dark:text-slate-100"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
        >
          <Layers className="w-4 h-4 text-violet-500 dark:text-violet-400" />
          Kelola Produk & Varian
        </button>
      </div>

      {activeSubTab === "transactions" ? (
        <>
          {/* Summary Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <Card
              onClick={() => {
                setActiveSubTab("products");
                setSearchQuery("");
              }}
              className="cursor-pointer hover:border-violet-500/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Varian Terdaftar</span>
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                {productsLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{products.length} SKU</h3>
                )}
                <p className="text-xs text-slate-500 mt-1 font-medium">Model barang di toko</p>
              </div>
            </Card>
            <Card
              onClick={() => setTransactionViewMode("tambah_stok")}
              className={`cursor-pointer transition-all ${transactionViewMode === "tambah_stok"
                  ? "border-emerald-500 ring-1 ring-emerald-500/25 bg-emerald-50/10 dark:bg-emerald-950/5"
                  : "hover:border-slate-350 dark:hover:border-slate-800"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Barang Masuk per Tanggal</span>
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <ArrowDownLeft className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  {stockInLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                      {totalStockInputtedOnDate} pcs
                    </h3>
                  )}
                  <div className="relative">
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={selectedStockDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val && val <= new Date().toISOString().substring(0, 10)) {
                          setSelectedStockDate(val);
                        }
                      }}
                      max={new Date().toISOString().substring(0, 10)}
                      className="absolute w-0 h-0 opacity-0 pointer-events-none"
                      title="Pilih Tanggal"
                    />
                    <button
                      type="button"
                      disabled={stockInLoading}
                      onClick={() => {
                        if (dateInputRef.current) {
                          if (typeof dateInputRef.current.showPicker === "function") {
                            dateInputRef.current.showPicker();
                          } else {
                            dateInputRef.current.click();
                          }
                        }
                      }}
                      className="p-1.5 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-655 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer z-20 disabled:opacity-50"
                    >
                      <Calendar className="w-3.5 h-3.5 text-violet-555 dark:text-violet-400" />
                      <span className="text-xs font-semibold">Pilih Tanggal</span>
                    </button>
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-655 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>{formatSelectedStockDate(selectedStockDate)}</span>
                </div>
                {/* Tambah Stok button shown when card active */}
                {transactionViewMode === "tambah_stok" && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleOpenStockIn(); }}
                    className="mt-1 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow transition-all cursor-pointer w-full justify-center"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Stok
                  </button>
                )}
              </div>
            </Card>

            <Card
              onClick={() => setTransactionViewMode("all")}
              className={`cursor-pointer transition-all sm:col-span-2 md:col-span-1 ${transactionViewMode === "all"
                  ? "border-sky-500 ring-1 ring-sky-500/25 bg-sky-50/10 dark:bg-sky-950/5"
                  : "hover:border-slate-350 dark:hover:border-slate-800"
                }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Stok Saat Ini</span>
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <ArrowUpRight className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-4">
                {productsLoading || stockInLoading || ordersLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                    {totalCurrentStock} Pcs
                  </h3>
                )}
                <p className="text-xs text-slate-500 mt-1 font-medium">Stok fisik setelah dikurangi pesanan</p>
              </div>
            </Card>
          </div>

          {/* Core Table Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Incoming Logs List */}
            <Card>
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle>
                    {transactionViewMode === "tambah_stok" ? "Riwayat Tambah Stok" : "Riwayat Transaksi Stok"}
                  </CardTitle>
                  {/* <CardDescription>Catatan jumlah stok</CardDescription> */}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-80">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Cari barang/catatan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="glass-input !pl-9 w-full"
                    />
                  </div>
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
                      <TableHead>Keterangan</TableHead>
                      <TableHead className="text-center">Aksi</TableHead>
                    </TableRow>
                  </TableH                  <TableBody>
                    {stockInLoading || ordersLoading ? (
                      Array.from({ length: 5 }).map((_, idx) => (
                        <TableRow key={`ske-tx-${idx}`}>
                          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                          <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : (
                      filteredLogs.map((log) => {
                        const parsed = parseUnitInfo(log.notes);
                        const displayQty = parsed ? `${Math.abs(parsed.qty)} ${parsed.unit}` : `${Math.abs(log.qty)} pcs`;
                        const displayNote = parsed ? parsed.cleanNote : log.notes;
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs text-slate-500 dark:text-slate-400">
                              {new Date(log.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "2-digit" })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.type === "masuk" ? "success" : "danger"}>
                                {log.type === "masuk" ? "Masuk" : "Keluar"}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                              {log.productName}
                            </TableCell>
                            <TableCell className="text-center font-mono font-bold">
                              {log.qty < 0 ? "-" : (log.type === "masuk" ? "+" : "-")}
                              {displayQty}
                            </TableCell>
                            <TableCell className="text-xs text-slate-550 dark:text-slate-400 max-w-[150px] truncate italic" title={displayNote}>
                              {displayNote}
                            </TableCell>
                            <TableCell className="text-center">
                              {log.type === "masuk" ? (
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => handleLogEditClick(log)}
                                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-violet-650 dark:hover:text-violet-400 transition-colors cursor-pointer"
                                    title="Edit Transaksi"
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleLogDelete(log.id)}
                                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-650 dark:hover:text-rose-455 transition-colors cursor-pointer"
                                    title="Hapus Transaksi"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-600 text-[10px] italic">Simulasi</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                    {!stockInLoading && !ordersLoading && filteredLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-500">
                          Tidak ada data transaksi ditemukan.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Right Column (Span 1) - Current Stock Levels grouped by Product */}
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              <div className="border-b border-slate-200 dark:border-slate-800/40 pb-3 mb-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Stok Barang Saat Ini</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Dikelompokkan per produk dan variasi.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Move Stock Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setMoveProductId("");
                        setMoveSourceVariantId("");
                        setMoveTargetVariantId("");
                        setMoveQty(1);
                        setMoveUnit("pcs");
                        setMoveError("");
                        setMoveSuccess("");
                        setIsMoveStockOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400 hover:bg-violet-500/20 transition-all text-xs font-semibold cursor-pointer"
                      title="Pindah stok antar ukuran"
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Pindah Stok
                    </button>
                    {/* Unit Toggle */}
                    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden text-[10px] font-bold">
                      {["pcs", "lusin", "kodi"].map((u) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setStockViewUnit(u)}
                          className={`px-2 py-1.5 cursor-pointer transition-colors uppercase ${
                            stockViewUnit === u
                              ? "bg-violet-600 text-white"
                              : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {productsLoading || stockInLoading || ordersLoading ? (
                <div className="space-y-3">
                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                  <div className="p-3 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ) : groupedProducts.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 text-xs py-8 bg-slate-50 dark:bg-slate-900/20 rounded-xl border border-slate-200 dark:border-slate-850">
                  Tidak ada data produk ditemukan.
                </p>
              ) : (
                groupedProducts.map((group) => (
                  <Card key={group.productId} className="overflow-hidden border-slate-200 dark:border-slate-855 hover:border-slate-350 dark:hover:border-slate-800 transition-colors">
                    {/* Product Header (Clickable for Collapse/Extend) */}
                    <div
                      onClick={() => toggleProductCollapse(group.productId)}
                      className="p-3 bg-slate-50/80 dark:bg-slate-900/40 border-b border-slate-200/60 dark:border-slate-800/40 flex items-center justify-between cursor-pointer select-none hover:bg-slate-100/80 dark:hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${collapsedProducts[group.productId] ? "-rotate-90" : ""
                            }`}
                        />
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-855 dark:text-slate-200 uppercase tracking-wider">{group.productName}</h4>
                          <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-550 uppercase tracking-wider bg-slate-200/50 dark:bg-slate-800/50 px-1.5 py-0.5 rounded-md mt-1 inline-block">
                            {group.category}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span
                          className={`font-mono font-extrabold text-xs px-2.5 py-1 rounded-md border shadow-sm ${
                            group.totalStock < 0
                              ? "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                              : group.totalStock <= 100
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-455 border-rose-500/20"
                              : group.totalStock <= 200
                                ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20"
                                : "bg-emerald-500/10 text-emerald-650 dark:text-emerald-455 border-emerald-500/20"
                          }`}
                        >
                          Total: {convertStock(group.totalStock, stockViewUnit)}
                        </span>
                      </div>
                    </div>

                    {/* Variants list */}
                    {!collapsedProducts[group.productId] && (
                      <CardContent className="p-3 space-y-2 bg-white dark:bg-slate-950/20 animate-in fade-in duration-200">
                        {group.variants.map((v) => (
                          <div key={v.id} className="flex items-center justify-between text-xs py-1 border-b border-dashed border-slate-100 dark:border-slate-900 last:border-0 last:pb-0">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{v.variantLabel}</span>
                              <span className="font-mono text-[9px] text-slate-400 dark:text-slate-550">{v.sku}</span>
                            </div>
                            <span
                              className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded border ${
                                v.stock < 0
                                  ? "bg-rose-600/15 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                  : v.stock <= 100
                                  ? "bg-rose-550/5 text-rose-600 dark:text-rose-400 border-rose-500/10"
                                  : v.stock <= 200
                                    ? "bg-yellow-550/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/10"
                                    : "bg-emerald-550/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/10"
                              }`}
                            >
                              {convertStock(v.stock, stockViewUnit)}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                ))
              )}
            </div>
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari nama produk..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="glass-input !pl-9 w-full sm:w-44"
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
                className="w-full sm:w-auto justify-center"
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
                {productsLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={`ske-prod-${idx}`}>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  rawProducts
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
                          <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                            {product.name}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 text-slate-600 dark:text-slate-400 font-medium">
                              {product.category || "Lainnya"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 dark:text-slate-350">
                            {product.variant_type || "Warna"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={product.has_size ? "success" : "secondary"}>
                              {product.has_size ? "Ya" : "Tidak"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate text-xs text-slate-500 dark:text-slate-400" title={variantsList || sizesList}>
                            {product.has_size ? `Ukuran: ${sizesList}` : `Varian: ${variantsList}`}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleProductEditClick(product)}
                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-violet-650 dark:hover:text-violet-400 transition-colors cursor-pointer"
                                title="Edit Detail Produk"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleProductDelete(product.id)}
                                className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-650 dark:hover:text-rose-455 transition-colors cursor-pointer"
                                title="Hapus Produk & Data Terkait"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
                {!productsLoading && rawProducts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400 dark:text-slate-550">
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
        className="max-w-2xl"
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

          {/* Unit Selector */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            <Eye className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Satuan Input:</span>
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[10px] font-bold ml-1">
              {["pcs", "lusin", "kodi"].map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setStockInUnit(u)}
                  className={`px-3 py-1.5 cursor-pointer transition-colors uppercase ${
                    stockInUnit === u
                      ? "bg-emerald-600 text-white"
                      : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 italic ml-1">
              {stockInUnit === "lusin" ? "(1 lusin = 12 pcs)" : stockInUnit === "kodi" ? "(1 kodi = 20 pcs)" : "(1 pcs = 1 pcs)"}
            </span>
          </div>

          {/* List of Product Blocks */}
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
            {productBlocks.map((block) => (
              <div key={block.id} className="relative border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40 space-y-3">
                {/* Block Header with Close/Remove button */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Blok Barang Masuk</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveBlock(block.id)}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                    title="Hapus blok produk"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Dropdown for selecting product */}
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Pilih Produk</label>
                  <select
                    value={block.productId}
                    onChange={(e) => handleBlockProductChange(block.id, e.target.value)}
                    className="glass-input w-full bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Pilih Produk --</option>
                    {rawProducts
                      .filter(p => p.id === block.productId || !productBlocks.some(b => b.id !== block.id && b.productId === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* If product is selected, show its variants and sizes inside this block */}
                {block.productId && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Variasi & Jumlah Masuk <span className="text-emerald-500 font-bold uppercase">({stockInUnit})</span></label>
                    <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                      {rawProducts
                        .find(p => p.id === block.productId)
                        ?.product_variants?.filter(v => v.is_active)
                        .map((variant) => {
                          const sizeLabel = variant.product_sizes?.size_label || "";
                          const varLabel = variant.variant_label || "";
                          const label = sizeLabel && varLabel
                            ? `Ukuran ${sizeLabel} - ${varLabel}`
                            : (sizeLabel ? `Ukuran ${sizeLabel}` : varLabel);

                          const qty = block.quantities[variant.id] || 0;

                          return (
                            <div key={variant.id} className="flex items-center justify-between gap-4 py-1 border-b border-slate-200 dark:border-slate-900/35 last:border-b-0">
                              <span className="text-xs text-slate-700 dark:text-slate-200 font-medium">{label}</span>

                              {/* Qty Counter */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleVariantQtyChange(block.id, variant.id, -1)}
                                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                >
                                  <MinusCircle className="w-5 h-5" />
                                </button>
                                <input
                                  type="number"
                                  value={qty}
                                  onChange={(e) => handleVariantQtyValChange(block.id, variant.id, e.target.value)}
                                  className="glass-input w-20 py-0.5 text-center text-xs font-bold font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleVariantQtyChange(block.id, variant.id, 1)}
                                  className="text-violet-650 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 transition-colors cursor-pointer"
                                >
                                  <PlusCircle className="w-5 h-5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {productBlocks.length === 0 && (
              <div className="text-center py-8 border border-dashed border-slate-350 dark:border-slate-850 rounded-xl bg-slate-50/30 dark:bg-slate-950/20">
                <p className="text-xs text-slate-500 dark:text-slate-450 italic">Belum ada produk yang ditambahkan. Silakan klik "+ Tambah Produk" di bawah.</p>
              </div>
            )}
          </div>

          {/* Add Product Button */}
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={handleAddBlock}
              disabled={productBlocks.length >= rawProducts.length}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-slate-350 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-350 hover:bg-slate-100 dark:hover:bg-slate-900 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Tambah Produk
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-slate-200 dark:border-slate-800 pt-3">
            {/* Transaction Date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tanggal Masuk</label>
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Catatan</label>
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
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
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
            <label className="text-xs font-semibold text-slate-550 dark:text-slate-400">Nama Produk / Varian</label>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{editingLog?.productName}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jumlah (Qty)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editLogQty}
                onChange={(e) => setEditLogQty(parseFloat(e.target.value) || 0)}
                step="any"
                required
                className="glass-input flex-1 font-mono text-sm"
              />
              {/* Unit Selector */}
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[10px] font-bold shrink-0">
                {["pcs", "lusin", "kodi"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setEditLogUnit(u)}
                    className={`px-2.5 py-2 cursor-pointer transition-colors uppercase ${
                      editLogUnit === u
                        ? "bg-violet-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {editLogQty !== 0 && (
              <p className="text-[10px] text-slate-450 dark:text-slate-500 italic">
                = {editLogQty * unitMultiplier(editLogUnit)} pcs
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tanggal Masuk</label>
            <input
              type="date"
              value={editLogDate}
              onChange={(e) => setEditLogDate(e.target.value)}
              required
              className="glass-input w-full text-xs font-mono"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Catatan</label>
            <input
              type="text"
              value={editLogNote}
              onChange={(e) => setEditLogNote(e.target.value)}
              className="glass-input w-full text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsEditLogOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </Dialog>

      {/* --- POPUP 5: PINDAH STOK ANTAR UKURAN/VARIAN --- */}
      <Dialog
        isOpen={isMoveStockOpen}
        onClose={() => setIsMoveStockOpen(false)}
        title="Pindah Stok Antar Ukuran / Varian"
        className="max-w-lg"
      >
        <form onSubmit={handleMoveStockSubmit} className="space-y-4 pt-2">
          {moveError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-center gap-2 font-medium">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{moveError}</span>
            </div>
          )}

          {moveSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0" />
              <span>{moveSuccess}</span>
            </div>
          )}

          {/* Penjelasan */}
          <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/15 text-xs text-violet-600 dark:text-violet-400">
            <p className="font-semibold mb-1 flex items-center gap-1.5"><ArrowLeftRight className="w-3.5 h-3.5" /> Cara kerja pemindahan stok:</p>
            <ul className="list-disc list-inside space-y-0.5 text-violet-500/80 dark:text-violet-400/80">
              <li>Stok akan dikurangi dari <strong>varian asal</strong></li>
              <li>Stok akan ditambahkan ke <strong>varian tujuan</strong></li>
              <li>Perubahan terjadi setelah konfirmasi berhasil</li>
            </ul>
          </div>

          {/* Pilih Produk */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pilih Produk</label>
            <select
              value={moveProductId}
              onChange={(e) => {
                setMoveProductId(e.target.value);
                setMoveSourceVariantId("");
                setMoveTargetVariantId("");
              }}
              required
              className="glass-input w-full bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="">-- Pilih Produk --</option>
              {rawProducts.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Varian Asal & Tujuan */}
          {moveProductId && (() => {
            const prod = rawProducts.find(p => p.id === moveProductId);
            const activeVariants = (prod?.product_variants || []).filter(v => v.is_active);
            return (
              <div className="grid grid-cols-2 gap-3">
                {/* Varian Asal */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Varian / Ukuran <span className="text-rose-500">Asal</span>
                  </label>
                  <select
                    value={moveSourceVariantId}
                    onChange={(e) => setMoveSourceVariantId(e.target.value)}
                    required
                    className="glass-input w-full bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Pilih Asal --</option>
                    {activeVariants.map((v) => {
                      const sizeLabel = v.product_sizes?.size_label || "";
                      const varLabel = v.variant_label || "";
                      const label = sizeLabel && varLabel ? `${sizeLabel} - ${varLabel}` : (sizeLabel || varLabel);
                      // get current stock from products flat list
                      const stockItem = products.find(p => p.id === v.id);
                      return (
                        <option key={v.id} value={v.id} disabled={v.id === moveTargetVariantId}>
                          {label} (stok: {stockItem?.stock ?? "?"} pcs)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Varian Tujuan */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Varian / Ukuran <span className="text-emerald-500">Tujuan</span>
                  </label>
                  <select
                    value={moveTargetVariantId}
                    onChange={(e) => setMoveTargetVariantId(e.target.value)}
                    required
                    className="glass-input w-full bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Pilih Tujuan --</option>
                    {activeVariants.map((v) => {
                      const sizeLabel = v.product_sizes?.size_label || "";
                      const varLabel = v.variant_label || "";
                      const label = sizeLabel && varLabel ? `${sizeLabel} - ${varLabel}` : (sizeLabel || varLabel);
                      const stockItem = products.find(p => p.id === v.id);
                      return (
                        <option key={v.id} value={v.id} disabled={v.id === moveSourceVariantId}>
                          {label} (stok: {stockItem?.stock ?? "?"} pcs)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            );
          })()}

          {/* Jumlah & Satuan */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jumlah yang Dipindahkan</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={moveQty}
                onChange={(e) => setMoveQty(parseFloat(e.target.value) || 0)}
                min="0.01"
                step="any"
                required
                className="glass-input flex-1 font-mono text-sm"
              />
              {/* Unit Selector */}
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-[10px] font-bold shrink-0">
                {["pcs", "lusin", "kodi"].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setMoveUnit(u)}
                    className={`px-2.5 py-2 cursor-pointer transition-colors uppercase ${
                      moveUnit === u
                        ? "bg-violet-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {/* Konversi preview */}
            {moveQty > 0 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                = {moveQty * unitMultiplier(moveUnit)} pcs yang akan dipindahkan
                {moveUnit === "lusin" ? ` (${moveQty} × 12)` : moveUnit === "kodi" ? ` (${moveQty} × 20)` : ""}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-2">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsMoveStockOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" size="sm" type="submit" icon={ArrowLeftRight}>
              Pindahkan Stok
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Produk</label>
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kategori</label>
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipe Varian</label>
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
          <div className="flex items-center gap-2 py-1.5 border-t border-b border-slate-200 dark:border-slate-900">
            <input
              type="checkbox"
              id="hasSizeCheckbox"
              checked={newProductHasSize}
              onChange={(e) => {
                setNewProductHasSize(e.target.checked);
                // Switch default type accordingly
                setNewProductVarType(e.target.checked ? "Ukuran" : "Warna");
              }}
              className="w-4 h-4 text-violet-600 bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-800 rounded focus:ring-violet-500 cursor-pointer"
            />
            <label htmlFor="hasSizeCheckbox" className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
              Produk memiliki ukuran (misal: SD, SMP, L, XL)
            </label>
          </div>

          {newProductHasSize ? (
            /* Size Input Interface */
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Daftar Ukuran</label>
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
                  <span key={s} className="px-2 py-1 rounded bg-violet-500/10 dark:bg-violet-600/25 border border-violet-500/30 dark:border-violet-500/35 text-[10px] font-bold text-violet-650 dark:text-violet-300 flex items-center gap-1.5">
                    {s}
                    <button type="button" onClick={() => handleRemoveSize(s)} className="hover:text-rose-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {addedSizes.length === 0 && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 italic">Belum ada ukuran ditambahkan.</p>
                )}
              </div>
            </div>
          ) : (
            /* Custom Colors/Variants Input Interface */
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Daftar Varian (Warna / Lainnya)</label>
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
                  <span key={v} className="px-2 py-1 rounded bg-violet-500/10 dark:bg-violet-600/25 border border-violet-500/30 dark:border-violet-500/35 text-[10px] font-bold text-violet-650 dark:text-violet-300 flex items-center gap-1.5">
                    {v}
                    <button type="button" onClick={() => handleRemoveVariantLabel(v)} className="hover:text-rose-500 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {addedVariants.length === 0 && (
                  <p className="text-[10px] text-slate-500 dark:text-slate-500 italic">Belum ada variasi ditambahkan.</p>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
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
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Nama Produk</label>
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
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Kategori</label>
              <input
                type="text"
                value={editProductCategory}
                onChange={(e) => setEditProductCategory(e.target.value)}
                required
                className="glass-input w-full text-xs"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tipe Varian</label>
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
          <div className="flex flex-col gap-2 border border-slate-200 dark:border-slate-800 rounded-lg p-3 bg-slate-50/50 dark:bg-slate-950/40">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1.5">
              Kelola Variasi Aktif
            </label>

            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {editProductVariants.map((variant, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 py-1 border-b border-slate-200/50 dark:border-slate-900/40 last:border-b-0">
                  <input
                    type="text"
                    value={variant.variant_label}
                    onChange={(e) => handleEditVariantLabelChange(idx, e.target.value)}
                    required
                    className={`glass-input text-xs py-1 px-2 flex-1 bg-white dark:bg-slate-900 border-slate-250 dark:border-slate-800 ${variant.is_active ? "text-slate-800 dark:text-slate-200 font-bold" : "text-slate-400 dark:text-slate-500 line-through"
                      }`}
                  />

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleVariantActive(idx)}
                      className={`px-2 py-1 text-[10px] font-bold rounded border cursor-pointer select-none transition-all ${variant.is_active
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-white dark:bg-slate-900 border-slate-250 dark:border-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-400"
                        }`}
                    >
                      {variant.is_active ? "Aktif" : "Non-aktif"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteVariantInEdit(idx)}
                      className="p-1 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-455 transition-colors cursor-pointer"
                      title="Hapus Varian"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add new variant element inside edit product screen */}
            <div className="flex items-center gap-2 border-t border-slate-200 dark:border-slate-900 pt-2.5 mt-2">
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

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3 mt-4">
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
