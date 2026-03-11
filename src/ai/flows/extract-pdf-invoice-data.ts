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
  description: z.string().describe('Tên hàng hóa, dịch vụ.'),
  unit: z.string().optional().describe('Đơn vị tính (e.g., cái, kg, lần).'),
  quantity: z.number().describe('Số lượng.'),
  unitPrice: z.number().describe('Đơn giá.'),
  lineTotal: z.number().describe('Thành tiền (Số lượng * Đơn giá).'),
});

const ExtractPdfInvoiceDataOutputSchema = z.object({
  invoiceSymbol: z.string().optional().describe('Ký hiệu hóa đơn.'),
  invoiceForm: z.string().optional().describe('Mẫu số hóa đơn.'),
  invoiceNumber: z.string().describe('Số hóa đơn.'),
  invoiceDate: z.string().describe('Ngày, tháng, năm lập hóa đơn (YYYY-MM-DD).'),
  invoiceLookupCode: z.string().optional().describe('Mã tra cứu hóa đơn.'),
  
  senderName: z.string().describe('Tên người bán.'),
  senderAddress: z.string().describe('Địa chỉ người bán.'),
  senderTaxId: z.string().describe('Mã số thuế người bán.'),
  senderAccountNumber: z.string().optional().describe('Số tài khoản ngân hàng của người bán.'),

  recipientName: z.string().describe('Tên người mua.'),
  recipientAddress: z.string().describe('Địa chỉ người mua.'),
  recipientTaxId: z.string().optional().describe('Mã số thuế người mua.'),

  paymentMethod: z.string().optional().describe('Hình thức thanh toán (e.g., TM, CK, TM/CK).'),
  
  items: z.array(InvoiceItemSchema).describe('Danh sách các hàng hóa, dịch vụ.'),
  
  subtotal: z.number().describe('Cộng tiền hàng (tổng thành tiền trước thuế).'),
  vatRate: z.string().optional().describe('Thuế suất GTGT (e.g., "5%", "10%", "Không chịu thuế").'),
  taxAmount: z.number().describe('Tiền thuế GTGT.'),
  totalAmount: z.number().describe('Tổng cộng tiền thanh toán (bao gồm thuế).'),
  totalAmountInWords: z.string().optional().describe('Số tiền viết bằng chữ.'),
  currency: z.string().describe('Đơn vị tiền tệ (e.g., VND, USD).'),
  
  notes: z.string().optional().describe('Ghi chú (nếu có).'),
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
  prompt: `Bạn là một AI kế toán chuyên nghiệp, chuyên trích xuất dữ liệu có cấu trúc từ hóa đơn GTGT của Việt Nam ở định dạng PDF.
Nhiệm vụ của bạn là trích xuất một cách tỉ mỉ tất cả các thông tin liên quan từ tệp hóa đơn PDF được cung cấp.
Đảm bảo tất cả các ngày tháng đều ở định dạng YYYY-MM-DD và tất cả các số đều là số thập phân chuẩn. Nếu một trường không tồn tại, hãy bỏ qua nó.

Trích xuất các thông tin sau:

**Thông tin nhận dạng hóa đơn:**
- **Ký hiệu hóa đơn (invoiceSymbol)**
- **Mẫu số hóa đơn (invoiceForm)**
- **Số hóa đơn (invoiceNumber)**
- **Ngày, tháng, năm lập hóa đơn (invoiceDate)**
- **Mã tra cứu hóa đơn (invoiceLookupCode)**

**Thông tin người bán:**
- **Tên đơn vị (senderName)**
- **Địa chỉ (senderAddress)**
- **Mã số thuế (senderTaxId)**
- **Số tài khoản (senderAccountNumber)** (nếu có)

**Thông tin người mua:**
- **Tên đơn vị (recipientName)** (Nếu là cá nhân thì là "Họ tên người mua hàng")
- **Địa chỉ (recipientAddress)**
- **Mã số thuế (recipientTaxId)** (nếu có)

**Thanh toán & Hàng hóa:**
- **Hình thức thanh toán (paymentMethod)** (ví dụ: TM, CK, TM/CK)
- **Danh sách hàng hóa, dịch vụ (items)**, mỗi mục bao gồm:
    - **Tên hàng hóa, dịch vụ (description)**
    - **Đơn vị tính (unit)**
    - **Số lượng (quantity)**
    - **Đơn giá (unitPrice)**
    - **Thành tiền (lineTotal)**

**Tổng tiền & Tiền tệ:**
- **Cộng tiền hàng (subtotal)** (Tổng thành tiền trước thuế)
- **Thuế suất GTGT (vatRate)** (ví dụ: "5%", "10%", "Không chịu thuế GTGT")
- **Tiền thuế GTGT (taxAmount)**
- **Tổng cộng tiền thanh toán (totalAmount)**
- **Số tiền viết bằng chữ (totalAmountInWords)**
- **Đơn vị tiền tệ (currency)**

**Thông tin khác:**
- **Ghi chú (notes)** (nếu có)
- **Điểm tin cậy (confidenceScore)**: Mức độ tự tin của bạn từ 0.0 đến 1.0.

Đầu ra của bạn PHẢI là một đối tượng JSON duy nhất và tuân thủ nghiêm ngặt schema đã cho.

Hóa đơn PDF: {{media url=pdfDataUri}}`,
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
