// history_recorder.js  (NON-module content script)
// Records note text at the moment a LinkedIn connection is sent.

(function () {
  const HISTORY_KEY = "history";
  const HISTORY_MAX = 500;
  const LOG = (...a) => {
    // console.debug("[QC history]", ...a);
  };

  const uid = () => "h_" + Math.random().toString(36).slice(2) + Date.now();

  function appendHistory(entry) {
    chrome.storage.local.get([HISTORY_KEY], (d) => {
      const arr = Array.isArray(d[HISTORY_KEY]) ? d[HISTORY_KEY] : [];
      arr.unshift(entry);
      if (arr.length > HISTORY_MAX) arr.length = HISTORY_MAX;
      chrome.storage.local.set({ [HISTORY_KEY]: arr }, () => {
        // LOG("saved", entry);
      });
    });
  }

  function getFullName() {
    const h1 = document.querySelector("h1");
    return (h1?.textContent || "").trim().replace(/\s+/g, " ");
  }
  function getCompanyFromHeader() {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      (b.getAttribute("aria-label") || "").startsWith("Current company:")
    );
    if (!btn) return "";
    const m = btn
      .getAttribute("aria-label")
      .match(/^Current company:\s*(.+?)\.\s/i);
    return m && m[1] ? m[1].trim() : "";
  }
  function currentProfileUrl() {
    const m = location.href.match(/(https:\/\/[^?#]+\/in\/[^?#/]+\/?)/i);
    return m ? m[1] : location.href;
  }

  function findAllModals() {
    return Array.from(
      document.querySelectorAll(
        '[role="dialog"], .artdeco-modal, [data-test-modal]'
      )
    );
  }
  function findTextarea(root) {
    const scope = root || document;
    return (
      scope.querySelector("#custom-message") ||
      scope.querySelector('textarea[name="message"]') ||
      scope.querySelector("textarea")
    );
  }
  function isSendButton(el) {
    if (!el) return false;
    const txt = (el.textContent || el.getAttribute("aria-label") || "").trim();
    return /\bsend\b/i.test(txt);
  }
  function closestButton(el) {
    while (el && el !== document.documentElement) {
      if (el.tagName === "BUTTON") return el;
      el = el.parentElement;
    }
    return null;
  }
  function buildEntry(finalMessage) {
    return {
      id: uid(),
      ts: Date.now(),
      name: getFullName(),
      profileUrl: currentProfileUrl(),
      company: getCompanyFromHeader(),
      message: (finalMessage || "").slice(0, 300),
      templateId: null,
      templateLabel: null,
    };
  }

  // --- Strategy A: Bind directly inside modals when they appear ---
  function bindSendInModal(modal) {
    if (!modal || modal.dataset.qcHistBound === "1") return;
    modal.dataset.qcHistBound = "1";

    const tryBind = () => {
      const btn = Array.from(modal.querySelectorAll("button")).find(
        isSendButton
      );
      if (!btn) {
        setTimeout(tryBind, 120); // modal mounts async, retry briefly
        return;
      }
      if (btn.dataset.qcHistBound === "1") return;
      btn.dataset.qcHistBound = "1";

      LOG("binding SEND in modal");
      btn.addEventListener(
        "click",
        () => {
          const ta = findTextarea(modal) || findTextarea(document);
          const entry = buildEntry(ta?.value || "");
          appendHistory(entry);
        },
        { once: true }
      );
    };

    tryBind();

    // Also capture Enter key in the textarea inside this modal
    const ta = findTextarea(modal);
    if (ta && !ta.dataset.qcHistKeyBound) {
      ta.dataset.qcHistKeyBound = "1";
      ta.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) {
          // Some UIs use Cmd/Ctrl+Enter, record just in case
          const entry = buildEntry(ta.value);
          appendHistory(entry);
        }
      });
    }
  }

  // Observe for modals appearing
  const mo = new MutationObserver(() => {
    findAllModals().forEach(bindSendInModal);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Bind any modal already present
  findAllModals().forEach(bindSendInModal);

  // --- Strategy B: Global capture fallback ---
  // If Strategy A misses (A/B DOM changes), catch any "Send" click anywhere.
  document.addEventListener(
    "click",
    (ev) => {
      const btn = closestButton(ev.target);
      if (!btn || !isSendButton(btn)) return;

      // Prefer message from the nearest open modal; otherwise fallback to page
      const modals = findAllModals();
      const taInModal = modals.map(findTextarea).find(Boolean);
      const ta = taInModal || findTextarea(document);

      LOG("global SEND capture");
      const entry = buildEntry(ta?.value || "");
      appendHistory(entry);
    },
    true // capture phase
  );

  LOG("recorder loaded");
})();
