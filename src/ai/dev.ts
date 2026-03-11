import { config } from 'dotenv';
config();

import '@/ai/flows/extract-pdf-invoice-data.ts';
import '@/ai/flows/validate-extracted-transaction-data.ts';
import '@/ai/flows/extract-statement-data.ts';
