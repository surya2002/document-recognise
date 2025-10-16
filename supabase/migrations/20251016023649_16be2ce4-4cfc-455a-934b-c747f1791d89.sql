-- Update documents table to optimize for single classification result
-- Add comment to clarify chunks column usage
COMMENT ON COLUMN documents.chunks IS 'Classification result stored as JSON (legacy array format for backward compatibility)';

-- Optionally add individual columns for better querying (future enhancement)
-- These can be populated from the chunks JSON for easier filtering
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS ocr_text TEXT,
  ADD COLUMN IF NOT EXISTS keywords_detected JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS reasoning TEXT,
  ADD COLUMN IF NOT EXISTS secondary_type TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT,
  ADD COLUMN IF NOT EXISTS text_quality TEXT;