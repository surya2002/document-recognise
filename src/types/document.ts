export type DocumentType = "Resume" | "ITR" | "Invoice" | "Bank Statement" | "Marksheet" | "Unknown" | "Mixed Document";

export interface KeywordMatch {
  keyword: string;
  weight: 1 | 2 | 3;
  type: "strong" | "moderate" | "weak";
}

export interface DocumentChunk {
  chunkIndex: number;
  pageCount: number;
  ocrText: string;
  probableType: DocumentType;
  confidencePercentage: number;
  keywordsDetected: KeywordMatch[];
  reasoning: string;
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

export const KEYWORD_MATRIX = {
  Resume: {
    strong: ["Resume Objective", "Work Experience", "Education", "Skills and Certifications"],
    moderate: ["LinkedIn", "Email:", "Phone:"],
    weak: ["Hobbies and Interests", "Projects"]
  },
  ITR: {
    strong: ["INDIAN INCOME TAX RETURN", "ITR-1 SAHAJ", "PART A GENERAL INFORMATION"],
    moderate: ["Assessment Year", "PAN", "Verification"],
    weak: ["Deductions", "Income from Salaries"]
  },
  "Bank Statement": {
    strong: ["STATEMENT OF ACCOUNT", "Account Number", "Statement Period"],
    moderate: ["Deposit", "Withdrawal", "Balance"],
    weak: ["Transaction Date", "Customer Name"]
  },
  Invoice: {
    strong: ["INVOICE", "Tax Invoice", "GSTIN", "Invoice No."],
    moderate: ["Buyer", "Vendor", "Total Amount", "Terms and Conditions"],
    weak: ["Quantity", "Rate", "Amount"]
  },
  Marksheet: {
    strong: ["STATEMENT OF MARKS", "BOARD OF SECONDARY EDUCATION", "Division"],
    moderate: ["Subject", "Marks Obtained", "Roll No."],
    weak: ["Total Marks", "Percentage", "Result"]
  }
};
