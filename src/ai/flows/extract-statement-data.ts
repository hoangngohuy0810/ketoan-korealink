'use server';
/**
 * @fileOverview A Genkit flow for extracting structured data from bank statements.
 *
 * - extractStatementData - A function that handles the bank statement data extraction process.
 * - ExtractStatementDataInput - The input type for the extractStatementData function.
 * - ExtractStatementDataOutput - The return type for the extractStatementData function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractStatementDataInputSchema = z.object({
  fileDataUri: z
    .string()
    .describe(
      "The bank statement content as a data URI. It can be a PDF, image, CSV, or Excel file. The URI must include a MIME type and use Base64 encoding. e.g., 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ExtractStatementDataInput = z.infer<typeof ExtractStatementDataInputSchema>;

const StatementTransactionSchema = z.object({
    date: z.string().describe('Date of the transaction (YYYY-MM-DD).'),
    description: z.string().describe('Transaction description.'),
    amount: z.number().describe('The absolute amount of the transaction.'),
    type: z.enum(['debit', 'credit']).describe('Type of transaction: "debit" for money out, "credit" for money in.'),
});

const ExtractStatementDataOutputSchema = z.object({
    startDate: z.string().describe('The start date of the statement period (YYYY-MM-DD).'),
    endDate: z.string().describe('The end date of the statement period (YYYY-MM-DD).'),
    openingBalance: z.number().describe('The opening balance of the statement.'),
    closingBalance: z.number().describe('The closing balance of the statement.'),
    transactions: z.array(StatementTransactionSchema).describe('A list of individual transactions from the statement.'),
    currency: z.string().describe('The currency of the statement (e.g., VND, USD).'),
    confidenceScore: z.number().min(0).max(1).describe('A score between 0 and 1 indicating the AI\'s confidence in the extraction accuracy.'),
});
export type ExtractStatementDataOutput = z.infer<typeof ExtractStatementDataOutputSchema>;


export async function extractStatementData(
  input: ExtractStatementDataInput
): Promise<ExtractStatementDataOutput> {
  return extractStatementDataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractStatementDataPrompt',
  input: { schema: ExtractStatementDataInputSchema },
  output: { schema: ExtractStatementDataOutputSchema },
  prompt: `You are an expert financial analyst. Your task is to extract structured data from the provided bank statement file. The file can be a PDF, an image, or a text-based format like CSV.

Analyze the document and extract the following information:
- The start date of the statement period.
- The end date of the statement period.
- The opening balance.
- The closing balance.
- A list of all transactions within the period. For each transaction, extract:
    - The date of the transaction.
    - The description of the transaction.
    - The transaction amount (as a positive number).
    - The type of transaction: 'credit' for deposits/money in, and 'debit' for withdrawals/money out.
- The currency of the statement.
- A confidence score (from 0.0 to 1.0) for the accuracy of the extracted data.

Format all dates as YYYY-MM-DD. Ensure all numerical values are standard decimals. Your output MUST be a JSON object that strictly conforms to the provided schema.

Statement Document: {{media url=fileDataUri}}`,
});

const extractStatementDataFlow = ai.defineFlow(
  {
    name: 'extractStatementDataFlow',
    inputSchema: ExtractStatementDataInputSchema,
    outputSchema: ExtractStatementDataOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('Failed to extract statement data.');
    }
    return output;
  }
);
