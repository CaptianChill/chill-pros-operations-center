const db = window.chillProsDb;
const cfg = window.FIELD_FORGED_CONFIG || {
  platform: "FieldForged",
  tenant: { id: "chill-pros", name: "Chill Pros" }
};
const tenant = cfg.tenant;
const STORAGE_KEY = `fieldForged:${tenant.id}:operations-center:v3`;
const TECHNICIAN_STORAGE_KEY = "chillProsTechnicians";

let queue = readStoredArray(STORAGE_KEY);
let technicians = readStoredArray(TECHNICIAN_STORAGE_KEY);

const schedule = [
  { time: "9:00 AM", name: "Joe's Ice House", address: "123 Frosty Way, San Antonio, TX", type: "Ice Machine PM Visit" },
  { time: "11:30 AM", name: "Chili's Grill & Bar", address: "8515 Potranco Rd, San Antonio, TX", type: "Walk-In Cooler Service Call" },
  { time: "2:00 PM", name: "H-E-B #204", address: "1604 & Bandera Rd, San Antonio, TX", type: "Reach-In Cooler Repair" }
];

const activity = [
  { icon: "✓", title: "Job #1248 Completed", detail: "7-Eleven Store #3391", time: "8:45 AM" },
  { icon: "▣", title: "New Intake Submitted", detail: "Tony's Pizza & Pasta", time: "7:32 AM" },
  { icon: "◒", title: "Parts Order Placed", detail: "True 842123 Door Gasket", time: "Yesterday" }
];

const ACTIVE_JOB_STATUSES = new Set(["Scheduled", "Dispatched", "In Progress", "Paused"]);
const STATUS_OPTIONS = [
  "Needs Review",
  "Needs Quote",
  "Scheduled",
  "Dispatched",
  "In Progress",
  "Paused",
  "Waiting on Parts",
  "Ready to Invoice",
  "Completed"
];

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll(".side-link");
const intakeForm = document.getElementById("intakeForm");
const clearIntake = document.getElementById("clearIntake");
const copySummary = document.getElementById("copySummary");
const queueSearch = document.getElementById("queueSearch");
const queueFilter = document.getElementById("queueFilter");
const queueList = document.getElementById("queueList");
const scheduleList = document.getElementById("scheduleList");
const todayJobsList = document.getElementById("todayJobsList");
const jobSearch = document.getElementById("jobSearch");
const jobStatusFilter = document.getElementById("jobStatusFilter");
const refreshJobs = document.getElementById("refreshJobs");
const activityList = document.getElementById("activityList");
const exportQueue = document.getElementById("exportQueue");
const addSampleJob = document.getElementById("addSampleJob");
const addTechnicianButton = document.getElementById("addTechnicianButton");
const technicianList = document.getElementById("technicianList");
const technicianDashboardSelect = document.getElementById("technicianDashboardSelect");
const technicianJobsList = document.getElementById("technicianJobsList");

function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.warn(`Unable to read ${key}:`, error);
    return [];
  }
}

function normalizeRecord(data = {}, firestoreId = "") {
  return {
    ...data,
    firestoreId: firestoreId || data.firestoreId || "",
    id: data.id || firestoreId || crypto.randomUUID?.() || String(Date.now()),
    officeStatus: data.officeStatus || "Needs Review",
    assignedTechnician: data.assignedTechnician || "",
    scheduledDate: data.scheduledDate || "",
    scheduledTime: data.scheduledTime || "",
    createdAt: data.createdAt || new Date().toISOString()
  };
}

function showView(id) {
  views.forEach((view) => view.classList.toggle("active", view.id === id));
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === id));

  if (id === "office-queue") renderQueue();
  if (id === "today-jobs") renderTodayJobs();
  if (id === "technicians") {
    renderTechnicians();
    renderTechnicianDashboard();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function persistQueue() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  updateCounts();
  renderQueue();
  renderTodayJobs();
  renderTechnicianDashboard();
}

function saveTechnicians() {
  localStorage.setItem(TECHNICIAN_STORAGE_KEY, JSON.stringify(technicians));
  renderTechnicians();
  renderTechnicianDashboard();
  renderTodayJobs();
}

function updateCounts() {
  const activeQueueCount = queue.filter((record) => record.officeStatus !== "Completed").length;
  document.querySelectorAll("#queueCount").forEach((element) => {
    element.textContent = activeQueueCount;
  });

  const jobsCount = document.getElementById("jobsCount");
  if (jobsCount) {
    jobsCount.textContent = queue.filter((record) => ACTIVE_JOB_STATUSES.has(record.officeStatus)).length;
  }
}

function toast(message) {
  const notification = document.createElement("div");
  notification.className = "toast";
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 1800);
}

function getFormData() {
  return intakeForm ? Object.fromEntries(new FormData(intakeForm).entries()) : {};
}

function createSummary(record) {
  return [
    "CHILL PROS OPERATIONS CENTER",
    `Status: ${record.officeStatus || "-"}`,
    `Customer: ${record.customerName || "-"}`,
    `Contact: ${record.contactName || "-"}`,
    `Phone: ${record.phone || "-"}`,
    `Email: ${record.email || "-"}`,
    `Address: ${record.address || "-"}`,
    `Equipment: ${record.equipmentType || "-"}`,
    `Manufacturer: ${record.manufacturer || "-"}`,
    `Model: ${record.modelNumber || "-"}`,
    `Serial: ${record.serialNumber || "-"}`,
    `Asset ID: ${record.assetId || "-"}`,
    `Site Location: ${record.siteLocation || "-"}`,
    `Complaint: ${record.complaint || "-"}`,
    `Findings: ${record.findings || "-"}`,
    `Recommendation: ${record.recommendation || "-"}`,
    `Estimated Amount: ${record.estimatedAmount ? "$" + Number(record.estimatedAmount).toFixed(2) : "-"}`,
    `Technician: ${record.assignedTechnician || "-"}`,
    `Scheduled Date: ${record.scheduledDate || "-"}`,
    `Scheduled Time: ${record.scheduledTime || "-"}`,
    `Photo Notes: ${record.photoNotes || "-"}`
  ].join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
  toast("Summary copied");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function buildStatusOptions(selectedStatus) {
  const currentStatus = String(selectedStatus || "Needs Review").trim();
  return STATUS_OPTIONS.map((status) => {
    const selected = status === currentStatus ? " selected" : "";
    return `<option value="${escapeAttribute(status)}"${selected}>${escapeHtml(status)}</option>`;
  }).join("");
}

async function loadCustomersFromFirebase() {
  if (!db) {
    console.warn("Firestore is unavailable. Using locally saved queue.");
    persistQueue();
    return;
  }

  try {
    const snapshot = await db.collection("Customers").get();
    queue = snapshot.docs.map((documentSnapshot) =>
      normalizeRecord(documentSnapshot.data(), documentSnapshot.id)
    );
    persistQueue();
  } catch (error) {
    console.error("Unable to load Firestore customers:", error);
    toast("Using locally saved queue");
    persistQueue();
  }
}

async function saveCustomerToFirebase(record) {
  if (!db) return record.id;
  const documentReference = await db.collection("Customers").add(record);
  return documentReference.id;
}

async function updateCustomerInFirebase(record, changes) {
  const documentId = record.firestoreId || record.id;
  if (!db || !documentId) return;
  await db.collection("Customers").doc(documentId).set(changes, { merge: true });
  record.firestoreId = documentId;
}

async function deleteCustomerFromFirebase(record) {
  const documentId = record.firestoreId || record.id;
  if (!db || !documentId) return;
  await db.collection("Customers").doc(documentId).delete();
}

function renderSchedule() {
  if (!scheduleList) return;
  scheduleList.innerHTML = "";
  schedule.forEach((job) => {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.innerHTML = `
      <strong>${escapeHtml(job.time)}</strong>
      <div><strong>${escapeHtml(job.name)}</strong><small>${escapeHtml(job.address)}</small></div>
      <span>${escapeHtml(job.type)}</span>`;
    scheduleList.appendChild(row);
  });
}

function renderActivity() {
  if (!activityList) return;
  activityList.innerHTML = "";
  activity.forEach((item) => {
    const row = document.createElement("div");
    row.className = "activity-row";
    row.innerHTML = `
      <span>${escapeHtml(item.icon)}</span>
      <div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail)}</small></div>
      <time>${escapeHtml(item.time)}</time>`;
    activityList.appendChild(row);
  });
}

function renderQueue() {
  if (!queueList) return;
  const searchTerm = queueSearch?.value.trim().toLowerCase() || "";
  const statusFilter = queueFilter?.value || "";
  const filteredQueue = queue.filter((record) => {
    const matchesSearch = !searchTerm || JSON.stringify(record).toLowerCase().includes(searchTerm);
    return matchesSearch && (!statusFilter || record.officeStatus === statusFilter);
  });

  queueList.innerHTML = "";
  if (!filteredQueue.length) {
    queueList.innerHTML = `<article class="queue-item"><div><h3>No matching records</h3><p class="queue-meta">Submit a new customer intake to create the first office queue record.</p></div></article>`;
    return;
  }

  filteredQueue.forEach((record) => {
    const template = document.getElementById("queueItemTemplate");
    if (!template) return;
    const node = template.content.firstElementChild.cloneNode(true);
    const created = new Date(record.createdAt);
    node.querySelector(".queue-customer").textContent = record.customerName || "Unnamed Customer";
    node.querySelector(".queue-meta").textContent = `${record.equipmentType || "Equipment"} • ${record.manufacturer || "Manufacturer not set"} • ${Number.isNaN(created.getTime()) ? "Date not set" : created.toLocaleString()}`;
    node.querySelector(".queue-detail").textContent = record.complaint || "";

    const statusElement = node.querySelector(".status-select");
    statusElement.innerHTML = buildStatusOptions(record.officeStatus);
    statusElement.value = record.officeStatus;
    statusElement.addEventListener("change", async () => {
      const previousStatus = record.officeStatus;
      const changes = { officeStatus: statusElement.value, statusUpdatedAt: new Date().toISOString() };
      Object.assign(record, changes);
      try {
        await updateCustomerInFirebase(record, changes);
        persistQueue();
        toast(changes.officeStatus === "Scheduled" ? "Job added to Today's Jobs" : `Status changed to ${changes.officeStatus}`);
      } catch (error) {
        console.error("Status update failed:", error);
        record.officeStatus = previousStatus;
        statusElement.value = previousStatus;
        toast("Status update failed");
      }
    });

    node.querySelector(".copy-item")?.addEventListener("click", () => copyText(createSummary(record)));
    node.querySelector(".delete-item")?.addEventListener("click", async () => {
      if (!confirm("Delete this office queue record?")) return;
      try {
        await deleteCustomerFromFirebase(record);
        queue = queue.filter((item) => item.id !== record.id);
        persistQueue();
        toast("Record deleted");
      } catch (error) {
        console.error(error);
        toast("Delete failed");
      }
    });
    queueList.appendChild(node);
  });
}

function renderTodayJobs() {
  if (!todayJobsList) return;
  const searchTerm = jobSearch?.value.trim().toLowerCase() || "";
  const selectedStatus = jobStatusFilter?.value || "";
  const jobs = queue.filter((record) => {
    const isJob = ACTIVE_JOB_STATUSES.has(record.officeStatus);
    const matchesSearch = !searchTerm || JSON.stringify(record).toLowerCase().includes(searchTerm);
    return isJob && matchesSearch && (!selectedStatus || record.officeStatus === selectedStatus);
  });

  todayJobsList.innerHTML = "";
  if (!jobs.length) {
    todayJobsList.innerHTML = `<article class="queue-item"><div><h3>No jobs scheduled yet</h3><p class="queue-meta">Change an Office Queue record to Scheduled to place it here.</p></div></article>`;
    return;
  }

  jobs.forEach((record) => {
    const article = document.createElement("article");
    article.className = "queue-item todays-job-card";
    article.innerHTML = `
      <div>
        <h3>${escapeHtml(record.customerName || "Unnamed Customer")}</h3>
        <p class="queue-meta">${escapeHtml(record.equipmentType || "Equipment")} • ${escapeHtml(record.manufacturer || "Manufacturer not set")}</p>
        <p class="queue-detail">${escapeHtml(record.complaint || "No complaint entered")}</p>
        <p class="queue-meta">${escapeHtml(record.address || "Address not entered")}</p>
      </div>
      <div class="queue-tools">
        <label>Status<select class="status-pill job-status">${buildStatusOptions(record.officeStatus)}</select></label>
        <label>Technician<select class="job-technician"><option value="">Assign technician</option>${technicians.filter((technician) => technician.status === "Active").map((technician) => `<option value="${escapeAttribute(technician.name)}"${technician.name === record.assignedTechnician ? " selected" : ""}>${escapeHtml(technician.name)}</option>`).join("")}</select></label>
        <label>Date<input class="job-date" type="date" value="${escapeAttribute(record.scheduledDate)}"></label>
        <label>Time<input class="job-time" type="time" value="${escapeAttribute(record.scheduledTime)}"></label>
        <button type="button" class="save-job">Save Job</button>
        <button type="button" class="copy-job">Copy</button>
      </div>`;

    article.querySelector(".save-job")?.addEventListener("click", async () => {
      const changes = {
        officeStatus: article.querySelector(".job-status")?.value || record.officeStatus,
        assignedTechnician: article.querySelector(".job-technician")?.value.trim() || "",
        scheduledDate: article.querySelector(".job-date")?.value || "",
        scheduledTime: article.querySelector(".job-time")?.value || "",
        statusUpdatedAt: new Date().toISOString()
      };
      Object.assign(record, changes);
      try {
        await updateCustomerInFirebase(record, changes);
        persistQueue();
        toast("Job updated");
      } catch (error) {
        console.error(error);
        toast("Job update failed");
      }
    });
    article.querySelector(".copy-job")?.addEventListener("click", () => copyText(createSummary(record)));
    todayJobsList.appendChild(article);
  });
}

function renderTechnicians() {
  if (!technicianList) return;
  technicianList.innerHTML = "";
  if (!technicians.length) {
    technicianList.innerHTML = "<p>No technicians added yet.</p>";
  } else {
    technicians.forEach((technician) => {
      const card = document.createElement("article");
      card.className = "queue-item";
      card.innerHTML = `<div><h3>${escapeHtml(technician.name)}</h3><p class="queue-meta">${escapeHtml(technician.phone || "No phone")} • ${escapeHtml(technician.email || "No email")}</p><p>${escapeHtml(technician.skills || "Skills not entered")}</p></div><div><strong>${escapeHtml(technician.status || "Active")}</strong><button class="delete-technician">Delete</button></div>`;
      card.querySelector(".delete-technician")?.addEventListener("click", () => {
        technicians = technicians.filter((item) => item.id !== technician.id);
        saveTechnicians();
      });
      technicianList.appendChild(card);
    });
  }

  if (technicianDashboardSelect) {
    const selected = technicianDashboardSelect.value;
    technicianDashboardSelect.innerHTML = `<option value="">Select technician</option>${technicians.filter((technician) => technician.status === "Active").map((technician) => `<option value="${escapeAttribute(technician.name)}">${escapeHtml(technician.name)}</option>`).join("")}`;
    technicianDashboardSelect.value = technicians.some((technician) => technician.name === selected) ? selected : "";
  }
}

function renderTechnicianDashboard() {
  if (!technicianJobsList) return;
  const selectedTechnician = technicianDashboardSelect?.value || "";
  if (!selectedTechnician) {
    technicianJobsList.innerHTML = `<article class="queue-item"><div><h3>No technician selected</h3><p class="queue-meta">Select a technician to display assigned jobs.</p></div></article>`;
    return;
  }

  const assignedJobs = queue.filter((record) => record.assignedTechnician === selectedTechnician && ACTIVE_JOB_STATUSES.has(record.officeStatus));
  if (!assignedJobs.length) {
    technicianJobsList.innerHTML = `<article class="queue-item"><div><h3>No assigned jobs</h3><p class="queue-meta">Assign an active job to ${escapeHtml(selectedTechnician)} from Today's Jobs.</p></div></article>`;
    return;
  }

  technicianJobsList.innerHTML = assignedJobs.map((record) => `<article class="queue-item"><div><h3>${escapeHtml(record.customerName || "Unnamed Customer")}</h3><p class="queue-meta">${escapeHtml(record.officeStatus)} • ${escapeHtml(record.scheduledDate || "Date not set")} ${escapeHtml(record.scheduledTime || "")}</p><p>${escapeHtml(record.address || record.complaint || "No job details")}</p></div></article>`).join("");
}

navButtons.forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
document.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => showView(button.dataset.viewTarget)));

intakeForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const record = normalizeRecord(getFormData());
  try {
    const firestoreId = await saveCustomerToFirebase(record);
    record.id = firestoreId || record.id;
    record.firestoreId = firestoreId || record.firestoreId;
    queue.unshift(record);
    persistQueue();
    intakeForm.reset();
    toast("Submitted to office queue");
    showView("office-queue");
  } catch (error) {
    console.error(error);
    toast("Failed to save to Firebase");
  }
});

clearIntake?.addEventListener("click", () => {
  intakeForm?.reset();
  toast("Form cleared");
});
copySummary?.addEventListener("click", () => copyText(createSummary(getFormData())));
queueSearch?.addEventListener("input", renderQueue);
queueFilter?.addEventListener("change", renderQueue);
jobSearch?.addEventListener("input", renderTodayJobs);
jobStatusFilter?.addEventListener("change", renderTodayJobs);
refreshJobs?.addEventListener("click", async () => {
  await loadCustomersFromFirebase();
  toast("Jobs refreshed");
});
technicianDashboardSelect?.addEventListener("change", renderTechnicianDashboard);

exportQueue?.addEventListener("click", () => {
  const payload = { platform: cfg.platform, tenant, exportedAt: new Date().toISOString(), queue };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `chill-pros-office-queue-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Queue export created");
});

addSampleJob?.addEventListener("click", () => {
  schedule.push({ time: "4:30 PM", name: "Sample Emergency Call", address: "San Antonio, TX", type: "HVAC No-Cool" });
  renderSchedule();
  toast("Sample job added");
});

addTechnicianButton?.addEventListener("click", () => {
  const name = prompt("Technician name:");
  if (!name?.trim()) return;
  const phone = prompt("Phone number:") || "";
  const email = prompt("Email address:") || "";
  const skills = prompt("Skills: HVAC, Refrigeration, Ice Machines, Kitchen Equipment") || "";
  technicians.push({
    id: crypto.randomUUID?.() || String(Date.now()),
    name: name.trim(),
    phone: phone.trim(),
    email: email.trim(),
    skills: skills.trim(),
    status: "Active"
  });
  saveTechnicians();
  toast("Technician added");
});

renderSchedule();
renderActivity();
renderTechnicians();
renderTodayJobs();
updateCounts();
loadCustomersFromFirebase();
