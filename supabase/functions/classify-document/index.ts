import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildClassificationPrompt(keywordMatrix: any): string {
  let prompt = `You are a document type classifier.
Analyze this OCR text and output normalized confidence scores for the following types using this weighted keyword matrix:\n\n`;

  // Build keyword matrix section dynamically
  for (const [docType, keywords] of Object.entries(keywordMatrix)) {
    const kw = keywords as any;
    prompt += `${docType}:\n`;
    
    if (kw.strong && kw.strong.length > 0) {
      prompt += `- Strong (+3): ${kw.strong.join(', ')}\n`;
    }
    if (kw.moderate && kw.moderate.length > 0) {
      prompt += `- Moderate (+2): ${kw.moderate.join(', ')}\n`;
    }
    if (kw.weak && kw.weak.length > 0) {
      prompt += `- Weak (+1): ${kw.weak.join(', ')}\n`;
    }
    prompt += '\n';
  }

  prompt += `Assign +3 for strong, +2 for moderate, +1 for weak indicators. Ignore generic words like Name, Date, Address. Return results as normalized confidence scores (summing to 100%). If all document types <40% confidence, classify as Unknown.

Return ONLY valid JSON in this exact format:
{
  "probable_type": "Invoice",
  "confidence_percentage": 92.4,
  "keywords_detected": [
    {"keyword": "INVOICE", "weight": 3, "type": "strong"},
    {"keyword": "GSTIN", "weight": 3, "type": "strong"}
  ],
  "reasoning": "High presence of tax and vendor identifiers."
}`;

  return prompt;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const { ocrText, userId } = await req.json();

    // Fetch user's custom keyword matrix from database
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: matrixData, error: matrixError } = await supabase
      .from('keyword_matrix')
      .select('*')
      .eq('user_id', userId);

    let keywordMatrix: any = {
      "Resume": {
        "strong": ["Resume Objective", "Work Experience", "Education", "Skills and Certifications"],
        "moderate": ["LinkedIn", "Email:", "Phone:"],
        "weak": ["Hobbies and Interests", "Projects"]
      },
      "ITR": {
        "strong": ["INDIAN INCOME TAX RETURN", "ITR-1 SAHAJ", "PART A GENERAL INFORMATION"],
        "moderate": ["Assessment Year", "PAN", "Verification"],
        "weak": ["Deductions", "Income from Salaries"]
      },
      "Bank Statement": {
        "strong": ["STATEMENT OF ACCOUNT", "Account Number", "Statement Period"],
        "moderate": ["Deposit", "Withdrawal", "Balance"],
        "weak": ["Transaction Date", "Customer Name"]
      },
      "Invoice": {
        "strong": ["INVOICE", "Tax Invoice", "GSTIN", "Invoice No."],
        "moderate": ["Buyer", "Vendor", "Total Amount", "Terms and Conditions"],
        "weak": ["Quantity", "Rate", "Amount"]
      },
      "Marksheet": {
        "strong": ["STATEMENT OF MARKS", "BOARD OF SECONDARY EDUCATION", "Division"],
        "moderate": ["Subject", "Marks Obtained", "Roll No."],
        "weak": ["Total Marks", "Percentage", "Result"]
      }
    };

    // Use custom matrix if available
    if (matrixData && matrixData.length > 0) {
      keywordMatrix = {};
      matrixData.forEach((row: any) => {
        keywordMatrix[row.doc_type] = {
          strong: row.strong_keywords || [],
          moderate: row.moderate_keywords || [],
          weak: row.weak_keywords || []
        };
      });
      console.log('Using custom keyword matrix for user:', userId);
    } else {
      console.log('Using default keyword matrix');
    }

    const CLASSIFICATION_PROMPT = buildClassificationPrompt(keywordMatrix);
    
    if (!ocrText || !ocrText.trim()) {
      return new Response(
        JSON.stringify({
          probable_type: "Unknown",
          confidence_percentage: 0,
          keywords_detected: [],
          reasoning: "No text content found in document"
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Classifying document with text length: ${ocrText.length}`);

    // Call Google Gemini API directly
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${CLASSIFICATION_PROMPT}\n\nInput: ${ocrText.substring(0, 10000)}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', geminiResponse.status, errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status}`);
    }

    const geminiResult = await geminiResponse.json();
    const content = geminiResult.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content in Gemini response');
    }

    console.log('Gemini response:', content.substring(0, 200));

    // Parse JSON from the response, handling markdown code blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/```json\n/, '').replace(/\n```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/```\n/, '').replace(/\n```$/, '');
    }

    const classificationResult = JSON.parse(jsonContent);

    return new Response(
      JSON.stringify(classificationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in classify-document:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        probable_type: "Unknown",
        confidence_percentage: 0,
        keywords_detected: [],
        reasoning: "Classification failed due to error"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
