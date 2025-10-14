import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileUploader } from "@/components/FileUploader";
import { DocumentResults } from "@/components/DocumentResults";
import { KeywordMatrix } from "@/components/KeywordMatrix";
import { ProcessedDocument, DocumentChunk } from "@/types/document";
import { calculateChunks, aggregateChunkResults } from "@/utils/pdfChunker";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, LogOut, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Session, User } from "@supabase/supabase-js";

const Index = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<ProcessedDocument[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(104857600); // 100MB default
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session) {
          setTimeout(() => {
            navigate("/auth");
          }, 0);
        } else {
          setTimeout(() => {
            loadUserData(session.user.id);
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Clear stale auth data and redirect to login
        supabase.auth.signOut({ scope: 'local' });
        setSession(null);
        setUser(null);
        navigate("/auth");
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        navigate("/auth");
      } else {
        loadUserData(session.user.id);
      }
      setLoading(false);
    }).catch(() => {
      // Handle any unexpected errors by clearing auth state
      supabase.auth.signOut({ scope: 'local' });
      setSession(null);
      setUser(null);
      navigate("/auth");
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadUserData = async (userId: string) => {
    await Promise.all([
      loadDocuments(),
      loadStorageInfo(userId)
    ]);
  };

  const loadStorageInfo = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('storage_used_bytes, storage_limit_bytes')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error loading storage info:', error);
      return;
    }

    if (data) {
      setStorageUsed(Number(data.storage_used_bytes));
      setStorageLimit(Number(data.storage_limit_bytes));
    }
  };

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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore 403 errors from already-invalidated sessions
      console.log('Sign out completed');
    }
    // Let onAuthStateChange handle the navigation
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

      // Refresh storage info
      if (user) {
        await loadStorageInfo(user.id);
      }
    }

    setDocuments(prev => prev.filter((_, i) => i !== index));
    
    toast({
      title: "Document removed",
      description: `${doc.fileName} has been removed`,
    });
  };

  const processFile = async (file: File) => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to upload documents",
        variant: "destructive"
      });
      return;
    }

    // Check storage limit
    if (storageUsed + file.size > storageLimit) {
      toast({
        title: "Storage limit exceeded",
        description: `You have ${((storageLimit - storageUsed) / 1024 / 1024).toFixed(2)}MB remaining. This file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`,
        variant: "destructive"
      });
      return;
    }

    const docIndex = documents.length;
    
    const newDoc: ProcessedDocument = {
      fileName: file.name,
      chunks: [],
      finalType: "Unknown",
      finalConfidence: 0,
      status: "uploading"
    };
    
    setDocuments(prev => [...prev, newDoc]);

    try {
      // Insert into database with user_id
      const { data: dbDoc, error: insertError } = await supabase
        .from('documents')
        .insert({
          file_name: file.name,
          file_size: file.size,
          final_type: 'Unknown',
          final_confidence: 0,
          status: 'uploading',
          chunks: [],
          user_id: user.id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? { ...doc, id: dbDoc.id } : doc
      ));

      const isPDF = file.type === 'application/pdf';
      const estimatedPages = isPDF ? 5 : 1;
      
      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? { ...doc, status: "ocr" as const } : doc
      ));

      await supabase
        .from('documents')
        .update({ status: 'ocr' })
        .eq('id', dbDoc.id);

      const formData = new FormData();
      formData.append('file', file);

      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-extract', {
        body: formData
      });

      if (ocrError || !ocrData?.success) {
        const errorMsg = ocrData?.error || ocrError?.message || 'OCR extraction failed';
        
        // Update database with error state
        await supabase
          .from('documents')
          .update({
            status: 'error',
            error: errorMsg
          })
          .eq('id', dbDoc.id);
        
        throw new Error(errorMsg);
      }

      const ocrText = ocrData.text;

      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? { ...doc, status: "classifying" as const } : doc
      ));

      await supabase
        .from('documents')
        .update({ status: 'classifying' })
        .eq('id', dbDoc.id);

      const { data: classifyData, error: classifyError } = await supabase.functions.invoke('classify-document', {
        body: { ocrText }
      });

      if (classifyError) {
        throw new Error('Classification failed');
      }

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

      await supabase
        .from('documents')
        .update({
          final_type: finalResult.finalType,
          final_confidence: finalResult.finalConfidence,
          chunks: [chunkResult] as any,
          status: 'finished'
        })
        .eq('id', dbDoc.id);

      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? {
          ...doc,
          chunks: [chunkResult],
          finalType: finalResult.finalType as ProcessedDocument['finalType'],
          finalConfidence: finalResult.finalConfidence,
          status: "finished" as const
        } : doc
      ));

      // Refresh storage info
      await loadStorageInfo(user.id);

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

    for (const file of files) {
      await processFile(file);
    }

    setIsProcessing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session || !user) {
    return null;
  }

  const storagePercentage = (storageUsed / storageLimit) * 100;
  const storageMB = (storageUsed / 1024 / 1024).toFixed(2);
  const limitMB = (storageLimit / 1024 / 1024).toFixed(0);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary p-2">
                <FileText className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold">AI Document Classifier</h1>
                <p className="text-sm text-muted-foreground">
                  {user.email}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Storage Usage */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Storage Usage</span>
              <span className="text-sm text-muted-foreground">
                {storageMB}MB / {limitMB}MB
              </span>
            </div>
            <Progress value={storagePercentage} className="h-2" />
          </div>

          <p className="text-muted-foreground mt-4">
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
