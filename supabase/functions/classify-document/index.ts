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
3. **Position-aware scoring**: Keywords in different document regions have different weights
4. **Frequency capping**: Same keyword repeated multiple times is capped at 3× weight to prevent gaming
5. **Validation-first approach**: Even high confidence scores can be overridden if mandatory fields are missing

---

## Document Region Definitions

Divide the OCR text into three regions:

- **Header Region**: First 500 characters → Apply 1.2× multiplier
- **Body Region**: Characters 501 to (length - 300) → Apply 1.0× multiplier (standard)
- **Footer Region**: Last 300 characters → Apply 0.8× multiplier

---

## Weighted Keyword Matrix

`;

  matrixData.forEach((row: any) => {
    prompt += `### ${row.doc_type}\n\n`;
    
    // Strong/Moderate/Weak keywords
    if (row.strong_keywords && row.strong_keywords.length > 0) {
      prompt += `**Strong Indicators (+3 points)**:\n`;
      prompt += `- ${row.strong_keywords.map((k: string) => `"${k}"`).join(', ')}\n\n`;
    }
    
    if (row.moderate_keywords && row.moderate_keywords.length > 0) {
      prompt += `**Moderate Indicators (+2 points)**:\n`;
      prompt += `- ${row.moderate_keywords.map((k: string) => `"${k}"`).join(', ')}\n\n`;
    }
    
    if (row.weak_keywords && row.weak_keywords.length > 0) {
      prompt += `**Weak Indicators (+1 point)**:\n`;
      prompt += `- ${row.weak_keywords.map((k: string) => `"${k}"`).join(', ')}\n\n`;
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
  2. Determine position multiplier (1.2, 1.0, or 0.8)
  3. Count occurrences (cap at 3 to prevent keyword stuffing)
  
  Keyword Score = weight × position_multiplier × min(occurrences, 3)

Raw Score for Document Type = Sum of all Keyword Scores
\`\`\`

### Phase 2: Exclusion Penalty Application

For each document type, check its exclusion keywords against the text:

\`\`\`
For each exclusion keyword found:
  Penalty Factor = (exclusion_penalty_percentage / 100) per exclusion keyword
  
Adjusted Score = Raw Score × (1 - Penalty Factor × exclusion_count)

If Adjusted Score < 0, set to 0
\`\`\`

### Phase 3: Normalization to Percentages

\`\`\`
Sum of All Adjusted Scores = Σ(Adjusted Score for each document type)

If Sum = 0:
  Return "Unknown" classification with 0% confidence

For each document type:
  Normalized Confidence = (Adjusted Score / Sum) × 100%
  
Verification: Sum of all confidences = 100%
\`\`\`

### Phase 4: Validation Checks

Perform these validation checks on the **highest scoring document type**:

#### Check 1: Minimum Unique Keywords
\`\`\`
Count unique keywords matched (not total occurrences)

If unique_keywords < 3:
  Apply -40% penalty to confidence
\`\`\`

#### Check 2: Mandatory Fields Presence
\`\`\`
For each mandatory field missing:
  Apply -30% penalty to confidence
\`\`\`

#### Check 3: Keyword Stuffing Detection
\`\`\`
If (any single keyword occurs > 5 times) AND (unique_keywords < 3):
  Apply -20% penalty (keyword stuffing detected)
\`\`\`

#### Check 4: Text Quality Check
\`\`\`
If text length < 50 characters:
  Set confidence to 0
  Return "Unable to classify - Insufficient text"
  
If text length < 150 characters:
  Apply -25% penalty (limited content warning)
\`\`\`

#### Apply All Penalties
\`\`\`
Final Confidence = Normalized Confidence - Sum of All Penalties

If Final Confidence < 40%:
  Override to "Unknown" with 0% confidence
\`\`\`

### Phase 5: Ambiguity Detection

\`\`\`
If 2 or more document types have confidence > 60%:
  Flag as "Ambiguous - Multiple document types detected"
  
If highest confidence < 40% after validation:
  Override to "Unknown"
\`\`\`

---

## Output Format

Return **ONLY** valid JSON in this exact format:

\`\`\`json
{
  "probable_type": "Invoice",
  "confidence_percentage": 85.3,
  "secondary_type": "Bank Statement",
  "secondary_confidence": 14.7,
  "keywords_detected": [
    {
      "keyword": "TAX INVOICE",
      "weight": 3,
      "type": "strong",
      "position": "header",
      "occurrences": 2,
      "occurrences_capped": 2
    }
  ],
  "exclusion_keywords_found": [],
  "unique_keywords_count": 3,
  "mandatory_fields_status": {
    "gstin_or_tax_invoice": "present",
    "invoice_number": "present",
    "item_details": "present"
  },
  "validation_status": "PASSED",
  "validation_penalties_applied": [],
  "reasoning": "Strong presence of GST-specific identifiers in header region.",
  "ambiguity_warning": null,
  "text_quality": "good",
  "text_length": 847
}
\`\`\`

### Important Notes

1. **Always return valid JSON** - No additional text before or after the JSON
2. **Case-insensitive matching** - "invoice" matches "INVOICE" matches "Invoice"
3. **Partial matching** - "TAX INVOICE" contains "INVOICE" and "TAX"
4. **Cap keyword occurrences** - Maximum 3× weight for repeated keywords
5. **Apply exclusion penalties** - Use the configured penalty percentage per exclusion keyword found
6. **Validate mandatory fields** - Missing fields incur 30% penalty each
7. **Override to Unknown** - If final confidence < 40% after all penalties
8. **Detect ambiguity** - Flag if 2+ types score > 60%
9. **Check text quality** - Minimum 50 characters required for classification

---

Now analyze the provided OCR text and return the classification in JSON format.`;

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

    // Fetch user's custom keyword matrix from database (including new fields)
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: matrixData, error: matrixError } = await supabase
      .from('keyword_matrix')
      .select('*')
      .eq('user_id', userId);

    let keywordMatrix: any[] = [
      {
        "doc_type": "Resume",
        "strong_keywords": ["Resume", "Curriculum Vitae", "CV", "Work Experience", "Professional Experience", "Employment History", "Career Objective", "Professional Summary", "Career Summary", "Skills and Certifications", "Technical Skills", "Core Competencies", "Professional Profile"],
        "moderate_keywords": ["LinkedIn", "GitHub", "Portfolio", "Email:", "E-mail:", "Phone:", "Mobile:", "Contact:", "Tel:", "References", "Certifications", "Professional Certifications", "Accomplishments"],
        "weak_keywords": ["Hobbies", "Interests", "Personal Interests", "Projects", "Personal Projects", "Achievements", "Awards", "Honors", "Languages Known", "Languages", "Personal Details", "Objective"],
        "exclusion_keywords": ["Salary", "CTC", "Basic Pay", "Basic Salary", "HRA", "House Rent Allowance", "Form 16", "Form-16", "TDS", "Tax Deducted", "GSTIN", "GST", "Invoice", "Tax Invoice", "Assessment Year", "Marks Obtained", "Total Marks", "Roll No", "Registration Number"],
        "exclusion_penalty_percentage": 50,
        "mandatory_fields": {
          "description": "Must have at least 2 of 3",
          "fields": ["Work Experience OR Education (with timeline/dates)", "Contact Information (Email OR Phone)", "Skills OR Career Objective OR Professional Summary"]
        },
        "regional_keywords": {}
      },
      {
        "doc_type": "ITR",
        "strong_keywords": ["INDIAN INCOME TAX RETURN", "Income Tax Return", "ITR-1", "ITR-2", "ITR-3", "ITR-4", "ITR-5", "ITR-6", "ITR-7", "SAHAJ", "SUGAM", "PART A GENERAL INFORMATION", "Part A - General Information", "Income Tax Department", "Acknowledgement Number", "Acknowledgment Number", "Return Filed", "ITR Acknowledgement"],
        "moderate_keywords": ["Assessment Year", "AY", "PAN", "Permanent Account Number", "Verification", "Total Income", "Total Taxable Income", "Tax Payable", "Tax Liability", "Section 80C", "Section 80D", "Section 80G", "Taxable Income", "Financial Year", "FY", "Income Tax Portal", "e-Filing"],
        "weak_keywords": ["Deductions", "Income from Salaries", "Income from Salary", "TDS", "Tax Deducted at Source", "Income from House Property", "Capital Gains", "Income from Other Sources", "Other Sources", "Gross Total Income"],
        "exclusion_keywords": ["Form 16", "Form-16", "Form No. 16", "TDS Certificate", "Part A", "Part B", "Employer TAN", "Salary Slip", "Pay Slip", "Payslip", "Monthly Salary", "Net Salary"],
        "exclusion_penalty_percentage": 50,
        "mandatory_fields": {
          "description": "Must have at least 2 of 3",
          "fields": ["ITR Form Type (ITR-1/2/3/4/5/6/7 OR SAHAJ OR SUGAM)", "PAN OR Permanent Account Number", "Assessment Year OR Financial Year OR Total Income/Tax Payable"]
        },
        "regional_keywords": {
          "Income Tax Return": "आयकर रिटर्न"
        }
      },
      {
        "doc_type": "Bank Statement",
        "strong_keywords": ["STATEMENT OF ACCOUNT", "Statement of Account", "Account Statement", "Bank Statement", "Account Number", "A/c No", "A/C Number", "Statement Period", "Statement Date", "IFSC Code", "IFSC", "Branch Name", "Branch Code", "Account Summary", "Transaction Statement"],
        "moderate_keywords": ["Deposit", "Withdrawal", "Balance", "Credit", "Debit", "Opening Balance", "Closing Balance", "Available Balance", "Transaction", "Running Balance", "Current Balance", "NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Check", "Transfer", "ATM Withdrawal"],
        "weak_keywords": ["Transaction Date", "Trans Date", "Value Date", "Date", "Customer Name", "Account Holder", "Reference Number", "Ref No", "Cheque No", "Check No", "Narration", "Particulars", "Description", "Branch Address"],
        "exclusion_keywords": ["Invoice", "Tax Invoice", "Bill", "GSTIN", "GST Number", "HSN Code", "HSN", "SAC Code", "Salary", "Pay Slip", "Payslip", "Basic Salary", "Marks", "Marks Obtained", "Roll No", "Subject"],
        "exclusion_penalty_percentage": 50,
        "mandatory_fields": {
          "description": "Must have at least 2 of 3",
          "fields": ["Account Number OR A/c No", "Transaction records (at least 2 transactions with dates) OR Balance information", "IFSC Code OR Bank Name OR Branch Name"]
        },
        "regional_keywords": {
          "Bank Statement": "खाता विवरण",
          "Statement of Account": "लेखा विवरण"
        }
      },
      {
        "doc_type": "Invoice",
        "strong_keywords": ["INVOICE", "TAX INVOICE", "Tax Invoice", "GSTIN", "GST Number", "GST Invoice", "Invoice No.", "Invoice Number", "Invoice No", "Inv No", "Invoice Date", "Bill of Supply", "Proforma Invoice", "Pro-forma Invoice", "Commercial Invoice", "Supply Invoice"],
        "moderate_keywords": ["Buyer", "Vendor", "Supplier", "Seller", "Bill To", "Ship To", "Shipping Address", "Billing Address", "Total Amount", "Grand Total", "Net Amount", "Terms and Conditions", "Payment Terms", "HSN Code", "HSN", "SAC Code", "SAC", "CGST", "SGST", "IGST", "GST Amount", "Tax Amount", "Place of Supply", "State Code", "Invoice Total", "Amount Payable"],
        "weak_keywords": ["Quantity", "Qty", "Rate", "Price", "Unit Price", "Amount", "Taxable Value", "Taxable Amount", "Description", "Item", "Item Description", "Product", "Service", "Discount", "Total Before Tax", "Subtotal"],
        "exclusion_keywords": ["Salary", "Pay Slip", "Payslip", "Employee ID", "Employee", "Basic Pay", "Basic Salary", "HRA", "Statement of Account", "Account Number", "Opening Balance", "Closing Balance", "Marks Obtained", "Roll No", "Subject", "Grade"],
        "exclusion_penalty_percentage": 50,
        "mandatory_fields": {
          "description": "Must have at least 2 of 3",
          "fields": ["GSTIN OR 'Tax Invoice' OR 'Invoice' in header region", "Invoice Number OR Invoice No", "Item/Product/Service details with quantities OR amounts"]
        },
        "regional_keywords": {
          "Invoice": "कर चालान",
          "Tax Invoice": "कर बीजक",
          "GST Invoice": "जीएसटी चालान"
        }
      },
      {
        "doc_type": "Marksheet",
        "strong_keywords": ["STATEMENT OF MARKS", "Statement of Marks", "MARK SHEET", "MARKSHEET", "Mark Sheet", "BOARD OF SECONDARY EDUCATION", "Board of Education", "Grade Sheet", "Grade Card", "Division", "CBSE", "Central Board of Secondary Education", "ICSE", "Indian Certificate of Secondary Education", "University Examination", "Result Card", "Transcript", "Academic Record", "Academic Transcript", "Consolidated Marksheet", "Semester Result", "Final Result", "Examination Result"],
        "moderate_keywords": ["Subject", "Subjects", "Marks Obtained", "Marks Secured", "Roll No.", "Roll Number", "Roll No", "Registration Number", "Reg No", "Reg. No.", "Enrollment Number", "CGPA", "GPA", "Grade", "Grades", "Class", "Semester", "Examination", "Theory", "Practical", "Internal", "External", "Obtained Marks"],
        "weak_keywords": ["Total Marks", "Maximum Marks", "Max Marks", "Percentage", "Result", "Pass", "Passed", "First Class", "Second Class", "Third Class", "Distinction", "Merit", "Pass Class", "Grand Total", "Aggregate"],
        "exclusion_keywords": ["Salary", "Pay Slip", "Payslip", "Invoice", "Tax Invoice", "GSTIN", "Account Number", "Statement of Account", "Balance", "Withdrawal", "Deposit", "Work Experience", "Career Objective", "Professional Summary"],
        "exclusion_penalty_percentage": 50,
        "mandatory_fields": {
          "description": "Must have at least 3 of 4",
          "fields": ["Roll No. OR Registration Number OR Enrollment Number", "Subject names (at least 3 different subjects)", "Marks OR Grades OR CGPA/GPA", "Board/University name OR Examination name OR Result/Pass status"]
        },
        "regional_keywords": {
          "Marksheet": "अंक पत्र",
          "Statement of Marks": "अंकतालिका"
        }
      }
    ];

    // Use custom matrix if available
    if (matrixData && matrixData.length > 0) {
      keywordMatrix = matrixData;
      console.log('Using custom keyword matrix for user:', userId);
    } else {
      console.log('Using default keyword matrix');
    }

    const CLASSIFICATION_PROMPT = buildAdvancedClassificationPrompt(keywordMatrix);
    
    if (!ocrText || !ocrText.trim()) {
      return new Response(
        JSON.stringify({
          probable_type: "Unknown",
          confidence_percentage: 0,
          keywords_detected: [],
          reasoning: "No text content found in document",
          validation_status: "FAILED",
          text_quality: "poor",
          text_length: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Classifying document with text length: ${ocrText.length}`);

    // Call Google Gemini API with the advanced prompt
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${CLASSIFICATION_PROMPT}\n\nOCR Text to classify:\n${ocrText.substring(0, 10000)}`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
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

    console.log('Gemini response:', content.substring(0, 300));

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
        reasoning: "Classification failed due to error",
        validation_status: "FAILED"
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});