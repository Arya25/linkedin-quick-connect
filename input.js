document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("messageInput");
  const saveBtn = document.getElementById("saveBtn");
  const status = document.getElementById("status");
  const greetingToggle = document.getElementById("addGreetingToggle");
  const charCount = document.getElementById("charCount");

  function updateCharacterCount() {
    charCount.textContent = `Characters: ${messageInput.value.length} / 300`;
  }
  messageInput.addEventListener("input", updateCharacterCount);

  // Load saved message
  chrome.storage.sync.get(["customMessage", "addGreeting"], (data) => {
    if (data.customMessage) {
      messageInput.value = data.customMessage;
    }
    greetingToggle.checked = data.addGreeting ?? false;
  });

  // Save message on click
  saveBtn.addEventListener("click", () => {
    const message = messageInput.value.trim();
    const addGreeting = greetingToggle.checked;
    if (message) {
      chrome.storage.sync.set({ customMessage: message, addGreeting }, () => {
        status.textContent = "Message saved!";
        setTimeout(() => (status.textContent = ""), 2000);
      });
    }
  });

  document.querySelectorAll(".sample-msg").forEach((msg) => {
    msg.addEventListener("click", () => {
      const textToCopy = msg.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        showCopiedMessage(msg);
      });
    });
  });

  function showCopiedMessage(element) {
    const copiedMsg = document.createElement("div");
    copiedMsg.innerText = "Text copied!";
    copiedMsg.className = "copied-tooltip";
    element.appendChild(copiedMsg);

    setTimeout(() => {
      copiedMsg.remove();
    }, 2000);
  }
});
