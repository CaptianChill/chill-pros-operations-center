window.FIELD_FORGED_CONFIG = {
  platform: {
    name: "FieldForged Overlay Engine",
    version: "2.0.0"
  },

  tenant: {
    id: "chill-pros",
    companyName: "Chill Pros",
    appName: "Chill Pros Operations Center",
    tagline: "License to Chill.",
    primaryColor: "#008cff",
    accentColor: "#7edbff",
    darkColor: "#000000",
    assetPrefix: "CP-SA"
  }
};

// Approved Chill Pros black / ice-blue theme.
document.write('<link rel="stylesheet" href="brand-lock.css?v=20260722-10">');
document.write('<link rel="stylesheet" href="final-template.css?v=20260722-10">');
document.write('<link rel="icon" type="image/png" href="chill-pros-official-logo-transparent.png?v=20260722-10">');
document.write('<link rel="apple-touch-icon" href="chill-pros-official-logo-transparent.png?v=20260722-10">');

// Authentication, role routing and realtime synchronization.
document.write('<script src="v1-access.js?v=20260722-10"><\/script>');
document.write('<script src="auth-diagnostics.js?v=20260722-10"><\/script>');
// Final dashboard composition matching the approved reference.
document.write('<script src="final-template.js?v=20260722-10"><\/script>');
