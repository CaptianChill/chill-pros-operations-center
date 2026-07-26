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

// Every application entry point loads firebase-config.js. Bootstrap the shared
// authentication/role gate and production empty-state reset here so direct,
// launcher, iPhone, iPad, and desktop entry points cannot bypass RC1 controls.
for (const runtimeScript of ["v1-access.js", "production-reset.js"]) {
  if (!document.querySelector(`script[src^="${runtimeScript}"]`)) {
    const script = document.createElement("script");
    script.src = runtimeScript;
    script.async = false;
    document.head.appendChild(script);
  }
}
