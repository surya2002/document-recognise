import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileUploader } from "@/components/FileUploader";
import { DocumentResults } from "@/components/DocumentResults";
import { KeywordMatrix } from "@/components/KeywordMatrix";
import { ProcessedDocument } from "@/types/document";
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
        // Clear ALL auth data from localStorage
        localStorage.removeItem('sb-cipvztetzfcyecvzqztn-auth-token');
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
      // Clear ALL auth data from localStorage on any error
      localStorage.removeItem('sb-cipvztetzfcyecvzqztn-auth-token');
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
      const loadedDocs: ProcessedDocument[] = data.map(doc => {
        // Type cast the JSON chunks data properly
        const chunksArray = doc.chunks as any[];
        const chunkData = Array.isArray(chunksArray) && chunksArray.length > 0 ? chunksArray[0] : {};
        
        return {
          fileName: doc.file_name,
          fileSize: doc.file_size || undefined,
          ocrText: chunkData.ocrText || undefined,
          probableType: chunkData.probableType || doc.final_type,
          confidencePercentage: chunkData.confidencePercentage || Number(doc.final_confidence),
          keywordsDetected: chunkData.keywordsDetected || [],
          reasoning: chunkData.reasoning || undefined,
          secondaryType: chunkData.secondaryType || undefined,
          secondaryConfidence: chunkData.secondaryConfidence || undefined,
          exclusionKeywordsFound: chunkData.exclusionKeywordsFound || undefined,
          uniqueKeywordsCount: chunkData.uniqueKeywordsCount || undefined,
          mandatoryFieldsStatus: chunkData.mandatoryFieldsStatus || undefined,
          validationStatus: chunkData.validationStatus || undefined,
          validationPenaltiesApplied: chunkData.validationPenaltiesApplied || undefined,
          ambiguityWarning: chunkData.ambiguityWarning || undefined,
          textQuality: chunkData.textQuality || undefined,
          textLength: chunkData.textLength || undefined,
          preValidationType: chunkData.preValidationType || undefined,
          preValidationConfidence: chunkData.preValidationConfidence || undefined,
          finalType: doc.final_type as ProcessedDocument['finalType'],
          finalConfidence: Number(doc.final_confidence),
          status: doc.status as ProcessedDocument['status'],
          error: doc.error || undefined,
          id: doc.id
        };
      });
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
      fileSize: file.size,
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

      // Convert file to base64 for Gemini Vision API
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data: ocrData, error: ocrError } = await supabase.functions.invoke('ocr-extract', {
        body: { 
          fileBase64,
          mimeType: file.type
        }
      });

      if (ocrError || !ocrData?.success) {
        const errorMsg = ocrData?.error || ocrError?.message || 'OCR extraction failed';
        
        // Provide more specific user guidance for different error types
        let userMessage = errorMsg;
        if (errorMsg.includes('No text content') || errorMsg.includes('insufficient text')) {
          userMessage = 'This document appears to be empty or contains no readable text. Please ensure your PDF has text content.';
        } else if (errorMsg.includes('password-protected') || errorMsg.includes('encrypted')) {
          userMessage = 'This document is password-protected. Please remove the password and try again.';
        }
        
        // Update database with error state
        await supabase
          .from('documents')
          .update({
            status: 'error',
            error: userMessage
          })
          .eq('id', dbDoc.id);
        
        throw new Error(userMessage);
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
        body: { 
          ocrText,
          userId: user.id
        }
      });

      if (classifyError) {
        throw new Error('Classification failed');
      }

      // Store classification results directly
      const classificationResult = {
        ocrText: ocrText.substring(0, 500),
        probableType: classifyData.probable_type,
        confidencePercentage: classifyData.confidence_percentage,
        keywordsDetected: classifyData.keywords_detected || [],
        reasoning: classifyData.reasoning,
        secondaryType: classifyData.secondary_type,
        secondaryConfidence: classifyData.secondary_confidence,
        exclusionKeywordsFound: classifyData.exclusion_keywords_found,
        uniqueKeywordsCount: classifyData.unique_keywords_count,
        mandatoryFieldsStatus: classifyData.mandatory_fields_status,
        validationStatus: classifyData.validation_status,
        validationPenaltiesApplied: classifyData.validation_penalties_applied,
        ambiguityWarning: classifyData.ambiguity_warning,
        textQuality: classifyData.text_quality,
        textLength: classifyData.text_length,
        preValidationType: classifyData.pre_validation_type,
        preValidationConfidence: classifyData.pre_validation_confidence
      };

      await supabase
        .from('documents')
        .update({
          final_type: classifyData.probable_type,
          final_confidence: classifyData.confidence_percentage,
          chunks: [classificationResult] as any, // Keep for backward compatibility
          status: 'finished'
        })
        .eq('id', dbDoc.id);

      setDocuments(prev => prev.map((doc, i) => 
        i === docIndex ? {
          ...doc,
          ...classificationResult,
          finalType: classifyData.probable_type as ProcessedDocument['finalType'],
          finalConfidence: classifyData.confidence_percentage,
          status: "finished" as const
        } : doc
      ));

      // Refresh storage info
      await loadStorageInfo(user.id);

      toast({
        title: "Document processed",
        description: `${file.name} classified as ${classifyData.probable_type}`,
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
            {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Your'}'s Space
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
