import { getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase web config is not a secret — it identifies the project to
// Google's client SDKs. Access is enforced by Firestore security rules
// and by Cloud Functions verifying the caller's ID token server-side.
const firebaseConfig: FirebaseOptions = {
  apiKey: "AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc",
  authDomain: "chill-pros-ice-stream.firebaseapp.com",
  projectId: "chill-pros-ice-stream",
  storageBucket: "chill-pros-ice-stream.firebasestorage.app",
  messagingSenderId: "260000821827",
  appId: "1:260000821827:web:4d65bb9f17a29001eedaf6",
  measurementId: "G-R0T9MTVV1V",
};

export const firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
