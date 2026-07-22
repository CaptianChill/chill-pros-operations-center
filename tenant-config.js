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

// Approved Chill Pros black / ice-blue production theme.
document.write('<link rel="stylesheet" href="brand-lock.css?v=20260722-12">');
document.write('<link rel="stylesheet" href="final-template.css?v=20260722-12">');
document.write('<link rel="stylesheet" href="production-owner.css?v=20260722-12">');
document.write('<link rel="icon" type="image/png" href="chill-pros-official-logo-transparent.png?v=20260722-12">');
document.write('<link rel="apple-touch-icon" href="chill-pros-official-logo-transparent.png?v=20260722-12">');

// Authentication, role routing and realtime synchronization.
document.write('<script src="v1-access.js?v=20260722-12"><\/script>');
document.write('<script src="auth-diagnostics.js?v=20260722-12"><\/script>');
// Approved dashboard composition and production-only live data cleanup.
document.write('<script src="final-template.js?v=20260722-12"><\/script>');
document.write('<script src="production-owner.js?v=20260722-12"><\/script>');
