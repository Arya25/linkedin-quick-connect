// Shared helpers for history (used by recorder + view)
export const HISTORY_KEY = "history";
export const HISTORY_MAX = 500;

export function safeEscape(s) {
  return (s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

export function loadHistory() {
  return new Promise((res) => {
    chrome.storage.local.get([HISTORY_KEY], (d) => {
      res(Array.isArray(d[HISTORY_KEY]) ? d[HISTORY_KEY] : []);
    });
  });
}

export function saveHistory(arr) {
  return new Promise((res) =>
    chrome.storage.local.set({ [HISTORY_KEY]: arr }, res)
  );
}

export function appendHistory(entry) {
  return new Promise((resolve) => {
    chrome.storage.local.get([HISTORY_KEY], (d) => {
      const arr = Array.isArray(d[HISTORY_KEY]) ? d[HISTORY_KEY] : [];
      arr.unshift(entry);
      if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
      chrome.storage.local.set({ [HISTORY_KEY]: arr }, resolve);
    });
  });
}
