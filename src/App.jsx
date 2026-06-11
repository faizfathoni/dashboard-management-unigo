import React, { useState, useEffect } from "react";
import { Sidebar } from "./components/layout/Sidebar";
import { Header } from "./components/layout/Header";
import { DashboardOverview } from "./pages/DashboardOverview";
import { InventoryPage } from "./pages/InventoryPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SettingsPage } from "./pages/SettingsPage";
import { fetchProducts, fetchStockIn, fetchOrders, mapInventoryItems } from "./lib/db";
import { Loader2 } from "lucide-react";

const findVariantIdByName = (prodName, variation, productsList) => {
  const pName = (prodName || "").toLowerCase();
  const vLabel = (variation || "").toLowerCase();
  
  let bestMatch = null;
  let highestScore = 0;

  for (const item of productsList) {
    let score = 0;
    const itemProdName = (item.productName || "").toLowerCase();
    const itemVarLabel = (item.variantLabel || "").toLowerCase();

    if (pName.includes(itemProdName) || itemProdName.includes(pName)) {
      score += 10;
    }

    if (vLabel) {
      const parts = vLabel.split(/[\s,\-\+]+/).map(p => p.trim()).filter(Boolean);
      parts.forEach(part => {
        if (itemVarLabel.includes(part)) {
          score += 2;
        }
      });
    }

    if (score > highestScore) {
      highestScore = score;
      bestMatch = item;
    }
  }

  if (bestMatch && highestScore >= 10) {
    return bestMatch.id;
  }
  return null;
};

function App() {
  // 1. Theme and Layout states
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("unigo_theme") || "dark";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 2. Data states
  const [rawProducts, setRawProducts] = useState([]);
  const [stockInLogs, setStockInLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const [orders, setOrders] = useState(() => {
    const saved = localStorage.getItem("unigo_orders");
    return saved ? JSON.parse(saved) : [];
  });

  const [supabaseOrders, setSupabaseOrders] = useState([]);

  const [lastSynced, setLastSynced] = useState(() => {
    const saved = localStorage.getItem("unigo_last_synced");
    return saved ? saved : new Date("2026-06-10T10:00:00Z").toISOString();
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [isSyncing, setIsSyncing] = useState(false);

  // Theme synchronization effect
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("unigo_theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // 2. Fetch data from Supabase
  const loadDataFromSupabase = async () => {
    try {
      setErrorMsg("");
      const prods = await fetchProducts();
      const logs = await fetchStockIn();
      const dbOrders = await fetchOrders();
      setRawProducts(prods);
      setStockInLogs(logs);
      setSupabaseOrders(dbOrders);
    } catch (err) {
      console.error("Failed to load data from Supabase:", err);
      setErrorMsg("Gagal memuat data dari database Supabase. Periksa koneksi internet Anda.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Clear old localStorage mock data once to ensure a clean slate
    const hasCleared = localStorage.getItem("unigo_mock_cleared");
    if (!hasCleared) {
      localStorage.removeItem("unigo_orders");
      localStorage.removeItem("unigo_products");
      localStorage.removeItem("unigo_inventory_logs");
      localStorage.setItem("unigo_mock_cleared", "true");
      setOrders([]);
    }
    loadDataFromSupabase();
  }, []);

  // Persist orders in localStorage
  useEffect(() => {
    localStorage.setItem("unigo_orders", JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem("unigo_last_synced", lastSynced);
  }, [lastSynced]);

  // 3. Derived Inventory State
  // Merge simulated orders and imported orders from Supabase
  const allOrders = React.useMemo(() => {
    const mappedSupabase = supabaseOrders.map((dbOrder) => {
      let channel = "Offline";
      const plat = (dbOrder.platform || "").toLowerCase();
      if (plat === "tiktok" || plat === "tokopedia") {
        channel = "TikTok/Tokopedia";
      } else if (plat === "shopee") {
        channel = "Shopee";
      }

      let uiStatus = "pengiriman sukses";
      const dbStatusLower = (dbOrder.status || "").toLowerCase();
      if (dbStatusLower.includes("batal") || dbStatusLower.includes("cancel")) {
        uiStatus = "pembatalan";
      } else if (dbStatusLower.includes("retur") || dbStatusLower.includes("refund") || dbStatusLower.includes("kembalian")) {
        uiStatus = "pengembalian retur";
      } else if (dbStatusLower.includes("gagal") || dbStatusLower.includes("fail")) {
        uiStatus = "pengiriman gagal";
      } else if (dbStatusLower.includes("perlu") || dbStatusLower.includes("menunggu") || dbStatusLower.includes("proses") || dbStatusLower.includes("rts") || dbStatusLower.includes("shipped")) {
        uiStatus = "perlu dikirim";
      } else if (dbStatusLower.includes("sukses") || dbStatusLower.includes("selesai") || dbStatusLower.includes("delivered")) {
        uiStatus = "pengiriman sukses";
      }

      return {
        id: dbOrder.order_id,
        customer: dbOrder.recipient_name || dbOrder.buyer_username || "Pembeli",
        date: dbOrder.created_time || dbOrder.created_at,
        channel: channel,
        status: uiStatus,
        items: [
          {
            productId: null,
            name: `${dbOrder.product_name}${dbOrder.variation ? ` (${dbOrder.variation})` : ""}`,
            qty: dbOrder.quantity || 1,
            price: Number(dbOrder.price) || 0,
            product_name: dbOrder.product_name,
            variation: dbOrder.variation
          }
        ],
        total: Number(dbOrder.order_amount) || 0,
        shippingFee: Number(dbOrder.shipping_fee) || 0,
        isImported: true,
        buyerUsername: dbOrder.buyer_username,
        paymentMethod: dbOrder.payment_method,
        city: dbOrder.city,
        province: dbOrder.province
      };
    });

    return [...mappedSupabase, ...orders];
  }, [supabaseOrders, orders]);

  // Flat mapped inventory items representing individual variants
  const products = mapInventoryItems(rawProducts, stockInLogs, allOrders);

  // Combined logs for incoming (Supabase stock_in) and outgoing (mock sales orders)
  const combinedLogs = React.useMemo(() => {
    const incoming = stockInLogs.map((log) => {
      const prodName = log.product_variants?.products?.name || "Produk";
      const sizeLabel = log.product_variants?.product_sizes?.size_label || "";
      const varLabel = log.product_variants?.variant_label || "";
      const label = sizeLabel && varLabel 
        ? `Ukuran ${sizeLabel} - ${varLabel}` 
        : (sizeLabel ? `Ukuran ${sizeLabel}` : varLabel);
      const variantDisplay = label ? ` (${label})` : "";

      return {
        id: log.id,
        date: log.date || log.created_at,
        type: "masuk",
        productId: log.variant_id,
        productName: `${prodName}${variantDisplay}`,
        qty: log.quantity || 0,
        notes: log.note || "Restock manual",
      };
    });

    const outgoing = allOrders
      .filter((o) => o.status === "pengiriman sukses")
      .flatMap((o) =>
        (o.items || []).map((item, idx) => ({
          id: `${o.id}-${idx}`,
          date: o.date,
          type: "keluar",
          productId: item.productId || findVariantIdByName(item.product_name, item.variation, products),
          productName: item.name,
          qty: item.qty || 0,
          notes: `Pesanan marketplace ${o.id} (${o.channel})`,
        }))
      );

    return [...incoming, ...outgoing].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [stockInLogs, allOrders, products]);

  // 4. Callback handlers
  // Syncing simulation from TikTok Shop & Shopee APIs
  const handleSyncMarketplaces = () => {
    if (products.length === 0) return;
    setIsSyncing(true);

    // Simulate network delay
    setTimeout(() => {
      const mockCustomers = [
        "Andi Pratama",
        "Siti Aminah",
        "Rina Amelia",
        "Doni Setiawan",
        "Gita Safitri",
        "Hendri Wijaya"
      ];
      
      const channels = ["Shopee", "TikTok Shop"];
      const statuses = ["pengiriman sukses", "pembatalan", "pengembalian retur", "pengiriman gagal"];
      
      // Randomly pick an inventory variant that has stock
      const stockItems = products.filter(p => p.stock > 0);
      const randomProduct = stockItems.length > 0 
        ? stockItems[Math.floor(Math.random() * stockItems.length)]
        : products[Math.floor(Math.random() * products.length)];
      
      if (!randomProduct) {
        setIsSyncing(false);
        return;
      }

      const randomQty = Math.floor(Math.random() * 2) + 1; // 1 or 2 pcs
      const randomChannel = channels[Math.floor(Math.random() * channels.length)];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      const randomCustomer = mockCustomers[Math.floor(Math.random() * mockCustomers.length)];
      const randomId = `ORD-${randomChannel === "Shopee" ? "SP" : "TT"}-${Math.floor(Math.random() * 9000) + 1000}`;
      
      const totalAmount = randomProduct.price * randomQty;
      
      const newOrder = {
        id: randomId,
        customer: randomCustomer,
        date: new Date().toISOString(),
        channel: randomChannel,
        status: randomStatus,
        items: [{ productId: randomProduct.id, name: randomProduct.name, qty: randomQty, price: randomProduct.price }],
        total: totalAmount,
      };

      // Update orders (this automatically recalculates variant stock)
      setOrders((prevOrders) => [newOrder, ...prevOrders]);
      setLastSynced(new Date().toISOString());
      setIsSyncing(false);
    }, 1500);
  };

  // Determine active tab title for the header
  const getTabTitle = () => {
    switch (activeTab) {
      case "overview":
        return "Ringkasan Toko";
      case "inventory":
        return "Manajemen Barang Masuk & Keluar";
      case "orders":
        return "Daftar Pesanan Marketplace & Offline";
      case "settings":
        return "Pengaturan Integrasi Toko";
      default:
        return "Dashboard";
    }
  };

  return (
    <div className="flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 min-h-screen transition-colors duration-200">
      {/* Sidebar navigation panel */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />

      {/* Backdrop overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-45 lg:hidden transition-opacity duration-300"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Main content right panel */}
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Header navbar */}
        <Header
          title={getTabTitle()}
          onSync={handleSyncMarketplaces}
          isSyncing={isSyncing}
          lastSynced={lastSynced}
          theme={theme}
          toggleTheme={toggleTheme}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
        />

        {/* Inner dashboard content page container */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto relative">
          {isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/80 dark:bg-slate-950/80 z-50">
              <Loader2 className="w-12 h-12 text-violet-500 animate-spin" />
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-4">Memuat Data dari Supabase...</p>
            </div>
          ) : errorMsg ? (
            <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400 text-center max-w-md mx-auto mt-20">
              <p className="font-semibold">{errorMsg}</p>
              <button 
                onClick={loadDataFromSupabase}
                className="mt-4 px-4 py-2 bg-rose-500 text-white rounded-lg text-xs font-bold hover:bg-rose-600 transition-colors"
              >
                Coba Lagi
              </button>
            </div>
          ) : (
            <>
              {activeTab === "overview" && (
                <DashboardOverview
                  orders={allOrders}
                  inventoryLogs={combinedLogs}
                  products={products}
                />
              )}

              {activeTab === "inventory" && (
                <InventoryPage
                  products={products}
                  rawProducts={rawProducts}
                  inventoryLogs={combinedLogs}
                  onRefreshData={loadDataFromSupabase}
                />
              )}

              {activeTab === "orders" && (
                <OrdersPage orders={allOrders} onRefreshData={loadDataFromSupabase} />
              )}

              {activeTab === "settings" && (
                <SettingsPage />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
