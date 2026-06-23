import { supabase } from './supabase'

/**
 * Fetch all products from Supabase, including their sizes and variants.
 */
export async function fetchProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      product_sizes (
        *
      ),
      product_variants (
        *,
        product_sizes (
          size_label
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error)
    throw error
  }
  return data || []
}

/**
 * Fetch all stock_in log entries joined with variant and product details.
 */
export async function fetchStockIn() {
  const { data, error } = await supabase
    .from('stock_in')
    .select(`
      *,
      product_variants (
        *,
        products (
          name,
          category,
          variant_type
        )
      )
    `)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching stock_in:', error)
    throw error
  }
  return data || []
}

/**
 * Add incoming stock entries.
 * entries should be an array of objects: { variant_id, quantity, price, date, note }
 */
export async function addStockIn(entries) {
  const { data, error } = await supabase
    .from('stock_in')
    .insert(entries)
    .select()

  if (error) {
    console.error('Error adding stock_in entries:', error)
    throw error
  }
  return data
}

/**
 * Update an existing stock_in entry.
 */
export async function updateStockIn(id, { quantity, date, note }) {
  const { data, error } = await supabase
    .from('stock_in')
    .update({ quantity, date, note })
    .eq('id', id)
    .select()

  if (error) {
    console.error('Error updating stock_in entry:', error)
    throw error
  }
  return data[0]
}

/**
 * Delete a stock_in entry.
 */
export async function deleteStockIn(id) {
  const { error } = await supabase
    .from('stock_in')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting stock_in entry:', error)
    throw error
  }
}

/**
 * Add a new product along with its optional sizes and variants.
 */
export async function addProduct({ name, category, variant_type, has_size, sizes = [], variants = [] }) {
  // 1. Insert product
  const { data: productData, error: productError } = await supabase
    .from('products')
    .insert([{ name, category, variant_type, has_size }])
    .select()

  if (productError) {
    console.error('Error creating product:', productError)
    throw productError
  }

  const newProduct = productData[0]
  const productId = newProduct.id

  // 2. If has_size is true and we have sizes to insert
  let sizeMap = {}
  if (has_size && sizes.length > 0) {
    const sizesToInsert = sizes.map((s, idx) => ({
      product_id: productId,
      size_label: s,
      sort_order: idx + 1
    }))

    const { data: insertedSizes, error: sizesError } = await supabase
      .from('product_sizes')
      .insert(sizesToInsert)
      .select()

    if (sizesError) {
      console.error('Error creating product sizes:', sizesError)
      // Attempt clean up of product
      await supabase.from('products').delete().eq('id', productId)
      throw sizesError
    }

    // Map size labels to their database IDs for variant linking
    insertedSizes.forEach(s => {
      sizeMap[s.size_label] = s.id
    })
  }

  // 3. Insert variants
  if (variants.length > 0) {
    const variantsToInsert = variants.map((v, idx) => {
      // If the product has size, tie the variant to the size UUID
      let sizeId = null
      if (has_size && v.size_label) {
        sizeId = sizeMap[v.size_label] || null
      }

      return {
        product_id: productId,
        size_id: sizeId,
        variant_label: v.variant_label,
        sort_order: idx + 1,
        is_active: true
      }
    })

    const { error: varError } = await supabase
      .from('product_variants')
      .insert(variantsToInsert)

    if (varError) {
      console.error('Error creating variants:', varError)
      // Clean up product and sizes
      await supabase.from('product_sizes').delete().eq('product_id', productId)
      await supabase.from('products').delete().eq('id', productId)
      throw varError
    }
  }

  return newProduct
}

/**
 * Update product info (name, category, variant_type).
 * Also supports updating variants active status or adding new variants.
 */
export async function updateProduct(productId, { name, category, variant_type, has_size, variants = [], deletedVariantIds = [] }) {
  // 1. Update basic product info
  const { error: productError } = await supabase
    .from('products')
    .update({ name, category, variant_type, has_size })
    .eq('id', productId)

  if (productError) {
    console.error('Error updating product details:', productError)
    throw productError
  }

  // 2. Handle variant deletions
  if (deletedVariantIds && deletedVariantIds.length > 0) {
    // Delete dependent stock_in entries
    const { error: stockErr } = await supabase
      .from('stock_in')
      .delete()
      .in('variant_id', deletedVariantIds)
    if (stockErr) console.error('Error deleting variant stock logs:', stockErr)

    // Delete variants
    const { error: varDelErr } = await supabase
      .from('product_variants')
      .delete()
      .in('id', deletedVariantIds)
    if (varDelErr) console.error('Error deleting variants:', varDelErr)
  }

  // 3. Handle variants updates & insertions
  if (variants && variants.length > 0) {
    for (const v of variants) {
      if (v.id) {
        // Update existing variant
        await supabase
          .from('product_variants')
          .update({ is_active: v.is_active, variant_label: v.variant_label })
          .eq('id', v.id)
      } else {
        // Insert new variant
        let sizeId = v.size_id || null

        // If product has size and we don't have a size_id yet
        if (has_size && !sizeId && v.variant_label) {
          // Check if size already exists in DB
          const { data: existingSizes } = await supabase
            .from('product_sizes')
            .select('id')
            .eq('product_id', productId)
            .eq('size_label', v.variant_label)

          if (existingSizes && existingSizes.length > 0) {
            sizeId = existingSizes[0].id
          } else {
            // Insert new size
            const { data: newSizeData, error: sizeErr } = await supabase
              .from('product_sizes')
              .insert([{ product_id: productId, size_label: v.variant_label, sort_order: 99 }])
              .select()

            if (sizeErr) {
              console.error('Error creating product size in update:', sizeErr)
            } else if (newSizeData && newSizeData.length > 0) {
              sizeId = newSizeData[0].id
            }
          }
        }

        await supabase
          .from('product_variants')
          .insert([{
            product_id: productId,
            size_id: sizeId,
            variant_label: v.variant_label,
            sort_order: 99,
            is_active: true
          }])
      }
    }
  }
}

/**
 * Safely delete a product along with all its child entities (cascade mock).
 */
export async function deleteProduct(productId) {
  // 1. Get all variant IDs for this product
  const { data: variants, error: varFetchErr } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId)

  if (varFetchErr) {
    console.error('Error fetching variants for deletion:', varFetchErr)
    throw varFetchErr
  }

  if (variants && variants.length > 0) {
    const variantIds = variants.map(v => v.id)

    // 2. Delete all stock_in entries for these variants
    const { error: stockDelErr } = await supabase
      .from('stock_in')
      .delete()
      .in('variant_id', variantIds)

    if (stockDelErr) {
      console.error('Error deleting related stock_in logs:', stockDelErr)
      throw stockDelErr
    }

    // 3. Delete variants
    const { error: varDelErr } = await supabase
      .from('product_variants')
      .delete()
      .in('id', variantIds)

    if (varDelErr) {
      console.error('Error deleting variants:', varDelErr)
      throw varDelErr
    }
  }

  // 4. Delete sizes
  const { error: sizeDelErr } = await supabase
    .from('product_sizes')
    .delete()
    .eq('product_id', productId)

  if (sizeDelErr) {
    console.error('Error deleting sizes:', sizeDelErr)
    throw sizeDelErr
  }

  // 5. Delete product
  const { error: prodDelErr } = await supabase
    .from('products')
    .delete()
    .eq('id', productId)

  if (prodDelErr) {
    console.error('Error deleting product:', prodDelErr)
    throw prodDelErr
  }
}

/**
 * Map raw products and stock_in entries from Supabase + mock orders to a flat list of stock items (variants)
 */
export function mapInventoryItems(rawProducts, stockInLogs, orders = []) {
  // Pre-calculate success orders to avoid filtering 7,000 orders for every variant
  const successOrders = orders.filter(o => o.status === "pengiriman sukses");

  // Pre-index incoming stock using a fast lookup map
  const incomingStockMap = {};
  stockInLogs.forEach(log => {
    if (log.variant_id) {
      incomingStockMap[log.variant_id] = (incomingStockMap[log.variant_id] || 0) + (log.quantity || 0);
    }
  });

  // Pre-index success orders for direct variant ID lookups
  const directOrderItems = {};
  const importedSuccessOrders = [];

  successOrders.forEach(order => {
    if (order.isImported) {
      importedSuccessOrders.push(order);
    } else {
      (order.items || []).forEach(item => {
        if (item.productId) {
          directOrderItems[item.productId] = (directOrderItems[item.productId] || 0) + (item.qty || 0);
        }
      });
    }
  });

  const items = [];

  rawProducts.forEach(product => {
    const variants = product.product_variants || [];
    variants.forEach(variant => {
      // 1. Calculate incoming stock from map
      const totalIncoming = incomingStockMap[variant.id] || 0;

      // 2. Calculate outgoing stock (start with direct matches)
      let totalOutgoing = directOrderItems[variant.id] || 0;

      // 3. For imported success orders, do optimized fuzzy matching
      const itemProdName = (product.name || "").toLowerCase();
      const itemVarLabel = (variant.variant_label || "").toLowerCase();
      const itemSizeLabel = (variant.product_sizes?.size_label || "").toLowerCase();

      importedSuccessOrders.forEach(order => {
        (order.items || []).forEach(item => {
          if (item.productId === variant.id) {
            totalOutgoing += item.qty || 0;
            return;
          }

          const orderProdName = (item.product_name || "").toLowerCase();
          const orderVar = (item.variation || "").toLowerCase();

          // Match product name
          const prodNameMatch = orderProdName.includes(itemProdName) || itemProdName.includes(orderProdName);
          if (!prodNameMatch) return;

          // Match size/variant labels
          let matched = false;
          if (itemSizeLabel && orderVar.includes(itemSizeLabel)) {
            if (itemVarLabel && !orderVar.includes(itemVarLabel)) {
              // No match
            } else {
              matched = true;
            }
          } else if (itemVarLabel && orderVar.includes(itemVarLabel)) {
            matched = true;
          } else if (!itemSizeLabel && !itemVarLabel && !orderVar) {
            matched = true;
          }

          if (matched) {
            totalOutgoing += item.qty || 0;
          }
        });
      });

      const stock = Math.max(0, totalIncoming - totalOutgoing);

      // 4. Generate SKU
      const initials = product.name.split(' ').map(w => w[0]).join('').toUpperCase();
      const sizeLabel = variant.product_sizes?.size_label || '';
      const varLabel = variant.variant_label || '';
      const label = sizeLabel || varLabel;
      const variantCode = label.substring(0, 3).toUpperCase();
      const sku = `${initials}-${variantCode}`;

      // 5. Variant label display
      const variantLabelDisplay = sizeLabel && varLabel 
        ? `Ukuran ${sizeLabel} - ${varLabel}` 
        : (sizeLabel ? `Ukuran ${sizeLabel}` : varLabel);

      items.push({
        id: variant.id,
        productId: product.id,
        name: `${product.name} (${variantLabelDisplay})`,
        productName: product.name,
        variantLabel: variantLabelDisplay,
        sku,
        category: product.category || 'Lainnya',
        stock,
        rawProduct: product,
        rawVariant: variant
      });
    });
  });

  return items;
}

/**
 * Helper to parse dates from CSV strings.
 */
function parseCSVDate(dateStr) {
  if (!dateStr) return null;
  const cleaned = String(dateStr).trim();
  if (!cleaned) return null;
  const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
  const match = cleaned.match(dmyRegex);
  if (match) {
    const [_, day, month, year, hour, minute, second] = match;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second)).toISOString();
  }
  const parsed = new Date(cleaned);
  return !isNaN(parsed.getTime()) ? parsed.toISOString() : null;
}

/**
 * Helper to safely extract keys from jsonb objects case-insensitively.
 */
function getJsonVal(rawData, keyName) {
  if (!rawData) return null;
  const actualKey = Object.keys(rawData).find(k => k.toLowerCase() === keyName.toLowerCase());
  const val = actualKey ? rawData[actualKey] : null;
  return val !== undefined && val !== null ? String(val).trim() : null;
}

/**
 * Helper to map a unified order row to orders_tiktok_tokopedia columns.
 */
function mapTiktokTokopediaRow(order, importId) {
  const getVal = (key) => {
    if (!order.raw_data) return null;
    const actualKey = Object.keys(order.raw_data).find(k => k.toLowerCase() === key.toLowerCase());
    return actualKey !== undefined ? order.raw_data[actualKey] : null;
  };

  const getFloat = (key) => {
    const val = getVal(key);
    if (val === null || val === undefined) return null;
    const parsed = parseFloat(String(val).replace(/[^0-9\.\-]/g, ''));
    return isNaN(parsed) ? null : parsed;
  };

  const getInt = (key) => {
    const val = getVal(key);
    if (val === null || val === undefined) return null;
    const parsed = parseInt(String(val).replace(/[^0-9\-]/g, ''), 10);
    return isNaN(parsed) ? null : parsed;
  };

  return {
    import_id: importId,
    order_id: order.order_id,
    order_status: order.status,
    order_substatus: getVal("Order Substatus") || getVal("order_substatus"),
    cancelation_return_type: getVal("Cancelation/Return Type") || getVal("cancelation_return_type"),
    normal_or_pre_order: getVal("Normal or Pre-order") || getVal("normal_or_pre_order"),
    sku_id: getVal("SKU ID") || getVal("sku_id"),
    seller_sku: getVal("Seller SKU") || getVal("seller_sku"),
    product_name: order.product_name,
    variation: order.variation,
    quantity: order.quantity,
    sku_quantity_of_return: getInt("Sku Quantity of return") || getInt("sku_quantity_of_return"),
    sku_unit_original_price: getFloat("SKU Unit Original Price") || getFloat("sku_unit_original_price"),
    sku_subtotal_before_discount: getFloat("SKU Subtotal Before Discount") || getFloat("sku_subtotal_before_discount"),
    sku_platform_discount: getFloat("SKU Platform Discount") || getFloat("sku_platform_discount"),
    sku_seller_discount: getFloat("SKU Seller Discount") || getFloat("sku_seller_discount"),
    sku_subtotal_after_discount: order.price,
    shipping_fee_after_discount: order.shipping_fee,
    original_shipping_fee: getFloat("Original Shipping Fee") || getFloat("original_shipping_fee"),
    shipping_fee_seller_discount: getFloat("Shipping Fee Seller Discount") || getFloat("shipping_fee_seller_discount"),
    shipping_fee_platform_discount: getFloat("Shipping Fee Platform Discount") || getFloat("shipping_fee_platform_discount"),
    distance_shipping_fee: getFloat("Distance Shipping Fee") || getFloat("distance_shipping_fee"),
    distance_fee: getFloat("Distance Fee") || getFloat("distance_fee"),
    order_refund_amount: getFloat("Order Refund Amount") || getFloat("order_refund_amount"),
    payment_platform_discount: getFloat("Payment platform discount") || getFloat("payment_platform_discount"),
    buyer_service_fee: getFloat("Buyer Service Fee") || getFloat("buyer_service_fee"),
    handling_fee: getFloat("Handling Fee") || getFloat("handling_fee"),
    shipping_insurance: getFloat("Shipping Insurance") || getFloat("shipping_insurance"),
    item_insurance: getFloat("Item Insurance") || getFloat("item_insurance"),
    order_amount: order.order_amount,
    created_time: order.created_time,
    paid_time: parseCSVDate(getVal("Paid Time") || getVal("paid_time")),
    rts_time: parseCSVDate(getVal("RTS Time") || getVal("rts_time")),
    shipped_time: parseCSVDate(getVal("Shipped Time") || getVal("shipped_time")),
    delivered_time: parseCSVDate(getVal("Delivered Time") || getVal("delivered_time")),
    cancelled_time: parseCSVDate(getVal("Cancelled Time") || getVal("cancelled_time")),
    cancel_by: getVal("Cancel By") || getVal("cancel_by"),
    cancel_reason: getVal("Cancel Reason") || getVal("cancel_reason"),
    fulfillment_type: getVal("Fulfillment Type") || getVal("fulfillment_type"),
    warehouse_name: getVal("Warehouse Name") || getVal("warehouse_name"),
    tracking_id: getVal("Tracking ID") || getVal("tracking_id"),
    delivery_option: getVal("Delivery Option") || getVal("delivery_option"),
    shipping_provider_name: getVal("Shipping Provider Name") || getVal("shipping_provider_name"),
    buyer_message: getVal("Buyer Message") || getVal("buyer_message"),
    buyer_username: order.buyer_username,
    recipient: order.recipient_name,
    phone_number: getVal("Phone #") || getVal("phone_number") || getVal("Phone Number"),
    zipcode: getVal("Zipcode") || getVal("zipcode"),
    country: getVal("Country") || getVal("country"),
    province: order.province,
    regency_and_city: order.city,
    districts: getVal("Districts") || getVal("districts"),
    villages: getVal("Villages") || getVal("villages"),
    detail_address: getVal("Detail Address") || getVal("detail_address"),
    additional_address_information: getVal("Additional address information") || getVal("additional_address_information"),
    payment_method: order.payment_method,
    weight_kg: getFloat("Weight(kg)") || getFloat("weight_kg"),
    product_category: getVal("Product Category") || getVal("product_category"),
    package_id: getVal("Package ID") || getVal("package_id"),
    purchase_channel: getVal("Purchase Channel") || getVal("purchase_channel"),
    seller_note: getVal("Seller Note") || getVal("seller_note"),
    checked_status: getVal("Checked Status") || getVal("checked_status"),
    checked_marked_by: getVal("Checked Marked by") || getVal("checked_marked_by"),
    tokopedia_invoice_number: getVal("Tokopedia Invoice Number") || getVal("tokopedia_invoice_number"),
    raw_data: order.raw_data
  };
}

/**
 * Helper to fetch all rows from a table in batches of 1000.
 */
async function fetchAllFromTable(tableName, selectColumns = '*') {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let keepFetching = true;

  while (keepFetching) {
    const fromRange = page * pageSize;
    const toRange = fromRange + pageSize - 1;

    const { data, error } = await supabase
      .from(tableName)
      .select(selectColumns)
      .order('id', { ascending: true })
      .range(fromRange, toRange);

    if (error) {
      console.error(`Error fetching page ${page} from table ${tableName}:`, error);
      throw error;
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      if (data.length < pageSize) {
        keepFetching = false;
      } else {
        page++;
      }
    } else {
      keepFetching = false;
    }
  }

  return allData;
}

// Columns we need from orders_tiktok_tokopedia for mapping and stats calculations (excluding raw_data)
const TIKTOK_STATS_COLUMNS = 'id, import_id, order_id, order_status, cancelation_return_type, product_name, variation, quantity, sku_subtotal_after_discount, shipping_fee_after_discount, order_amount, buyer_username, recipient, province, regency_and_city, payment_method, created_time, purchase_channel, retur_check, retur_checked_at';

/**
 * Fetch all orders from public.orders_tiktok_tokopedia and public.orders_shopee,
 * mapping and returning them in a unified order format.
 * Optimized to exclude heavy raw_data for TikTok/Tokopedia.
 */
export async function fetchOrders() {
  const tiktokData = await fetchAllFromTable('orders_tiktok_tokopedia', TIKTOK_STATS_COLUMNS);
  const shopeeData = await fetchAllFromTable('orders_shopee');

  const mappedTiktok = (tiktokData || []).map(row => {
    let platform = "tiktok";
    if (row.purchase_channel && row.purchase_channel.toLowerCase().includes("tokopedia")) {
      platform = "tokopedia";
    }

    let status = row.order_status;
    if (row.cancelation_return_type && row.cancelation_return_type.trim().toLowerCase() === "return/refund") {
      status = "Return/Refund";
    }

    return {
      id: row.id,
      import_id: row.import_id,
      platform,
      order_id: row.order_id,
      status,
      product_name: row.product_name || "",
      variation: row.variation || "",
      quantity: row.quantity || 1,
      price: Number(row.sku_subtotal_after_discount) || 0,
      shipping_fee: Number(row.shipping_fee_after_discount) || 0,
      order_amount: Number(row.order_amount) || 0,
      buyer_username: row.buyer_username,
      recipient_name: row.recipient,
      province: row.province,
      city: row.regency_and_city,
      payment_method: row.payment_method,
      created_time: row.created_time,
      raw_data: null, // Excluded for TikTok
      retur_check: row.retur_check,
      retur_checked_at: row.retur_checked_at
    };
  });

  const mappedShopee = (shopeeData || []).map(row => {
    let status = getJsonVal(row.raw_data, "Order Status") || getJsonVal(row.raw_data, "status");
    const cancelReturnType = getJsonVal(row.raw_data, "Cancelation/Return Type") || getJsonVal(row.raw_data, "cancelation_return_type");
    if (cancelReturnType && cancelReturnType.trim().toLowerCase() === "return/refund") {
      status = "Return/Refund";
    }

    const priceStr = getJsonVal(row.raw_data, "SKU Subtotal After Discount") || getJsonVal(row.raw_data, "price") || getJsonVal(row.raw_data, "SKU Unit Original Price") || "0";
    const price = parseFloat(priceStr.replace(/[^0-9\.\-]/g, '')) || 0;

    const shipFeeStr = getJsonVal(row.raw_data, "Shipping Fee After Discount") || getJsonVal(row.raw_data, "shipping_fee") || "0";
    const shippingFee = parseFloat(shipFeeStr.replace(/[^0-9\.\-]/g, '')) || 0;

    const amountStr = getJsonVal(row.raw_data, "Order Amount") || getJsonVal(row.raw_data, "total") || "0";
    const orderAmount = parseFloat(amountStr.replace(/[^0-9\.\-]/g, '')) || price + shippingFee;

    const createdTimeStr = getJsonVal(row.raw_data, "Created Time") || getJsonVal(row.raw_data, "created_time") || getJsonVal(row.raw_data, "date");
    const createdTime = parseCSVDate(createdTimeStr) || row.created_at;

    return {
      id: row.id,
      import_id: row.import_id,
      platform: "shopee",
      order_id: row.order_id,
      status,
      product_name: getJsonVal(row.raw_data, "Product Name") || getJsonVal(row.raw_data, "product_name") || "",
      variation: getJsonVal(row.raw_data, "Variation") || getJsonVal(row.raw_data, "varian") || "",
      quantity: parseInt(getJsonVal(row.raw_data, "Quantity") || getJsonVal(row.raw_data, "qty") || "1", 10),
      price,
      shipping_fee: shippingFee,
      order_amount: orderAmount,
      buyer_username: getJsonVal(row.raw_data, "Buyer Username") || getJsonVal(row.raw_data, "buyer_username"),
      recipient_name: getJsonVal(row.raw_data, "Recipient") || getJsonVal(row.raw_data, "customer") || getJsonVal(row.raw_data, "recipient_name"),
      province: getJsonVal(row.raw_data, "Province") || getJsonVal(row.raw_data, "provinsi"),
      city: getJsonVal(row.raw_data, "Regency and City") || getJsonVal(row.raw_data, "city") || getJsonVal(row.raw_data, "kota"),
      payment_method: getJsonVal(row.raw_data, "Payment Method") || getJsonVal(row.raw_data, "payment_method"),
      created_time: createdTime,
      raw_data: row.raw_data,
      retur_check: row.retur_check,
      retur_checked_at: row.retur_checked_at
    };
  });

  const combined = [...mappedTiktok, ...mappedShopee].sort((a, b) => {
    const dateA = a.created_time ? new Date(a.created_time) : new Date(0);
    const dateB = b.created_time ? new Date(b.created_time) : new Date(0);
    return dateB - dateA;
  });

  return combined;
}

function formatSQLDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function getDateRangeRange(timeRange, customStartDate, customEndDate) {
  if (timeRange === "all") return null;
  const now = new Date();
  let start = null;
  let end = new Date();

  if (timeRange === "today") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (timeRange === "yesterday") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, -1);
  } else if (timeRange === "7days") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  } else if (timeRange === "30days") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
  } else if (timeRange === "custom") {
    if (customStartDate) {
      start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
    }
    if (customEndDate) {
      end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
    }
  }
  return { start, end };
}

/**
 * Fetch paginated orders directly from Supabase, applying database-side filtering & search.
 */
export async function fetchPaginatedOrders({
  page = 1,
  pageSize = 25,
  searchQuery = "",
  channel = "All",
  status = "All",
  timeRange = "all",
  customStartDate = "",
  customEndDate = ""
}) {
  const offset = (page - 1) * pageSize;
  const dateRange = getDateRangeRange(timeRange, customStartDate, customEndDate);

  const applyFilters = (query, isShopee = false) => {
    // Search Query
    if (searchQuery) {
      const qClean = searchQuery.trim();
      if (isShopee) {
        query = query.or(`order_id.ilike.%${qClean}%,raw_data->>Recipient.ilike.%${qClean}%,raw_data->>Buyer Username.ilike.%${qClean}%,raw_data->>buyer_username.ilike.%${qClean}%,raw_data->>customer.ilike.%${qClean}%,raw_data->>recipient_name.ilike.%${qClean}%`);
      } else {
        query = query.or(`order_id.ilike.%${qClean}%,recipient.ilike.%${qClean}%,buyer_username.ilike.%${qClean}%`);
      }
    }

    // Status Filter
    if (status !== "All") {
      if (isShopee) {
        if (status === "pembatalan") {
          query = query.or(`raw_data->>Order Status.ilike.%cancel%,raw_data->>Order Status.ilike.%batal%,raw_data->>status.ilike.%cancel%,raw_data->>status.ilike.%batal%`);
        } else if (status === "pengembalian retur") {
          query = query.or(`raw_data->>Order Status.ilike.%retur%,raw_data->>Order Status.ilike.%refund%,raw_data->>status.ilike.%retur%,raw_data->>status.ilike.%refund%,retur_check.eq.true`);
        } else if (status === "pengiriman gagal") {
          query = query.or(`raw_data->>Order Status.ilike.%gagal%,raw_data->>Order Status.ilike.%fail%,raw_data->>status.ilike.%gagal%,raw_data->>status.ilike.%fail%`);
        } else if (status === "perlu dikirim") {
          query = query.or(`raw_data->>Order Status.ilike.%perlu%,raw_data->>Order Status.ilike.%menunggu%,raw_data->>Order Status.ilike.%proses%,raw_data->>Order Status.ilike.%rts%,raw_data->>Order Status.ilike.%shipped%,raw_data->>status.ilike.%perlu%,raw_data->>status.ilike.%menunggu%,raw_data->>status.ilike.%proses%,raw_data->>status.ilike.%rts%,raw_data->>status.ilike.%shipped%`);
        } else if (status === "pengiriman sukses") {
          query = query.or(`raw_data->>Order Status.ilike.%sukses%,raw_data->>Order Status.ilike.%selesai%,raw_data->>Order Status.ilike.%delivered%,raw_data->>status.ilike.%sukses%,raw_data->>status.ilike.%selesai%,raw_data->>status.ilike.%delivered%`);
        }
      } else {
        if (status === "pembatalan") {
          query = query.or(`order_status.ilike.%cancel%,order_status.ilike.%batal%`);
        } else if (status === "pengembalian retur") {
          query = query.or(`order_status.ilike.%retur%,order_status.ilike.%refund%,order_status.ilike.%kembalian%,retur_check.eq.true`);
        } else if (status === "pengiriman gagal") {
          query = query.or(`order_status.ilike.%gagal%,order_status.ilike.%fail%`);
        } else if (status === "perlu dikirim") {
          query = query.or(`order_status.ilike.%perlu%,order_status.ilike.%menunggu%,order_status.ilike.%proses%,order_status.ilike.%rts%,order_status.ilike.%shipped%`);
        } else if (status === "pengiriman sukses") {
          query = query.or(`order_status.ilike.%sukses%,order_status.ilike.%selesai%,order_status.ilike.%delivered%`);
        }
      }
    }

    // Time Range Filter
    if (dateRange) {
      const { start, end } = dateRange;
      if (isShopee) {
        if (start) query = query.gte('created_at', start.toISOString());
        if (end) query = query.lte('created_at', end.toISOString());
      } else {
        if (start) query = query.gte('created_time', formatSQLDate(start));
        if (end) query = query.lte('created_time', formatSQLDate(end));
      }
    }

    return query;
  };

  let totalTiktok = 0;
  let totalShopee = 0;

  // 1. Fetch counts first (in parallel)
  const countPromises = [];

  if (channel === "All" || channel === "TikTok/Tokopedia") {
    let q = supabase
      .from('orders_tiktok_tokopedia')
      .select('id', { count: 'exact', head: true });
    q = applyFilters(q, false);
    countPromises.push(
      q.then(({ count, error }) => {
        if (error) throw error;
        totalTiktok = count || 0;
      })
    );
  }

  if (channel === "All" || channel === "Shopee") {
    let q = supabase
      .from('orders_shopee')
      .select('id', { count: 'exact', head: true });
    q = applyFilters(q, true);
    countPromises.push(
      q.then(({ count, error }) => {
        if (error) throw error;
        totalShopee = count || 0;
      })
    );
  }

  await Promise.all(countPromises);

  // 2. Conditionally fetch data ranges in parallel
  let tiktokOrders = [];
  let shopeeOrders = [];
  const dataPromises = [];

  if ((channel === "All" || channel === "TikTok/Tokopedia") && offset < totalTiktok) {
    let q = supabase
      .from('orders_tiktok_tokopedia')
      .select(TIKTOK_STATS_COLUMNS);
    q = applyFilters(q, false);
    q = q.order('created_time', { ascending: false }).range(offset, offset + pageSize - 1);
    dataPromises.push(
      q.then(({ data, error }) => {
        if (error) throw error;
        tiktokOrders = data || [];
      })
    );
  }

  if ((channel === "All" || channel === "Shopee") && offset < totalShopee) {
    let q = supabase
      .from('orders_shopee')
      .select('*');
    q = applyFilters(q, true);
    q = q.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1);
    dataPromises.push(
      q.then(({ data, error }) => {
        if (error) throw error;
        shopeeOrders = data || [];
      })
    );
  }

  await Promise.all(dataPromises);

  // Map database structures to unified format
  const mappedTiktok = tiktokOrders.map(row => {
    let platform = "tiktok";
    if (row.purchase_channel && row.purchase_channel.toLowerCase().includes("tokopedia")) {
      platform = "tokopedia";
    }
    let status = row.order_status;
    if (row.cancelation_return_type && row.cancelation_return_type.trim().toLowerCase() === "return/refund") {
      status = "Return/Refund";
    }
    
    // UI channel mapping
    let channel = "Offline";
    if (platform === "tiktok" || platform === "tokopedia") {
      channel = "TikTok/Tokopedia";
    } else if (platform === "shopee") {
      channel = "Shopee";
    }

    // UI Status mapping
    let uiStatus = "pengiriman sukses";
    const dbStatusLower = (status || "").toLowerCase();
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

    const price = Number(row.sku_subtotal_after_discount) || 0;
    const quantity = row.quantity || 1;

    return {
      id: row.order_id,
      db_id: row.id,
      customer: row.recipient || row.buyer_username || "Pembeli",
      date: row.created_time,
      channel: channel,
      status: uiStatus,
      items: [
        {
          productId: null,
          name: `${row.product_name || ""}${row.variation ? ` (${row.variation})` : ""}`,
          qty: quantity,
          price: price,
          product_name: row.product_name || "",
          variation: row.variation || ""
        }
      ],
      total: Number(row.order_amount) || 0,
      shippingFee: Number(row.shipping_fee_after_discount) || 0,
      isImported: true,
      buyerUsername: row.buyer_username,
      paymentMethod: row.payment_method,
      city: row.regency_and_city,
      province: row.province,
      retur_check: row.retur_check,
      retur_checked_at: row.retur_checked_at
    };
  });

  const mappedShopee = shopeeOrders.map(row => {
    let status = getJsonVal(row.raw_data, "Order Status") || getJsonVal(row.raw_data, "status");
    const cancelReturnType = getJsonVal(row.raw_data, "Cancelation/Return Type") || getJsonVal(row.raw_data, "cancelation_return_type");
    if (cancelReturnType && cancelReturnType.trim().toLowerCase() === "return/refund") {
      status = "Return/Refund";
    }

    const priceStr = getJsonVal(row.raw_data, "SKU Subtotal After Discount") || getJsonVal(row.raw_data, "price") || getJsonVal(row.raw_data, "SKU Unit Original Price") || "0";
    const price = parseFloat(priceStr.replace(/[^0-9\.\-]/g, '')) || 0;

    const shipFeeStr = getJsonVal(row.raw_data, "Shipping Fee After Discount") || getJsonVal(row.raw_data, "shipping_fee") || "0";
    const shippingFee = parseFloat(shipFeeStr.replace(/[^0-9\.\-]/g, '')) || 0;

    const amountStr = getJsonVal(row.raw_data, "Order Amount") || getJsonVal(row.raw_data, "total") || "0";
    const orderAmount = parseFloat(amountStr.replace(/[^0-9\.\-]/g, '')) || price + shippingFee;

    const createdTimeStr = getJsonVal(row.raw_data, "Created Time") || getJsonVal(row.raw_data, "created_time") || getJsonVal(row.raw_data, "date");
    const createdTime = parseCSVDate(createdTimeStr) || row.created_at;

    // UI channel mapping
    const channel = "Shopee";

    // UI Status mapping
    let uiStatus = "pengiriman sukses";
    const dbStatusLower = (status || "").toLowerCase();
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

    const prodName = getJsonVal(row.raw_data, "Product Name") || getJsonVal(row.raw_data, "product_name") || "";
    const variation = getJsonVal(row.raw_data, "Variation") || getJsonVal(row.raw_data, "varian") || "";
    const quantity = parseInt(getJsonVal(row.raw_data, "Quantity") || getJsonVal(row.raw_data, "qty") || "1", 10);
    const buyerUsername = getJsonVal(row.raw_data, "Buyer Username") || getJsonVal(row.raw_data, "buyer_username");
    const recipientName = getJsonVal(row.raw_data, "Recipient") || getJsonVal(row.raw_data, "customer") || getJsonVal(row.raw_data, "recipient_name");

    return {
      id: row.order_id,
      db_id: row.id,
      customer: recipientName || buyerUsername || "Pembeli",
      date: createdTime,
      channel: channel,
      status: uiStatus,
      items: [
        {
          productId: null,
          name: `${prodName}${variation ? ` (${variation})` : ""}`,
          qty: quantity,
          price: price,
          product_name: prodName,
          variation: variation
        }
      ],
      total: orderAmount,
      shippingFee: shippingFee,
      isImported: true,
      buyerUsername: buyerUsername,
      paymentMethod: getJsonVal(row.raw_data, "Payment Method") || getJsonVal(row.raw_data, "payment_method"),
      city: getJsonVal(row.raw_data, "Regency and City") || getJsonVal(row.raw_data, "city") || getJsonVal(row.raw_data, "kota"),
      province: getJsonVal(row.raw_data, "Province") || getJsonVal(row.raw_data, "provinsi"),
      retur_check: row.retur_check,
      retur_checked_at: row.retur_checked_at
    };
  });

  const combined = [...mappedTiktok, ...mappedShopee].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });

  // Slice to max pageSize just in case both tables fetched items
  const sliced = combined.slice(0, pageSize);
  const totalCount = totalTiktok + totalShopee;

  return {
    orders: sliced,
    totalCount
  };
}

/**
 * Import multiple orders and log the import in order_imports first,
 * then upserting into the correct table.
 */
export async function importOrders(platform, filename, ordersArray, onProgress) {
  if (ordersArray.length === 0) return { orders: [], importLog: null }

  // 1. Insert import metadata first to get the import_id
  const { data: importData, error: importError } = await supabase
    .from('order_imports')
    .insert({
      platform,
      filename,
      total_rows: ordersArray.length
    })
    .select();

  if (importError) {
    console.error('Error logging order import:', importError);
    throw importError;
  }

  const importLog = importData?.[0] || null;
  const importId = importLog ? importLog.id : null;

  // 2. Prepare database rows depending on the platform
  let dbRows = [];
  let tableName = '';

  const platLower = (platform || '').toLowerCase();
  if (platLower === 'shopee') {
    dbRows = ordersArray.map(order => ({
      import_id: importId,
      order_id: order.order_id,
      raw_data: {
        ...order.raw_data,
        "Order Status": order.status // keep overridden status
      }
    }));
    tableName = 'orders_shopee';
  } else {
    dbRows = ordersArray.map(order => mapTiktokTokopediaRow(order, importId));
    tableName = 'orders_tiktok_tokopedia';
  }

  // 3. Upsert in chunks to avoid database statement timeouts
  const CHUNK_SIZE = 200;
  const allResults = [];

  for (let i = 0; i < dbRows.length; i += CHUNK_SIZE) {
    const chunk = dbRows.slice(i, i + CHUNK_SIZE);
    const { data: orderData, error: orderError } = await supabase
      .from(tableName)
      .upsert(chunk, { onConflict: 'order_id' })
      .select();

    if (orderError) {
      console.error(`Error upserting orders chunk into ${tableName} starting at index ${i}:`, orderError);
      throw orderError;
    }
    if (orderData) {
      allResults.push(...orderData);
    }
    if (onProgress) {
      const progress = Math.min(100, Math.round(((i + chunk.length) / dbRows.length) * 100));
      onProgress(progress);
    }
  }

  return { orders: allResults, importLog };
}

/**
 * Find an order by tracking ID, update retur_check = true and retur_checked_at = now,
 * and return the matched and updated order.
 */
export async function verifyReturnOrder(trackingId) {
  if (!trackingId || !trackingId.trim()) {
    throw new Error("Tracking ID tidak boleh kosong");
  }
  const cleanTrackingId = trackingId.trim();

  // 1. Search in orders_tiktok_tokopedia
  const { data: tiktokData, error: tiktokError } = await supabase
    .from('orders_tiktok_tokopedia')
    .select('*')
    .eq('tracking_id', cleanTrackingId)
    .limit(1);

  if (tiktokError) {
    console.error("Error searching TikTok/Tokopedia order:", tiktokError);
  }

  if (tiktokData && tiktokData.length > 0) {
    const matchedOrder = tiktokData[0];
    const { data: updatedData, error: updateError } = await supabase
      .from('orders_tiktok_tokopedia')
      .update({
        retur_check: true,
        retur_checked_at: new Date().toISOString()
      })
      .eq('id', matchedOrder.id)
      .select();

    if (updateError) {
      console.error("Error updating TikTok/Tokopedia return status:", updateError);
      throw updateError;
    }
    
    return {
      order: updatedData[0],
      platform: matchedOrder.purchase_channel && matchedOrder.purchase_channel.toLowerCase().includes("tokopedia") ? "tokopedia" : "tiktok"
    };
  }

  // 2. Search in orders_shopee using JSONB query
  const { data: shopeeData, error: shopeeError } = await supabase
    .from('orders_shopee')
    .select('*')
    .or(`raw_data->>No. Resi.eq.${cleanTrackingId},raw_data->>tracking_id.eq.${cleanTrackingId},raw_data->>Tracking ID.eq.${cleanTrackingId},order_id.eq.${cleanTrackingId}`)
    .limit(1);

  if (shopeeError) {
    console.error("Error searching Shopee order:", shopeeError);
  }

  if (shopeeData && shopeeData.length > 0) {
    const matchedOrder = shopeeData[0];
    const { data: updatedData, error: updateError } = await supabase
      .from('orders_shopee')
      .update({
        retur_check: true,
        retur_checked_at: new Date().toISOString()
      })
      .eq('id', matchedOrder.id)
      .select();

    if (updateError) {
      console.error("Error updating Shopee return status:", updateError);
      throw updateError;
    }
    
    return {
      order: updatedData[0],
      platform: "shopee"
    };
  }

  // Fallback to check if scanned trackingId matches order_id
  const { data: tiktokDataById } = await supabase
    .from('orders_tiktok_tokopedia')
    .select('*')
    .eq('order_id', cleanTrackingId)
    .limit(1);

  if (tiktokDataById && tiktokDataById.length > 0) {
    const matchedOrder = tiktokDataById[0];
    const { data: updatedData, error: updateError } = await supabase
      .from('orders_tiktok_tokopedia')
      .update({
        retur_check: true,
        retur_checked_at: new Date().toISOString()
      })
      .eq('id', matchedOrder.id)
      .select();

    if (updateError) throw updateError;
    return {
      order: updatedData[0],
      platform: matchedOrder.purchase_channel && matchedOrder.purchase_channel.toLowerCase().includes("tokopedia") ? "tokopedia" : "tiktok"
    };
  }

  const { data: shopeeDataById } = await supabase
    .from('orders_shopee')
    .select('*')
    .eq('order_id', cleanTrackingId)
    .limit(1);

  if (shopeeDataById && shopeeDataById.length > 0) {
    const matchedOrder = shopeeDataById[0];
    const { data: updatedData, error: updateError } = await supabase
      .from('orders_shopee')
      .update({
        retur_check: true,
        retur_checked_at: new Date().toISOString()
      })
      .eq('id', matchedOrder.id)
      .select();

    if (updateError) throw updateError;
    return {
      order: updatedData[0],
      platform: "shopee"
    };
  }

  return null;
}


