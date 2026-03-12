import { db, storage } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  where,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { 
  ref, 
  uploadString, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { Transaction } from '@/app/lib/definitions';

const TRANSACTIONS_COLLECTION = 'transactions';

// Firestore does not accept `undefined` values — strip them before saving
function removeUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

export async function saveTransaction(userId: string, transaction: Omit<Transaction, 'id'>, pdfDataUri?: string) {
  let fileUrl = '';
  
  if (pdfDataUri && pdfDataUri.startsWith('data:')) {
    try {
      const fileId = `${Date.now()}_invoice.pdf`;
      const storageRef = ref(storage, `invoices/${userId}/${fileId}`);
      await uploadString(storageRef, pdfDataUri, 'data_url');
      fileUrl = await getDownloadURL(storageRef);
    } catch (storageError) {
      console.warn('Storage upload failed, saving transaction without PDF attachment:', storageError);
      // Continue saving to Firestore even if Storage upload fails
    }
  }

  const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION),
    removeUndefined({
      ...transaction,
      userId,
      pdfUrl: fileUrl,
      pdfDataUri: null, // Don't store huge base64 in Firestore
      createdAt: serverTimestamp(),
    } as Record<string, unknown>)
  );

  return docRef.id;
}

export async function updateTransaction(userId: string, id: string, updates: Partial<Transaction>, pdfDataUri?: string) {
  const docRef = doc(db, TRANSACTIONS_COLLECTION, id);
  
  let pdfUpdate = {};
  if (pdfDataUri && pdfDataUri.startsWith('data:')) {
    const fileId = `${Date.now()}_invoice.pdf`;
    const storageRef = ref(storage, `invoices/${userId}/${fileId}`);
    await uploadString(storageRef, pdfDataUri, 'data_url');
    const fileUrl = await getDownloadURL(storageRef);
    pdfUpdate = { pdfUrl: fileUrl, pdfDataUri: null };
  }

  await updateDoc(docRef,
    removeUndefined({
      ...updates,
      ...pdfUpdate,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>)
  );
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const q = query(collection(db, TRANSACTIONS_COLLECTION), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const transactions = querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      // Map pdfUrl back to pdfDataUri for compatibility or just use pdfUrl in UI
      pdfDataUri: data.pdfUrl || data.pdfDataUri, 
    } as Transaction;
  });

  // Sort by date descending (to avoid requiring a composite index in Firestore)
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return transactions;
}

export async function resetLedger(userId: string) {
  const q = query(collection(db, TRANSACTIONS_COLLECTION), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  
  const deletePromises = querySnapshot.docs.map(async (document) => {
    const data = document.data();
    
    // Delete file from Storage if it exists
    if (data.pdfUrl) {
      try {
        const fileRef = ref(storage, data.pdfUrl);
        await deleteObject(fileRef);
      } catch (e) {
        console.error('Error deleting file:', e);
      }
    }
    
    // Delete document from Firestore
    await deleteDoc(doc(db, TRANSACTIONS_COLLECTION, document.id));
  });

  await Promise.all(deletePromises);
}
