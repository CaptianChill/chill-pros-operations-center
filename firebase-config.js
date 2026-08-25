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

// Chill Bro is loaded from this shared bootstrap so every Operations Center entrypoint
// gets the same secure copilot without exposing server credentials client-side.
(() => {
  const addCss = () => {
    if (document.querySelector('link[data-chill-bro]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'chill-bro.css';
    link.dataset.chillBro = '1';
    document.head.appendChild(link);
  };

  const loadCopilot = () => {
    if (document.querySelector('script[data-chill-bro]')) return;
    const script = document.createElement('script');
    script.src = 'chill-bro.js';
    script.defer = true;
    script.dataset.chillBro = '1';
    document.head.appendChild(script);
  };

  const ensureAuth = () => {
    addCss();
    if (window.firebase?.auth) {
      loadCopilot();
      return;
    }
    const authScript = document.createElement('script');
    authScript.src = 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js';
    authScript.onload = loadCopilot;
    authScript.onerror = () => console.error('Unable to load Firebase Auth for Chill Bro.');
    document.head.appendChild(authScript);
  };

  ensureAuth();
})();
