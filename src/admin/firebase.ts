import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const app = initializeApp({
  projectId: 'hack-key-tech-store-staging',
  appId: '1:356345379707:web:027fa4ca0b73591b111bde',
  storageBucket: 'hack-key-tech-store-staging.firebasestorage.app',
  apiKey: 'AIzaSyCFf6VJkpGefgQ1lgjysL1EfKyOSOkldLA',
  authDomain: 'hack-key-tech-store-staging.firebaseapp.com',
  messagingSenderId: '356345379707'
});

export const adminAuth = getAuth(app);
