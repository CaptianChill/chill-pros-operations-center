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
    darkColor: "#05090d",
    assetPrefix: "CP-SA"
  }
};

// Lock the approved Chill Pros black / ice-blue template and bypass stale iPad caches.
document.write('<link rel="stylesheet" href="brand-lock.css?v=20260722-3">');
document.write('<link rel="icon" type="image/png" href="chill-pros-official-logo-transparent.png?v=20260722-3">');
document.write('<link rel="apple-touch-icon" href="chill-pros-official-logo-transparent.png?v=20260722-3">');

// Load the V1.0 authentication, role routing and realtime synchronization layer.
document.write('<script src="v1-access.js?v=20260722-3"><\/script>');
