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

  function downloadCompletedJobsCsv(records) {
    const csv = buildCompletedJobsCsv(records);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chill-pros-completed-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const exportButton = document.getElementById("exportCompletedReports");
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
