'use server';

import { extractPdfInvoiceData, type ExtractPdfInvoiceDataInput, type ExtractPdfInvoiceDataOutput } from '@/ai/flows/extract-pdf-invoice-data';
import { validateExtractedTransactionData, type ValidateExtractedTransactionDataInput, type ValidateExtractedTransactionDataOutput } from '@/ai/flows/validate-extracted-transaction-data';
import { extractStatementData, type ExtractStatementDataInput, type ExtractStatementDataOutput } from '@/ai/flows/extract-statement-data';
import { z } from 'zod';

const ExtractActionSchema = z.object({
  pdfDataUri: z.string().startsWith('data:application/pdf;base64,'),
});

export async function extractInvoiceAction(
  input: ExtractPdfInvoiceDataInput
): Promise<{ success: true; data: ExtractPdfInvoiceDataOutput } | { success: false; error: string }> {
  const parsed = ExtractActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Dữ liệu đầu vào không hợp lệ. Vui lòng tải lên tệp PDF.' };
  }

  try {
    const output = await extractPdfInvoiceData(parsed.data);
    return { success: true, data: output };
  } catch (error) {
    console.error('Error in extractInvoiceAction:', error);
    return { success: false, error: 'AI không thể trích xuất dữ liệu từ hoá đơn. Vui lòng thử lại.' };
  }
}

export async function validateTransactionAction(
  input: ValidateExtractedTransactionDataInput
): Promise<{ success: true; data: ValidateExtractedTransactionDataOutput } | { success: false; error: string }> {
  try {
    const output = await validateExtractedTransactionData(input);
    return { success: true, data: output };
  } catch (error) {
    console.error('Error in validateTransactionAction:', error);
    return { success: false, error: 'AI không thể xác thực giao dịch.' };
  }
}

const ReconcileActionSchema = z.object({
  fileDataUri: z.string().startsWith('data:'),
});

export async function reconcileStatementAction(
  input: ExtractStatementDataInput
): Promise<{ success: true; data: ExtractStatementDataOutput } | { success: false; error: string }> {
  const parsed = ReconcileActionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Dữ liệu đầu vào không hợp lệ. Vui lòng tải lên một tệp hợp lệ.' };
  }

  try {
    const output = await extractStatementData(parsed.data);
    return { success: true, data: output };
  } catch (error) {
    console.error('Error in reconcileStatementAction:', error);
    return { success: false, error: 'AI không thể trích xuất dữ liệu từ sao kê. Vui lòng thử lại.' };
  }
}
