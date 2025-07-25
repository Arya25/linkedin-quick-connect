document.addEventListener("DOMContentLoaded", () => {
  // Tab switching logic
  const tabTableBtn = document.getElementById("tabTableBtn");
  const tabInsightsBtn = document.getElementById("tabInsightsBtn");
  const tabTable = document.getElementById("tabTable");
  const tabInsights = document.getElementById("tabInsights");

  function showTab(tab) {
    if (tab === "table") {
      tabTable.classList.add("active");
      tabInsights.classList.remove("active");
      tabTableBtn.classList.add("active");
      tabInsightsBtn.classList.remove("active");
    } else {
      tabTable.classList.remove("active");
      tabInsights.classList.add("active");
      tabTableBtn.classList.remove("active");
      tabInsightsBtn.classList.add("active");
      renderCharts();
    }
  }
  tabTableBtn.addEventListener("click", () => showTab("table"));
  tabInsightsBtn.addEventListener("click", () => showTab("insights"));

  // Table/stat rendering (existing logic)
  const tableBody = document.querySelector("#historyTable tbody");
  const statsDiv = document.getElementById("stats");
  const emptyMsg = document.getElementById("emptyMsg");
  if (!tableBody) {
    console.error("No #historyTable tbody found in the DOM!");
    return;
  }

  chrome.storage.sync.get({ connectionHistory: [] }, (data) => {
    const history = data.connectionHistory;
    let total = history.length;
    let pending = history.filter((h) => h.status === "pending").length;
    let accepted = history.filter((h) => h.status === "accepted").length;

    // Modern stats card UI
    statsDiv.innerHTML = `
      <div class="stat">
        <div class="num">${total}</div>
        <div class="label">Total Sent</div>
      </div>
      <div class="stat">
        <div class="num">${pending}</div>
        <div class="label">Pending</div>
      </div>
      <div class="stat">
        <div class="num">${accepted}</div>
        <div class="label">Accepted</div>
      </div>
    `;

    tableBody.innerHTML = "";
    if (history.length === 0) {
      emptyMsg.style.display = "";
      return;
    } else {
      emptyMsg.style.display = "none";
    }

    history.forEach((entry, idx) => {
      const tr = document.createElement("tr");
      tr.style.opacity = 0;
      tr.style.animation = `fadeInRow 0.7s ${0.1 * idx}s forwards`;
      tr.innerHTML = `
        <td>${entry.name || ""}</td>
        <td>${entry.company || ""}</td>
        <td>${new Date(entry.date).toLocaleString()}</td>
        <td>${entry.message || ""}</td>
        <td>${entry.status || "pending"}</td>
        <td><a href="${entry.url}" target="_blank">Profile</a></td>
      `;
      tableBody.appendChild(tr);
    });

    // Store for chart rendering
    window._connectionHistory = history;
  });

  // Chart rendering logic
  let chartsRendered = false;
  function renderCharts() {
    if (chartsRendered) return; // Only render once per page load
    const history = window._connectionHistory || [];
    // --- 1. Company Distribution ---
    const companyCounts = {};
    history.forEach((entry) => {
      let company =
        entry.company && entry.company.trim()
          ? entry.company.trim()
          : "Unknown";
      companyCounts[company] = (companyCounts[company] || 0) + 1;
    });
    const companyLabels = Object.keys(companyCounts);
    const companyData = Object.values(companyCounts);
    new Chart(document.getElementById("industryChart").getContext("2d"), {
      type: "pie",
      data: {
        labels: companyLabels,
        datasets: [
          {
            data: companyData,
            backgroundColor: [
              "#6366f1",
              "#60a5fa",
              "#f59e42",
              "#34d399",
              "#f472b6",
              "#fbbf24",
              "#a78bfa",
              "#f87171",
              "#10b981",
              "#818cf8",
              "#facc15",
              "#e879f9",
              "#f472b6",
              "#fcd34d",
              "#6ee7b7",
              "#fca5a5",
              "#c084fc",
              "#f9fafb",
              "#a3e635",
              "#f43f5e",
              "#38bdf8",
              "#f97316",
              "#eab308",
              "#f472b6",
              "#f87171",
              "#fbbf24",
              "#a78bfa",
              "#f472b6",
              "#fcd34d",
              "#6ee7b7",
            ],
          },
        ],
      },
      options: {
        plugins: { legend: { position: "bottom" } },
        responsive: true,
        maintainAspectRatio: false,
      },
    });

    // --- 2. Message Length vs. Acceptance Rate ---
    // Group by message length buckets (e.g., 0-50, 51-100, ...)
    const lengthBuckets = {};
    history.forEach((entry) => {
      const len = (entry.message || "").length;
      const bucket =
        Math.floor(len / 50) * 50 + 1 + "-" + (Math.floor(len / 50) * 50 + 50);
      if (!lengthBuckets[bucket])
        lengthBuckets[bucket] = { sent: 0, accepted: 0 };
      lengthBuckets[bucket].sent++;
      if (entry.status === "accepted") lengthBuckets[bucket].accepted++;
    });
    const lengthLabels = Object.keys(lengthBuckets);
    const acceptanceRates = lengthLabels.map((b) => {
      const d = lengthBuckets[b];
      return d.sent ? Math.round((d.accepted / d.sent) * 100) : 0;
    });
    new Chart(document.getElementById("lengthChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: lengthLabels,
        datasets: [
          {
            label: "Acceptance Rate (%)",
            data: acceptanceRates,
            backgroundColor: "#6366f1",
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    });

    // --- 3. Acceptance Rate Over Time ---
    // Group by week
    const weekBuckets = {};
    history.forEach((entry) => {
      const d = new Date(entry.date);
      // Get year-week string
      const week = `${d.getFullYear()}-W${Math.ceil(
        ((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + d.getDay() + 1) / 7
      )}`;
      if (!weekBuckets[week]) weekBuckets[week] = { sent: 0, accepted: 0 };
      weekBuckets[week].sent++;
      if (entry.status === "accepted") weekBuckets[week].accepted++;
    });
    const weekLabels = Object.keys(weekBuckets).sort();
    const weekAcceptance = weekLabels.map((w) => {
      const d = weekBuckets[w];
      return d.sent ? Math.round((d.accepted / d.sent) * 100) : 0;
    });
    new Chart(document.getElementById("acceptanceChart").getContext("2d"), {
      type: "line",
      data: {
        labels: weekLabels,
        datasets: [
          {
            label: "Acceptance Rate (%)",
            data: weekAcceptance,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99,102,241,0.1)",
            fill: true,
            tension: 0.3,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    });
    chartsRendered = true;
  }

  // Add fade-in animation for table rows
  const style = document.createElement("style");
  style.innerHTML = `
@keyframes fadeInRow {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}`;
  document.head.appendChild(style);
});
