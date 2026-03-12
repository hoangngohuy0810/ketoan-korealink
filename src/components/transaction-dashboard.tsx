'use client';

import * as React from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Banknote,
  Calendar as CalendarIcon,
  FileText,
  FileUp,
  Filter,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Search,
  Settings,
  Trash2,
  UploadCloud,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useLocalStorage } from '@/hooks/use-local-storage';
import type { CompanyInfo, ExtractedData, ExtractedStatementData, Transaction } from '@/app/lib/definitions';
import { format, isValid, parse } from 'date-fns';
import { vi } from 'date-fns/locale';
import { type DateRange } from 'react-day-picker';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { extractInvoiceAction, reconcileStatementAction, validateTransactionAction } from '@/app/actions';
import { Logo } from '@/components/icons';
import { 
  getTransactions, 
  saveTransaction, 
  updateTransaction, 
  resetLedger 
} from '@/lib/transaction-service';
import { auth, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn, fileToDataUri, formatCurrency } from '@/lib/utils';

const FIXED_COMPANY_INFO: CompanyInfo = {
  name: 'CÔNG TY CỔ PHẦN KẾT NỐI TRI THỨC TRẺ',
  taxId: '2901970328',
  abbreviation: 'TRI THỨC TRẺ',
  openingBalance: 0,
  openingBalanceDate: '2024-01-01',
};
const ADDRESS_TAX = 'Số B12-15, đường số 5, khu đô thị TECCO Nghi Phú, Phường Vinh Phú, Tỉnh Nghệ An, Việt Nam';

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
  openingBalance: z.coerce.number().default(0),
  openingBalanceDate: z.date({ required_error: 'Vui lòng nhập ngày.' }),
});

type SortableColumn = 'date' | 'invoiceNumber' | 'counterpartyName' | 'netAmount' | 'vatAmount' | 'totalAmount';

export default function TransactionDashboard() {
  const { toast } = useToast();
  const [companyInfo, setCompanyInfo] = React.useState<CompanyInfo>(FIXED_COMPANY_INFO);
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [user, setUser] = React.useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = React.useState(true);

  // State
  const [isClient, setIsClient] = React.useState(false);
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
  const [fileQueue, setFileQueue] = React.useState<File[]>([]);
  
  // New state for reconciliation
  const [isReconDialogOpen, setIsReconDialogOpen] = React.useState(false);
  const [isReconciling, setIsReconciling] = React.useState(false);
  const [reconFile, setReconFile] = React.useState<File | null>(null);
  const [reconError, setReconError] = React.useState<string | null>(null);
  const [reconResult, setReconResult] = React.useState<{
    statement: ExtractedStatementData;
    ledgerChange: number;
    discrepancy: number;
  } | null>(null);

  // Sorting state
  const [sortConfig, setSortConfig] = React.useState<{ key: SortableColumn; direction: 'ascending' | 'descending' }>({
    key: 'date',
    direction: 'descending',
  });


  // Forms
  const companyForm = useForm<z.infer<typeof companyInfoSchema>>({
    resolver: zodResolver(companyInfoSchema),
    defaultValues: {
      ...companyInfo,
      openingBalanceDate: companyInfo.openingBalanceDate ? parse(companyInfo.openingBalanceDate, 'yyyy-MM-dd', new Date()) : new Date(),
    }
  });

  const transactionForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
  });
  const reviewForm = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
  });

  React.useEffect(() => {
    setIsClient(true);
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);
  
  React.useEffect(() => {
    async function loadData() {
      if (!user) return;
      try {
        const data = await getTransactions(user.uid);
        setTransactions(data);
      } catch (error) {
        console.error('Error loading transactions:', error);
        toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể tải dữ liệu từ server.' });
      } finally {
        setLoading(false);
      }
    }
    if (isClient && user) {
      loadData();
    }
  }, [isClient, user, toast]);

  React.useEffect(() => {
    if (isClient) {
        const initialDate = companyInfo.openingBalanceDate ? parse(companyInfo.openingBalanceDate, 'yyyy-MM-dd', new Date()) : new Date();
        companyForm.reset({
            ...companyInfo,
            openingBalanceDate: isValid(initialDate) ? initialDate : new Date(),
        });
    }
  }, [isClient, companyInfo, companyForm]);

  React.useEffect(() => {
    if (fileQueue.length > 0 && !isProcessing && !isReviewSheetOpen && !isFormSheetOpen) {
      const fileToProcess = fileQueue[0];

      const processNextFile = async () => {
        if (!companyInfo.name) {
          toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng thiết lập thông tin doanh nghiệp trước.' });
          setFileQueue([]); // Clear queue on config error
          return;
        }

        setIsProcessing(true);
        try {
          const pdfDataUri = await fileToDataUri(fileToProcess);
          const result = await extractInvoiceAction({ pdfDataUri });

          if (result.success) {
            const aiData = result.data;
            const transactionType = aiData.recipientName.toLowerCase().includes(companyInfo.name.toLowerCase()) ? 'income' : 'expense';

            const extracted: ExtractedData = {
              ...aiData,
              pdfDataUri: pdfDataUri,
            };
            setExtractedData(extracted);

            const validationInput = {
              transactionDate: aiData.invoiceDate,
              invoiceNumber: aiData.invoiceNumber,
              counterpartyName: transactionType === 'income' ? aiData.senderName : aiData.recipientName,
              totalAmount: aiData.totalAmount,
              vatAmount: aiData.taxAmount,
              netAmount: aiData.subtotal,
              transactionType: transactionType as 'income' | 'expense',
            };

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
            toast({ variant: 'destructive', title: `Lỗi xử lý ${fileToProcess.name}`, description: result.error });
          }
        } catch (error) {
          toast({ variant: 'destructive', title: `Lỗi xử lý ${fileToProcess.name}`, description: 'Không thể xử lý tệp PDF.' });
        } finally {
          setIsProcessing(false);
        }
      };

      setFileQueue(q => q.slice(1));
      processNextFile();
    }
  }, [fileQueue, isProcessing, isReviewSheetOpen, isFormSheetOpen, companyInfo.name, reviewForm, toast]);
  
  // New useEffect to handle reconciliation file processing
  React.useEffect(() => {
    if (!reconFile) return;

    const processReconFile = async () => {
      setIsReconciling(true);
      setReconError(null);
      setReconResult(null);

      try {
        const fileDataUri = await fileToDataUri(reconFile);
        const result = await reconcileStatementAction({ fileDataUri });

        if (result.success) {
          const statementData = result.data;
          
          const statementStartDate = parse(statementData.startDate, 'yyyy-MM-dd', new Date());
          const statementEndDate = parse(statementData.endDate, 'yyyy-MM-dd', new Date());

          if (!isValid(statementStartDate) || !isValid(statementEndDate)) {
              throw new Error('AI trả về ngày không hợp lệ từ sao kê.');
          }

          const ledgerChange = transactions
            .filter(t => {
                const transDate = parse(t.date, 'yyyy-MM-dd', new Date());
                return isValid(transDate) && transDate >= statementStartDate && transDate <= statementEndDate;
            })
            .reduce((acc, t) => {
                return t.transactionType === 'income' ? acc + t.totalAmount : acc - t.totalAmount;
            }, 0);
          
          const statementChange = statementData.closingBalance - statementData.openingBalance;
          const discrepancy = statementChange - ledgerChange;

          setReconResult({
            statement: statementData,
            ledgerChange,
            discrepancy,
          });

        } else {
          setReconError(result.error);
        }
      } catch (error) {
        setReconError(error instanceof Error ? error.message : 'Đã có lỗi xảy ra khi đối soát.');
      } finally {
        setIsReconciling(false);
        setReconFile(null); // Reset file after processing
      }
    };

    processReconFile();
  }, [reconFile, transactions]);

  // Derived State
  const filteredTransactions = React.useMemo(() => {
    if (!isClient) return [];
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
      });
  }, [isClient, transactions, searchTerm, filterType, dateRange]);
  
  const sortedTransactions = React.useMemo(() => {
    const sortableItems = [...filteredTransactions];
    if (sortConfig) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        let comparison = 0;
        if (sortConfig.key === 'date') {
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [filteredTransactions, sortConfig]);

  const periodSummary = React.useMemo(() => {
    if (!isClient) return { totalIncome: 0, totalExpense: 0 };
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
  }, [isClient, filteredTransactions]);

  const currentBalance = React.useMemo(() => {
    if (!isClient) return 0;
    const openingBalanceDate = companyInfo.openingBalanceDate ? parse(companyInfo.openingBalanceDate, 'yyyy-MM-dd', new Date()) : new Date(0);
    const netChange = transactions
      .filter(t => {
        const tDate = parse(t.date, 'yyyy-MM-dd', new Date());
        return isValid(tDate) && tDate >= openingBalanceDate;
      })
      .reduce((acc, t) => acc + (t.transactionType === 'income' ? t.totalAmount : -t.totalAmount), 0);
    return (companyInfo.openingBalance || 0) + netChange;
  }, [isClient, transactions, companyInfo]);

  // Handlers
  const requestSort = (key: SortableColumn) => {
    let newDirection: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key) {
        newDirection = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    }
    setSortConfig({ key, direction: newDirection });
  };
  
  const handleSaveCompanyInfo = (values: z.infer<typeof companyInfoSchema>) => {
    const newInfo = {
      ...values,
      openingBalanceDate: format(values.openingBalanceDate, 'yyyy-MM-dd'),
    };
    setCompanyInfo(newInfo);
    setIsCompanyInfoOpen(false);
    toast({ title: 'Thành công', description: 'Đã cập nhật thông tin doanh nghiệp.' });
  };

  const handleResetLedger = async () => {
    if (!user) return;
    setIsProcessing(true);
    try {
      await resetLedger(user.uid);
      setTransactions([]);
      toast({ title: 'Hoàn tất', description: 'Toàn bộ sổ sách và hóa đơn đã được xóa khỏi hệ thống.' });
      setIsCompanyInfoOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể reset sổ sách.' });
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast({ title: 'Thành công', description: 'Đăng nhập thành công.' });
    } catch (error) {
      console.error('Login error:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể đăng nhập.' });
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast({ title: 'Thành công', description: 'Đã đăng xuất.' });
    } catch (error) {
      console.error('Logout error:', error);
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể đăng xuất.' });
    }
  };

  const onReconDialogOpenChange = (open: boolean) => {
    if (!open) {
        setReconFile(null);
        setReconResult(null);
        setReconError(null);
    }
    setIsReconDialogOpen(open);
  }

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
        transactionType: 'expense',
      });
    }
    setIsFormSheetOpen(true);
  };

  const handleSaveTransaction = async (values: z.infer<typeof transactionSchema>) => {
    const isEditing = !!values.id;
    setIsProcessing(true);

    try {
      if (isEditing) {
          const originalTransaction = transactions.find(t => t.id === values.id);
          const updates = {
            ...values,
            date: format(values.date, 'yyyy-MM-dd'),
          };
          await updateTransaction(values.id!, updates, values.pdfDataUri);
          
          // Refresh local state
          const updatedData = await getTransactions(user!.uid);
          setTransactions(updatedData);
          toast({ title: 'Thành công', description: 'Đã cập nhật giao dịch.' });
      } else {
          const newTransaction: Omit<Transaction, 'id'> = {
            date: format(values.date, 'yyyy-MM-dd'),
            invoiceNumber: values.invoiceNumber,
            counterpartyName: values.counterpartyName,
            transactionType: values.transactionType,
            netAmount: values.netAmount,
            vatAmount: values.vatAmount,
            totalAmount: values.totalAmount,
            notes: values.notes,
            items: [],
            currency: 'VND',
          };
          await saveTransaction(user!.uid, newTransaction, values.pdfDataUri);
          const updatedData = await getTransactions(user!.uid);
          setTransactions(updatedData);
          toast({ title: 'Thành công', description: 'Đã thêm giao dịch mới.' });
      }
      setIsFormSheetOpen(false);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không thể lưu giao dịch.' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProcessFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFileQueue(q => [...q, ...Array.from(files)]);
  };

  const handleConfirmExtraction = async (values: z.infer<typeof transactionSchema>) => {
    if (!extractedData) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Không tìm thấy dữ liệu đã trích xuất.' });
      return;
    }
    
    setIsProcessing(true);
    try {
      const { subtotal, ...restOfExtractedData } = extractedData;

      const newTransaction: Omit<Transaction, 'id'> = {
        ...restOfExtractedData,
        ...values,
        date: format(values.date, "yyyy-MM-dd"),
        netAmount: values.netAmount,
        items: extractedData.items,
        currency: extractedData.currency,
        senderName: extractedData.senderName,
        recipientName: extractedData.recipientName,
      };
      
      await saveTransaction(user!.uid, newTransaction, values.pdfDataUri);
      const updatedData = await getTransactions(user!.uid);
      setTransactions(updatedData);
      
      toast({ title: 'Thành công', description: 'Đã lưu giao dịch từ hoá đơn.' });
      setIsReviewSheetOpen(false);
      setExtractedData(null);
      setValidationIssues([]);
    } catch (error) {
      console.error('handleConfirmExtraction error:', error);
      const msg = error instanceof Error ? error.message : 'Lỗi không xác định';
      toast({ variant: 'destructive', title: 'Lỗi lưu giao dịch', description: msg });
    } finally {
      setIsProcessing(false);
    }
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

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50/50 p-4">
        <div className="w-full max-w-md space-y-8 text-center bg-white p-8 rounded-2xl shadow-xl">
          <div className="flex flex-col items-center gap-3">
            <Logo />
            <h1 className="text-3xl font-bold tracking-tight text-primary">Nhật Ký Thu Chi</h1>
            <p className="text-muted-foreground">Quản lý tài chính doanh nghiệp thông minh với AI</p>
          </div>
          <div className="py-6 border-t border-b border-gray-100">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Đăng nhập để tiếp tục</h2>
            <Button size="lg" className="w-full h-12 text-base shadow-md hover:shadow-lg transition-transform hover:-translate-y-0.5" onClick={handleLogin}>
              <LogIn className="mr-2 h-5 w-5" /> Đăng nhập bằng Google
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={isReconDialogOpen} onOpenChange={onReconDialogOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Banknote className="mr-2 h-4 w-4" /> Đối soát sao kê
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Đối soát sao kê ngân hàng</DialogTitle>
                <DialogDescription>
                  Tải lên tệp sao kê của bạn (PDF, ảnh, CSV,...). AI sẽ phân tích và đối chiếu với sổ sách.
                </DialogDescription>
              </DialogHeader>
              {!reconResult && (
                <div className="py-8 flex flex-col items-center justify-center gap-4 text-center border-2 border-dashed rounded-lg">
                  {isReconciling ? (
                    <>
                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                      <p className="font-semibold">AI đang phân tích sao kê...</p>
                      <p className="text-sm text-muted-foreground">Quá trình này có thể mất một vài phút.</p>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-12 w-12 text-muted-foreground" />
                      <Label htmlFor="recon-file-upload" className={cn(buttonVariants(), 'cursor-pointer')}>
                        Chọn tệp sao kê
                      </Label>
                      <input id="recon-file-upload" type="file" className="hidden" onChange={(e) => e.target.files && setReconFile(e.target.files[0])} />
                      <p className="text-xs text-muted-foreground">Hỗ trợ PDF, PNG, JPG, CSV</p>
                      {reconError && (
                         <Alert variant="destructive" className="mt-4 text-left">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Lỗi</AlertTitle>
                            <AlertDescription>
                                {reconError}
                            </AlertDescription>
                         </Alert>
                      )}
                    </>
                  )}
                </div>
              )}
              {reconResult && (
                <div className="space-y-4">
                   <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Kết quả đối soát</h3>
                    <Badge variant={reconResult.statement.confidenceScore > 0.8 ? 'default' : 'destructive'} className="bg-green-100 text-green-800">
                      Độ tin cậy: {Math.round(reconResult.statement.confidenceScore * 100)}%
                    </Badge>
                   </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-base">Thông tin từ sao kê</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                        <p>Kỳ: {format(parse(reconResult.statement.startDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yy')} - {format(parse(reconResult.statement.endDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yy')}</p>
                        <p>Số dư đầu: {formatCurrency(reconResult.statement.openingBalance, reconResult.statement.currency)}</p>
                        <p>Số dư cuối: {formatCurrency(reconResult.statement.closingBalance, reconResult.statement.currency)}</p>
                        <p className="font-medium">Biến động: {formatCurrency(reconResult.statement.closingBalance - reconResult.statement.openingBalance, reconResult.statement.currency)}</p>
                      </CardContent>
                    </Card>
                     <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-base">Thông tin từ sổ sách</CardTitle></CardHeader>
                      <CardContent className="space-y-1">
                         <p>Kỳ: {format(parse(reconResult.statement.startDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yy')} - {format(parse(reconResult.statement.endDate, 'yyyy-MM-dd', new Date()), 'dd/MM/yy')}</p>
                        <p>Biến động ròng trong kỳ:</p>
                        <p className="font-medium">{formatCurrency(reconResult.ledgerChange, reconResult.statement.currency)}</p>
                      </CardContent>
                    </Card>
                  </div>
                  <Alert variant={reconResult.discrepancy === 0 ? 'default' : 'destructive'} className={reconResult.discrepancy === 0 ? 'bg-green-50 border-green-200' : ''}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>
                      {reconResult.discrepancy === 0 ? 'Số liệu khớp!' : 'Phát hiện chênh lệch!'}
                    </AlertTitle>
                    <AlertDescription>
                      {reconResult.discrepancy === 0 
                        ? 'Biến động trên sao kê khớp với biến động trên sổ sách của bạn.'
                        : `Chênh lệch: ${formatCurrency(reconResult.discrepancy, reconResult.statement.currency)}.`}
                    </AlertDescription>
                  </Alert>
                   <DialogFooter>
                      <Button variant="outline" onClick={() => { setReconResult(null); setReconError(null); }}>Đối soát file khác</Button>
                   </DialogFooter>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <input
            type="file"
            id="pdf-upload"
            className="hidden"
            accept="application/pdf"
            onChange={(e) => handleProcessFiles(e.target.files)}
            disabled={isProcessing}
            multiple
          />
          <Button asChild variant="outline" disabled={isProcessing}>
            <label htmlFor="pdf-upload" className="cursor-pointer">
              {isProcessing && fileQueue.length === 0 ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="mr-2 h-4 w-4" />
              )}
              Tải lên hoá đơn {fileQueue.length > 0 && `(${fileQueue.length} đang chờ)`}
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
            <DialogContent className="flex flex-col max-h-[90vh] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Thông tin doanh nghiệp & Số dư đầu kỳ</DialogTitle>
                <DialogDescription>
                  Cung cấp thông tin để AI và hệ thống hoạt động chính xác.
                </DialogDescription>
              </DialogHeader>
              <Form {...companyForm}>
                <form onSubmit={companyForm.handleSubmit(handleSaveCompanyInfo)} className="flex flex-col min-h-0 flex-1">
                  {/* Scrollable content area */}
                  <div className="overflow-y-auto flex-1 pr-1 space-y-4">
                    <FormField control={companyForm.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Tên doanh nghiệp</FormLabel><FormControl><Input placeholder="Công ty Cổ phần MISA" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={companyForm.control} name="taxId" render={({ field }) => (
                        <FormItem><FormLabel>Mã số thuế</FormLabel><FormControl><Input placeholder="0101243150" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={companyForm.control} name="abbreviation" render={({ field }) => (
                        <FormItem><FormLabel>Tên viết tắt</FormLabel><FormControl><Input placeholder="MISA" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={companyForm.control} name="openingBalance" render={({ field }) => (
                        <FormItem><FormLabel>Số dư đầu kỳ</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                    )}/>
                    <FormField control={companyForm.control} name="openingBalanceDate" render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Ngày của số dư đầu kỳ</FormLabel>
                        <FormControl>
                          <div className="flex items-center gap-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                            <CalendarIcon className="h-4 w-4 opacity-50 shrink-0" />
                            <span className="flex-1">
                              {field.value ? format(field.value, "dd/MM/yyyy") : <span className="text-muted-foreground">Chưa chọn ngày</span>}
                            </span>
                          </div>
                        </FormControl>
                        <div className="rounded-md border">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => field.onChange(date)}
                            locale={vi}
                            className="w-full"
                          />
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  </div>
                  {/* Fixed footer inside form */}
                  <div className="pt-4 border-t mt-4 shrink-0">
                    <Button type="submit" className="w-full">Lưu thay đổi</Button>
                  </div>
                </form>
              </Form>
              {/* Reset section - fixed at bottom */}
              <div className="border-t pt-4 shrink-0">
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full">
                            <Trash2 className="mr-2 h-4 w-4" /> Reset sổ sách
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Bạn có chắc chắn không?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Hành động này sẽ xóa vĩnh viễn tất cả các giao dịch đã ghi.
                                Thông tin doanh nghiệp sẽ được giữ lại. Bạn không thể hoàn tác hành động này.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Huỷ</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetLedger}>Tiếp tục</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
            </DialogContent>
          </Dialog>
          {user ? (
            <div className="flex items-center gap-2 pl-4 border-l">
              <div className="flex items-center gap-2">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-border" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-border">
                    <UserIcon className="w-4 h-4 text-primary" />
                  </div>
                )}
                <span className="text-sm font-medium hidden sm:inline-block max-w-[120px] truncate">{user.displayName || user.email}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleLogout} title="Đăng xuất">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button variant="default" className="ml-2" onClick={handleLogin}>
              <LogIn className="mr-2 h-4 w-4" /> Đăng nhập
            </Button>
          )}
        </div>
      </header>
      
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng thu (trong kỳ)</CardTitle>
            <span className="text-green-500">▲</span>
          </CardHeader>
          <CardContent>
            {isClient ? (
              <div className="text-2xl font-bold">{formatCurrency(periodSummary.totalIncome)}</div>
            ) : (
              <Skeleton className="h-8 w-3/4" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng chi (trong kỳ)</CardTitle>
            <span className="text-red-500">▼</span>
          </CardHeader>
          <CardContent>
            {isClient ? (
              <div className="text-2xl font-bold">{formatCurrency(periodSummary.totalExpense)}</div>
            ) : (
              <Skeleton className="h-8 w-3/4" />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Số dư hiện tại</CardTitle>
            <span className="text-muted-foreground">=</span>
          </CardHeader>
          <CardContent>
            {isClient ? (
              <div className="text-2xl font-bold">{formatCurrency(currentBalance)}</div>
            ) : (
              <Skeleton className="h-8 w-3/4" />
            )}
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
                    id="date"
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
                    showOutsideDays={false}
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
                  <TableHead className="w-[120px] p-0">
                    <Button variant="ghost" className="w-full justify-start px-4 font-medium" onClick={() => requestSort('date')}>
                      Ngày
                      {sortConfig.key === 'date' ? (sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-start px-4 font-medium" onClick={() => requestSort('invoiceNumber')}>
                      Số HĐ
                      {sortConfig.key === 'invoiceNumber' ? (sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                     <Button variant="ghost" className="w-full justify-start px-4 font-medium" onClick={() => requestSort('counterpartyName')}>
                      Đối tác
                      {sortConfig.key === 'counterpartyName' ? (sortConfig.direction === 'ascending' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />) : <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />}
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-end px-4 font-medium" onClick={() => requestSort('netAmount')}>
                      {sortConfig.key === 'netAmount' ? (sortConfig.direction === 'ascending' ? <ArrowUp className="mr-2 h-4 w-4" /> : <ArrowDown className="mr-2 h-4 w-4" />) : <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />}
                      Số tiền
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                     <Button variant="ghost" className="w-full justify-end px-4 font-medium" onClick={() => requestSort('vatAmount')}>
                      {sortConfig.key === 'vatAmount' ? (sortConfig.direction === 'ascending' ? <ArrowUp className="mr-2 h-4 w-4" /> : <ArrowDown className="mr-2 h-4 w-4" />) : <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />}
                      VAT
                    </Button>
                  </TableHead>
                  <TableHead className="p-0">
                    <Button variant="ghost" className="w-full justify-end px-4 font-medium" onClick={() => requestSort('totalAmount')}>
                      {sortConfig.key === 'totalAmount' ? (sortConfig.direction === 'ascending' ? <ArrowUp className="mr-2 h-4 w-4" /> : <ArrowDown className="mr-2 h-4 w-4" />) : <ArrowUpDown className="mr-2 h-4 w-4 opacity-50" />}
                      Tổng cộng
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!isClient ? (
                   Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i} className="pointer-events-none">
                      <TableCell><Skeleton className="h-4 w-[70px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full max-w-[200px]" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-[80px] ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sortedTransactions.length > 0 ? (
                  sortedTransactions.map((t) => (
                    <TableRow
                      key={t.id}
                      className={cn(
                        'cursor-pointer',
                        t.transactionType === 'income' ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-red-400'
                      )}
                      onClick={() => handleOpenFormSheet(t)}
                    >
                      <TableCell>{format(parse(t.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center justify-between">
                           <span>{t.invoiceNumber}</span>
                           {t.pdfDataUri && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewPdf(t.pdfDataUri);
                              }}
                            >
                              <FileText className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{t.counterpartyName}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.netAmount)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.vatAmount)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(t.totalAmount)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
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
        <SheetContent className="sm:max-w-2xl w-full">
          <Form {...transactionForm}>
            <form onSubmit={transactionForm.handleSubmit(handleSaveTransaction)} className="flex flex-col h-full">
              <SheetHeader>
                <SheetTitle>{editingTransaction ? 'Chỉnh sửa giao dịch' : 'Thêm giao dịch thủ công'}</SheetTitle>
                <SheetDescription>
                  {editingTransaction ? 'Cập nhật và xem chi tiết giao dịch này.' : 'Điền thông tin cho giao dịch mới.'}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-grow overflow-y-auto p-1 -mx-1 pr-4 mt-4 space-y-4">
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

                {editingTransaction && editingTransaction.pdfDataUri && (
                  <Accordion type="single" collapsible className="w-full pt-4 border-t">
                    <AccordionItem value="invoice-details">
                      <AccordionTrigger className="text-base font-semibold">
                        Xem chi tiết hoá đơn gốc
                      </AccordionTrigger>
                      <AccordionContent className="space-y-6 pt-4 text-sm">
                        {/* Invoice Header Details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div><p className="font-medium">Ký hiệu HĐ</p><p className="text-muted-foreground">{editingTransaction.invoiceSymbol || 'N/A'}</p></div>
                          <div><p className="font-medium">Mẫu số HĐ</p><p className="text-muted-foreground">{editingTransaction.invoiceForm || 'N/A'}</p></div>
                          <div><p className="font-medium">Mã tra cứu</p><p className="text-muted-foreground break-all">{editingTransaction.invoiceLookupCode || 'N/A'}</p></div>
                        </div>

                        {/* Sender and Recipient */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <h4 className="font-semibold">Bên bán</h4>
                            <p className="font-medium">{editingTransaction.senderName}</p>
                            <p><span className="text-muted-foreground">MST:</span> {editingTransaction.senderTaxId}</p>
                            <p><span className="text-muted-foreground">Địa chỉ:</span> {editingTransaction.senderAddress}</p>
                            {editingTransaction.senderAccountNumber && <p><span className="text-muted-foreground">STK:</span> {editingTransaction.senderAccountNumber}</p>}
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold">Bên mua</h4>
                            <p className="font-medium">{editingTransaction.recipientName}</p>
                            {editingTransaction.recipientTaxId && <p><span className="text-muted-foreground">MST:</span> {editingTransaction.recipientTaxId}</p>}
                            <p><span className="text-muted-foreground">Địa chỉ:</span> {editingTransaction.recipientAddress}</p>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div>
                          <h4 className="font-semibold mb-2">Hàng hoá, dịch vụ</h4>
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="p-2">#</TableHead>
                                  <TableHead className="p-2">Tên</TableHead>
                                  <TableHead className="text-right p-2">SL</TableHead>
                                  <TableHead className="text-right p-2">Đơn giá</TableHead>
                                  <TableHead className="text-right p-2">Thành tiền</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {editingTransaction.items && editingTransaction.items.length > 0 ? (
                                  editingTransaction.items.map((item, index) => (
                                    <TableRow key={index}>
                                      <TableCell className="p-2">{index + 1}</TableCell>
                                      <TableCell className="p-2">{item.description}</TableCell>
                                      <TableCell className="text-right p-2">{item.quantity}</TableCell>
                                      <TableCell className="text-right p-2">{formatCurrency(item.unitPrice, editingTransaction.currency)}</TableCell>
                                      <TableCell className="text-right p-2">{formatCurrency(item.lineTotal, editingTransaction.currency)}</TableCell>
                                    </TableRow>
                                  ))
                                ) : (
                                  <TableRow><TableCell colSpan={5} className="text-center p-4">Không có chi tiết hàng hoá.</TableCell></TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                        
                        {/* Totals */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p><span className="font-medium">HT thanh toán:</span> {editingTransaction.paymentMethod || 'N/A'}</p>
                                {editingTransaction.totalAmountInWords && <p><span className="font-medium">Bằng chữ:</span> {editingTransaction.totalAmountInWords}</p>}
                            </div>
                            <div className="space-y-1 text-right">
                                <p>Cộng tiền hàng: <span className="font-semibold">{formatCurrency(editingTransaction.netAmount, editingTransaction.currency)}</span></p>
                                <p>Thuế GTGT ({editingTransaction.vatRate || 'N/A'}): <span className="font-semibold">{formatCurrency(editingTransaction.vatAmount, editingTransaction.currency)}</span></p>
                                <p className="text-base font-bold">Tổng thanh toán: <span className="font-semibold">{formatCurrency(editingTransaction.totalAmount, editingTransaction.currency)}</span></p>
                            </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                )}
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
