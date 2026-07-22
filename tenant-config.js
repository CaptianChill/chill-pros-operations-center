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
document.write('<link rel="stylesheet" href="brand-lock.css?v=20260722-2">');

// Load the V1.0 authentication, role routing and realtime synchronization layer
// before app.js initializes. This preserves the saved Chill Pros template and
// keeps all users on one shared application URL.
document.write('<script src="v1-access.js?v=20260722-2"><\/script>');
