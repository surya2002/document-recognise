-- Create table to store keyword matrix configuration
CREATE TABLE public.keyword_matrix (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  doc_type text NOT NULL,
  strong_keywords text[] NOT NULL DEFAULT '{}',
  moderate_keywords text[] NOT NULL DEFAULT '{}',
  weak_keywords text[] NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, doc_type)
);

-- Enable RLS
ALTER TABLE public.keyword_matrix ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own keyword matrix"
ON public.keyword_matrix
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own keyword matrix"
ON public.keyword_matrix
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own keyword matrix"
ON public.keyword_matrix
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own keyword matrix"
ON public.keyword_matrix
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_keyword_matrix_updated_at
BEFORE UPDATE ON public.keyword_matrix
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();