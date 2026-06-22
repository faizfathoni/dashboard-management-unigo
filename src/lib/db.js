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
  const items = [];

  rawProducts.forEach(product => {
    const variants = product.product_variants || [];
    variants.forEach(variant => {
      // 1. Calculate incoming stock from stock_in table
      const variantStockLogs = stockInLogs.filter(log => log.variant_id === variant.id);
      const totalIncoming = variantStockLogs.reduce((sum, log) => sum + (log.quantity || 0), 0);

      // 2. Calculate outgoing stock from success orders in local state
      const successOrders = orders.filter(o => o.status === "pengiriman sukses");
      const totalOutgoing = successOrders.reduce((sum, order) => {
        const orderItem = (order.items || []).find(item => {
          if (item.productId === variant.id) return true;
          if (order.isImported) {
            const itemProdName = (product.name || "").toLowerCase();
            const itemVarLabel = (variant.variant_label || "").toLowerCase();
            const itemSizeLabel = (variant.product_sizes?.size_label || "").toLowerCase();

            const orderProdName = (item.product_name || "").toLowerCase();
            const orderVar = (item.variation || "").toLowerCase();

            // Match product name
            const prodNameMatch = orderProdName.includes(itemProdName) || itemProdName.includes(orderProdName);
            if (!prodNameMatch) return false;

            // Match size/variant labels
            if (itemSizeLabel && orderVar.includes(itemSizeLabel.toLowerCase())) {
              if (itemVarLabel && !orderVar.includes(itemVarLabel.toLowerCase())) {
                return false;
              }
              return true;
            }
            if (itemVarLabel && orderVar.includes(itemVarLabel.toLowerCase())) {
              return true;
            }
            if (!itemSizeLabel && !itemVarLabel && !orderVar) {
              return true;
            }
          }
          return false;
        });
        return sum + (orderItem ? orderItem.qty : 0);
      }, 0);

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
        id: variant.id, // matches the variant ID so orders link correctly
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
 * Helper to map a unified order row to orders_shopee columns.
 */
function mapShopeeRow(order, importId) {
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
 * Fetch all orders from public.orders_tiktok_tokopedia and public.orders_shopee,
 * mapping and returning them in a unified order format.
 */
export async function fetchOrders() {
  const { data: tiktokData, error: tiktokError } = await supabase
    .from('orders_tiktok_tokopedia')
    .select('*');

  if (tiktokError) {
    console.error('Error fetching TikTok/Tokopedia orders:', tiktokError);
    throw tiktokError;
  }

  const { data: shopeeData, error: shopeeError } = await supabase
    .from('orders_shopee')
    .select('*');

  if (shopeeError) {
    console.error('Error fetching Shopee orders:', shopeeError);
    throw shopeeError;
  }

  const mappedTiktok = (tiktokData || []).map(row => {
    let platform = "tiktok";
    const channelVal = getJsonVal(row.raw_data, "Purchase Channel") || getJsonVal(row.raw_data, "purchase_channel") || "";
    if (channelVal.toLowerCase().includes("tokopedia")) {
      platform = "tokopedia";
    }

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
      platform,
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
      raw_data: row.raw_data
    };
  });

  const mappedShopee = (shopeeData || []).map(row => {
    let status = row.order_status;
    if (row.cancelation_return_type && row.cancelation_return_type.trim().toLowerCase() === "return/refund") {
      status = "Return/Refund";
    }

    return {
      id: row.id,
      import_id: row.import_id,
      platform: "shopee",
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
      raw_data: row.raw_data
    };
  });

  const combined = [...mappedTiktok, ...mappedShopee].sort((a, b) => {
    const dateA = a.created_time ? new Date(a.created_time) : new Date(0);
    const dateB = b.created_time ? new Date(b.created_time) : new Date(0);
    return dateB - dateA;
  });

  return combined;
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
    dbRows = ordersArray.map(order => mapShopeeRow(order, importId));
    tableName = 'orders_shopee';
  } else {
    dbRows = ordersArray.map(order => ({
      import_id: importId,
      order_id: order.order_id,
      raw_data: {
        ...order.raw_data,
        "Order Status": order.status // keep overridden status
      }
    }));
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

