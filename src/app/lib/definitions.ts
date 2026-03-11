export type InvoiceItem = {
  description: string;
  unit?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

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

  // New detailed fields from invoice
  invoiceSymbol?: string;
  invoiceForm?: string;
  invoiceLookupCode?: string;
  
  senderName?: string;
  senderAddress?: string;
  senderTaxId?: string;
  senderAccountNumber?: string;

  recipientName?: string;
  recipientAddress?: string;
  recipientTaxId?: string;

  paymentMethod?: string;
  items?: InvoiceItem[];
  vatRate?: string;
  totalAmountInWords?: string;
  currency?: string;
};

export type CompanyInfo = {
  name: string;
  taxId: string;
  abbreviation: string;
  openingBalance: number;
  openingBalanceDate: string; // YYYY-MM-DD
};

export type ExtractedData = {
  invoiceSymbol?: string;
  invoiceForm?: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceLookupCode?: string;

  senderName: string;
  senderAddress: string;
  senderTaxId: string;
  senderAccountNumber?: string;

  recipientName: string;
  recipientAddress: string;
  recipientTaxId?: string;

  paymentMethod?: string;
  items: InvoiceItem[];
  subtotal: number;
  vatRate?: string;
  taxAmount: number;
  totalAmount: number;
  totalAmountInWords?: string;
  currency: string;
  
  notes?: string;
  pdfDataUri: string;
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
