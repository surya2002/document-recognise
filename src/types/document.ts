export type DocumentType = "Resume" | "ITR" | "Invoice" | "Bank Statement" | "Marksheet" | "Unknown" | "Mixed Document";

export interface KeywordMatch {
  keyword: string;
  weight: 1 | 2 | 3;
  type: "strong" | "moderate" | "weak";
  position?: "header" | "body" | "footer";
  occurrences?: number;
  occurrences_capped?: number;
}

export interface DocumentChunk {
  chunkIndex: number;
  pageCount: number;
  ocrText: string;
  probableType: DocumentType;
  confidencePercentage: number;
  keywordsDetected: KeywordMatch[];
  reasoning: string;
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
}

export interface ProcessedDocument {
  id?: string;
  fileName: string;
  chunks: DocumentChunk[];
  finalType: DocumentType;
  finalConfidence: number;
  status: "uploading" | "ocr" | "classifying" | "finished" | "error";
  error?: string;
}

export const KEYWORD_MATRIX: {
  [key: string]: {
    strong: string[];
    moderate: string[];
    weak: string[];
    exclusion?: string[];
    exclusionPenalty?: number;
    mandatory?: any;
    regional?: any;
  };
} = {
  Resume: {
    strong: ["Resume Objective", "Work Experience", "Education", "Skills and Certifications"],
    moderate: ["LinkedIn", "Email:", "Phone:"],
    weak: ["Hobbies and Interests", "Projects"],
    exclusion: [],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  ITR: {
    strong: ["INDIAN INCOME TAX RETURN", "ITR-1 SAHAJ", "PART A GENERAL INFORMATION"],
    moderate: ["Assessment Year", "PAN", "Verification"],
    weak: ["Deductions", "Income from Salaries"],
    exclusion: [],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  "Bank Statement": {
    strong: ["STATEMENT OF ACCOUNT", "Account Number", "Statement Period"],
    moderate: ["Deposit", "Withdrawal", "Balance"],
    weak: ["Transaction Date", "Customer Name"],
    exclusion: [],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  Invoice: {
    strong: ["INVOICE", "Tax Invoice", "GSTIN", "Invoice No."],
    moderate: ["Buyer", "Vendor", "Total Amount", "Terms and Conditions"],
    weak: ["Quantity", "Rate", "Amount"],
    exclusion: [],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  },
  Marksheet: {
    strong: ["STATEMENT OF MARKS", "BOARD OF SECONDARY EDUCATION", "Division"],
    moderate: ["Subject", "Marks Obtained", "Roll No."],
    weak: ["Total Marks", "Percentage", "Result"],
    exclusion: [],
    exclusionPenalty: 50,
    mandatory: {},
    regional: {}
  }
};
