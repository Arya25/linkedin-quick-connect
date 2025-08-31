// ============ Storage keys & defaults ============
const K = {
  TEMPLATES: "templates",
  SETTINGS: "settings",
  LEGACY_MSG: "customMessage",
  LEGACY_GREETING: "addGreeting",
};

const uid = () => "tpl_" + Math.random().toString(36).slice(2) + Date.now();

// ============ State ============
let templates = [];
let settings = { addGreeting: true, defaultTemplateId: "" };
let selectedId = null; // current template being edited (null = new)

// ============ DOM ============
const addGreetingToggle = document.getElementById("addGreetingToggle");
addGreetingToggle.checked = true;
const menuBtn = document.getElementById("menuBtn");
const menuPanel = document.getElementById("menuPanel");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importFile = document.getElementById("importFile");
const resetSamplesBtn = document.getElementById("resetSamplesBtn");

const editorTitle = document.getElementById("editorTitle");
const tplLabel = document.getElementById("tplLabel");
const tplText = document.getElementById("tplText");
const charCount = document.getElementById("charCount");
const preview = document.getElementById("preview");
const saveTplBtn = document.getElementById("saveTplBtn");
const statusEl = document.getElementById("status");

const listEl = document.getElementById("templatesList");
const countPill = document.getElementById("countPill");
const emptyMsg = document.getElementById("emptyMsg");
const clearBtn = document.getElementById("clearEditorBtn");
if (clearBtn) {
  clearBtn.addEventListener("click", startNew);
}

// ============ Boot ============
document.addEventListener("DOMContentLoaded", async () => {
  await migrateIfNeeded();
  await loadAll();
  wireUI();
  renderList();
  // If we have templates, select first; else start in "new" mode
  if (templates.length) {
    select(templates[0].id);
  } else {
    startNew();
  }
  // Ensure a subtle “+ New” exists without cluttering your HTML
  // ensureNewButton();
});

// ============ Migration (from old single message) ============
async function migrateIfNeeded() {
  return new Promise((res) => {
    chrome.storage.sync.get(
      [K.TEMPLATES, K.SETTINGS, K.LEGACY_MSG, K.LEGACY_GREETING],
      (d) => {
        if (Array.isArray(d[K.TEMPLATES])) return res(); // already migrated
        const legacyMsg = (d[K.LEGACY_MSG] || "").trim();
        const legacyGreeting = d[K.LEGACY_GREETING];

        const seed = legacyMsg
          ? [{ id: "default", label: "Default", text: legacyMsg }]
          : [
              {
                id: "default",
                label: "Default",
                text: "I would love to connect!",
              },
              {
                id: uid(),
                label: "Recruiter: short",
                text: "I am exploring roles at {cmpny}. Cornell Tech MBA + 8y SWE in fintech. Would love to connect.",
              },
              {
                id: uid(),
                label: "Friendly",
                text: "I came across your profile and would love to connect.",
              },
              {
                id: uid(),
                label: "Recruiter: long",
                text: "I came across your profile and noticed that you are currently hiring for a role of ________ at {cmpny}. I am very interested in this role and believe that my skills and experience make me a strong candidate. I would love to connect and discuss how I can contribute to your team at {cmpny}.",
              },
            ];

        chrome.storage.sync.set(
          {
            [K.TEMPLATES]: seed,
            [K.SETTINGS]: {
              addGreeting:
                typeof legacyGreeting === "boolean" ? legacyGreeting : true,
              defaultTemplateId: "default",
            },
          },
          res
        );
      }
    );
  });
}

// ============ Load / Save ============
async function loadAll() {
  return new Promise((res) => {
    chrome.storage.sync.get([K.TEMPLATES, K.SETTINGS], (d) => {
      templates = Array.isArray(d[K.TEMPLATES]) ? d[K.TEMPLATES] : [];
      const s = d[K.SETTINGS] || {};
      settings = {
        addGreeting: typeof s.addGreeting === "boolean" ? s.addGreeting : true,
        defaultTemplateId: s.defaultTemplateId || "",
      };
      addGreetingToggle.checked = settings.addGreeting;
      res();
    });
  });
}

function saveTemplates() {
  return new Promise((r) =>
    chrome.storage.sync.set({ [K.TEMPLATES]: templates }, r)
  );
}
function saveSettings() {
  return new Promise((r) =>
    chrome.storage.sync.set({ [K.SETTINGS]: settings }, r)
  );
}

// ============ UI wiring ============
function wireUI() {
  // Hamburger toggling
  menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const showing = menuPanel.style.display === "block";
    menuPanel.style.display = showing ? "" : "block";
  });
  document.addEventListener("click", (e) => {
    if (
      menuPanel.style.display === "block" &&
      !menuPanel.contains(e.target) &&
      e.target !== menuBtn
    ) {
      menuPanel.style.display = "";
    }
  });

  // Menu actions
  exportBtn.addEventListener("click", () => {
    menuPanel.style.display = "";
    doExport();
  });
  importBtn.addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => {
    const f = e.target.files?.[0];
    if (f) doImport(f);
    importFile.value = "";
    menuPanel.style.display = "";
  });
  resetSamplesBtn.addEventListener("click", () => {
    resetSamples();
    menuPanel.style.display = "";
  });

  // Editor
  addGreetingToggle.addEventListener("change", async (e) => {
    settings.addGreeting = !!e.target.checked;
    await saveSettings();
    updatePreview();
  });
  tplText.addEventListener("input", updatePreview);
  tplLabel.addEventListener(
    "input",
    () => (editorTitle.textContent = `${tplLabel.value || "new"}`)
  );
  saveTplBtn.addEventListener("click", saveCurrent);

  // Samples -> start a new draft prefilled with clicked sample
  // Samples -> start a new draft prefilled with clicked sample
  document.querySelectorAll(".sample-msg").forEach((el) => {
    el.addEventListener("click", () => {
      startNew();

      // Normalize whitespace: collapse all runs of spaces/newlines/tabs to a single space
      const raw = el.textContent || "";
      const normalized = raw
        .replace(/\u00A0/g, " ") // non-breaking space → space
        .replace(/\s+/g, " ") // collapse all whitespace
        .replace(/\s+([,.!?;:])/g, "$1") // remove space before punctuation
        .trim();

      tplText.value = normalized.slice(0, 300); // respect 300-char cap
      updatePreview();
      tplLabel.focus();
    });
  });
}

// Add a tiny “+ New” button next to the title if you didn’t include one in HTML
function ensureNewButton() {
  if (document.getElementById("newTemplateBtn")) return;
  const btn = document.createElement("button");
  btn.id = "newTemplateBtn";
  btn.textContent = "+ New";
  btn.className = "icon-btn";
  btn.style.marginLeft = "8px";
  btn.style.fontSize = "14px";
  btn.addEventListener("click", startNew);
  // place beside the Editor title
  const h = editorTitle;
  const wrap = document.createElement("span");
  wrap.style.marginLeft = "6px";
  wrap.appendChild(btn);
  h.after(wrap);
}

// ============ Editor helpers ============
function startNew() {
  selectedId = null;
  editorTitle.textContent = "Create New";
  tplLabel.value = "";
  tplText.value = "";
  updatePreview();
}

function select(id) {
  selectedId = id;
  const t = templates.find((x) => x.id === id);
  editorTitle.textContent = `${t?.label || "new"}`;
  tplLabel.value = t?.label || "";
  tplText.value = t?.text || "";
  updatePreview();
}

function updatePreview() {
  const raw = (tplText.value || "").slice(0, 300);
  if (tplText.value.length > 300) tplText.value = raw; // hard trim to 300
  charCount.textContent = `${raw.length} / 300`;
  const withGreeting = settings.addGreeting ? `Hi {firstName}, ${raw}` : raw;
  preview.textContent = withGreeting
    .replaceAll("{firstName}", "Shubham")
    .replaceAll("{cmpny}", "Acme Corp");
}

// ============ CRUD ============
async function saveCurrent() {
  const label = (tplLabel.value || "").trim();
  const text = (tplText.value || "").trim();

  if (!label) return toast("Label required");
  if (!text) return toast("Message required");

  if (!selectedId) {
    // create new
    const t = { id: uid(), label, text };
    templates.push(t);
    if (!settings.defaultTemplateId) settings.defaultTemplateId = t.id;
    selectedId = t.id;
  } else {
    // update existing
    const i = templates.findIndex((x) => x.id === selectedId);
    if (i >= 0) templates[i] = { ...templates[i], label, text };
  }

  await saveTemplates();
  await saveSettings();
  renderList();
  select(selectedId);
  toast("Saved");
}

async function deleteTemplate(id) {
  const i = templates.findIndex((t) => t.id === id);
  if (i < 0) return;
  const wasDefault = templates[i].id === settings.defaultTemplateId;
  templates.splice(i, 1);
  if (wasDefault) settings.defaultTemplateId = templates[0]?.id || "";
  if (selectedId === id) selectedId = templates[0]?.id || null;

  await saveTemplates();
  await saveSettings();
  renderList();
  if (selectedId) select(selectedId);
  else startNew();
  toast("Deleted");
}

async function setDefault(id) {
  settings.defaultTemplateId = id;
  await saveSettings();
  renderList();
  toast("Default updated");
}

// ============ List rendering (fixed width, compact) ============
function renderList() {
  listEl.innerHTML = "";

  // Sort alphabetical by label
  const sorted = templates
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));

  sorted.forEach((t) => listEl.appendChild(rowEl(t)));

  countPill.textContent = `${templates.length} total`;
  emptyMsg.style.display = templates.length ? "none" : "block";
}

function rowEl(t) {
  const row = document.createElement("div");
  row.className = "trow";

  // default star
  const star = document.createElement("div");
  star.className = "star";
  if (t.id === settings.defaultTemplateId) star.classList.add("default");
  star.textContent = t.id === settings.defaultTemplateId ? "★" : "☆";
  star.title = "Set as default";
  star.addEventListener("click", () => setDefault(t.id));

  // label + preview (click opens in editor)
  const text = document.createElement("div");
  const lab = document.createElement("div");
  lab.className = "label";
  lab.textContent = t.label;
  const prev = document.createElement("small");
  prev.textContent = t.text;
  text.appendChild(lab);
  text.appendChild(prev);
  text.style.cursor = "pointer";
  text.addEventListener("click", () => select(t.id));

  // edit button
  const edit = document.createElement("button");
  edit.className = "icon-btn sm";
  edit.textContent = "✎";
  edit.title = "Edit";
  edit.addEventListener("click", () => select(t.id));

  // delete button
  const del = document.createElement("button");
  del.className = "icon-btn sm delete-btn";
  del.textContent = "🗑";
  del.title = "Delete";
  del.addEventListener("click", () => deleteTemplate(t.id));

  row.append(star, text, edit, del);
  return row;
}

// ============ Export / Import / Reset ============
function doExport() {
  const payload = JSON.stringify({ templates, settings }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "quick-connect-templates.json";
  a.click();
  URL.revokeObjectURL(url);
}

function doImport(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.templates) || !data.settings)
        throw new Error("bad file");
      templates = data.templates;
      settings = {
        addGreeting: false,
        defaultTemplateId: "",
        ...data.settings,
      };
      await saveTemplates();
      await saveSettings();
      renderList();
      if (templates[0]) select(templates[0].id);
      else startNew();
      toast("Imported");
    } catch {
      toast("Import failed");
    }
  };
  reader.readAsText(file);
}

async function resetSamples() {
  templates = [
    {
      id: "default",
      label: "Default",
      text: "I would love to connect!",
    },
    {
      id: uid(),
      label: "Recruiter: short",
      text: "I am currently exploring roles at {cmpny}. Cornell Tech MBA + 8y SWE in fintech. Would love to connect.",
    },
    {
      id: uid(),
      label: "Friendly",
      text: "I came across your profile and would love to connect.",
    },
    {
      id: uid(),
      label: "Recruiter: long",
      text: "I came across your profile and noticed that you are currently hiring for a role of ________ at {cmpny}. I am very interested in this role and believe that my skills and experience make me a strong candidate. I would love to connect and discuss how I can contribute to your team at {cmpny}.",
    },
  ];
  settings.defaultTemplateId = "default";
  await saveTemplates();
  await saveSettings();
  renderList();
  select("default");
  toast("Reset");
  settings.addGreeting = true; // default ON after reset
  addGreetingToggle.checked = true;
}

// ============ Helpers ============
function toast(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ""), 1500);
}
