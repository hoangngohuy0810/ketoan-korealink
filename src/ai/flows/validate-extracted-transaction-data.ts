'use server';
/**
 * @fileOverview A Genkit flow to validate extracted transaction data from invoices.
 *
 * - validateExtractedTransactionData - A function that validates transaction details extracted by AI.
 * - ValidateExtractedTransactionDataInput - The input type for the validateExtractedTransactionData function.
 * - ValidateExtractedTransactionDataOutput - The return type for the validateExtractedTransactionData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input Schema
const ValidateExtractedTransactionDataInputSchema = z.object({
  transactionDate: z.string().describe('The date of the transaction (e.g., "DD/MM/YYYY").'),
  invoiceNumber: z.string().describe('The unique identifier for the invoice.'),
  counterpartyName: z.string().describe('The name of the entity with whom the transaction occurred.'),
  totalAmount: z.number().describe('The total amount of the transaction, including VAT.'),
  vatAmount: z.number().describe('The VAT (Value Added Tax) amount.'),
  netAmount: z.number().describe('The net amount of the transaction, excluding VAT.'),
  transactionType: z.enum(['income', 'expense']).describe('The type of transaction: income or expense.'),
  documentUrl: z.string().optional().describe('Optional URL to the original PDF document.'),
});
export type ValidateExtractedTransactionDataInput = z.infer<typeof ValidateExtractedTransactionDataInputSchema>;

// Output Schema
const ValidateExtractedTransactionDataOutputSchema = z.object({
  validatedData: ValidateExtractedTransactionDataInputSchema.describe('The original transaction data, potentially confirmed as valid.'),
  inconsistencies: z.array(z.string()).describe('A list of identified inconsistencies or potential errors in the extracted data.'),
  hasInconsistencies: z.boolean().describe('True if any inconsistencies were found, false otherwise.'),
});
export type ValidateExtractedTransactionDataOutput = z.infer<typeof ValidateExtractedTransactionDataOutputSchema>;

// Wrapper function
export async function validateExtractedTransactionData(input: ValidateExtractedTransactionDataInput): Promise<ValidateExtractedTransactionDataOutput> {
  return validateExtractedTransactionDataFlow(input);
}

// Prompt definition
const validatePrompt = ai.definePrompt({
  name: 'validateExtractedTransactionDataPrompt',
  input: {schema: ValidateExtractedTransactionDataInputSchema},
  output: {schema: ValidateExtractedTransactionDataOutputSchema},
  prompt: `You are an expert accounting assistant tasked with reviewing extracted transaction data for inconsistencies.
Your goal is to identify potential errors, especially calculation discrepancies like VAT.

Review the following extracted transaction details:

Transaction Date: {{{transactionDate}}}
Invoice Number: {{{invoiceNumber}}}
Counterparty: {{{counterpartyName}}}
Total Amount: {{{totalAmount}}}
VAT Amount: {{{vatAmount}}}
Net Amount: {{{netAmount}}}
Transaction Type: {{{transactionType}}}

Carefully check if the sum of 'Net Amount' and 'VAT Amount' equals 'Total Amount'.
Also, identify any other obvious data inconsistencies or missing critical information that would make this transaction invalid or suspicious for accounting purposes.

Based on your review, list all identified inconsistencies as concise strings in the 'inconsistencies' array.
Set 'hasInconsistencies' to true if any inconsistencies are found, otherwise set it to false.
The 'validatedData' field should reflect the input data as is, unless you have a specific reason to modify it (which is generally not expected in this task, as corrections are manual).

Example of an inconsistency: "VAT calculation error: Net Amount ({{netAmount}}) + VAT Amount ({{vatAmount}}) does not equal Total Amount ({{totalAmount}})."
`,
});

// Flow definition
const validateExtractedTransactionDataFlow = ai.defineFlow(
  {
    name: 'validateExtractedTransactionDataFlow',
    inputSchema: ValidateExtractedTransactionDataInputSchema,
    outputSchema: ValidateExtractedTransactionDataOutputSchema,
  },
  async (input) => {
    const {output} = await validatePrompt(input);
    return output!;
  }
);
