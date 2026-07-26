const firebaseConfig = {
  apiKey: "AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc",
  authDomain: "chill-pros-ice-stream.firebaseapp.com",
  projectId: "chill-pros-ice-stream",
  storageBucket: "chill-pros-ice-stream.firebasestorage.app",
  messagingSenderId: "260000821827",
  appId: "1:260000821827:web:4d65bb9f17a29001eedaf6",
  measurementId: "G-R0T9MTVV1V"
};

firebase.initializeApp(firebaseConfig);

const firestoreDb = firebase.firestore();

window.chillProsDb = firestoreDb;

// The AI foundation remains isolated and advisory-only. The UI module mounts
// only when localStorage flag chillProsFeatures:aiOperationsBrief is "true".
for (const aiScript of ["ai/operations-engine.js", "ai/daily-operations-brief.js"]) {
  if (!document.querySelector(`script[src="${aiScript}"]`)) {
    const script = document.createElement("script");
    script.src = aiScript;
    script.async = false;
    document.head.appendChild(script);
  }
}
