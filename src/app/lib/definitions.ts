export type Transaction = {
  id: string;
  date: string; // YYYY-MM-DD
  invoiceNumber: string;
  counterpartyName: string;
  transactionType: 'income' | 'expense';
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  notes?: string;
  pdfDataUri?: string;
};

export type CompanyInfo = {
  name: string;
  taxId: string;
  abbreviation: string;
  openingBalance: number;
  openingBalanceDate: string; // YYYY-MM-DD
};

export type ExtractedData = {
  invoiceNumber: string;
  invoiceDate: string;
  recipientName: string;
  senderName: string;
  totalAmount: number;
  taxAmount: number;
  subtotal: number;
  pdfDataUri: string;
  notes?: string;
};

export type StatementTransaction = {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
};

export type ExtractedStatementData = {
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  transactions: StatementTransaction[];
  currency: string;
  confidenceScore: number;
};
