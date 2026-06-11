// config/firebase.ts
import * as admin from 'firebase-admin';
import logger from '../utils/logger';

// Inicializar Firebase Admin SDK
let firebaseApp: admin.app.App;

try {
    
   firebaseApp = admin.initializeApp({
     credential: admin.credential.cert(require('../../service-account.json'))
  });

  logger.info('Firebase Admin SDK inicializado correctamente', 'FirebaseConfig');
} catch (error) {
  logger.error('Error inicializando Firebase Admin SDK', 'FirebaseConfig', {}, error as Error);
  throw error;
}

// Exportar servicios
export const messaging = admin.messaging();
export const auth = admin.auth();
export const firestore = admin.firestore();

export default admin;