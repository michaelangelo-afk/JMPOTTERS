-- ================================================================
-- JMPOTTERS — Multi-media gallery migration
-- Run in Supabase SQL Editor AFTER scripts/decrement_stock_rpc.sql.
-- Idempotent: safe to re-run.
-- ================================================================

-- 1) product_media — per-product sub-images AND a single optional video
CREATE TABLE IF NOT EXISTS product_media (
    id                 BIGSERIAL PRIMARY KEY,
    product_id         INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url                TEXT NOT NULL,
    storage_path       TEXT NOT NULL,
    media_type         TEXT NOT NULL CHECK (media_type IN ('image','video')),
    sort_order         INT  NOT NULL DEFAULT 0,
    alt_text           TEXT NOT NULL DEFAULT '',
    caption            TEXT NOT NULL DEFAULT '',
    file_size_bytes    BIGINT,
    duration_seconds   INT,
    width              INT,
    height             INT,
    is_cover           BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Faster lookups by product + display order
CREATE INDEX IF NOT EXISTS idx_product_media_product_id
    ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_product_sort
    ON product_media(product_id, sort_order);

-- Ensure at most ONE row per product can be flagged as the cover image
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_media_one_cover_per_product
    ON product_media(product_id) WHERE is_cover = true;

-- updated_at trigger (re-uses same helper as decrement_stock_rpc.sql style)
CREATE OR REPLACE FUNCTION tg_set_updated_at() RETURNS TRIGGER
    LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_product_media_updated_at ON product_media;
CREATE TRIGGER tg_product_media_updated_at
    BEFORE UPDATE ON product_media
    FOR EACH ROW EXECUTE FUNCTION tg_set_updated_at();

-- ------------------------------------------------------------
-- RLS — match the existing project pattern (the JS admin gate is
-- the trusted boundary for writes; storefront reads are public).
-- Tighten later if/when Supabase Auth is wired into the admin.
-- ------------------------------------------------------------
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_media" ON product_media;
CREATE POLICY "Public read product_media"
    ON product_media FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Public write product_media" ON product_media;
CREATE POLICY "Public write product_media"
    ON product_media FOR ALL
    USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 2) Relax product-images bucket to accept video MIME types
--    and raise per-file size to 200MB so short product videos fit.
-- ------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/avif', 'image/svg+xml',
        'video/mp4',  'video/webm',  'video/quicktime', 'video/x-matroska'
     ],
    file_size_limit = 209715200  -- 200MB
WHERE id = 'product-images';
