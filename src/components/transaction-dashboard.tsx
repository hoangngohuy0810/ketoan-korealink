
'use client';

import * as React from 'react';
import {
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
  Settings,
  UploadCloud,
  X,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { CompanyInfo, Transaction, ExtractedData } from '@/app/lib/definitions';
import { format, parse, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, cn, fileToDataUri } from '@/lib/utils';
import { Logo } from '@/components/icons';
import { extractInvoiceAction, validateTransactionAction } from '@/app/actions';
import { type ExtractPdfInvoiceDataOutput } from '@/ai/flows/extract-pdf-invoice-data';

const COMPANY_INFO_KEY = 'nhat-ky-thu-chi-company-info';
const TRANSACTIONS_KEY = 'nhat-ky-thu-chi-transactions';

const transactionSchema = z.object({
  id: z.string().optional(),
  date: z.date({ required_error: 'Vui lòng nhập ngày.' }),
  invoiceNumber: z.string().min(1, 'Số hoá đơn không được để trống.'),
  counterpartyName: z.string().min(1, 'Tên đối tác không được để trống.'),
  transactionType: z.enum(['income', 'expense'], { required_error: 'Vui lòng chọn loại giao dịch.' }),
  netAmount: z.coerce.number().min(0, 'Số tiền phải lớn hơn hoặc bằng 0.'),
  vatAmount: z.coerce.number().min(0, 'VAT phải lớn hơn hoặc bằng 0.'),
  totalAmount: z.coerce.number().min(0, 'Tổng cộng phải lớn hơn hoặc bằng 0.'),
  notes: z.string().optional(),
  pdfDataUri: z.string().optional(),
});

const companyInfoSchema = z.object({
  name: z.string().min(1, 'Tên doanh nghiệp không được để trống.'),
  taxId: z.string().min(1, 'Mã số thuế không được để trống.'),
  abbreviation: z.string().min(1, 'Tên viết tắt không được để trống.'),
});

export default function TransactionDashboard() {
  const { toast } = useToast();
  const [companyInfo, setCompanyInfo] = useLocalStorage<CompanyInfo>(COMPANY_INFO_KEY, {
    name: '',
    taxId: '',
    abbreviation: '',
  });
  const [transactions, setTransactions] = useLocalStorage<Transaction[]>(TRANSACTIONS_KEY, []);

  // State
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterType, setFilterType] = React.useState<'all' | 'income' | 'expense'>('all');
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>();
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isCompanyInfoOpen, setIsCompanyInfoOpen] = React.useState(false);
  const [isFormSheetOpen, setIsFormSheetOpen] = React.useState(false);
  const [isReviewSheetOpen, setIsReviewSheetOpen] = React.useState(false);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = React.useState(false);
  const [editingTransaction, setEditingTransaction] = React.useState<Transaction | null>(null);
  const [extractedData, setExtractedData] = React.useState<ExtractedData | null>(null);
  const [validationIssues, setValidationIssues] = React.useState<string[]>([]);
  const [viewingPdf, setViewingPdf] = React.useState<string | undefined>(undefined);
  const [isDragging, setIsDragging] = React.useState(false);

  // Forms
  const companyForm = useForm<z.infer<typeof companyInfoSchema>>({
    resolver: zodResolver(companyInfoSchema),
    values: companyInfo,
  });

  const transactionForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
  });
  const reviewForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
  });

  React.useEffect(() => {
    if (companyInfo && !companyInfo.name && transactions.length === 0) {
      setIsCompanyInfoOpen(true);
    }
  }, [companyInfo, transactions.length]);

  React.useEffect(() => {
    companyForm.reset(companyInfo);
  }, [companyInfo, companyForm]);

  // Derived State
  const filteredTransactions = React.useMemo(() => {
    return transactions
      .filter((t) => {
        const transactionDate = parse(t.date, 'yyyy-MM-dd', new Date());
        if (!isValid(transactionDate)) return false;

        const isInDateRange =
          !dateRange ||
          (!dateRange.from && !dateRange.to) ||
          (dateRange.from && !dateRange.to && transactionDate >= dateRange.from) ||
          (!dateRange.from && dateRange.to && transactionDate <= dateRange.to) ||
          (dateRange.from && dateRange.to && transactionDate >= dateRange.from && transactionDate <= dateRange.to);

        const matchesType = filterType === 'all' || t.transactionType === filterType;
        const matchesSearch =
          searchTerm.trim() === '' ||
          t.counterpartyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          t.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase());

        return isInDateRange && matchesType && matchesSearch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, searchTerm, filterType, dateRange]);

  const summary = React.useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t) => {
        if (t.transactionType === 'income') {
          acc.totalIncome += t.totalAmount;
        } else {
          acc.totalExpense += t.totalAmount;
        }
        return acc;
      },
      { totalIncome: 0, totalExpense: 0 }
    );
  }, [filteredTransactions]);

  // Handlers
  const handleSaveCompanyInfo = (values: z.infer<typeof companyInfoSchema>) => {
    setCompanyInfo(values);
    setIsCompanyInfoOpen(false);
    toast({ title: 'Thành công', description: 'Đã cập nhật thông tin doanh nghiệp.' });
  };

  const handleOpenFormSheet = (transaction: Transaction | null) => {
    setEditingTransaction(transaction);
    if (transaction) {
      const date = parse(transaction.date, 'yyyy-MM-dd', new Date());
      transactionForm.reset({ ...transaction, date: isValid(date) ? date : new Date() });
    } else {
      transactionForm.reset({
        date: new Date(),
        invoiceNumber: '',
        counterpartyName: '',
        netAmount: 0,
        vatAmount: 0,
        totalAmount: 0,
        notes: '',
      });
    }
    setIsFormSheetOpen(true);
  };

  const handleSaveTransaction = (values: z.infer<typeof transactionSchema>) => {
    const newTransaction: Transaction = {
      ...values,
      id: values.id || new Date().toISOString(),
      date: format(values.date, 'yyyy-MM-dd'),
    };
    if (values.id) {
      setTransactions(transactions.map((t) => (t.id === values.id ? newTransaction : t)));
      toast({ title: 'Thành công', description: 'Đã cập nhật giao dịch.' });
    } else {
      setTransactions([newTransaction, ...transactions]);
      toast({ title: 'Thành công', description: 'Đã thêm giao dịch mới.' });
    }
    setIsFormSheetOpen(false);
  };

  const handleProcessFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!companyInfo.name) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng thiết lập thông tin doanh nghiệp trước.' });
      return;
    }
    setIsProcessing(true);
    const file = files[0];
    try {
      const pdfDataUri = await fileToDataUri(file);
      const result = await extractInvoiceAction({ pdfDataUri });

      if (result.success) {
        const aiData = result.data;
        const transactionType = aiData.recipientName.toLowerCase().includes(companyInfo.name.toLowerCase()) ? 'income' : 'expense';
        
        const extracted: ExtractedData = {
          invoiceNumber: aiData.invoiceNumber,
          invoiceDate: aiData.invoiceDate,
          senderName: aiData.senderName,
          recipientName: aiData.recipientName,
          totalAmount: aiData.totalAmount,
          taxAmount: aiData.taxAmount,
          subtotal: aiData.subtotal,
          pdfDataUri: pdfDataUri,
          notes: aiData.notes,
        };
        setExtractedData(extracted);
        
        const validationInput = {
          transactionDate: aiData.invoiceDate,
          invoiceNumber: aiData.invoiceNumber,
          counterpartyName: transactionType === 'income' ? aiData.senderName : aiData.recipientName,
          totalAmount: aiData.totalAmount,
          vatAmount: aiData.taxAmount,
          netAmount: aiData.subtotal,
          transactionType: transactionType,
        }

        const validationResult = await validateTransactionAction(validationInput);

        const date = parse(aiData.invoiceDate, 'yyyy-MM-dd', new Date());

        reviewForm.reset({
          date: isValid(date) ? date : new Date(),
          invoiceNumber: aiData.invoiceNumber,
          counterpartyName: transactionType === 'income' ? aiData.senderName : aiData.recipientName,
          netAmount: aiData.subtotal,
          vatAmount: aiData.taxAmount,
          totalAmount: aiData.totalAmount,
          transactionType: transactionType,
          notes: aiData.notes,
          pdfDataUri: pdfDataUri,
        });

        if (validationResult.success && validationResult.data.hasInconsistencies) {
          setValidationIssues(validationResult.data.inconsistencies);
        } else {
          setValidationIssues([]);
        }
        setIsReviewSheetOpen(true);

      } else {
        toast({ variant: 'destructive', title: 'Lỗi trích xuất', description: result.error });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể xử lý tệp PDF.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmExtraction = (values: z.infer<typeof transactionSchema>) => {
    const newTransaction: Transaction = {
      ...values,
      id: new Date().toISOString(),
      date: format(values.date, 'yyyy-MM-dd'),
    };
    setTransactions([newTransaction, ...transactions]);
    toast({ title: 'Thành công', description: 'Đã lưu giao dịch từ hoá đơn.' });
    setIsReviewSheetOpen(false);
    setExtractedData(null);
    setValidationIssues([]);
  };

  const handleViewPdf = (pdfDataUri: string | undefined) => {
    if (pdfDataUri) {
      setViewingPdf(pdfDataUri);
      setIsPdfViewerOpen(true);
    }
  };

  const handleDragEvents = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      className={cn(
        'relative p-4 sm:p-6 lg:p-8 space-y-6 transition-colors duration-300',
        isDragging && 'bg-primary/10'
      )}
      onDragEnter={handleDragEvents}
      onDragLeave={handleDragEvents}
      onDragOver={handleDragEvents}
      onDrop={(e) => {
        handleDragEvents(e);
        setIsDragging(false);
        handleProcessFiles(e.dataTransfer.files);
      }}
    >
      {/* Drag and Drop Overlay */}
      <div
        className={cn(
          'pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity',
          isDragging ? 'opacity-100' : 'opacity-0'
        )}
      >
        <div className="flex flex-col items-center gap-4 text-center p-8 border-2 border-dashed border-primary rounded-xl">
          <UploadCloud className="w-16 h-16 text-primary" />
          <p className="text-2xl font-semibold text-primary">Thả file PDF hoá đơn vào đây</p>
        </div>
      </div>
      
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Logo />
          <h1 className="text-2xl font-bold text-primary">Nhật Ký Thu Chi</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            id="pdf-upload"
            className="hidden"
            accept="application/pdf"
            onChange={(e) => handleProcessFiles(e.target.files)}
            disabled={isProcessing}
          />
          <Button asChild variant="outline" disabled={isProcessing}>
            <label htmlFor="pdf-upload" className="cursor-pointer">
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Tải lên hoá đơn
            </label>
          </Button>
          <Button onClick={() => handleOpenFormSheet(null)}>
            <Plus className="mr-2 h-4 w-4" /> Thêm thủ công
          </Button>
          <Dialog open={isCompanyInfoOpen} onOpenChange={setIsCompanyInfoOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thông tin doanh nghiệp</DialogTitle>
                <DialogDescription>
                  AI sẽ sử dụng thông tin này để xác định giao dịch Thu/Chi.
                </DialogDescription>
              </DialogHeader>
              <Form {...companyForm}>
                <form onSubmit={companyForm.handleSubmit(handleSaveCompanyInfo)} className="space-y-4">
                  <FormField
                    control={companyForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tên doanh nghiệp</FormLabel>
                        <FormControl>
                          <Input placeholder="Công ty Cổ phần MISA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyForm.control}
                    name="taxId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mã số thuế</FormLabel>
                        <FormControl>
                          <Input placeholder="0101243150" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={companyForm.control}
                    name="abbreviation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tên viết tắt</FormLabel>
                        <FormControl>
                          <Input placeholder="MISA" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit">Lưu thay đổi</Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng thu</CardTitle>
            <span className="text-green-500">▲</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalIncome)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng chi</CardTitle>
            <span className="text-red-500">▼</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalExpense)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chênh lệch</CardTitle>
            <span className="text-muted-foreground">=</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary.totalIncome - summary.totalExpense)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDragOver={(e) => e.preventDefault()}
        className="transition-shadow hover:shadow-lg"
      >
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
            <div className="relative w-full sm:w-auto sm:flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên đối tác, số hoá đơn..."
                className="pl-10 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full sm:w-[240px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                        </>
                      ) : (
                        format(dateRange.from, "dd/MM/yy")
                      )
                    ) : (
                      <span>Chọn khoảng ngày</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={vi}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Filter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="end">
                  <RadioGroup value={filterType} onValueChange={(v) => setFilterType(v as any)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="all" id="all" />
                      <Label htmlFor="all">Tất cả</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="income" id="income" />
                      <Label htmlFor="income">Thu</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="expense" id="expense" />
                      <Label htmlFor="expense">Chi</Label>
                    </div>
                  </RadioGroup>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Ngày</TableHead>
                  <TableHead>Số HĐ</TableHead>
                  <TableHead>Đối tác</TableHead>
                  <TableHead className="text-right">Số tiền</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Tổng cộng</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.length > 0 ? (
                  filteredTransactions.map((t) => (
                    <TableRow
                      key={t.id}
                      className={cn(
                        'cursor-pointer',
                        t.transactionType === 'income' ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-red-400'
                      )}
                      onClick={() => handleOpenFormSheet(t)}
                    >
                      <TableCell>{format(parse(t.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">{t.invoiceNumber}</TableCell>
                      <TableCell>{t.counterpartyName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.netAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.vatAmount)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(t.totalAmount)}</TableCell>
                      <TableCell>
                        {t.pdfDataUri && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewPdf(t.pdfDataUri);
                            }}
                          >
                            <FileText className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      Không có giao dịch nào.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Sheets */}
      <Sheet open={isFormSheetOpen} onOpenChange={setIsFormSheetOpen}>
        <SheetContent className="sm:max-w-lg">
          <Form {...transactionForm}>
            <form onSubmit={transactionForm.handleSubmit(handleSaveTransaction)} className="flex flex-col h-full">
              <SheetHeader>
                <SheetTitle>{editingTransaction ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch thủ công'}</SheetTitle>
                <SheetDescription>
                  {editingTransaction ? 'Cập nhật chi tiết cho giao dịch này.' : 'Điền thông tin cho giao dịch mới.'}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-grow overflow-y-auto p-1 -mx-1 pr-2 mt-4 space-y-4">
                <FormField control={transactionForm.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Ngày giao dịch</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                              {field.value ? format(field.value, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={vi}/>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField control={transactionForm.control} name="invoiceNumber" render={({ field }) => (
                    <FormItem><FormLabel>Số hoá đơn</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                 )}/>
                 <FormField control={transactionForm.control} name="counterpartyName" render={({ field }) => (
                    <FormItem><FormLabel>Tên đối tác</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                 )}/>
                 <FormField control={transactionForm.control} name="transactionType" render={({ field }) => (
                    <FormItem className="space-y-3"><FormLabel>Loại giao dịch</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="income" /></FormControl><FormLabel className="font-normal">Thu</FormLabel></FormItem>
                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="expense" /></FormControl><FormLabel className="font-normal">Chi</FormLabel></FormItem>
                    </RadioGroup></FormControl><FormMessage /></FormItem>
                 )}/>
                 <FormField control={transactionForm.control} name="netAmount" render={({ field }) => (
                    <FormItem><FormLabel>Số tiền (chưa VAT)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                 )}/>
                 <FormField control={transactionForm.control} name="vatAmount" render={({ field }) => (
                    <FormItem><FormLabel>Tiền VAT</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                 )}/>
                 <FormField control={transactionForm.control} name="totalAmount" render={({ field }) => (
                    <FormItem><FormLabel>Tổng cộng (gồm VAT)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                 )}/>
                 <FormField control={transactionForm.control} name="notes" render={({ field }) => (
                    <FormItem><FormLabel>Ghi chú</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                 )}/>
              </div>
              <SheetFooter className="pt-4">
                <SheetClose asChild><Button type="button" variant="outline">Huỷ</Button></SheetClose>
                <Button type="submit">Lưu</Button>
              </SheetFooter>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      <Sheet open={isReviewSheetOpen} onOpenChange={setIsReviewSheetOpen}>
        <SheetContent className="sm:max-w-2xl w-full">
            <Form {...reviewForm}>
            <form onSubmit={reviewForm.handleSubmit(handleConfirmExtraction)} className="flex flex-col h-full">
              <SheetHeader>
                <SheetTitle>Xem lại dữ liệu trích xuất</SheetTitle>
                <SheetDescription>
                  AI đã trích xuất các thông tin sau từ hoá đơn. Vui lòng kiểm tra và chỉnh sửa nếu cần.
                </SheetDescription>
              </SheetHeader>
              {validationIssues.length > 0 && (
                 <Alert variant="destructive" className="mt-4">
                    <AlertTitle>Cảnh báo không nhất quán</AlertTitle>
                    <AlertDescription>
                        <ul className="list-disc pl-5">
                            {validationIssues.map((issue, i) => <li key={i}>{issue}</li>)}
                        </ul>
                    </AlertDescription>
                 </Alert>
              )}
              <div className="flex-grow overflow-y-auto p-1 -mx-1 pr-2 mt-4 space-y-4">
                 {/* Same form fields as transactionForm */}
                 <FormField control={reviewForm.control} name="date" render={({ field }) => (
                    <FormItem className="flex flex-col"><FormLabel>Ngày giao dịch</FormLabel><Popover><PopoverTrigger asChild><FormControl>
                        <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                            {field.value ? format(field.value, "dd/MM/yyyy") : <span>Chọn ngày</span>}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                    </FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus locale={vi}/>
                    </PopoverContent></Popover><FormMessage /></FormItem>
                 )}/>
                 <FormField control={reviewForm.control} name="invoiceNumber" render={({ field }) => (<FormItem><FormLabel>Số hoá đơn</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={reviewForm.control} name="counterpartyName" render={({ field }) => (<FormItem><FormLabel>Tên đối tác</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={reviewForm.control} name="transactionType" render={({ field }) => (<FormItem className="space-y-3"><FormLabel>Loại giao dịch</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="income" /></FormControl><FormLabel className="font-normal">Thu</FormLabel></FormItem>
                    <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="expense" /></FormControl><FormLabel className="font-normal">Chi</FormLabel></FormItem>
                 </RadioGroup></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={reviewForm.control} name="netAmount" render={({ field }) => (<FormItem><FormLabel>Số tiền (chưa VAT)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={reviewForm.control} name="vatAmount" render={({ field }) => (<FormItem><FormLabel>Tiền VAT</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={reviewForm.control} name="totalAmount" render={({ field }) => (<FormItem><FormLabel>Tổng cộng (gồm VAT)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)}/>
                 <FormField control={reviewForm.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Ghi chú</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)}/>
              </div>
              <SheetFooter className="pt-4">
                <SheetClose asChild><Button type="button" variant="outline">Huỷ</Button></SheetClose>
                <Button type="submit">Xác nhận & Lưu</Button>
              </SheetFooter>
            </form>
            </Form>
        </SheetContent>
      </Sheet>

      <Sheet open={isPdfViewerOpen} onOpenChange={setIsPdfViewerOpen}>
        <SheetContent className="w-full sm:max-w-3xl h-full flex flex-col p-0">
          <SheetHeader className="p-6 pb-2">
            <SheetTitle>Tài liệu gốc</SheetTitle>
          </SheetHeader>
          <div className="flex-grow">
            <embed src={viewingPdf} type="application/pdf" width="100%" height="100%" />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
