const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("fileInput");
const fileLabel = document.getElementById("fileLabel");
const uploadBtn = document.getElementById("uploadBtn");
const uploadStatus = document.getElementById("uploadStatus");
const docList = document.getElementById("docList");
const docFilter = document.getElementById("docFilter");
const messages = document.getElementById("messages");
const askForm = document.getElementById("askForm");
const questionInput = document.getElementById("question");
const askBtn = document.getElementById("askBtn");

let history = []; // [{ role: "user" | "bot", text }]

// ---------- helpers ----------
async function api(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function addMessage(text, type, sources) {
  const div = document.createElement("div");
  div.className = `msg ${type}`;
  div.textContent = text; // textContent keeps it safe from HTML injection

  if (sources && sources.length) {
    const details = document.createElement("details");
    details.className = "sources";
    const summary = document.createElement("summary");
    summary.textContent = `Sources (${sources.length})`;
    details.appendChild(summary);

    for (const s of sources) {
      const item = document.createElement("div");
      item.className = "source-item";
      const title = document.createElement("b");
      title.textContent = `${s.source} - part ${s.chunk + 1}`;
      const body = document.createElement("span");
      body.textContent = s.text + (s.text.length >= 300 ? "..." : "");
      item.append(title, body);
      details.appendChild(item);
    }
    div.appendChild(details);
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

// ---------- documents ----------
async function loadDocuments() {
  try {
    const { documents } = await api("/api/documents");

    docList.innerHTML = "";
    if (documents.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No documents yet";
      docList.appendChild(li);
    }

    const current = docFilter.value;
    docFilter.innerHTML = '<option value="">All documents</option>';

    for (const doc of documents) {
      const li = document.createElement("li");
      const info = document.createElement("div");
      const name = document.createElement("div");
      name.className = "name";
      name.textContent = doc.name;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${doc.chunks} chunks`;
      info.append(name, meta);

      const del = document.createElement("button");
      del.className = "del";
      del.title = "Delete";
      del.textContent = "×";
      del.addEventListener("click", async () => {
        if (!confirm(`Delete ${doc.name}?`)) return;
        try {
          await api(`/api/documents/${encodeURIComponent(doc.name)}`, { method: "DELETE" });
          loadDocuments();
        } catch (err) {
          uploadStatus.className = "status error";
          uploadStatus.textContent = err.message;
        }
      });

      li.append(info, del);
      docList.appendChild(li);

      const opt = document.createElement("option");
      opt.value = doc.name;
      opt.textContent = doc.name;
      docFilter.appendChild(opt);
    }

    docFilter.value = documents.some((d) => d.name === current) ? current : "";
  } catch (err) {
    uploadStatus.className = "status error";
    uploadStatus.textContent = err.message;
  }
}

fileInput.addEventListener("change", () => {
  fileLabel.textContent = fileInput.files[0] ? fileInput.files[0].name : "Choose PDF or TXT";
});

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    uploadStatus.className = "status error";
    uploadStatus.textContent = "Please choose a file first.";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  uploadBtn.disabled = true;
  uploadStatus.className = "status";
  uploadStatus.textContent = "Uploading and processing... (large files take a minute)";

  try {
    const data = await api("/api/upload", { method: "POST", body: formData });
    uploadStatus.className = "status ok";
    uploadStatus.textContent = `Done: ${data.chunks} chunks stored.`;
    fileInput.value = "";
    fileLabel.textContent = "Choose PDF or TXT";
    loadDocuments();
  } catch (err) {
    uploadStatus.className = "status error";
    uploadStatus.textContent = err.message;
  } finally {
    uploadBtn.disabled = false;
  }
});

// ---------- chat ----------
askForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;

  addMessage(question, "user");
  questionInput.value = "";
  askBtn.disabled = true;
  const thinking = addMessage("Thinking...", "bot");

  try {
    const data = await api("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        source: docFilter.value,
        history,
      }),
    });

    thinking.remove();
    addMessage(data.answer, "bot", data.sources);
    history.push({ role: "user", text: question }, { role: "bot", text: data.answer });
  } catch (err) {
    thinking.remove();
    addMessage(err.message, "bot error");
  } finally {
    askBtn.disabled = false;
    questionInput.focus();
  }
});

loadDocuments();
