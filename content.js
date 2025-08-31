/******************************
 * Quick Connect (split button)
 * content.js — drop-in replacement
 ******************************/

let currentUrl = location.href;

/* ---------- One-time CSS for our mini UI ---------- */
(function injectStylesOnce() {
  if (document.getElementById("qc-split-styles")) return;
  const style = document.createElement("style");
  style.id = "qc-split-styles";
  style.textContent = `
    .qc-wrap { display:inline-flex; align-items:center; position:relative; margin-left:8px; }

    /* Single split button (one element) */
    .qc-split {
      --li-blue: #1466c2;
      --li-blue-hover: #1157a6;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: var(--li-blue);
      color: #fff;
      border: 1px solid #00418220;
      border-radius: 999px;
      padding: 6px 10px 6px 12px;  /* extra left for icon */
      font: 600 14px/1 system-ui, -apple-system, "Segoe UI", Roboto, Arial;
      cursor: pointer;
      box-shadow: 0 2px 0 rgba(0,0,0,0.06);
      
    }
    .qc-split:hover { background: var(--li-blue-hover); }

    .qc-split .ico {
      width:16px; height:16px; display:inline-block;
      margin-right: 6px;
    }

    /* Right 'caret area' integrated into the same button */
    .qc-split .car {
      display:inline-flex; align-items:center; justify-content:center;
      margin-left: 4px;
      padding-left: 8px;
      border-left: 1px solid rgba(255,255,255,0.35);
      width: 25px; /* fixed tappable zone */
      user-select: none;
    }
      .qc-item .lbl .star {
  color: #1466c2; /* LinkedIn blue */
  margin-left: 2px;
}


    /* Dropdown menu */
    .qc-menu {
      position: absolute; top: 100%; right: 0; margin-top: 8px; background: #fff; color: #111;
      border: 1px solid #d0d7de; border-radius: 10px; box-shadow: 0 8px 28px rgba(0,0,0,.12);
      min-width: 280px; overflow: hidden; display: none; z-index: 999999; left:0;
    }
    .qc-item { display:flex; flex-direction:column; gap:3px; padding:10px 12px; cursor:pointer; border-bottom:1px solid #eef2f6; }
    .qc-item:last-child { border-bottom:none; }
    .qc-item:hover { background:#f6f8fa; }
    .qc-item .lbl { font-weight:600; font-size:13px; }
    .qc-item .prev { font-size:12px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .qc-manage { padding:10px 12px; font-size:13px; background:#fafbfc; text-align:center; cursor:pointer; }
    .qc-manage:hover { background:#f0f3f7; }
  `;
  document.head.appendChild(style);
})();

/* ---------- Storage & pickers (new + legacy) ---------- */
const cache = {
  templates: [],
  settings: { addGreeting: false, defaultTemplateId: "" },
  lastChosenTemplateId: null, // per-tab pick until reload
};

function loadTemplatesAndSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ["templates", "settings", "customMessage", "addGreeting"],
      (data) => {
        // New model
        if (Array.isArray(data.templates) && data.templates.length) {
          cache.templates = data.templates;
          cache.settings = data.settings || {
            addGreeting: false,
            defaultTemplateId: "",
          };
        } else {
          // Legacy fallback → synthesize a single template
          const legacyText = (data.customMessage || "").trim();
          const t = legacyText
            ? [{ id: "default", label: "Default", text: legacyText }]
            : [
                {
                  id: "default",
                  label: "Default",
                  text: "Hi {firstName}, would love to connect!",
                },
              ];
          cache.templates = t;
          cache.settings = {
            addGreeting: !!data.addGreeting,
            defaultTemplateId: "default",
          };
        }
        resolve();
      }
    );
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.templates || changes.settings)) {
    loadTemplatesAndSettings().then(() => {
      // Re-render menu next open; primary click will use latest default
    });
  }
});

function pickActiveTemplate() {
  const byId = Object.fromEntries(cache.templates.map((t) => [t.id, t]));
  return (
    byId[cache.lastChosenTemplateId] ||
    byId[cache.settings.defaultTemplateId] ||
    cache.templates[0] ||
    null
  );
}

/* ---------- Page context ---------- */
function getCurrentCompanyName() {
  const companyButton = Array.from(document.querySelectorAll("button")).find(
    (btn) => btn.getAttribute("aria-label")?.startsWith("Current company:")
  );
  if (!companyButton) return "";
  const label = companyButton.getAttribute("aria-label");
  const match = label.match(/^Current company:\s*(.+?)\.\s/i);
  return match && match[1] ? match[1].trim() : "";
}

function getProfileContext() {
  const nameElement = document.querySelector("h1");
  const fullName = (nameElement?.innerText || "").trim();
  const [firstName] = fullName.split(" ");
  const company = getCurrentCompanyName();
  return { fullName, firstName: firstName || "", company: company || "" };
}

function renderMessage(tplText, ctx) {
  const placeholder = "______";
  const base = (tplText || "")
    // braced tokens first
    .replaceAll("{firstName}", ctx.firstName || "")
    .replaceAll("{cmpny}", ctx.company || placeholder)
    // legacy bare tokens next (word-boundary so we don’t touch other words)
    .replace(/\bfirstName\b/g, ctx.firstName || "")
    .replace(/\bcmpny\b/g, ctx.company || placeholder);

  return cache.settings.addGreeting
    ? `Hi ${ctx.firstName || ""}, ${base}`.trim()
    : base;
}

/* ---------- LI actions: open Add-note + fill ---------- */

async function waitForInviteInDropdown(fullName) {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const inviteBtn = Array.from(
        document.querySelectorAll('div[role="button"]')
      ).find(
        (el) =>
          el.getAttribute("aria-label") === `Invite ${fullName} to connect`
      );
      if (inviteBtn) {
        clearInterval(interval);
        resolve(inviteBtn);
      }
    }, 200);
    setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, 3000);
  });
}

function waitForAddNoteButton() {
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const btn = document.querySelector('button[aria-label="Add a note"]');
      if (btn) {
        clearInterval(interval);
        resolve(btn);
      }
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, 3000);
  });
}

function waitFor(selectorFn, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const intervalTime = 100;
    let elapsed = 0;
    const interval = setInterval(() => {
      const result = selectorFn();
      if (result) {
        clearInterval(interval);
        resolve(result);
      }
      elapsed += intervalTime;
      if (elapsed >= timeout) {
        clearInterval(interval);
        reject("Element not found in time.");
      }
    }, intervalTime);
  });
}

async function openInviteFlow(fullName) {
  // Try direct "Invite X to connect" first
  const directInviteBtn = Array.from(document.querySelectorAll("button")).find(
    (btn) => btn.getAttribute("aria-label") === `Invite ${fullName} to connect`
  );
  if (directInviteBtn) {
    directInviteBtn.click();
  } else {
    // Fallback: More actions → Invite
    const moreBtn = Array.from(document.querySelectorAll("button")).find(
      (btn) => btn.getAttribute("aria-label")?.includes("More actions")
    );
    if (!moreBtn) return false;
    moreBtn.click();
    const dd = await waitForInviteInDropdown(fullName);
    if (!dd) return false;
    dd.click();
  }
  return true;
}

// async function openAddNoteDialog() {
//   await waitForAddNoteButton();
//   const addNoteBtn = document.querySelector('button[aria-label="Add a note"]');
//   if (!addNoteBtn) return false;
//   addNoteBtn.click();
//   return true;
// }

async function openAddNoteDialog() {
  // Wait for the "Add a note" button to exist
  await waitForAddNoteButton();

  // Click it (robust selector)
  let addNoteBtn =
    document.querySelector('button[aria-label="Add a note"]') ||
    Array.from(document.querySelectorAll("button")).find((b) =>
      /add a note/i.test(b.textContent || "")
    );

  if (!addNoteBtn) return null;
  addNoteBtn.click();

  // Wait for the dialog and the textarea inside it
  try {
    const dialog = await waitFor(() => {
      const dlg =
        document.querySelector('[role="dialog"]') ||
        document.querySelector('[data-test-id*="invite"]') ||
        document.querySelector("[data-test-modal]");
      if (!dlg) return null;

      const ta =
        dlg.querySelector("#custom-message") ||
        dlg.querySelector('textarea[name="message"]') ||
        dlg.querySelector("textarea");
      return ta ? dlg : null;
    }, 4000);

    return dialog; // return the dialog element so we can scope queries
  } catch {
    return null;
  }
}

// Use the native setter so React sees the change
function setNativeValue(el, value) {
  const proto = Object.getPrototypeOf(el);
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  const setter = desc && desc.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
}

async function fillNoteTextIn(dialogEl, message) {
  // Trim to LI’s 300-char limit (safety)
  const msg = (message || "").slice(0, 300);

  // Find the textarea INSIDE the dialog we just opened
  let textarea =
    dialogEl.querySelector("#custom-message") ||
    dialogEl.querySelector('textarea[name="message"]') ||
    dialogEl.querySelector("textarea");

  if (!textarea) {
    // brief retry if the dialog content is still mounting
    await delay(150);
    textarea =
      dialogEl.querySelector("#custom-message") ||
      dialogEl.querySelector('textarea[name="message"]') ||
      dialogEl.querySelector("textarea");
  }
  if (!textarea) return false;

  // Focus first, then set value via native setter, then fire events
  textarea.focus();
  setNativeValue(textarea, ""); // clear
  textarea.dispatchEvent(new Event("input", { bubbles: true }));

  setNativeValue(textarea, msg);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  textarea.dispatchEvent(new Event("change", { bubbles: true }));
  textarea.dispatchEvent(
    new KeyboardEvent("keyup", { bubbles: true, key: " " })
  );

  return true;
}

// function fillNoteText(message) {
//   // Prefer your old target first; then generic textarea
//   const textarea =
//     document.querySelector("#custom-message") ||
//     document.querySelector('textarea[name="message"]') ||
//     document.querySelector("textarea");
//   if (!textarea) return false;
//   textarea.value = message;
//   textarea.dispatchEvent(new Event("input", { bubbles: true }));
//   return true;
// }

async function fillNoteText(message) {
  // Try to (re)locate the textarea; wait briefly if needed
  let textarea =
    document.querySelector("#custom-message") ||
    document.querySelector('textarea[name="message"]') ||
    document.querySelector("textarea");

  if (!textarea) {
    try {
      await delay(200); // tiny wait
      textarea =
        document.querySelector("#custom-message") ||
        document.querySelector('textarea[name="message"]') ||
        document.querySelector("textarea");
    } catch {}
  }

  if (!textarea) return false;

  textarea.value = message;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

/* ---------- Split button injection & behavior ---------- */

function makeSplitButton(onPrimary, onOpenMenu) {
  const wrap = document.createElement("span");
  wrap.className = "qc-wrap";

  // Single element button (label + caret zones)
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "qc-split";
  btn.innerHTML = `
    <img class="ico" src="${chrome.runtime.getURL(
      "icons/btn-icon.svg"
    )}" alt="">
    <span class="lbl">Quick Connect</span>
    <span class="car" aria-hidden="true">▾</span>
  `;

  const menu = document.createElement("div");
  menu.className = "qc-menu";

  wrap.appendChild(btn);
  wrap.appendChild(menu);

  // Click handling: if the click lands inside the '.car' area -> open menu; else primary
  btn.addEventListener("click", (e) => {
    const target = e.target;
    const clickedCaret = target.classList.contains("car");
    if (clickedCaret) {
      onOpenMenu(wrap); // opens/positions & fills menu
    } else {
      onPrimary(); // run the main action
    }
  });

  // Close menu on outside click
  document.addEventListener("click", (ev) => {
    if (!wrap.contains(ev.target)) menu.style.display = "none";
  });

  return wrap;
}

// Open/position the dropdown for a given wrap
function onOpenMenuFactory() {
  return function openMenu(wrapEl) {
    const menu = wrapEl.querySelector(".qc-menu");
    const ctx = getProfileContext();
    menu.innerHTML = buildMenuHtml(ctx);
    menu.style.display = menu.style.display === "block" ? "none" : "block";

    // Position just under the button (right aligned)
    const r = wrapEl.getBoundingClientRect();
    menu.style.position = "fixed";
    menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    menu.style.top = `${r.bottom + 6}px`;

    // Hook clicks
    menu.querySelectorAll(".qc-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const id = item.getAttribute("data-id");
        cache.lastChosenTemplateId = id;
        menu.style.display = "none";
        await onPrimaryClick();
      });
    });
    menu.querySelector('[data-manage="1"]')?.addEventListener("click", () => {
      menu.style.display = "none";
      chrome.runtime.sendMessage({ action: "openOptionsPage" });
    });
  };
}

function buildMenuHtml(ctx) {
  const items = cache.templates
    .map((t) => {
      const prev = renderMessage(t.text, ctx).replace(/\n/g, " ");
      const isDefault = t.id === cache.settings.defaultTemplateId;
      const star = isDefault ? `<span class="star"> ★</span>` : "";
      return `<div class="qc-item" data-id="${t.id}">
      <div class="lbl">${escapeHtml(t.label)}${star}</div>
      <div class="prev">${escapeHtml(prev)}</div>
    </div>`;
    })
    .join("");
  const manage = `<div class="qc-manage" data-manage="1">Manage templates…</div>`;
  return items + manage;
}

function escapeHtml(s) {
  return (s || "").replace(
    /[&<>"']/g,
    (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ])
  );
}

async function onPrimaryClick() {
  if (!cache.templates || cache.templates.length === 0) {
    await loadTemplatesAndSettings();
  }

  const ctx = getProfileContext();
  const tpl = pickActiveTemplate();
  if (!tpl) {
    chrome.runtime.sendMessage({ action: "openOptionsPage" });
    return;
  }

  // Open invite
  const ok = await openInviteFlow(ctx.fullName);
  if (!ok) {
    try {
      await navigator.clipboard.writeText(renderMessage(tpl.text, ctx));
    } catch {}
    alert(
      "Couldn’t open Connect dialog. The message was copied to your clipboard."
    );
    return;
  }

  // Open Add a note → get the dialog back
  const dialog = await openAddNoteDialog();
  if (!dialog) return;

  // Render the message and fill
  const msg = renderMessage(tpl.text, ctx);
  console.log("Filling message:", msg);

  const filled = await fillNoteTextIn(dialog, msg); // <-- await
  if (!filled) {
    try {
      await navigator.clipboard.writeText(msg);
    } catch {}
    alert(
      "Couldn’t find note textarea. The message was copied to your clipboard."
    );
  }
}

function onOpenMenuFactory(wrap) {
  return function (wrapEl) {
    const menu = wrapEl.querySelector(".qc-menu");
    const ctx = getProfileContext();
    menu.innerHTML = buildMenuHtml(ctx);
    menu.style.display = menu.style.display === "block" ? "none" : "block";

    // hook clicks
    menu.querySelectorAll(".qc-item").forEach((item) => {
      item.addEventListener("click", async () => {
        const id = item.getAttribute("data-id");
        cache.lastChosenTemplateId = id;
        menu.style.display = "none";
        await onPrimaryClick(); // fill with chosen
      });
    });
    menu.querySelector('[data-manage="1"]')?.addEventListener("click", () => {
      menu.style.display = "none";
      chrome.runtime.sendMessage({ action: "openOptionsPage" });
    });
  };
}

/* ---------- Your existing helper logic (kept) ---------- */

function watchUrlChangeAndExtractName() {
  // Remove any previous buttons before remount
  document
    .querySelectorAll(".quick-connect-btn, .qc-wrap")
    .forEach((btn) => btn.remove());

  if (location.href.includes("/in/")) {
    waitForProfileName();
  }

  setInterval(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;
      document
        .querySelectorAll(".quick-connect-btn, .qc-wrap")
        .forEach((btn) => btn.remove());
      if (currentUrl.includes("/in/")) {
        waitForProfileName();
      }
    }
  }, 500);
}

function waitForProfileName() {
  const interval = setInterval(() => {
    const nameElement = document.querySelector("h1");
    if (nameElement) {
      clearInterval(interval);
      const name = nameElement.innerText.trim();
      waitForMoreButtons(name, async (moreButtons) => {
        await injectQuickConnectSplitButton(name, moreButtons);
      });
    }
  }, 200);
}

async function injectQuickConnectSplitButton(fullName, moreButtons) {
  // Clean previous
  document
    .querySelectorAll(".quick-connect-btn, .qc-wrap")
    .forEach((btn) => btn.remove());

  if (isAlreadyConnected(fullName)) return;
  if (await isRequestPending(fullName)) return;

  // Ensure templates loaded
  await loadTemplatesAndSettings();

  const onPrimary = onPrimaryClick;
  const onOpenMenu = onOpenMenuFactory();

  // Insert a split button next to each "More actions" (you already have multiple)
  moreButtons.forEach((moreBtn) => {
    if (moreBtn.nextElementSibling?.classList.contains("qc-wrap")) return;
    const wrap = makeSplitButton(onPrimary, onOpenMenu);
    moreBtn.insertAdjacentElement("afterend", wrap);
  });
}

function waitForMoreButtons(fullName, callback) {
  fullName = fullName.trim();
  const interval = setInterval(() => {
    const moreButtons = Array.from(document.querySelectorAll("button")).filter(
      (btn) => btn.getAttribute("aria-label") === "More actions"
    );
    if (moreButtons.length > 0) {
      clearInterval(interval);
      callback(moreButtons);
    }
  }, 200);
}

function isAlreadyConnected(fullName) {
  const connectedItem = Array.from(
    document.querySelectorAll('[role="button"]')
  ).find(
    (el) =>
      el.getAttribute("aria-label") === `Remove your connection to ${fullName}`
  );
  return !!connectedItem;
}

async function isRequestPending(fullName, timeout = 100) {
  try {
    await waitFor(
      () =>
        Array.from(document.querySelectorAll("button")).some(
          (btn) =>
            btn.getAttribute("aria-label") ===
            `Pending, click to withdraw invitation sent to ${fullName}`
        ),
      timeout
    );
    return true;
  } catch {
    return false;
  }
}

/* ---------- Start ---------- */
watchUrlChangeAndExtractName();
