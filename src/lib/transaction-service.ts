import { db, storage } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  query, 
  orderBy,
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

export async function saveTransaction(transaction: Omit<Transaction, 'id'>, pdfDataUri?: string) {
  let fileUrl = '';
  
  if (pdfDataUri && pdfDataUri.startsWith('data:')) {
    const fileId = `${Date.now()}_invoice.pdf`;
    const storageRef = ref(storage, `invoices/${fileId}`);
    
    // Upload the data URI to Firebase Storage
    await uploadString(storageRef, pdfDataUri, 'data_url');
    fileUrl = await getDownloadURL(storageRef);
  }

  const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), {
    ...transaction,
    pdfUrl: fileUrl,
    pdfDataUri: null, // Don't store huge base64 in Firestore
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function updateTransaction(id: string, updates: Partial<Transaction>, pdfDataUri?: string) {
  const docRef = doc(db, TRANSACTIONS_COLLECTION, id);
  
  let pdfUpdate = {};
  if (pdfDataUri && pdfDataUri.startsWith('data:')) {
    const fileId = `${Date.now()}_invoice.pdf`;
    const storageRef = ref(storage, `invoices/${fileId}`);
    await uploadString(storageRef, pdfDataUri, 'data_url');
    const fileUrl = await getDownloadURL(storageRef);
    pdfUpdate = { pdfUrl: fileUrl, pdfDataUri: null };
  }

  await updateDoc(docRef, {
    ...updates,
    ...pdfUpdate,
    updatedAt: serverTimestamp(),
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  const q = query(collection(db, TRANSACTIONS_COLLECTION), orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);
  
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      // Map pdfUrl back to pdfDataUri for compatibility or just use pdfUrl in UI
      pdfDataUri: data.pdfUrl || data.pdfDataUri, 
    } as Transaction;
  });
}

export async function resetLedger() {
  const querySnapshot = await getDocs(collection(db, TRANSACTIONS_COLLECTION));
  
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
