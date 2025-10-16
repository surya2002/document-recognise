import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function buildAdvancedClassificationPrompt(matrixData: any[]): string {
  let prompt = `# Indian Document Type Classifier - Complete System Prompt

You are an advanced Indian document type classifier. Your task is to analyze OCR-extracted text and classify it into one of five document types: **Resume, ITR (Income Tax Return), Bank Statement, Invoice, or Marksheet**.

## Core Classification Principles

1. **Case-insensitive matching**: All keyword matching is case-insensitive
2. **Partial matching**: "INVOICE" matches "TAX INVOICE", "INVOICE NO", "INVOICE NUMBER", etc.
3. **Position-aware scoring**: Each keyword has its own position multipliers for header, body, and footer regions
4. **Frequency capping**: Same keyword repeated multiple times is capped at 3× weight to prevent gaming
5. **Validation-first approach**: Even high confidence scores can be overridden if mandatory fields are missing

---

## Document Region Definitions

Divide the OCR text into three regions:

- **Header Region**: First 500 characters
- **Body Region**: Characters 501 to (length - 300)
- **Footer Region**: Last 300 characters

Each keyword has custom multipliers for these regions.

---

## Weighted Keyword Matrix

`;

  matrixData.forEach((row: any) => {
    prompt += `### ${row.doc_type}\n\n`;
    
    // Strong keywords with individual multipliers
    if (row.strong_keywords && row.strong_keywords.length > 0) {
      prompt += `**Strong Indicators (+3 points)**:\n`;
      row.strong_keywords.forEach((kw: any) => {
        prompt += `- "${kw.keyword}" (Header: ${kw.headerMult}×, Body: ${kw.bodyMult}×, Footer: ${kw.footerMult}×)\n`;
      });
      prompt += `\n`;
    }
    
    // Moderate keywords with individual multipliers
    if (row.moderate_keywords && row.moderate_keywords.length > 0) {
      prompt += `**Moderate Indicators (+2 points)**:\n`;
      row.moderate_keywords.forEach((kw: any) => {
        prompt += `- "${kw.keyword}" (Header: ${kw.headerMult}×, Body: ${kw.bodyMult}×, Footer: ${kw.footerMult}×)\n`;
      });
      prompt += `\n`;
    }
    
    // Weak keywords with individual multipliers
    if (row.weak_keywords && row.weak_keywords.length > 0) {
      prompt += `**Weak Indicators (+1 point)**:\n`;
      row.weak_keywords.forEach((kw: any) => {
        prompt += `- "${kw.keyword}" (Header: ${kw.headerMult}×, Body: ${kw.bodyMult}×, Footer: ${kw.footerMult}×)\n`;
      });
      prompt += `\n`;
    }
    
    // Exclusion keywords with CONFIGURABLE penalty
    if (row.exclusion_keywords && row.exclusion_keywords.length > 0) {
      const penalty = row.exclusion_penalty_percentage || 50;
      prompt += `**Exclusion Keywords (${penalty}% penalty per keyword)**:\n`;
      prompt += `- ${row.exclusion_keywords.map((k: string) => `"${k}"`).join(', ')}\n\n`;
    }
    
    // Mandatory fields
    if (row.mandatory_fields && Object.keys(row.mandatory_fields).length > 0) {
      prompt += `**Mandatory Fields**:\n`;
      prompt += `${JSON.stringify(row.mandatory_fields, null, 2)}\n\n`;
    }
    
    // Regional keywords
    if (row.regional_keywords && Object.keys(row.regional_keywords).length > 0) {
      prompt += `**Regional Keywords (Hindi)**:\n`;
      prompt += `${JSON.stringify(row.regional_keywords, null, 2)}\n\n`;
    }
    
    prompt += `---\n\n`;
  });
  
  // Add the complete classification instructions
  prompt += `## Calculation Process

### Phase 1: Raw Score Calculation

For each document type:

\`\`\`
For each keyword found:
  1. Determine keyword weight (3, 2, or 1)
  2. Determine the document region (header, body, or footer)
  3. Apply the keyword's specific position multiplier for that region
  4. Count occurrences (cap at 3 to prevent keyword stuffing)
  
  Keyword Score = weight × keyword_position_multiplier × min(occurrences, 3)

Raw Score for Document Type = Sum of all Keyword Scores
\`\`\`

**IMPORTANT**: Use the specific position multipliers shown for each keyword above, NOT default values.

### Phase 2: Exclusion Penalty Application

For each document type, check its exclusion keywords against the text:

\`\`\`
For each exclusion keyword found:
  Penalty Factor = (exclusion_penalty_percentage / 100) per exclusion keyword
  
Adjusted Score = Raw Score × (1 - Penalty Factor × exclusion_count)

Example:
- Resume raw score = 20.0
- Found 2 exclusion keywords ("invoice", "tax")
- Exclusion penalty = 50%
- Adjusted Score = 20.0 × (1 - 0.5 × 2) = 20.0 × 0.0 = 0.0
\`\`\`

### Phase 3: Confidence Calculation

\`\`\`
Total Score = Sum of all adjusted scores across all document types

For each document type:
  Confidence % = (Adjusted Score / Total Score) × 100
\`\`\`

### Phase 4: Final Validation

Before finalizing classification:

1. **Check mandatory fields** (if specified for the probable type)
2. **Apply validation penalties** if mandatory fields are missing
3. **Set ambiguity warnings** if top two confidences are within 15% of each other
4. **Check text quality** (good = >500 chars, fair = 200-500 chars, poor = <200 chars)

**CRITICAL - Penalty Format Requirements**:

Each penalty in the \`validationPenaltiesApplied\` array MUST follow this exact template:

"[WHAT FAILED] which is [WHY IT MATTERS] for [DOCUMENT TYPE] documents. Applied -[XX]% confidence penalty because [REASONING FOR PERCENTAGE]."

Components:
1. **[WHAT FAILED]**: Specific field/requirement that's missing or incorrect
   - Examples: "Missing mandatory field 'PAN Number'", "Exclusion keyword 'Resume' found in header"
   
2. **[WHY IT MATTERS]**: Business/technical reason why this is important
   - Examples: "required to verify taxpayer identity", "indicates this is not a tax document"
   
3. **[DOCUMENT TYPE]**: The document type being validated
   - Examples: "ITR", "Invoice", "Bank Statement"
   
4. **[XX]%**: Exact penalty percentage applied (must match your calculation)
   
5. **[REASONING FOR PERCENTAGE]**: Why this specific percentage
   - Examples: "major identifying field", "strong contradiction to document type", "minor quality issue"

**Good Examples**:
- "Missing mandatory field 'PAN Number' which is required to verify taxpayer identity for ITR documents. Applied -15% confidence penalty because PAN is a major identifying field."
- "Exclusion keyword 'Resume' found in header region which indicates this is not a tax document for ITR documents. Applied -50% confidence penalty because it's a strong contradiction to the document type."
- "Text quality is poor (<200 chars) which reduces accuracy of keyword matching for all documents. Applied -20% confidence penalty because minimal text provides insufficient classification evidence."
- "Ambiguous classification between ITR (45%) and Invoice (42%) which shows no clear winner for any document type. Applied -10% confidence penalty to both because scores are too close (<15% difference)."

**Bad Examples (DO NOT USE)**:
- "Applied -40% penalty" ❌ (no explanation of what failed or why)
- "Missing field, -15% penalty" ❌ (no detail on which field or why it matters)
- "Low confidence due to missing data" ❌ (vague, no specific percentage or field)

**Penalty Scenarios to Handle**:

1. **Missing Mandatory Field**: -10% to -20% per field
   - Template: "Missing mandatory field '[FIELD]' which is [PURPOSE] for [DOCTYPE] documents. Applied -XX% because [IMPORTANCE LEVEL]."

2. **Exclusion Keywords Found**: -30% to -60% per keyword
   - Template: "Exclusion keyword '[KEYWORD]' found in [REGION] which [CONTRADICTION] for [DOCTYPE] documents. Applied -XX% because [SEVERITY]."

3. **Poor Text Quality**: -10% to -30%
   - Template: "Text quality is [QUALITY] ([CHAR_COUNT] chars) which [IMPACT] for [DOCTYPE] documents. Applied -XX% because [LIMITATION]."

4. **Ambiguous Classification**: -5% to -15%
   - Template: "Ambiguous classification between [TYPE1] (XX%) and [TYPE2] (XX%) which shows [ISSUE]. Applied -XX% because [REASON]."

5. **Regional Keyword Absence**: -5% to -15%
   - Template: "No regional language keywords found which reduces confidence in [REGION] document identification for [DOCTYPE]. Applied -XX% because [IMPACT]."

---

## Output Format

You MUST return a valid JSON object (no markdown, no backticks) with this exact structure:

\`\`\`json
{
  "probable_type": "Resume",
  "confidence_percentage": 85.5,
  "keywords_detected": [
    {
      "keyword": "Work Experience",
      "weight": 3,
      "type": "strong",
      "position": "header",
      "occurrences": 2,
      "occurrences_capped": 2
    }
  ],
  "reasoning": "Found strong indicators like 'Work Experience' in header (×1.5) and 'Education' in body (×1.1). Total raw score: 20.4 after position multipliers. No exclusion keywords found.",
  "secondary_type": "ITR",
  "secondary_confidence": 12.3,
  "exclusion_keywords_found": [],
  "unique_keywords_count": 8,
  "mandatory_fields_status": {
    "Work Experience": "present",
    "Education": "present"
  },
  "validation_status": "PASSED",
  "validation_penalties_applied": [
    "Missing mandatory field 'PAN Number' which is required for ITR documents. Applied -15% confidence penalty.",
    "Text quality is fair (350 chars), may affect accuracy. Applied -5% penalty."
  ],
  "ambiguity_warning": null,
  "text_quality": "good",
  "text_length": 1245,
  "pre_validation_type": "Resume",
  "pre_validation_confidence": 85.5
}
\`\`\`

---

## Decision Rules

1. **High confidence (>70%)**: Likely correct classification
2. **Medium confidence (40-70%)**: Review reasoning and keywords carefully
3. **Low confidence (<40%)**: Mark as "Unknown" or "Mixed Document"
4. **Close call (difference <15%)**: Add ambiguity warning
5. **Missing mandatory fields**: Apply validation penalty or override classification

---

## Example Classification

**Input Text:**
"RESUME OBJECTIVE: Seeking software engineer role at tech company. WORK EXPERIENCE: Software Developer at ABC Corp (2019-2023). EDUCATION: BS Computer Science, XYZ University (2019)."

**Expected Output:**
\`\`\`json
{
  "probable_type": "Resume",
  "confidence_percentage": 92.8,
  "keywords_detected": [
    {
      "keyword": "Resume Objective",
      "weight": 3,
      "type": "strong",
      "position": "header",
      "occurrences": 1,
      "occurrences_capped": 1
    },
    {
      "keyword": "Work Experience",
      "weight": 3,
      "type": "strong",
      "position": "body",
      "occurrences": 1,
      "occurrences_capped": 1
    },
    {
      "keyword": "Education",
      "weight": 3,
      "type": "strong",
      "position": "body",
      "occurrences": 1,
      "occurrences_capped": 1
    }
  ],
  "reasoning": "Strong resume indicators: 'Resume Objective' in header (3 × 1.2 = 3.6), 'Work Experience' in body (3 × 1.0 = 3.0), 'Education' in body (3 × 1.0 = 3.0). Total raw score: 9.6. No exclusion keywords found. Clear resume structure.",
  "secondary_type": "Unknown",
  "secondary_confidence": 0.0,
  "exclusion_keywords_found": [],
  "unique_keywords_count": 3,
  "mandatory_fields_status": {},
  "validation_status": "PASSED",
  "validation_penalties_applied": [],
  "ambiguity_warning": null,
  "text_quality": "good",
  "text_length": 185,
  "pre_validation_type": "Resume",
  "pre_validation_confidence": 92.8
}
\`\`\`

---

Now classify the following document text:
`;

  return prompt;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ocrText, userId } = await req.json();
    
    if (!ocrText) {
      console.error('Missing required field: ocrText');
      return new Response(
        JSON.stringify({ error: 'Missing required field: ocrText' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Get environment variables
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!geminiApiKey || !supabaseUrl || !supabaseServiceKey) {
      console.error('Missing required environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Create Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch user-specific keyword matrix or use default
    let matrixData: any[] = [];
    
    if (userId) {
      const { data, error } = await supabase
        .from('keyword_matrix')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching keyword matrix:', error);
      } else if (data && data.length > 0) {
        matrixData = data;
        console.log(`Using user-specific matrix with ${data.length} document types`);
      }
    }

    // If no user-specific matrix, use default
    if (matrixData.length === 0) {
      console.log('Using default keyword matrix');
      matrixData = [
        {
          doc_type: 'Resume',
          strong_keywords: [
            { keyword: 'Resume Objective', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Work Experience', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Education', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Skills and Certifications', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          moderate_keywords: [
            { keyword: 'LinkedIn', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Email:', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Phone:', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          weak_keywords: [
            { keyword: 'Hobbies and Interests', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Projects', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          exclusion_keywords: ['invoice', 'statement', 'receipt', 'tax', 'bank', 'GSTIN', 'PAN', 'marks', 'grade'],
          exclusion_penalty_percentage: 50,
          mandatory_fields: {},
          regional_keywords: {}
        },
        {
          doc_type: 'ITR',
          strong_keywords: [
            { keyword: 'INDIAN INCOME TAX RETURN', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'ITR-1 SAHAJ', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'PART A GENERAL INFORMATION', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          moderate_keywords: [
            { keyword: 'Assessment Year', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'PAN', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Verification', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          weak_keywords: [
            { keyword: 'Deductions', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Income from Salaries', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          exclusion_keywords: ['resume', 'curriculum vitae', 'education', 'experience', 'skills', 'invoice', 'bank statement'],
          exclusion_penalty_percentage: 50,
          mandatory_fields: {},
          regional_keywords: {}
        },
        {
          doc_type: 'Bank Statement',
          strong_keywords: [
            { keyword: 'STATEMENT OF ACCOUNT', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Account Number', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Statement Period', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          moderate_keywords: [
            { keyword: 'Deposit', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Withdrawal', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Balance', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          weak_keywords: [
            { keyword: 'Transaction Date', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Customer Name', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          exclusion_keywords: ['resume', 'invoice', 'tax return', 'marksheet', 'grade', 'ITR', 'GSTIN'],
          exclusion_penalty_percentage: 50,
          mandatory_fields: {},
          regional_keywords: {}
        },
        {
          doc_type: 'Invoice',
          strong_keywords: [
            { keyword: 'INVOICE', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Tax Invoice', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'GSTIN', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Invoice No.', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          moderate_keywords: [
            { keyword: 'Buyer', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Vendor', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Total Amount', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Terms and Conditions', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          weak_keywords: [
            { keyword: 'Quantity', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Rate', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Amount', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          exclusion_keywords: ['resume', 'experience', 'education', 'bank statement', 'marks', 'ITR', 'assessment year'],
          exclusion_penalty_percentage: 50,
          mandatory_fields: {},
          regional_keywords: {}
        },
        {
          doc_type: 'Marksheet',
          strong_keywords: [
            { keyword: 'STATEMENT OF MARKS', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'BOARD OF SECONDARY EDUCATION', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Division', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          moderate_keywords: [
            { keyword: 'Subject', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Marks Obtained', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Roll No.', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          weak_keywords: [
            { keyword: 'Total Marks', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Percentage', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
            { keyword: 'Result', headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
          ],
          exclusion_keywords: ['invoice', 'tax', 'salary', 'transaction', 'experience', 'GSTIN', 'bank statement'],
          exclusion_penalty_percentage: 50,
          mandatory_fields: {},
          regional_keywords: {}
        }
      ];
    }

    // Build prompt with matrix data
    const systemPrompt = buildAdvancedClassificationPrompt(matrixData);

    // Basic validation of OCR text
    if (typeof ocrText !== 'string' || ocrText.trim().length === 0) {
      console.error('Invalid ocrText provided');
      return new Response(
        JSON.stringify({ error: 'Invalid OCR text provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing document with ${ocrText.length} characters of OCR text`);

    // Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`;
    
    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: systemPrompt + '\n\n' + ocrText
          }]
        }],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${geminiResponse.status} ${errorText}`);
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || !geminiData.candidates[0]?.content?.parts?.[0]?.text) {
      console.error('Unexpected Gemini API response format:', JSON.stringify(geminiData));
      throw new Error('Unexpected response format from Gemini API');
    }

    let responseText = geminiData.candidates[0].content.parts[0].text.trim();
    
    // Remove markdown code blocks if present
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?$/g, '').trim();
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/```\n?/g, '').trim();
    }
    
    console.log('Classification result:', responseText);
    
    // Parse the JSON response
    const classification = JSON.parse(responseText);
    
    return new Response(
      JSON.stringify(classification),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Classification error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error occurred during classification'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
