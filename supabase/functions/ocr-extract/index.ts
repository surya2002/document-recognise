import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OCR_API_KEY = Deno.env.get('OCR_SPACE_API_KEY');
    if (!OCR_API_KEY) {
      throw new Error('OCR_SPACE_API_KEY not configured');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);

    // Convert file to base64 (chunk-based to avoid stack overflow on large files)
    const bytes = await file.arrayBuffer();
    const uint8Array = new Uint8Array(bytes);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    const base64 = btoa(binary);
    
    // Call OCR.Space API
    const ocrFormData = new FormData();
    ocrFormData.append('base64Image', `data:${file.type};base64,${base64}`);
    ocrFormData.append('apikey', OCR_API_KEY);
    ocrFormData.append('language', 'eng');
    ocrFormData.append('isOverlayRequired', 'false');
    ocrFormData.append('detectOrientation', 'true');
    ocrFormData.append('scale', 'true');
    ocrFormData.append('OCREngine', '2');

    console.log('Calling OCR.Space API...');
    
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: ocrFormData,
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('OCR API error:', ocrResponse.status, errorText);
      throw new Error(`OCR API error: ${ocrResponse.status}`);
    }

    const ocrResult = await ocrResponse.json();
    console.log('OCR result:', JSON.stringify(ocrResult).substring(0, 200));

    const extractedText = ocrResult.ParsedResults?.[0]?.ParsedText || '';
    
    // Handle page limit warnings (OCR.Space has 3-page limit for PDFs)
    if (ocrResult.IsErroredOnProcessing) {
      const errorMsg = ocrResult.ErrorMessage?.[0] || '';
      
      // If we got text despite the error (e.g., page limit reached), use it
      if (extractedText.trim()) {
        console.warn(`OCR warning (continuing with partial text): ${errorMsg}`);
      } else {
        // Only throw if no text was extracted at all
        throw new Error(errorMsg || 'OCR processing failed');
      }
    }
    
    if (!extractedText.trim()) {
      console.warn('No text extracted from document');
    }

    return new Response(
      JSON.stringify({ 
        text: extractedText,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in ocr-extract:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
