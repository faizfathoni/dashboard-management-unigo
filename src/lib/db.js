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
export async function updateStockIn(id, { quantity, price, date, note }) {
  const { data, error } = await supabase
    .from('stock_in')
    .update({ quantity, price, date, note })
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
        const orderItem = (order.items || []).find(item => item.productId === variant.id);
        return sum + (orderItem ? orderItem.qty : 0);
      }, 0);

      const stock = Math.max(0, totalIncoming - totalOutgoing);

      // 3. Determine price
      // Fetch latest price from stock_in logs, or use fallback
      const latestLogWithPrice = variantStockLogs.find(log => log.price > 0);
      let price = latestLogWithPrice ? parseFloat(latestLogWithPrice.price) : null;
      if (!price) {
        if (product.name.toLowerCase().includes('bola')) {
          price = 25000;
        } else if (product.name.toLowerCase().includes('aero')) {
          price = 35000;
        } else {
          price = 50000;
        }
      }

      // 4. Generate SKU
      const initials = product.name.split(' ').map(w => w[0]).join('').toUpperCase();
      const sizeLabel = variant.product_sizes?.size_label || '';
      const varLabel = variant.variant_label || '';
      const label = sizeLabel || varLabel;
      const variantCode = label.substring(0, 3).toUpperCase();
      const sku = `${initials}-${variantCode}`;

      // 5. Variant label display
      const variantLabelDisplay = sizeLabel ? `Ukuran ${sizeLabel}` : varLabel;

      items.push({
        id: variant.id, // matches the variant ID so orders link correctly
        productId: product.id,
        name: `${product.name} (${variantLabelDisplay})`,
        productName: product.name,
        variantLabel: variantLabelDisplay,
        sku,
        category: product.category || 'Lainnya',
        price,
        stock,
        rawProduct: product,
        rawVariant: variant
      });
    });
  });

  return items;
}

