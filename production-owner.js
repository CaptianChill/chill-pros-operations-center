(() => {
  function records() {
    try {
      return Array.isArray(queue) ? queue : [];
    } catch (error) {
      return [];
    }
  }

  function formatTime(value) {
    if (!value) return "Time not set";
    const [hourText, minute = "00"] = String(value).split(":");
    const hour = Number(hourText);
    if (!Number.isFinite(hour)) return value;
    const suffix = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minute} ${suffix}`;
  }

  function liveJobs() {
    const active = new Set(["Scheduled", "Dispatched", "In Progress", "Paused"]);
    return [...records()]
      .filter((record) => active.has(record.officeStatus))
      .sort((a, b) => `${a.scheduledDate || "9999"} ${a.scheduledTime || "99:99"}`.localeCompare(`${b.scheduledDate || "9999"} ${b.scheduledTime || "99:99"}`));
  }

  function renderLiveSchedule() {
    const list = document.getElementById("scheduleList");
    if (!list) return;
    const jobs = liveJobs().slice(0, 5);
    if (!jobs.length) {
      list.innerHTML = '<div class="production-empty"><div><strong>No scheduled jobs</strong>Move an Office Queue record to Scheduled to place it here.</div></div>';
      return;
    }
    list.innerHTML = jobs.map((job) => `
      <div class="schedule-row">
        <strong>${formatTime(job.scheduledTime)}</strong>
        <div><strong>${job.customerName || "Unnamed Customer"}</strong><small>${job.address || "Address not entered"}</small></div>
        <span>${job.equipmentType || "Service Call"}</span>
      </div>`).join("");
  }

  function renderLiveActivity() {
    const list = document.getElementById("activityList");
    if (!list) return;
    const recent = [...records()]
      .sort((a, b) => String(b.statusUpdatedAt || b.createdAt || "").localeCompare(String(a.statusUpdatedAt || a.createdAt || "")))
      .slice(0, 5);
    if (!recent.length) {
      list.innerHTML = '<div class="production-empty"><div><strong>No recent activity</strong>New intake and job updates will appear here.</div></div>';
      return;
    }
    list.innerHTML = recent.map((record) => {
      const stamp = new Date(record.statusUpdatedAt || record.createdAt || Date.now());
      const time = Number.isNaN(stamp.getTime()) ? "" : stamp.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
      return `<div class="activity-row"><span>✓</span><div><strong>${record.officeStatus || "Updated"}</strong><small>${record.customerName || "Unnamed Customer"}</small></div><time>${time}</time></div>`;
    }).join("");
  }

  function refreshProductionDashboard() {
    renderLiveSchedule();
    renderLiveActivity();
  }

  function applyProductionMode() {
    document.querySelectorAll(".cp-brand-guide,.cp-bottom-grid").forEach((node) => node.remove());
    document.getElementById("addSampleJob")?.remove();
    refreshProductionDashboard();

    const originalPersistQueue = typeof persistQueue === "function" ? persistQueue : null;
    if (originalPersistQueue && !window.__cpProductionPersistPatched) {
      persistQueue = function productionPersistQueue() {
        const result = originalPersistQueue.apply(this, arguments);
        refreshProductionDashboard();
        return result;
      };
      window.__cpProductionPersistPatched = true;
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(applyProductionMode, 0), { once: true });
  } else {
    setTimeout(applyProductionMode, 0);
  }
})();
