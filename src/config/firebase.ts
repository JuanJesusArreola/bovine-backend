// config/firebase.ts
import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { env } from './env';

// Inicializar Firebase Admin SDK
let firebaseApp: admin.app.App | undefined;

try {
  if (!admin.apps.length) {
    const serviceAccountJson = env('FIREBASE_SERVICE_ACCOUNT_JSON');
    const credentialsPath = env('GOOGLE_APPLICATION_CREDENTIALS');
    const localServiceAccountPath = path.resolve(__dirname, '../../service-account.json');

    if (serviceAccountJson) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(serviceAccountJson)),
      });
    } else if (credentialsPath) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(require(path.resolve(credentialsPath))),
      });
    } else if (fs.existsSync(localServiceAccountPath)) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(require(localServiceAccountPath)),
      });
    } else {
      logger.warn(
        'Firebase Admin SDK no inicializado: falta FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS',
        'FirebaseConfig',
      );
    }
  } else {
    firebaseApp = admin.app();
  }

  if (firebaseApp) {
    logger.info('Firebase Admin SDK inicializado correctamente', 'FirebaseConfig');
  }
} catch (error) {
  logger.error('Error inicializando Firebase Admin SDK', 'FirebaseConfig', {}, error as Error);
}

// Exportar servicios
export const messaging = firebaseApp ? admin.messaging(firebaseApp) : undefined;
export const auth = firebaseApp ? admin.auth(firebaseApp) : undefined;
export const firestore = firebaseApp ? admin.firestore(firebaseApp) : undefined;

export default admin;
