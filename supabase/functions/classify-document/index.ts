import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLASSIFICATION_PROMPT = `You are a document type classifier.
Analyze this OCR text and output normalized confidence scores for the following types using this weighted keyword matrix:

Resume:
- Strong (+3): Resume Objective, Work Experience, Education, Skills and Certifications
- Moderate (+2): LinkedIn, Email:, Phone:
- Weak (+1): Hobbies and Interests, Projects

ITR:
- Strong (+3): INDIAN INCOME TAX RETURN, ITR-1 SAHAJ, PART A GENERAL INFORMATION
- Moderate (+2): Assessment Year, PAN, Verification
- Weak (+1): Deductions, Income from Salaries

Bank Statement:
- Strong (+3): STATEMENT OF ACCOUNT, Account Number, Statement Period
- Moderate (+2): Deposit, Withdrawal, Balance
- Weak (+1): Transaction Date, Customer Name

Invoice:
- Strong (+3): INVOICE, Tax Invoice, GSTIN, Invoice No.
- Moderate (+2): Buyer, Vendor, Total Amount, Terms and Conditions
- Weak (+1): Quantity, Rate, Amount

Marksheet:
- Strong (+3): STATEMENT OF MARKS, BOARD OF SECONDARY EDUCATION, Division
- Moderate (+2): Subject, Marks Obtained, Roll No.
- Weak (+1): Total Marks, Percentage, Result

Assign +3 for strong, +2 for moderate, +1 for weak indicators. Ignore generic words like Name, Date, Address. Return results as normalized confidence scores (summing to 100%). If all document types <40% confidence, classify as Unknown.

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    const { ocrText } = await req.json();
    
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
