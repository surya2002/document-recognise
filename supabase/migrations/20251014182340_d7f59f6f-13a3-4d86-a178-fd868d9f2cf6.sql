-- Create documents table to store processed results
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  final_type TEXT NOT NULL,
  final_confidence DECIMAL(5,2) NOT NULL,
  chunks JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'uploading',
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read documents (public app)
CREATE POLICY "Documents are viewable by everyone"
ON public.documents
FOR SELECT
USING (true);

-- Create policy to allow anyone to insert documents
CREATE POLICY "Anyone can insert documents"
ON public.documents
FOR INSERT
WITH CHECK (true);

-- Create policy to allow anyone to update documents
CREATE POLICY "Anyone can update documents"
ON public.documents
FOR UPDATE
USING (true);

-- Create policy to allow anyone to delete documents
CREATE POLICY "Anyone can delete documents"
ON public.documents
FOR DELETE
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();