const firebaseConfig = {
  apiKey: "AIzaSyBsBEKMggwSUVEmdTTK1rjYOcdPyYCCL0c",
  authDomain: "chill-pros-ice-stream.firebaseapp.com",
  projectId: "chill-pros-ice-stream",
  storageBucket: "chill-pros-ice-stream.appspot.com",
  messagingSenderId: "260000821827",
  appId: "1:260000821827:web:b9ace31bc5c1093deedaf6",
  measurementId: "G-V2TJE0RWPR"
};

firebase.initializeApp(firebaseConfig);

const firestoreDb = firebase.firestore();

window.chillProsDb = firestoreDb;
