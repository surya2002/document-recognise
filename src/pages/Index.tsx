import { useState } from "react";
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
      // Determine number of pages (simplified - for real PDFs would need PDF.js)
      const isPDF = file.type === 'application/pdf';
      const estimatedPages = isPDF ? 5 : 1; // Simplified estimation
      
      const chunks = calculateChunks(estimatedPages);
      
      // Update status to OCR
      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? { ...doc, status: "ocr" as const } : doc
      ));

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

          <DocumentResults documents={documents} />
        </div>
      </div>
    </div>
  );
};

export default Index;
