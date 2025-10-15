# AI Document Classifier - README

## Quick Start

1. **Install dependencies**: `npm install`
2. **Set environment variables**: Create `.env` file with Supabase credentials and Gemini API key
3. **Run locally**: `npm run dev`
4. **Access**: Navigate to `http://localhost:5173`

> **Note**: Requires Supabase project with tables (`documents`, `keyword_matrix`, `profiles`) and Edge Functions (`ocr-extract`, `classify-document`)

---

## Document Categories

The system classifies **5 Indian document types**:
- **Resume**: Work experience, education, skills
- **ITR (Income Tax Return)**: ITR-1/2/3/4, PAN, assessment year
- **Bank Statement**: Account number, transactions, IFSC code
- **Invoice**: GSTIN, invoice number, tax breakdown (CGST/SGST/IGST)
- **Marksheet**: Roll number, subjects, marks, CBSE/ICSE/university

---

## Classification Approach

The system uses a **multi-phase weighted keyword scoring** methodology with validation safeguards:

1. **OCR Extraction**: Gemini Vision API extracts text from PDFs/images with multi-page support
2. **Position-Aware Scoring**: Keywords in header (first 500 chars) get 1.2× weight, body 1.0×, footer 0.8×
3. **Weighted Keyword Matrix**: Strong indicators (+3), moderate (+2), weak (+1) with frequency capping at 3×
4. **Exclusion Penalties**: Conflicting keywords reduce confidence by 50% per occurrence (e.g., "GSTIN" in Resume)
5. **Normalization**: Raw scores normalized to percentages summing to 100% across all categories
6. **Validation Layer**: Checks unique keyword count (≥3), mandatory fields, keyword stuffing, and text quality
7. **Confidence Override**: Results below 40% post-validation classified as "Unknown"; penalties for missing fields

**Key Innovation**: The system prevents false positives through mandatory field validation (e.g., Marksheet requires Roll No. + Subjects + Marks) and penalizes keyword stuffing, ensuring robust classification even with edge cases like repeated headers.

---

## Adding a New Category

### 1. Update Keyword Matrix (`src/types/document.ts`)

```typescript
export const KEYWORD_MATRIX = {
  // ... existing categories
  "Aadhaar Card": {
    strong: ["Unique Identification Authority of India", "UIDAI", "Aadhaar"],
    moderate: ["Enrollment Number", "Date of Birth", "Address"],
    weak: ["Government of India", "Proof of Identity"],
    exclusion: ["Resume", "Invoice", "Bank Statement", "Salary"],
    exclusionPenalty: 50,
    mandatory: {
      fields: ["aadhaar_number", "uidai", "enrollment_number"]
    },
    regional: {
      hindi: ["आधार कार्ड", "विशिष्ट पहचान"]
    }
  }
}
```

### 2. Update Type Definition

```typescript
export type DocumentType = 
  | "Resume" | "ITR" | "Invoice" | "Bank Statement" | "Marksheet" 
  | "Aadhaar Card" // Add new type
  | "Unknown" | "Mixed Document";
```

### 3. Update Classification Prompt (Gemini)

Add the new category to the system prompt in `supabase/functions/classify-document/index.ts`:

```typescript
const SYSTEM_PROMPT = `
  // ... existing categories
  
  ### 6. Aadhaar Card
  **Strong Indicators (+3 points)**:
  - "Unique Identification Authority of India", "UIDAI", "Aadhaar"
  
  **Mandatory Fields** (must have at least 2 of 3):
  1. Aadhaar Number (12-digit)
  2. UIDAI logo or text
  3. Enrollment Number OR Date of Birth
`;
```

### 4. Sync with Database

Update user's keyword matrix in Supabase:

```typescript
// In src/components/KeywordMatrix.tsx
const handleSave = async () => {
  const insertData = Object.entries(cleanedMatrix).map(([docType, keywords]) => ({
    user_id: user.id,
    doc_type: docType, // "Aadhaar Card"
    strong_keywords: keywords.strong,
    moderate_keywords: keywords.moderate,
    weak_keywords: keywords.weak,
    exclusion_keywords: keywords.exclusion,
    mandatory_fields: keywords.mandatory
  }));
  
  await supabase.from('keyword_matrix').upsert(insertData);
};
```

### 5. Test with Sample Documents

Upload sample Aadhaar cards and verify:
- Keywords detected correctly
- Mandatory fields validated
- Exclusion keywords prevent misclassification
- Confidence scores are accurate

---

## Extensibility & Future Directions

### Architectural Strengths
1. **User-Customizable Keywords**: Each user can edit their own keyword matrix via UI, stored per-user in `keyword_matrix` table
2. **Database-Driven Categories**: New categories don't require code deployment—just update user's matrix in DB
3. **Gemini API Flexibility**: Prompt engineering allows rapid iteration on classification logic without retraining models
4. **Modular Validation**: Each category defines its own mandatory fields, enabling category-specific business rules

### Scalability Enhancements
1. **Multi-Language Support**: Extend `regional` keywords beyond Hindi to Tamil, Telugu, Marathi, Bengali
2. **Hybrid Documents**: Detect and split documents containing multiple types (e.g., Form 16 + Salary Slips)
3. **Field Extraction**: Beyond classification, extract structured data (dates, amounts, names) using Gemini
4. **Confidence Tuning**: ML model to learn optimal weights from user corrections/feedback
5. **Batch Processing**: Queue system for large document sets with progress tracking
6. **API Integration**: RESTful API for third-party systems to integrate classification
7. **Custom Workflows**: User-defined post-classification actions (auto-tag, route, archive)

### Enterprise Features
1. **Role-Based Categories**: Different keyword matrices for departments (HR sees Resumes, Finance sees Invoices)
2. **Audit Trail**: Track who classified what, with version history of keyword changes
3. **Compliance Rules**: Auto-check documents against regulatory requirements (GDPR redaction, retention policies)
4. **Template Library**: Pre-built keyword sets for industries (healthcare, legal, finance)

### Technical Debt to Address
- Add unit tests for scoring algorithm
- Implement caching for frequently classified document patterns
- Optimize Gemini API calls with batch processing
- Add webhook support for real-time classification notifications

---

## Tech Stack
- **Frontend**: React + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **AI**: Google Gemini Pro Vision (OCR + Classification)
- **Deployment**: Vercel (frontend) + Supabase (backend)

---

## License
MIT
