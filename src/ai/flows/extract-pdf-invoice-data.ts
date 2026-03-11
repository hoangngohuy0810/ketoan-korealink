'use server';
/**
 * @fileOverview A Genkit flow for extracting structured data from PDF invoices.
 *
 * - extractPdfInvoiceData - A function that handles the PDF invoice data extraction process.
 * - ExtractPdfInvoiceDataInput - The input type for the extractPdfInvoiceData function.
 * - ExtractPdfInvoiceDataOutput - The return type for the extractPdfInvoiceData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractPdfInvoiceDataInputSchema = z.object({
  pdfDataUri: z
    .string()
    .describe(
      "The PDF invoice content as a data URI that must include a MIME type (application/pdf) and use Base64 encoding. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ExtractPdfInvoiceDataInput = z.infer<typeof ExtractPdfInvoiceDataInputSchema>;

const InvoiceItemSchema = z.object({
  description: z.string().describe('Description of the item or service.'),
  quantity: z.number().describe('Quantity of the item or service.'),
  unitPrice: z.number().describe('Unit price of the item or service.'),
  lineTotal: z.number().describe('Total price for this line item (quantity * unitPrice).'),
});

const ExtractPdfInvoiceDataOutputSchema = z.object({
  invoiceNumber: z.string().describe('The unique invoice number.'),
  invoiceDate: z.string().describe('The date the invoice was issued (YYYY-MM-DD format).'),
  dueDate: z.string().optional().describe('The due date for the invoice payment (YYYY-MM-DD format), if available.'),
  senderName: z.string().describe('The name of the company or individual issuing the invoice (sender).'),
  senderAddress: z.string().optional().describe('The address of the company or individual issuing the invoice.'),
  senderTaxId: z.string().optional().describe('The tax identification number of the sender.'),
  recipientName: z.string().describe('The name of the company or individual receiving the invoice (recipient).'),
  recipientAddress: z.string().optional().describe('The address of the company or individual receiving the invoice.'),
  recipientTaxId: z.string().optional().describe('The tax identification number of the recipient.'),
  items: z.array(InvoiceItemSchema).describe('A list of individual items or services on the invoice.'),
  subtotal: z.number().describe('The total amount before taxes.'),
  taxAmount: z.number().describe('The total tax amount.'),
  totalAmount: z.number().describe('The grand total amount including taxes.'),
  currency: z.string().describe('The currency of the invoice (e.g., VND, USD).'),
  notes: z.string().optional().describe('Any additional notes or comments found on the invoice.'),
  confidenceScore: z.number().min(0).max(1).describe('A score between 0 and 1 indicating the AI\'s confidence in the extraction accuracy. 1 being highest confidence.'),
});
export type ExtractPdfInvoiceDataOutput = z.infer<typeof ExtractPdfInvoiceDataOutputSchema>;

export async function extractPdfInvoiceData(
  input: ExtractPdfInvoiceDataInput
): Promise<ExtractPdfInvoiceDataOutput> {
  return extractPdfInvoiceDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractPdfInvoiceDataPrompt',
  input: { schema: ExtractPdfInvoiceDataInputSchema },
  output: { schema: ExtractPdfInvoiceDataOutputSchema },
  prompt: `You are an expert accounting assistant specialized in extracting structured data from PDF invoices.\nYour task is to meticulously extract the following details from the provided PDF invoice.\nEnsure that all extracted numerical values are in a standard decimal format and dates are in YYYY-MM-DD format.\nIf a field is not found, you should omit it from the output, unless it is explicitly required by the schema.\nCalculate a confidence score (between 0 and 1) based on the clarity of the document and your certainty in the extracted information.\n\nExtract the following information:\n- Invoice Number\n- Invoice Date\n- Due Date (if present)\n- Sender Name (company/individual who issued the invoice)\n- Sender Address\n- Sender Tax ID (if present)\n- Recipient Name (company/individual who received the invoice)\n- Recipient Address\n- Recipient Tax ID (if present)\n- A list of items, each with:\n    - Description\n    - Quantity\n    - Unit Price\n    - Line Total\n- Subtotal (total before taxes)\n- Tax Amount (total tax)\n- Total Amount (grand total)\n- Currency\n- Any general notes or comments (if present)\n- Confidence Score (from 0.0 to 1.0)\n\nYour output MUST be a JSON object conforming strictly to the provided schema.\n\nInvoice PDF: {{media url=pdfDataUri}}`,
});

const extractPdfInvoiceDataFlow = ai.defineFlow(
  {
    name: 'extractPdfInvoiceDataFlow',
    inputSchema: ExtractPdfInvoiceDataInputSchema,
    outputSchema: ExtractPdfInvoiceDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to extract invoice data.');
    }
    return output;
  }
);
