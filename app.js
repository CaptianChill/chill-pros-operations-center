const db = window.chillProsDb;
const cfg = window.FIELD_FORGED_CONFIG || {
  platform: "FieldForged",
  tenant: { id: "chill-pros", name: "Chill Pros" }
};
const tenant = cfg.tenant;
const STORAGE_KEY = `fieldForged:${tenant.id}:operations-center:v3`;

let queue = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

const schedule = [
  {
    time: "9:00 AM",
    name: "Joe's Ice House",
    address: "123 Frosty Way, San Antonio, TX",
    type: "Ice Machine PM Visit"
  },
  {
    time: "11:30 AM",
    name: "Chili's Grill & Bar",
    address: "8515 Potranco Rd, San Antonio, TX",
    type: "Walk-In Cooler Service Call"
  },
  {
    time: "2:00 PM",
    name: "H-E-B #204",
    address: "1604 & Bandera Rd, San Antonio, TX",
    type: "Reach-In Cooler Repair"
  }
];

const activity = [
  {
    icon: "✓",
    title: "Job #1248 Completed",
    detail: "7-Eleven Store #3391",
    time: "8:45 AM"
  },
  {
    icon: "▣",
    title: "New Intake Submitted",
    detail: "Tony's Pizza & Pasta",
    time: "7:32 AM"
  },
  {
    icon: "◒",
    title: "Parts Order Placed",
    detail: "True 842123 Door Gasket",
    time: "Yesterday"
  }
];

const views = document.querySelectorAll(".view");
const navButtons = document.querySelectorAll(".side-link");

const intakeForm = document.getElementById("intakeForm");
const clearIntake = document.getElementById("clearIntake");
const copySummary = document.getElementById("copySummary");

const queueSearch = document.getElementById("queueSearch");
const queueFilter = document.getElementById("queueFilter");
const queueList = document.getElementById("queueList");
const queueCount = document.getElementById("queueCount");

const scheduleList = document.getElementById("scheduleList");
const todayJobsList = document.getElementById("todayJobsList");
const jobSearch = document.getElementById("jobSearch");
const jobStatusFilter = document.getElementById("jobStatusFilter");
const refreshJobs = document.getElementById("refreshJobs");
const activityList = document.getElementById("activityList");

const exportQueue = document.getElementById("exportQueue");
const addSampleJob = document.getElementById("addSampleJob");

const OFFICE_STATUSES = [
  "Needs Review",
  "Scheduled",
  "Needs Quote",
  "Ready to Invoice",
  "Waiting on Parts",
  "Dispatched",
  "In Progress",
  "Paused",
  "Completed"
];

const ACTIVE_JOB_STATUSES = new Set([
  "Scheduled",
  "Dispatched",
  "In Progress",
  "Paused"
]);

function normalizeRecord(data, firestoreId = "") {
  return {
    ...data,
    firestoreId: firestoreId,
    id: data.id || crypto.randomUUID?.() || String(Date.now()),
    officeStatus: data.officeStatus || "Needs Review",
    createdAt: data.createdAt || new Date().toISOString()
  };
}
async function updateCustomerInFirebase(record, changes) {
  if (!db || !record.firestoreId) return;

  await db
    .collection("Customers")
    .doc(record.firestoreId)
    .set(changes, { merge: true });
}
function showView(id) {
  views.forEach((view) => {
    view.classList.toggle("active", view.id === id);
  });

  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === id);
  });

  if (id === "office-queue") {
    renderQueue();
  }

  if (id === "todays-jobsob") {
    renderTodayJobs();  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

navButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.view);
  });
});

document.querySelectorAll("[data-view-target]").forEach((button) => {
  button.addEventListener("click", () => {
    showView(button.dataset.viewTarget);
  });
});

function renderSchedule() {
  if (!scheduleList) return;

  scheduleList.innerHTML = "";

  schedule.forEach((job) => {
    const row = document.createElement("div");
    row.className = "schedule-row";
    row.innerHTML = `
      <strong>${escapeHtml(job.time)}</strong>
      <div>
        <strong>${escapeHtml(job.name)}</strong>
        <small>${escapeHtml(job.address)}</small>
      </div>
      <span>${escapeHtml(job.type)}</span>
    `;
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
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.detail)}</small>
      </div>
      <time>${escapeHtml(item.time)}</time>
    `;
    activityList.appendChild(row);
  });
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  updateCounts();
  renderQueue();
  renderTodayJobs();
}

function updateCounts() {
  if (queueCount) {
    const activeQueueCount = queue.filter(
      (record) => record.officeStatus !== "Completed"
    ).length;
    queueCount.textContent = activeQueueCount;
  }

  const jobsCount = document.getElementById("jobsCount");
  if (jobsCount) {
    jobsCount.textContent = queue.filter((record) =>
      ACTIVE_JOB_STATUSES.has(record.officeStatus)
    ).length;
  }
}

function toast(message) {
  const notification = document.createElement("div");
  notification.className = "toast";
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 1800);
}

function getFormData() {
  if (!intakeForm) return {};
  return Object.fromEntries(new FormData(intakeForm).entries());
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
    `Estimated Amount: ${
      record.estimatedAmount
        ? "$" + Number(record.estimatedAmount).toFixed(2)
        : "-"
    }`,
    `Technician: ${record.assignedTechnician || "-"}`,
    `Scheduled Date: ${record.scheduledDate || "-"}`,
    `Scheduled Time: ${record.scheduledTime || "-"}`,
    `Photo Notes: ${record.photoNotes || "-"}`
  ].join("\n");
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Summary copied");
  } catch (error) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    toast("Summary copied");
  }
}
function normalizeRecord(data, firestoreId = "") {
  return {
    ...data,
    firestoreId,
    id: data.id || crypto.randomUUID?.() || String(Date.now()),
    officeStatus: data.officeStatus || "Needs Review",
    createdAt: data.createdAt || new Date().toISOString()
  };
}
async function loadCustomersFromFirebase() {
  if (!db) {
    console.warn("Firestore is unavailable. Using locally saved queue.");
    persist();
    return;
  }

  try {
    const snapshot = await db.collection("Customers").get();

    queue = snapshot.docs.map((documentSnapshot) =>
      normalizeRecord(documentSnapshot.data(), documentSnapshot.id)
    );

    persist();
  } catch (error) {
    console.error("Unable to load Firestore customers:", error);
    toast("Using locally saved queue");
    persist();
  }
}

async function saveCustomerToFirebase(record) {
  if (!db) return record.id;

  const documentReference = await db.collection("Customers").add(record);
  return documentReference.id;
}

async function updateCustomerInFirebase(record, changes) {
  if (!db || !record.id) return;

  await db.collection("Customers").doc(record.id).set(changes, { merge: true });
}

async function deleteCustomerFromFirebase(record) {
  if (!db || !record.firestoreId) return;

  await db
    .collection("Customers")
    .doc(record.firestoreId)
    .delete();
}
if (intakeForm) {
  intakeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const record = normalizeRecord(getFormData());
    record.officeStatus = record.officeStatus || "Needs Review";

    try {
      const firestoreId = await saveCustomerToFirebase(record);
      record.id = firestoreId || record.id;

      queue.unshift(record);
      persist();
      intakeForm.reset();
      toast("Submitted to office queue");
      showView("office-queue");
    } catch (error) {
      console.error(error);
      alert(`Firebase error: ${error.message}`);
      toast("Failed to save to Firebase");
    }
  });
}

if (clearIntake) {
  clearIntake.addEventListener("click", () => {
    intakeForm?.reset();
    toast("Form cleared");
  });
}

if (copySummary) {
  copySummary.addEventListener("click", () => {
    copyText(createSummary(getFormData()));
  });
}

if (queueSearch) {
  queueSearch.addEventListener("input", renderQueue);
}

if (queueFilter) {
  queueFilter.addEventListener("change", renderQueue);
}

function buildStatusOptions(selectedStatus) {
  return OFFICE_STATUSES.map((status) => {
    const selected = status === selectedStatus ? "selected" : "";
    return `<option value="${escapeHtml(status)}" ${selected}>${escapeHtml(
      status
    )}</option>`;
  }).join("");
}

function renderQueue() {
  if (!queueList) return;

  queueList.innerHTML = "";

  const searchTerm = queueSearch
    ? queueSearch.value.trim().toLowerCase()
    : "";
  const statusFilter = queueFilter ? queueFilter.value : "";

  const filteredQueue = queue.filter((record) => {
    const matchesSearch =
      !searchTerm ||
      JSON.stringify(record).toLowerCase().includes(searchTerm);

    const matchesStatus =
      !statusFilter || record.officeStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!filteredQueue.length) {
    queueList.innerHTML = `
      <article class="queue-item">
        <div>
          <h3>No matching records</h3>
          <p class="queue-meta">
            Submit a new customer intake to create the first office queue record.
          </p>
        </div>
      </article>
    `;
    return;
  }

  filteredQueue.forEach((record) => {
    const template = document.getElementById("queueItemTemplate");
    if (!template) return;

    const node = template.content.firstElementChild.cloneNode(true);

    const customerElement = node.querySelector(".queue-customer");
    const metaElement = node.querySelector(".queue-meta");
    const detailElement = node.querySelector(".queue-detail");
    const statusElement = node.querySelector(".status-pill");
    const copyButton = node.querySelector(".copy-item");
    const deleteButton = node.querySelector(".delete-item");

    if (customerElement) {
      customerElement.textContent =
        record.customerName || "Unnamed Customer";
    }

    if (metaElement) {
      const created = new Date(record.createdAt);
      const createdText = Number.isNaN(created.getTime())
        ? "Date not set"
        : created.toLocaleString();

      metaElement.textContent =
        `${record.equipmentType || "Equipment"} • ` +
        `${record.manufacturer || "Manufacturer not set"} • ` +
        createdText;
    }

    if (detailElement) {
      detailElement.textContent = record.complaint || "";
    }

    if (statusElement) {
      statusElement.innerHTML = buildStatusOptions(record.officeStatus);

      statusElement.addEventListener("change", async () => {
  const previousStatus = record.officeStatus;
  const newStatus = statusElement.value;

  record.officeStatus = newStatus;
  record.statusUpdatedAt = new Date().toISOString();

  try {
    await updateCustomerInFirebase(record, {
      officeStatus: newStatus,
      statusUpdatedAt: record.statusUpdatedAt
    });

    persist();
    renderQueue();
    renderTodayJobs();

    if (newStatus === "Scheduled") {
      toast("Job added to Today's Jobs");
    } else {
      toast(`Status changed to ${newStatus}`);
    }
  } catch (error) {
    console.error("Status update failed:", error);
    record.officeStatus = previousStatus;
    statusElement.value = previousStatus;
    toast("Status update failed");
  }
});
    }
    if (copyButton) {
      copyButton.addEventListener("click", () => {
        copyText(createSummary(record));
      });
    }

    if (deleteButton) {
      deleteButton.addEventListener("click", async () => {
        const confirmed = confirm("Delete this office queue record?");
        if (!confirmed) return;

        try {
          await deleteCustomerFromFirebase(record);
          queue = queue.filter((item) => item.id !== record.id);
          persist();
          toast("Record deleted");
        } catch (error) {
          console.error(error);
          toast("Delete failed");
        }
      });
    }

queueList.appendChild(node);
});
} 

function renderTodayJobs() {
  if (!todayJobsList) return;

  const searchTerm = jobSearch
    ? jobSearch.value.trim().toLowerCase()
    : "";
  const selectedStatus = jobStatusFilter ? jobStatusFilter.value : "";

  const jobs = queue.filter((record) => {
    const isJob = ACTIVE_JOB_STATUSES.has(record.officeStatus);
    const matchesSearch =
      !searchTerm ||
      JSON.stringify(record).toLowerCase().includes(searchTerm);
    const matchesStatus =
      !selectedStatus || record.officeStatus === selectedStatus;

    return isJob && matchesSearch && matchesStatus;
  });

  todayJobsList.innerHTML = "";

  if (!jobs.length) {
    todayJobsList.innerHTML = `
      <article class="queue-item">
        <div>
          <h3>No jobs scheduled yet</h3>
          <p class="queue-meta">
            Change an Office Queue record to Scheduled to place it here.
          </p>
        </div>
      </article>
    `;
    return;
  }

  jobs.forEach((record) => {
    const article = document.createElement("article");
    article.className = "queue-item todays-job-card";

    article.innerHTML = `
      <div>
        <h3>${escapeHtml(record.customerName || "Unnamed Customer")}</h3>
        <p class="queue-meta">
          ${escapeHtml(record.equipmentType || "Equipment")} •
          ${escapeHtml(record.manufacturer || "Manufacturer not set")}
        </p>
        <p class="queue-detail">${escapeHtml(
          record.complaint || "No complaint entered"
        )}</p>
        <p class="queue-meta">
          ${escapeHtml(record.address || "Address not entered")}
        </p>
      </div>

      <div class="queue-tools">
        <label>
          Status
          <select class="status-pill job-status">
            ${buildStatusOptions(record.officeStatus)}
          </select>
        </label>

        <label>
          Technician
          <input
            class="job-technician"
            type="text"
            value="${escapeAttribute(record.assignedTechnician || "")}"
            placeholder="Assign technician"
          >
        </label>

        <label>
          Date
          <input
            class="job-date"
            type="date"
            value="${escapeAttribute(record.scheduledDate || "")}"
          >
        </label>

        <label>
          Time
          <input
            class="job-time"
            type="time"
            value="${escapeAttribute(record.scheduledTime || "")}"
          >
        </label>

        <button type="button" class="save-job">Save Job</button>
        <button type="button" class="copy-job">Copy</button>
      </div>
    `;

    const statusInput = article.querySelector(".job-status");
    const technicianInput = article.querySelector(".job-technician");
    const dateInput = article.querySelector(".job-date");
    const timeInput = article.querySelector(".job-time");
    const saveButton = article.querySelector(".save-job");
    const copyButton = article.querySelector(".copy-job");

    saveButton?.addEventListener("click", async () => {
      const changes = {
        officeStatus: statusInput?.value || record.officeStatus,
        assignedTechnician: technicianInput?.value.trim() || "",
        scheduledDate: dateInput?.value || "",
        scheduledTime: timeInput?.value || "",
        statusUpdatedAt: new Date().toISOString()
      };

      Object.assign(record, changes);

      try {
        await updateCustomerInFirebase(record, changes);
        persist();
        toast("Job updated");
      } catch (error) {
        console.error(error);
        toast("Job update failed");
      }
    });

    copyButton?.addEventListener("click", () => {
      copyText(createSummary(record));
    });

    todayJobsList.appendChild(article);
  });
}

if (jobSearch) {
  jobSearch.addEventListener("input", renderTodayJobs);
}

if (jobStatusFilter) {
  jobStatusFilter.addEventListener("change", renderTodayJobs);
}

if (refreshJobs) {
  refreshJobs.addEventListener("click", async () => {
    await loadCustomersFromFirebase();
    renderTodayJobs();
    toast("Jobs refreshed");
  });
}

if (exportQueue) {
  exportQueue.addEventListener("click", () => {
    const payload = {
      platform: cfg.platform,
      tenant,
      exportedAt: new Date().toISOString(),
      queue
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      `chill-pros-office-queue-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

    link.click();
    URL.revokeObjectURL(url);
    toast("Queue export created");
  });
}

if (addSampleJob) {
  addSampleJob.addEventListener("click", () => {
    schedule.push({
      time: "4:30 PM",
      name: "Sample Emergency Call",
      address: "San Antonio, TX",
      type: "HVAC No-Cool"
    });

    renderSchedule();
    toast("Sample job added");
  });
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


 updateCustomerInFirebase(record, {
  officeStatus: newStatus,
  statusUpdatedAt: record.statusUpdatedAt
});
 persist();
renderQueue();
renderTodayJobs();
updateCounts();
loadCustomersFromFirebase();
