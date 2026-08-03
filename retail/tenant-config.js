window.FIELD_FORGED_RETAIL_CONFIG = {
  product: {
    name: "FieldForged Ops",
    edition: "Contractor Edition",
    descriptor: "Field service operations, without the office chaos.",
    poweredBy: "FieldForged Technologies"
  },
  tenant: {
    id: "fieldforged-demo",
    companyName: "Northstar Mechanical",
    shortName: "NM",
    supportEmail: "support@fieldforged.example",
    region: "San Antonio, TX"
  },
  branding: {
    mode: "retail",
    logoUrl: "",
    primary: "#0A7569",
    primarySoft: "#41887A",
    primaryDark: "#05534B",
    background: "#090D10",
    surface: "#11171B",
    text: "#F4F7F7",
    muted: "#93A1A6"
  },
  features: {
    diagnostics: true,
    partsIntelligence: true,
    maintenance: true,
    reports: true,
    customDomain: false,
    removeFieldForgedBranding: false
  },
  plans: {
    contractor: {
      label: "Contractor",
      setup: 500,
      monthly: 149,
      users: 5
    },
    growth: {
      label: "Growth",
      setup: 1000,
      monthly: 299,
      users: 15
    },
    whiteLabel: {
      label: "White Label",
      setup: 3500,
      monthly: 599,
      users: 30,
      customDomain: true,
      removeFieldForgedBranding: true
    }
  }
};

// White-label deployments override this object before app.js loads.
// Example:
// window.FIELD_FORGED_RETAIL_CONFIG = {
//   ...window.FIELD_FORGED_RETAIL_CONFIG,
//   tenant: { ...window.FIELD_FORGED_RETAIL_CONFIG.tenant, companyName: "Acme Service Group", shortName: "AS" },
//   branding: { ...window.FIELD_FORGED_RETAIL_CONFIG.branding, mode: "white-label", primary: "#7C3AED" },
//   features: { ...window.FIELD_FORGED_RETAIL_CONFIG.features, customDomain: true, removeFieldForgedBranding: true }
// };
