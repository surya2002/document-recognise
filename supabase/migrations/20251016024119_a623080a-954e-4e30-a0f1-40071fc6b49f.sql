-- Add position multiplier columns to keyword_matrix table
ALTER TABLE keyword_matrix 
  ADD COLUMN IF NOT EXISTS header_multiplier NUMERIC DEFAULT 1.2,
  ADD COLUMN IF NOT EXISTS body_multiplier NUMERIC DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS footer_multiplier NUMERIC DEFAULT 0.8;

-- Add comments to explain the columns
COMMENT ON COLUMN keyword_matrix.header_multiplier IS 'Multiplier for keywords found in the first 500 characters of the document';
COMMENT ON COLUMN keyword_matrix.body_multiplier IS 'Multiplier for keywords found in the middle section of the document';
COMMENT ON COLUMN keyword_matrix.footer_multiplier IS 'Multiplier for keywords found in the last 300 characters of the document';