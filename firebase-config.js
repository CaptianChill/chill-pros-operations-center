const firebaseConfig = {
  apiKey: "AIzaSyBsBEKMggwSUvEmdTTK1rjYOcdPyYCCLOc",
  authDomain: "chill-pros-ice-stream.firebaseapp.com",
  projectId: "chill-pros-ice-stream",
  storageBucket: "chill-pros-ice-stream.firebasestorage.app",
  messagingSenderId: "260000821827",
  appId: "1:260000821827:web:4d65bb9f17a29001eedaf6",
  measurementId: "G-R0T9MTVV1V"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
window.chillProsDb = firebase.firestore();

(() => {
  const mountV3 = () => {
    if (!document.querySelector('link[data-chill-bro-v3]')) {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'chill-bro-v3.css?v=20260826-redesign';
      css.dataset.chillBroV3 = '1';
      document.head.appendChild(css);
    }
    if (!document.querySelector('script[data-chill-bro-v3]')) {
      const script = document.createElement('script');
      script.src = 'chill-bro-v3.js?v=20260826-redesign';
      script.dataset.chillBroV3 = '1';
      document.body.appendChild(script);
    }
  };

  if (window.firebase?.auth) {
    mountV3();
  } else {
    const auth = document.createElement('script');
    auth.src = 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth-compat.js';
    auth.onload = mountV3;
    auth.onerror = mountV3;
    document.head.appendChild(auth);
  }
})();
