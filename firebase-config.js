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

// Shared secure bootstrap for Chill Pros Operations Center.
(() => {
  const addCss = (href, marker) => {
    if (document.querySelector(`link[data-${marker}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute(`data-${marker}`, '1');
    document.head.appendChild(link);
  };

  const addScript = (src, marker) => {
    if (document.querySelector(`script[data-${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.setAttribute(`data-${marker}`, '1');
    document.head.appendChild(script);
  };

  const loadOperationsTools = () => {
    addCss('native-billing.css', 'native-billing');
    addCss('operations-v3.css', 'operations-v3');
    addCss('operations-v3-command.css', 'operations-v3-command');
    addCss('celestial-v5.css?v=20260825-v5', 'celestial-v5');
    addCss('v2-functional.css?v=20260826-v2', 'v2-functional');
    addScript('native-billing.js', 'native-billing');
    addScript('operations-v3.js', 'operations-v3-command');
    addScript('v2-functional.js?v=20260826-v2', 'v2-functional');
    addScript('ionos-receptionist.js?v=20260826-ionos', 'ionos-receptionist');
  };

  const ensureAuth = () => {
    if (window.firebase?.auth) {
      loadOperationsTools();
      return;
    }
    const authScript = document.createElement('script');
    authScript.src = 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js';
    authScript.onload = loadOperationsTools;
    authScript.onerror = () => console.error('Unable to load Firebase Auth for Chill Pros secure tools.');
    document.head.appendChild(authScript);
  };

  ensureAuth();
})();
