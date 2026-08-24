import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { firebaseConfig } from './firebase_constants';

const app = initializeApp(firebaseConfig);

let messagingPromise: Promise<Messaging | null> | null = null;

export const getFirebaseMessaging = () => {
  if (typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  if (!messagingPromise) {
    messagingPromise = isSupported()
      .then((supported) => supported ? getMessaging(app) : null)
      .catch((error) => {
        console.warn('Firebase Messaging não está disponível neste navegador:', error);
        return null;
      });
  }

  return messagingPromise;
};

export default app;
