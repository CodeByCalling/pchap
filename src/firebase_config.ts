import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyC4TWqTO-CRvuWerNWZW-cn7sHlt48YCe0",
  authDomain: "jrm-member-dng-portal.firebaseapp.com",
  projectId: "jrm-member-dng-portal",
  storageBucket: "jrm-member-dng-portal.firebasestorage.app",
  messagingSenderId: "219102672112",
  appId: "1:219102672112:web:33c85b2eb84c308b2b3e35",
  measurementId: "G-6ZTHH59X3L"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
import { getFunctions } from 'firebase/functions';
export const functions = getFunctions(app);

