-- Add new columns to keyword_matrix table for advanced classification
ALTER TABLE keyword_matrix 
ADD COLUMN IF NOT EXISTS exclusion_keywords text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS exclusion_penalty_percentage integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS mandatory_fields jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS regional_keywords jsonb DEFAULT '{}';