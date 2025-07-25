let currentUrl = location.href;

function getCurrentCompanyName() {
  const companyButton = Array.from(document.querySelectorAll("button")).find(
    (btn) => btn.getAttribute("aria-label")?.startsWith("Current company:")
  );

  if (!companyButton) {
    return "";
  }

  const label = companyButton.getAttribute("aria-label");
  // Extract the company name from the label
  const match = label.match(/^Current company:\s*(.+?)\.\s/i);

  if (match && match[1]) {
    const companyName = match[1].trim();
    return companyName;
  }
  return "";
}

function watchUrlChangeAndExtractName() {
  document
    .querySelectorAll(".quick-connect-btn")
    .forEach((btn) => btn.remove());

  if (location.href.includes("/in/")) {
    waitForProfileName();
  }

  setInterval(() => {
    if (location.href !== currentUrl) {
      currentUrl = location.href;

      // Only run if we're on a profile page
      if (currentUrl.includes("/in/")) {
        waitForProfileName();
      }
    }
  }, 500); // check every half second
}

function waitForProfileName() {
  const interval = setInterval(() => {
    const nameElement = document.querySelector("h1");
    if (nameElement) {
      clearInterval(interval);
      const name = nameElement.innerText.trim();
      const [firstName, ...rest] = name.split(" ");
      //   const lastName = rest.join(" ").trim();

      waitForMoreButtons(firstName, async (moreButtons) => {
        await injectQuickConnectButton(name, moreButtons);
      });
    }
  }, 200);
}

async function injectQuickConnectButton(name, moreButtons) {
  document
    .querySelectorAll(".quick-connect-btn")
    .forEach((btn) => btn.remove());
  if (isAlreadyConnected(name)) {
    return;
  }

  if (await isRequestPending(name)) {
    return;
  }

  const [firstName, ...rest] = name.split(" ");
  moreButtons.forEach((moreBtn, index) => {
    const quickBtn = document.createElement("button");
    quickBtn.innerHTML = `
      <img src="${chrome.runtime.getURL(
        "icons/btn-icon.svg"
      )}" alt="" style="width: 16px; height: 16px; margin-right: 6px; vertical-align: middle;">
      <span>Quick Connect</span>
    `;
    quickBtn.className = "quick-connect-btn";
    quickBtn.style.fontWeight = "600";
    quickBtn.style.marginTop = "0px";
    quickBtn.style.marginRight = "8px";
    quickBtn.style.marginBottom = "0px";
    quickBtn.style.marginLeft = "8px";
    quickBtn.style.backgroundColor = "#303336";
    quickBtn.style.color = "white";
    quickBtn.style.border = "none";
    quickBtn.style.borderRadius = "100px";
    quickBtn.style.padding = "6px 16px";
    quickBtn.style.fontSize = "14px";
    quickBtn.style.cursor = "pointer";

    // Add your click handler here if needed
    quickBtn.addEventListener("click", async () => {
      // Try direct invite button first
      const directInviteBtn = Array.from(
        document.querySelectorAll("button")
      ).find(
        (btn) => btn.getAttribute("aria-label") === `Invite ${name} to connect`
      );

      if (directInviteBtn) {
        directInviteBtn.click();

        clickAddNoteButton(firstName);
        return;
      } else {
        // Fallback: Try opening from "More" dropdown
        const moreBtn = Array.from(document.querySelectorAll("button")).find(
          (btn) => btn.getAttribute("aria-label")?.includes("More actions")
        );
        if (moreBtn) {
          moreBtn.click();

          // Wait for dropdown menu to appear
          const dropdownInviteBtn = await waitForInviteInDropdown(name);
          if (dropdownInviteBtn) {
            dropdownInviteBtn.click();
          } else {
            return;
          }
          clickAddNoteButton(firstName);
        } else {
          return;
        }
      }
    });
    if (moreBtn.nextElementSibling?.classList.contains("quick-connect-btn"))
      return;
    moreBtn.insertAdjacentElement("afterend", quickBtn);
  });
}

async function clickAddNoteButton(firstName) {
  await waitForAddNoteButton();
  const addNoteBtn = document.querySelector('button[aria-label="Add a note"]');
  if (addNoteBtn) {
    addNoteBtn.click();
    const company = getCurrentCompanyName();
    message =
      "Hi " +
      firstName +
      ",\nI came across your profile while exploring roles at " +
      company +
      " and wanted to reach out. I have 8 years of software development experience and recently wrapped up my MBA. I’ve led several end-to-end technical projects and would love to connect and learn more about your work at " +
      company +
      ".";
    await waitFor(() => document.querySelector('textarea[name="message"]'));
    // fillNoteMessage(message);
    chrome.storage.sync.get(["customMessage"], (result) => {
      const message = result.customMessage;

      if (!message || message.trim() === "") {
        chrome.runtime.sendMessage({ action: "openOptionsPage" });
        return;
      }

      fillNoteMessage(firstName, company, message); // your existing function
    });
  }
}

function waitForInviteInDropdown(fullName) {
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

    // Optional timeout fallback
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

    // Optional 5s timeout fallback
    setTimeout(() => {
      clearInterval(interval);
      resolve(null);
    }, 3000);
  });
}

// function fillNoteMessage(message) {
//   const textarea = document.querySelector('textarea[name="message"]');
//   //   injectRephraseButton();
//   if (!textarea) {
//     return false;
//   }

//   textarea.value = message;
//   textarea.dispatchEvent(new Event("input", { bubbles: true }));
//   return true;
// }

function fillNoteMessage(
  firstName,
  company,
  defaultMessage = "Hi! I'd love to connect with you."
) {
  const textarea = document.querySelector("#custom-message");
  if (!textarea) {
    return;
  }

  chrome.storage.sync.get(
    ["customMessage", "addGreeting", "connectionHistory"],
    (data) => {
      var message = data.customMessage || defaultMessage;
      const addGreeting = data.addGreeting;

      message = message.replace(/firstName/g, firstName);
      message = message.replace(/cmpny/g, company || "");

      if (addGreeting) {
        message = `Hi ${firstName}` + ",\n" + message;
      }
      textarea.value = message;
      textarea.dispatchEvent(new Event("input", { bubbles: true }));

      // --- Analytics: Save to history ---
      const newEntry = {
        url: window.location.href,
        name: firstName, // Only first name available here
        company: company || "",
        message: message,
        date: new Date().toISOString(),
        status: "pending",
      };
      const history = data.connectionHistory || [];
      // Avoid duplicate entries for the same profile on the same day
      const isDuplicate = history.some(
        (entry) =>
          entry.url === newEntry.url &&
          entry.date.slice(0, 10) === newEntry.date.slice(0, 10)
      );
      if (!isDuplicate) {
        chrome.storage.sync.set({ connectionHistory: [newEntry, ...history] });
      }
      // --- End Analytics ---
    }
  );
}

function waitForMoreButtons(firstName, callback) {
  firstName = firstName.trim();
  const interval = setInterval(() => {
    const moreButtons = Array.from(document.querySelectorAll("button")).filter(
      (btn) => btn.getAttribute("aria-label") === "More actions"
    );

    if (moreButtons.length > 0) {
      clearInterval(interval);
      callback(moreButtons); // pass array of matched buttons
    }
  }, 200);
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

function isAlreadyConnected(fullName) {
  const connectedItem = Array.from(
    document.querySelectorAll('[role="button"]')
  ).find(
    (el) =>
      el.getAttribute("aria-label") === `Remove your connection to ${fullName}`
  );

  if (connectedItem) {
    return true;
  }

  return false;
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
  } catch (err) {
    // Element not found within timeout
    return false;
  }
}

watchUrlChangeAndExtractName();
