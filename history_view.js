import {
  HISTORY_KEY,
  loadHistory,
  saveHistory,
  safeEscape,
} from "./history_common.js";

const tbody = document.getElementById("historyBody");
const empty = document.getElementById("historyEmpty");
const exportBtn = document.getElementById("exportHistoryBtn");
const clearBtn = document.getElementById("clearHistoryBtn");

function fmt(ts) {
  return new Date(ts).toLocaleString();
}

async function renderHistory() {
  const rows = await loadHistory();
  tbody.innerHTML = "";
  if (!rows.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  function fmt(ts) {
    const d = new Date(ts);
    const day = d.getDate();

    // Add st, nd, rd, th
    const suffix =
      day % 10 === 1 && day !== 11
        ? "st"
        : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
        ? "rd"
        : "th";

    const month = d.toLocaleString("default", { month: "long" }); // e.g., August
    const year = d.getFullYear();
    const time = d.toLocaleString("default", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    return `${day}${suffix} ${month} ${year}, ${time}`;
  }

  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmt(r.ts)}</td>
      <td>${safeEscape(r.name || "")}</td>
      <td>${safeEscape(r.company || "")}</td>
      <td class="message">${safeEscape(r.message || "")}</td>
      <td><a href="${r.profileUrl}" target="_blank">Open</a></td>
    `;
    tbody.appendChild(tr);
  });
}

exportBtn.addEventListener("click", async () => {
  const rows = await loadHistory();
  const headers = ["ts", "name", "company", "message", "profileUrl"];
  const csv = [headers.join(",")]
    .concat(
      rows.map((r) =>
        headers
          .map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
    )
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quick-connect-history.csv";
  a.click();
  URL.revokeObjectURL(url);
});

clearBtn.addEventListener("click", async () => {
  if (!confirm("Clear all connection history?")) return;
  await saveHistory([]);
  await renderHistory();
});

renderHistory();
