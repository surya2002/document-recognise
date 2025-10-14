import { useState, useEffect } from "react";
import { FileUploader } from "@/components/FileUploader";
import { DocumentResults } from "@/components/DocumentResults";
import { KeywordMatrix } from "@/components/KeywordMatrix";
import { ProcessedDocument, DocumentChunk } from "@/types/document";
import { calculateChunks, aggregateChunkResults } from "@/utils/pdfChunker";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText } from "lucide-react";

const Index = () => {
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Load existing documents from database
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading documents:', error);
      return;
    }

    if (data) {
      const loadedDocs: ProcessedDocument[] = data.map(doc => ({
        fileName: doc.file_name,
        chunks: Array.isArray(doc.chunks) ? doc.chunks as any as DocumentChunk[] : [],
        finalType: doc.final_type as ProcessedDocument['finalType'],
        finalConfidence: Number(doc.final_confidence),
        status: doc.status as ProcessedDocument['status'],
        error: doc.error || undefined,
        id: doc.id
      }));
      setDocuments(loadedDocs);
    }
  };

  const handleDelete = async (index: number) => {
    const doc = documents[index];
    
    if (doc.id) {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) {
        console.error('Error deleting document:', error);
        toast({
          title: "Delete failed",
          description: "Failed to delete document from database",
          variant: "destructive"
        });
        return;
      }
    }

    setDocuments(prev => prev.filter((_, i) => i !== index));
    
    toast({
      title: "Document removed",
      description: `${doc.fileName} has been removed`,
    });
  };

  const processFile = async (file: File) => {
    const docIndex = documents.length;
    
    // Add document to state with uploading status
    const newDoc: ProcessedDocument = {
      fileName: file.name,
      chunks: [],
      finalType: "Unknown",
      finalConfidence: 0,
      status: "uploading"
    };
    
    setDocuments(prev => [...prev, newDoc]);

    try {
      // Insert into database
      const { data: dbDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_size: file.size,
          final_type: 'Unknown',
          final_confidence: 0,
          status: 'uploading',
          chunks: []
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update local state with database ID
      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? { ...doc, id: dbDoc.id } : doc
      ));

      // Determine number of pages (simplified - for real PDFs would need PDF.js)
      const isPDF = file.type === 'application/pdf';
      const estimatedPages = isPDF ? 5 : 1; // Simplified estimation
      
      const chunks = calculateChunks(estimatedPages);
      
      // Update status to OCR
      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? { ...doc, status: "ocr" as const } : doc
      ));

      await supabase
        .from('documents')
        .update({ status: 'ocr' })
        .eq('id', dbDoc.id);

      // Process OCR (for simplicity, processing whole file)
      const formData = new FormData();
      formData.append('file', file);

      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-extract', {
        body: formData
      });

      if (ocrError || !ocrData?.success) {
        throw new Error(ocrData?.error || 'OCR extraction failed');
      }

      const ocrText = ocrData.text;

      // Update status to classifying
      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? { ...doc, status: "classifying" as const } : doc
      ));

      await supabase
        .from('documents')
        .update({ status: 'classifying' })
        .eq('id', dbDoc.id);

      // Classify document
      const { data: classifyData, error: classifyError } = await supabase.functions.invoke('classify-document', {
        body: { ocrText }
      });

      if (classifyError) {
        throw new Error('Classification failed');
      }

      // Create chunk result
      const chunkResult: DocumentChunk = {
        chunkIndex: 1,
        pageCount: estimatedPages,
        ocrText: ocrText.substring(0, 500),
        probableType: classifyData.probable_type,
        confidencePercentage: classifyData.confidence_percentage,
        keywordsDetected: classifyData.keywords_detected || [],
        reasoning: classifyData.reasoning
      };

      const finalResult = aggregateChunkResults([
        {
          chunkIndex: 1,
          pageCount: estimatedPages,
          probableType: chunkResult.probableType,
          confidencePercentage: chunkResult.confidencePercentage
        }
      ]);

      // Update database
      await supabase
        .from('documents')
        .update({
          final_type: finalResult.finalType,
          final_confidence: finalResult.finalConfidence,
          chunks: [chunkResult] as any,
          status: 'finished'
        })
        .eq('id', dbDoc.id);

      // Update with final results
      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? {
          ...doc,
          chunks: [chunkResult],
          finalType: finalResult.finalType as ProcessedDocument['finalType'],
          finalConfidence: finalResult.finalConfidence,
          status: "finished" as const
        } : doc
      ));

      toast({
        title: "Document processed",
        description: `${file.name} classified as ${finalResult.finalType}`,
      });

    } catch (error) {
      console.error('Error processing file:', error);
      
      const doc = documents[docIndex];
      if (doc.id) {
        await supabase
          .from('documents')
          .update({
            status: 'error',
            error: error instanceof Error ? error.message : 'Processing failed'
          })
          .eq('id', doc.id);
      }

      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? {
          ...doc,
          status: "error" as const,
          error: error instanceof Error ? error.message : 'Processing failed'
        } : doc
      ));

      toast({
        title: "Processing failed",
        description: `Failed to process ${file.name}`,
        variant: "destructive"
      });
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    setIsProcessing(true);

    // Process files sequentially to avoid overwhelming the APIs
    for (const file of files) {
      await processFile(file);
    }

    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-primary p-2">
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">AI Document Classifier</h1>
          </div>
          <p className="text-muted-foreground">
            Powered by OCR.Space and Gemini AI with weighted keyword classification
          </p>
        </header>

        <div className="space-y-8">
          <FileUploader 
            onFilesSelected={handleFilesSelected}
            isProcessing={isProcessing}
          />

          <KeywordMatrix />

          <DocumentResults documents={documents} onDelete={handleDelete} />
        </div>
      </div>
    </div>
  );
};

export default Index;
