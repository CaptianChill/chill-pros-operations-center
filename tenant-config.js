// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc",
  authDomain: "chill-pros-ice-stream.firebaseapp.com",
  projectId: "chill-pros-ice-stream",
  storageBucket: "chill-pros-ice-stream.firebasestorage.app",
  messagingSenderId: "260000821827",
  appId: "1:260000821827:web:b9ace31bc5c1093deedaf6",
  measurementId: "G-V2TJE0RWPR"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
