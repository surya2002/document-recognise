-- Convert keyword arrays to JSONB with position multipliers
-- This migration transforms simple text arrays into structured objects with multipliers

-- Step 1: Add temporary JSONB columns
ALTER TABLE public.keyword_matrix
ADD COLUMN strong_keywords_new JSONB DEFAULT '[]'::jsonb,
ADD COLUMN moderate_keywords_new JSONB DEFAULT '[]'::jsonb,
ADD COLUMN weak_keywords_new JSONB DEFAULT '[]'::jsonb;

-- Step 2: Migrate existing data, applying current document-level multipliers to each keyword
UPDATE public.keyword_matrix
SET 
  strong_keywords_new = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'keyword', elem,
        'headerMult', COALESCE(header_multiplier, 1.2),
        'bodyMult', COALESCE(body_multiplier, 1.0),
        'footerMult', COALESCE(footer_multiplier, 0.8)
      )
    )
    FROM unnest(strong_keywords) AS elem
  ),
  moderate_keywords_new = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'keyword', elem,
        'headerMult', COALESCE(header_multiplier, 1.2),
        'bodyMult', COALESCE(body_multiplier, 1.0),
        'footerMult', COALESCE(footer_multiplier, 0.8)
      )
    )
    FROM unnest(moderate_keywords) AS elem
  ),
  weak_keywords_new = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'keyword', elem,
        'headerMult', COALESCE(header_multiplier, 1.2),
        'bodyMult', COALESCE(body_multiplier, 1.0),
        'footerMult', COALESCE(footer_multiplier, 0.8)
      )
    )
    FROM unnest(weak_keywords) AS elem
  );

-- Step 3: Handle cases where arrays might be empty or null
UPDATE public.keyword_matrix
SET 
  strong_keywords_new = COALESCE(strong_keywords_new, '[]'::jsonb),
  moderate_keywords_new = COALESCE(moderate_keywords_new, '[]'::jsonb),
  weak_keywords_new = COALESCE(weak_keywords_new, '[]'::jsonb);

-- Step 4: Drop old array columns
ALTER TABLE public.keyword_matrix
DROP COLUMN strong_keywords,
DROP COLUMN moderate_keywords,
DROP COLUMN weak_keywords;

-- Step 5: Rename new columns to original names
ALTER TABLE public.keyword_matrix
RENAME COLUMN strong_keywords_new TO strong_keywords;

ALTER TABLE public.keyword_matrix
RENAME COLUMN moderate_keywords_new TO moderate_keywords;

ALTER TABLE public.keyword_matrix
RENAME COLUMN weak_keywords_new TO weak_keywords;

-- Step 6: Drop document-level multiplier columns (no longer needed)
ALTER TABLE public.keyword_matrix
DROP COLUMN header_multiplier,
DROP COLUMN body_multiplier,
DROP COLUMN footer_multiplier;