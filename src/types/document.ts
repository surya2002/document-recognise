export type DocumentType = "Resume" | "ITR" | "Invoice" | "Bank Statement" | "Marksheet" | "Unknown" | "Mixed Document";

export interface KeywordMatch {
  keyword: string;
  weight: 1 | 2 | 3;
  type: "strong" | "moderate" | "weak";
  position?: "header" | "body" | "footer";
  occurrences?: number;
  occurrences_capped?: number;
}

export interface KeywordWithMultipliers {
  keyword: string;
  headerMult: number;
  bodyMult: number;
  footerMult: number;
}

export interface ProcessedDocument {
  id?: string;
  fileName: string;
  fileSize?: number;
  
  // Classification results
  ocrText?: string;
  probableType?: DocumentType;
  confidencePercentage?: number;
  keywordsDetected?: KeywordMatch[];
  reasoning?: string;
  
  // Optional classification details
  secondaryType?: DocumentType;
  secondaryConfidence?: number;
  exclusionKeywordsFound?: string[];
  uniqueKeywordsCount?: number;
  mandatoryFieldsStatus?: {
    [field: string]: "present" | "missing";
  };
  validationStatus?: "PASSED" | "FAILED";
  validationPenaltiesApplied?: string[];
  ambiguityWarning?: string;
  textQuality?: "good" | "fair" | "poor";
  textLength?: number;
  preValidationType?: DocumentType;
  preValidationConfidence?: number;
  
  // Processing metadata
  finalType: DocumentType;
  finalConfidence: number;
  status: "uploading" | "ocr" | "classifying" | "finished" | "error";
  error?: string;
}

export const KEYWORD_MATRIX: {
  [key: string]: {
    strong: KeywordWithMultipliers[];
    moderate: KeywordWithMultipliers[];
    weak: KeywordWithMultipliers[];
    exclusion?: string[];
    exclusionPenalty?: number;
    mandatory?: any;
    regional?: any;
  };
} = {
  Resume: {
    strong: [
      { keyword: "Resume Objective", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Work Experience", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Education", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Skills and Certifications", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    moderate: [
      { keyword: "LinkedIn", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Email:", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Phone:", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    weak: [
      { keyword: "Hobbies and Interests", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Projects", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    exclusion: ["invoice", "statement", "receipt", "tax", "bank", "GSTIN", "PAN", "marks", "grade"],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  ITR: {
    strong: [
      { keyword: "INDIAN INCOME TAX RETURN", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "ITR-1 SAHAJ", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "PART A GENERAL INFORMATION", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    moderate: [
      { keyword: "Assessment Year", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "PAN", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Verification", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    weak: [
      { keyword: "Deductions", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Income from Salaries", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    exclusion: ["resume", "curriculum vitae", "education", "experience", "skills", "invoice", "bank statement"],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  "Bank Statement": {
    strong: [
      { keyword: "STATEMENT OF ACCOUNT", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Account Number", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Statement Period", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    moderate: [
      { keyword: "Deposit", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Withdrawal", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Balance", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    weak: [
      { keyword: "Transaction Date", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Customer Name", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    exclusion: ["resume", "invoice", "tax return", "marksheet", "grade", "ITR", "GSTIN"],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  Invoice: {
    strong: [
      { keyword: "INVOICE", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Tax Invoice", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "GSTIN", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Invoice No.", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    moderate: [
      { keyword: "Buyer", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Vendor", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Total Amount", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Terms and Conditions", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    weak: [
      { keyword: "Quantity", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Rate", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Amount", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    exclusion: ["resume", "experience", "education", "bank statement", "marks", "ITR", "assessment year"],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  Marksheet: {
    strong: [
      { keyword: "STATEMENT OF MARKS", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "BOARD OF SECONDARY EDUCATION", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Division", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    moderate: [
      { keyword: "Subject", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Marks Obtained", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Roll No.", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    weak: [
      { keyword: "Total Marks", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Percentage", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 },
      { keyword: "Result", headerMult: 1.2, bodyMult: 1.0, footerMult: 0.8 }
    ],
    exclusion: ["invoice", "tax", "salary", "transaction", "experience", "GSTIN", "bank statement"],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  }
};
