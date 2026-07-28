(function attachCompletedReportsExport(globalScope) {
  "use strict";

  const csvApi = globalScope.ChillProsCsvExport;
  if (!csvApi || typeof csvApi.asCsvCell !== "function") {
    throw new Error("Secure CSV export utility is unavailable");
  }

  const headers = [
    "Customer",
    "Completion Date",
    "Technician",
    "Equipment",
    "Address",
    "Findings",
    "Recommendation",
    "Estimated Amount"
  ];

  function buildCompletedJobsCsv(records) {
    const safeRecords = Array.isArray(records) ? records : [];
    const rows = safeRecords.map((record = {}) => {
      const completionDate = record.completedAt || record.statusUpdatedAt || record.createdAt || "";
      const equipment = [record.equipmentType, record.manufacturer, record.modelNumber]
        .filter(Boolean)
        .join(" • ");

      return [
        record.customerName || "",
        completionDate,
        record.assignedTechnician || "",
        equipment,
        record.address || "",
        record.findings || "",
        record.recommendation || "",
        record.estimatedAmount || ""
      ].map(csvApi.asCsvCell).join(",");
    });

    return [headers.map(csvApi.asCsvCell).join(","), ...rows].join("\n");
  }

  function assertDownloadRuntime() {
    if (typeof globalScope.Blob !== "function") {
      throw new Error("Completed jobs export requires Blob support");
    }
    if (!globalScope.URL || typeof globalScope.URL.createObjectURL !== "function" || typeof globalScope.URL.revokeObjectURL !== "function") {
      throw new Error("Completed jobs export requires object URL support");
    }
    if (!globalScope.document || typeof globalScope.document.createElement !== "function") {
      throw new Error("Completed jobs export requires a browser document");
    }
  }

  function downloadCompletedJobsCsv(records) {
    assertDownloadRuntime();
    const csv = buildCompletedJobsCsv(records);
    // The UTF-8 BOM keeps customer names, notes, and equipment symbols readable
    // when the downloaded CSV is opened directly in desktop Excel.
    const blob = new globalScope.Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = globalScope.URL.createObjectURL(blob);
    const link = globalScope.document.createElement("a");
    link.href = url;
    link.download = `chill-pros-completed-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.hidden = true;

    const parent = globalScope.document.body || globalScope.document.documentElement;
    if (!parent) {
      globalScope.URL.revokeObjectURL(url);
      throw new Error("Completed jobs export requires an attached document root");
    }

    parent.appendChild(link);
    let downloadStarted = false;
    try {
      link.click();
      downloadStarted = true;
    } finally {
      link.remove();
      if (!downloadStarted) {
        globalScope.URL.revokeObjectURL(url);
      }
    }

    // WebKit may still be consuming the object URL after the click task completes.
    // Keep it alive briefly so iPhone/iPad Safari can finish the download reliably.
    globalScope.setTimeout(() => globalScope.URL.revokeObjectURL(url), 1000);
  }

  const exportButton = globalScope.document?.getElementById("exportCompletedReports");
  if (exportButton) {
    exportButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const records = typeof filteredCompletedJobs !== "undefined" && Array.isArray(filteredCompletedJobs)
        ? filteredCompletedJobs
        : [];
      downloadCompletedJobsCsv(records);
    }, { capture: true });
  }

  globalScope.ChillProsCompletedReportsExport = {
    buildCompletedJobsCsv,
    downloadCompletedJobsCsv
  };
})(typeof window !== "undefined" ? window : globalThis);
