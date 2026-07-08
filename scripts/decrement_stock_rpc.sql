-- ================================================================
-- JMPOTTERS – Atomic stock decrement RPCs
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard)
-- These functions run with SECURITY DEFINER = bypasses RLS,
-- so anon/authenticated users can decrement stock safely.
-- ================================================================

-- 1. Decrement product_sizes.stock_quantity (footwear variants)
CREATE OR REPLACE FUNCTION decrement_product_size_stock(
    p_size_id  INT,
    p_color_id INT,
    p_qty      INT,
    OUT new_stock INT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE product_sizes
     SET stock_quantity = stock_quantity - p_qty,
         updated_at     = now()
   WHERE id = p_size_id
     AND color_id = p_color_id
     AND stock_quantity >= p_qty
  RETURNING stock_quantity INTO new_stock;
$$;

GRANT EXECUTE ON FUNCTION decrement_product_size_stock(INT, INT, INT) TO anon, authenticated;

-- 2. Decrement products.stock (parent mirror, also SECURITY DEFINER for safety)
CREATE OR REPLACE FUNCTION decrement_product_stock(
    p_product_id INT,
    p_qty        INT,
    OUT new_stock INT
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE products
     SET stock       = stock - p_qty,
         updated_at  = now()
   WHERE id = p_product_id
     AND stock >= p_qty
  RETURNING stock INTO new_stock;
$$;

GRANT EXECUTE ON FUNCTION decrement_product_stock(INT, INT) TO anon, authenticated;
