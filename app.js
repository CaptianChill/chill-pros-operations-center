const db = window.chillProsDb;
const cfg = window.FIELD_FORGED_CONFIG;
const tenant = cfg.tenant;

const STORAGE_KEY = `fieldForged:${tenant.id}:operations-center:v1`;

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
const activityList = document.getElementById("activityList");

const exportQueue = document.getElementById("exportQueue");
const addSampleJob = document.getElementById("addSampleJob");

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
      <strong>${job.time}</strong>
      <div>
        <b>${job.name}</b>
        <small>${job.address}</small>
      </div>
      <small>${job.type}</small>
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
      <span class="activity-dot">${item.icon}</span>
      <div>
        <b>${item.title}</b>
        <small>${item.detail}</small>
      </div>
      <small>${item.time}</small>
    `;

    activityList.appendChild(row);
  });
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  updateCounts();
  renderQueue();
}

function updateCounts() {
  if (!queueCount) return;

  const activeCount = queue.filter((record) => {
    return record.officeStatus !== "Completed";
  }).length;

  queueCount.textContent = activeCount;
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

  return Object.fromEntries(
    new FormData(intakeForm).entries()
  );
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
async function saveCustomerToFirebase(record) {
  const projectId = "chill-pros-ice-stream";
  const apiKey = "AIzaSyBsBEKMggwSUvEmdTTK1rjY0cdPyYCCL0c";

  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}` +
    `/databases/(default)/documents/Customers?key=${apiKey}`;

  const fields = {};

  Object.entries(record).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (typeof value === "number") {
      fields[key] = { doubleValue: value };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ fields })
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.error?.message || `Firestore error ${response.status}`
    );
  }

  return result;
}

  
if (intakeForm) {
  intakeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const record = getFormData();

    record.id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now());

    record.createdAt = new Date().toISOString();

    try {
      await saveCustomerToFirebase(record);

      queue.unshift(record);

      persist();

      intakeForm.reset();

      toast("Submitted to office queue");

      showView("office-queue");
    } catch (error) {
      console.error(error);

      alert(
        "Firebase error: " + error.message
      );

      toast("Failed to save to Firebase");
    }
  });
}

if (clearIntake) {
  clearIntake.addEventListener("click", () => {
    intakeForm.reset();

    toast("Form cleared");
  });
}

if (copySummary) {
  copySummary.addEventListener("click", () => {
    const record = getFormData();

    copyText(
      createSummary(record)
    );
  });
}

if (queueSearch) {
  queueSearch.addEventListener(
    "input",
    renderQueue
  );
}

if (queueFilter) {
  queueFilter.addEventListener(
    "change",
    renderQueue
  );
}

function renderQueue() {
  if (!queueList) return;

  queueList.innerHTML = "";

  const searchTerm = queueSearch
    ? queueSearch.value.trim().toLowerCase()
    : "";

  const statusFilter = queueFilter
    ? queueFilter.value
    : "";

  const filteredQueue = queue.filter((record) => {
    const matchesSearch =
      !searchTerm ||
      JSON.stringify(record)
        .toLowerCase()
        .includes(searchTerm);

    const matchesStatus =
      !statusFilter ||
      record.officeStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (!filteredQueue.length) {
    queueList.innerHTML = `
      <div class="simple-view">
        <h2>No matching records</h2>
        <p>
          Submit a new customer intake to create
          the first office queue record.
        </p>
      </div>
    `;

    return;
  }

  filteredQueue.forEach((record) => {
    const template =
      document.getElementById(
        "queueItemTemplate"
      );

    if (!template) return;

    const node =
      template.content.firstElementChild.cloneNode(
        true
      );

    const customerElement =
      node.querySelector(".queue-customer");

    const metaElement =
      node.querySelector(".queue-meta");

    const detailElement =
      node.querySelector(".queue-detail");

    const statusElement =
      node.querySelector(".status-pill");

    const copyButton =
      node.querySelector(".copy-item");

    const deleteButton =
      node.querySelector(".delete-item");

    if (customerElement) {
      customerElement.textContent =
        record.customerName ||
        "Unnamed Customer";
    }

    if (metaElement) {
      metaElement.textContent =
        `${record.equipmentType || "Equipment"} • ` +
        `${record.manufacturer || "Manufacturer not set"} • ` +
        `${new Date(record.createdAt).toLocaleString()}`;
    }

    if (detailElement) {
      detailElement.textContent =
        record.complaint || "";
    }

    if (statusElement) {
      statusElement.textContent =
        record.officeStatus ||
        "Needs Review";
    }

    if (copyButton) {
      copyButton.addEventListener(
        "click",
        () => {
          copyText(
            createSummary(record)
          );
        }
      );
    }

    if (deleteButton) {
      deleteButton.addEventListener(
        "click",
        () => {
          const confirmed = confirm(
            "Delete this office queue record?"
          );

          if (!confirmed) return;

          queue = queue.filter((item) => {
            return item.id !== record.id;
          });

          persist();

          toast("Record deleted");
        }
      );
    }

    queueList.appendChild(node);
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

    const blob = new Blob(
      [
        JSON.stringify(
          payload,
          null,
          2
        )
      ],
      {
        type: "application/json"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

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
  addSampleJob.addEventListener(
    "click",
    () => {
      schedule.push({
        time: "4:30 PM",
        name: "Sample Emergency Call",
        address: "San Antonio, TX",
        type: "HVAC No-Cool"
      });

      renderSchedule();

      toast("Sample job added");
    }
  );
}

renderSchedule();
renderActivity();
renderQueue();
updateCounts();
