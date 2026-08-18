// =====================================================
// PROGRAM NOTEBOOK
// FRONTEND APPLICATION
// =====================================================

const API_BASE =
  "/api";

// =====================================================
// GLOBAL STATE
// =====================================================

let currentUser = null;
let authToken = null;

let myNotes = [];
let visibleNotes = [];
let subjects = [];

let currentPage = "home";

let readerNotes = [];
let readerIndex = 0;

let editingNoteId = null;

// =====================================================
// DOM HELPER
// =====================================================

function $(id) {
  return document.getElementById(id);
}

// =====================================================
// TOAST
// =====================================================

function showToast(
  message,
  type = "normal"
) {
  const toast = $("toast");

  if (!toast) return;

  toast.textContent = message;

  toast.className =
    "show " + type;

  clearTimeout(
    showToast.timer
  );

  showToast.timer =
    setTimeout(() => {
      toast.className = "";
    }, 3000);
}

// =====================================================
// API REQUEST
// =====================================================

// =====================================================
// API REQUEST
// =====================================================

const SERVER_DOWN_MESSAGE =
  "Server is currently unavailable. Please try again after some time. Thank you.";

async function apiRequest(
  endpoint,
  options = {}
) {
  const url =
    API_BASE + endpoint;

  const headers = {
    ...(options.headers || {}),
  };

  if (
    options.body &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] =
      "application/json";
  }

  if (authToken) {
    headers.Authorization =
      `Bearer ${authToken}`;
  }

  let response;

  try {
    response =
      await fetch(url, {
        ...options,
        headers,
      });
  } catch (error) {
    console.error(
      "NETWORK ERROR:",
      error
    );

    throw new Error(
      SERVER_DOWN_MESSAGE
    );
  }

  let text = "";

  try {
    text =
      await response.text();
  } catch (error) {
    console.error(
      "RESPONSE READ ERROR:",
      error
    );

    throw new Error(
      SERVER_DOWN_MESSAGE
    );
  }

  let data = {};

  try {
    data =
      text
        ? JSON.parse(text)
        : {};
  } catch (error) {
    console.error(
      "SERVER RETURNED INVALID RESPONSE:",
      text
    );

    throw new Error(
      SERVER_DOWN_MESSAGE
    );
  }

  // -------------------------------------------------
  // SERVER / DATABASE UNAVAILABLE
  // -------------------------------------------------

  if (
    response.status === 502 ||
    response.status === 503 ||
    response.status === 504
  ) {
    throw new Error(
      SERVER_DOWN_MESSAGE
    );
  }

  // -------------------------------------------------
  // MONGODB / SERVER ERROR
  // NEVER SHOW RAW DATABASE ERROR TO USER
  // -------------------------------------------------

  if (!response.ok) {
    const serverMessage =
      String(
        data?.message || ""
      ).toLowerCase();

    if (
      serverMessage.includes(
        "buffering timed out"
      ) ||
      serverMessage.includes(
        "mongo"
      ) ||
      serverMessage.includes(
        "mongoose"
      ) ||
      serverMessage.includes(
        "database"
      ) ||
      serverMessage.includes(
        "server selection"
      ) ||
      serverMessage.includes(
        "topology"
      ) ||
      response.status >= 500
    ) {
      throw new Error(
        SERVER_DOWN_MESSAGE
      );
    }

    // Normal user errors
    throw new Error(
      data.message ||
      `Request failed (${response.status})`
    );
  }

  return data;
}

// =====================================================
// STORAGE
// =====================================================

function saveSession(
  token,
  user
) {
  authToken =
    token || null;

  currentUser =
    user || null;

  if (authToken) {
    localStorage.setItem(
      "pn_token",
      authToken
    );
  } else {
    localStorage.removeItem(
      "pn_token"
    );
  }

  if (currentUser) {
    localStorage.setItem(
      "pn_user",
      JSON.stringify(
        currentUser
      )
    );
  } else {
    localStorage.removeItem(
      "pn_user"
    );
  }
}

function loadSession() {
  authToken =
    localStorage.getItem(
      "pn_token"
    );

  try {
    currentUser =
      JSON.parse(
        localStorage.getItem(
          "pn_user"
        ) || "null"
      );
  } catch {
    currentUser = null;
  }
}

function clearSession() {
  authToken = null;
  currentUser = null;

  localStorage.removeItem(
    "pn_token"
  );

  localStorage.removeItem(
    "pn_user"
  );
}

// =====================================================
// AUTH SCREEN
// =====================================================

function showLoginScreen() {
  $("loginScreen")?.classList.remove(
    "hidden"
  );

  $("app")?.classList.add(
    "hidden"
  );
}

function showApp() {
  $("loginScreen")?.classList.add(
    "hidden"
  );

  $("app")?.classList.remove(
    "hidden"
  );
}

// =====================================================
// USER ID CHECK
// =====================================================

async function startNotebook() {
  const input =
    $("nameInput");

  const name =
    String(
      input?.value || ""
    ).trim();

  if (!name) {
    showToast(
      "Please enter your User ID",
      "error"
    );

    input?.focus();

    return;
  }

  const button =
    $("startBtn");

  if (button) {
    button.disabled = true;
    button.innerHTML =
      "Checking... <span>⏳</span>";
  }

  try {
    const data =
      await apiRequest(
        "/auth/check",
        {
          method: "POST",

          body: JSON.stringify({
            name,
          }),
        }
      );

    // -------------------------------------------------
    // EXISTING USER
    // -------------------------------------------------

    // -------------------------------------------------
// EXISTING USER
// -------------------------------------------------

if (
  data.exists &&
  data.hasPassword
) {
  $("userStep")?.classList.add("hidden");

  $("passwordStep")?.classList.remove("hidden");

  $("createStep")?.classList.add("hidden");

  const passwordInput = $("passwordInput");

  if (passwordInput) {
    passwordInput.value = "";
    passwordInput.focus();
  }

  if ($("authDescription")) {
    $("authDescription").textContent =
      `Welcome back, ${name}. Enter your password to continue.`;
  }

  return;
}

    // -------------------------------------------------
    // NEW USER
    // -------------------------------------------------

    $("userStep")?.classList.add(
      "hidden"
    );

    $("passwordStep")?.classList.add(
      "hidden"
    );

    $("createStep")?.classList.remove(
      "hidden"
    );

    if ($("newUserName")) {
      $("newUserName").textContent =
        name;
    }

    $("createPasswordInput").value =
      "";

    $("confirmPasswordInput").value =
      "";

    if ($("authDescription")) {
      $("authDescription").textContent =
        "Create your personal Program Notebook.";
    }

    $("createPasswordInput")?.focus();
  } catch (error) {
    console.error(
      "CHECK USER ERROR:",
      error
    );

    showToast(
      error.message,
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML =
        'Continue <span>→</span>';
    }
  }
}

// =====================================================
// LOGIN
// =====================================================

async function loginUser() {
  const name =
    String(
      $("nameInput")?.value || ""
    ).trim();

  const password =
    String(
      $("passwordInput")?.value || ""
    );

  if (!name) {
    showToast(
      "User ID is required",
      "error"
    );

    return;
  }

  if (!password) {
    showToast(
      "Password is required",
      "error"
    );

    $("passwordInput")?.focus();

    return;
  }

  const button =
    $("loginBtn");

  if (button) {
    button.disabled = true;
    button.innerHTML =
      "Logging in... <span>⏳</span>";
  }

  try {
    const data =
      await apiRequest(
        "/auth/login",
        {
          method: "POST",

          body: JSON.stringify({
            name,
            password,
          }),
        }
      );

    // -------------------------------------------------
    // TOKEN + USER
    // -------------------------------------------------

    const token =
      data.token ||
      data.data?.token;

    const user =
      data.user ||
      data.data?.user;

    if (
      !token ||
      !user
    ) {
      console.error(
        "LOGIN RESPONSE:",
        data
      );

      throw new Error(
        "Server did not return login token/user data."
      );
    }

    saveSession(
      token,
      user
    );

    showToast(
      "Login successful",
      "success"
    );

    await openNotebook();
  } catch (error) {
    console.error(
      "LOGIN ERROR:",
      error
    );

    showToast(
      error.message,
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML =
        'Login <span>→</span>';
    }
  }
}

// =====================================================
// REGISTER
// =====================================================

async function createNotebook() {
  const name =
    String(
      $("nameInput")?.value || ""
    ).trim();

  const password =
    String(
      $("createPasswordInput")
        ?.value || ""
    );

  const confirmPassword =
    String(
      $("confirmPasswordInput")
        ?.value || ""
    );

  if (!name) {
    showToast(
      "User ID is required",
      "error"
    );

    return;
  }

  if (!password) {
    showToast(
      "Create a password",
      "error"
    );

    return;
  }

  if (
    password.length < 4
  ) {
    showToast(
      "Password must be at least 4 characters",
      "error"
    );

    return;
  }

  if (
    password !==
    confirmPassword
  ) {
    showToast(
      "Passwords do not match",
      "error"
    );

    return;
  }

  const button =
    $("createBtn");

  if (button) {
    button.disabled = true;
    button.innerHTML =
      "Creating... <span>⏳</span>";
  }

  try {
    const data =
      await apiRequest(
        "/auth/register",
        {
          method: "POST",

          body: JSON.stringify({
            name,
            password,
            confirmPassword,
          }),
        }
      );

    const token =
      data.token ||
      data.data?.token;

    const user =
      data.user ||
      data.data?.user;

    if (
      !token ||
      !user
    ) {
      throw new Error(
        "Server did not return account data."
      );
    }

    saveSession(
      token,
      user
    );

    showToast(
      "Notebook created successfully",
      "success"
    );

    await openNotebook();
  } catch (error) {
    console.error(
      "CREATE USER ERROR:",
      error
    );

    showToast(
      error.message,
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML =
        'Create Notebook <span>→</span>';
    }
  }
}

// =====================================================
// OPEN NOTEBOOK
// =====================================================

async function openNotebook() {
  if (
    !currentUser ||
    !currentUser.name
  ) {
    clearSession();
    showLoginScreen();
    return;
  }

  showApp();

  updateUserUI();

  await loadAllData();

  showPage("home");
}

// =====================================================
// LOAD ALL DATA
// =====================================================

async function loadAllData() {
  if (
    !currentUser?.name
  ) {
    return;
  }

  try {
    const user =
      encodeURIComponent(
        currentUser.name
      );

    const [
      ownNotesData,
      visibleNotesData,
      subjectsData,
    ] =
      await Promise.all([
        apiRequest(
          `/notes?user=${user}`
        ),

        apiRequest(
          `/visible-notes?user=${user}`
        ),

        apiRequest(
          `/subjects?user=${user}`
        ),
      ]);

    myNotes =
      Array.isArray(
        ownNotesData
      )
        ? ownNotesData
        : [];

    visibleNotes =
      Array.isArray(
        visibleNotesData
      )
        ? visibleNotesData
        : [];

    subjects =
      Array.isArray(
        subjectsData
      )
        ? subjectsData
        : [];

    // -------------------------------------------------
    // IMPORTANT:
    // PUBLIC NOTES FROM ALL USERS ARE INCLUDED HERE.
    // -------------------------------------------------

    renderHome();

    renderSubjects();

    updateStats();

    updateSubjectOptions();

    renderProfile();
  } catch (error) {
    console.error(
      "LOAD DATA ERROR:",
      error
    );

    showToast(
      error.message,
      "error"
    );
  }
}

// =====================================================
// USER UI
// =====================================================

function getInitial(
  name
) {
  return (
    String(
      name || "U"
    )
      .trim()
      .charAt(0)
      .toUpperCase() || "U"
  );
}

function updateUserUI() {
  const name =
    currentUser?.name ||
    "User";

  const initial =
    getInitial(name);

  const ids = [
    "sideName",
    "topName",
    "welcomeName",
    "profileName",
  ];

  ids.forEach(
    (id) => {
      const el = $(id);

      if (el) {
        el.textContent =
          name;
      }
    }
  );

  [
    "avatar",
    "topAvatar",
    "bigAvatar",
  ].forEach(
    (id) => {
      const el = $(id);

      if (el) {
        el.textContent =
          initial;
      }
    }
  );

  if ($("profileLabel")) {
    $("profileLabel").textContent =
      "Active";
  }
}

// =====================================================
// STATS
// =====================================================

function updateStats() {
  const uniqueSubjects =
    new Set(
      myNotes.map(
        (note) =>
          note.subject
      )
    );

  if ($("subjectCount")) {
    $("subjectCount").textContent =
      uniqueSubjects.size;
  }

  if ($("questionCount")) {
    $("questionCount").textContent =
      myNotes.length;
  }

  if ($("profileSubjects")) {
    $("profileSubjects").textContent =
      uniqueSubjects.size;
  }

  if ($("profileQuestions")) {
    $("profileQuestions").textContent =
      myNotes.length;
  }
}

// =====================================================
// HOME
// =====================================================

function renderHome(
  random = false
) {
  let notes =
    [...visibleNotes];

  if (random) {
    notes.sort(
      () =>
        Math.random() -
        0.5
    );
  }

  const feed =
    $("randomFeed");

  if (!feed) return;

  if (!notes.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <div>✦</div>
        <h3>No notes yet</h3>
        <p>
          Add your first note to start your notebook.
        </p>
      </div>
    `;

    if ($("feedCount")) {
      $("feedCount").textContent =
        "0 notes";
    }

    return;
  }

  if ($("feedCount")) {
    $("feedCount").textContent =
      `${notes.length} notes`;
  }

  feed.innerHTML =
    notes
      .map(
        (note, index) =>
          createFeedCard(
            note,
            index
          )
      )
      .join("");

  feed
    .querySelectorAll(
      "[data-open-note]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const id =
              button.dataset
                .openNote;

            openReaderById(
              id,
              notes
            );
          }
        );
      }
    );
}

// =====================================================
// FEED CARD
// =====================================================

function createFeedCard(
  note,
  index
) {
  const isOwner =
    note.userName ===
    currentUser?.name;

  const isPublic =
    note.visibility ===
    "public";

  const visibilityHTML =
    isPublic
      ? `<span class="visibility-badge public">🌎 Public</span>`
      : `<span class="visibility-badge private">🔒 Private</span>`;

  const ownerHTML =
    isPublic
      ? `<span class="note-owner">by ${escapeHTML(note.userName || "User")}</span>`
      : `<span class="note-owner">your note</span>`;

  const codePreview =
    note.code
      ? `
        <div class="feed-code-preview">
          <span>CODE</span>
          <small>${escapeHTML(
            note.language ||
              "text"
          )}</small>
        </div>
      `
      : "";

  return `
    <article
      class="feed-card"
      data-open-note="${escapeHTML(
        String(
          note._id ||
            note.id ||
            ""
        )
      )}"
    >

      <div class="feed-card-top">
        <div>
          <span class="subject-tag">
            ${escapeHTML(
              note.subject ||
                "General"
            )}
          </span>

          ${ownerHTML}
        </div>

        ${visibilityHTML}
      </div>

      <div class="feed-number">
        Q.${String(
          index + 1
        ).padStart(2, "0")}
      </div>

      <h3>
        ${escapeHTML(
          note.question ||
            "Question"
        )}
      </h3>

      <p>
        ${escapeHTML(
          makePreview(
            note.answer,
            160
          )
        )}
      </p>

      ${codePreview}

      <button
        class="soft-btn"
        type="button"
        data-open-note="${escapeHTML(
          String(
            note._id ||
              note.id ||
              ""
          )
        )}"
      >
        Open Answer →
      </button>

    </article>
  `;
}

// =====================================================
// NOTES PAGE
// =====================================================

function renderSubjects() {
  const list =
    $("subjectList");

  const area =
    $("questionArea");

  if (!list || !area) {
    return;
  }

  // -------------------------------------------------
  // SHOW ALL VISIBLE SUBJECTS
  // PUBLIC SUBJECTS FROM OTHER USERS ALSO APPEAR.
  // -------------------------------------------------

  const subjectMap =
    new Map();

  visibleNotes.forEach(
    (note) => {
      const subject =
        String(
          note.subject ||
            "General"
        ).trim();

      if (
        !subjectMap.has(
          subject
        )
      ) {
        subjectMap.set(
          subject,
          0
        );
      }

      subjectMap.set(
        subject,
        subjectMap.get(
          subject
        ) + 1
      );
    }
  );

  const sorted =
    [...subjectMap.entries()]
      .sort((a, b) =>
        a[0].localeCompare(
          b[0]
        )
      );

  if (!sorted.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div>✦</div>
        <h3>No subjects</h3>
        <p>Add a note first.</p>
      </div>
    `;

    area.innerHTML = `
      <div class="empty-state">
        <div>←</div>
        <h3>No notes available</h3>
        <p>Your notes will appear here.</p>
      </div>
    `;

    return;
  }

  list.innerHTML =
    sorted
      .map(
        ([name, count]) => `
          <button
            class="subject-item"
            type="button"
            data-subject="${escapeHTML(
              name
            )}"
          >
            <span>
              ${escapeHTML(
                name
              )}
            </span>

            <b>
              ${count}
            </b>
          </button>
        `
      )
      .join("");

  list
    .querySelectorAll(
      "[data-subject]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            list
              .querySelectorAll(
                ".subject-item"
              )
              .forEach(
                (item) =>
                  item.classList.remove(
                    "active"
                  )
              );

            button.classList.add(
              "active"
            );

            renderQuestions(
              button.dataset
                .subject
            );
          }
        );
      }
    );
}

// =====================================================
// QUESTIONS
// =====================================================

function renderQuestions(
  subject
) {
  const area =
    $("questionArea");

  if (!area) return;

  const notes =
    visibleNotes.filter(
      (note) =>
        String(
          note.subject
        ) ===
        String(subject)
    );

  if (!notes.length) {
    area.innerHTML = `
      <div class="empty-state">
        <h3>No questions</h3>
      </div>
    `;

    return;
  }

  area.innerHTML = `
    <div class="question-list">

      <div class="section-heading">
        <div>
          <span class="eyebrow">
            SUBJECT
          </span>

          <h3>
            ${escapeHTML(
              subject
            )}
          </h3>
        </div>

        <span class="count-pill">
          ${notes.length} questions
        </span>
      </div>

      ${notes
        .map(
          (note, index) => {
            const publicClass =
              note.visibility ===
              "public"
                ? "public"
                : "private";

            const owner =
              note.visibility ===
              "public"
                ? ` · ${escapeHTML(
                    note.userName ||
                      "User"
                  )}`
                : "";

            return `
              <button
                type="button"
                class="question-item"
                data-question-id="${escapeHTML(
                  String(
                    note._id
                  )
                )}"
              >

                <span class="question-number">
                  Q.${String(
                    index + 1
                  ).padStart(
                    2,
                    "0"
                  )}
                </span>

                <div>
                  <strong>
                    ${escapeHTML(
                      note.question
                    )}
                  </strong>

                  <small>
                    <span class="${publicClass}">
                      ${
                        note.visibility ===
                        "public"
                          ? "🌎 Public"
                          : "🔒 Private"
                      }
                    </span>

                    ${owner}
                  </small>
                </div>

                <span>→</span>

              </button>
            `;
          }
        )
        .join("")}

    </div>
  `;

  area
    .querySelectorAll(
      "[data-question-id]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            openReaderById(
              button.dataset
                .questionId,
              notes
            );
          }
        );
      }
    );
}

// =====================================================
// READER
// =====================================================

function openReaderById(
  id,
  notes
) {
  const index =
    notes.findIndex(
      (note) =>
        String(
          note._id
        ) ===
        String(id)
    );

  if (index < 0) {
    showToast(
      "Note not found",
      "error"
    );

    return;
  }

  readerNotes =
    [...notes];

  readerIndex =
    index;

  renderReader();

  $("readerModal")?.classList.remove(
    "hidden"
  );
}

// =====================================================
// RENDER READER
// =====================================================

function renderReader() {
  const note =
    readerNotes[
      readerIndex
    ];

  if (!note) return;

  const total =
    readerNotes.length;

  const question =
    note.question ||
    "Question";

  const answer =
    note.answer ||
    "";

  const code =
    note.code ||
    "";

  const language =
    note.language ||
    "text";

  if ($("readerNumber")) {
    $("readerNumber").textContent =
      `Q.${String(
        readerIndex + 1
      ).padStart(2, "0")}`;
  }

  if ($("readerSubject")) {
    $("readerSubject").textContent =
      note.subject ||
      "Subject";
  }

  if ($("readerQuestion")) {
    $("readerQuestion").textContent =
      question;
  }

  if ($("readerAnswer")) {
    $("readerAnswer").innerHTML =
      formatAnswer(answer);
  }

  // -------------------------------------------------
  // VISIBILITY
  // -------------------------------------------------

  const visibility =
    $("readerVisibility");

  if (visibility) {
    if (
      note.visibility ===
      "public"
    ) {
      visibility.className =
        "visibility-badge public";

      visibility.textContent =
        "🌎 Public";
    } else {
      visibility.className =
        "visibility-badge private";

      visibility.textContent =
        "🔒 Private";
    }
  }

  // -------------------------------------------------
  // CODE
  // -------------------------------------------------

  const codeWrap =
    $("readerCodeWrap");

  const codeElement =
    $("readerCode");

  const languageElement =
    $("readerLanguage");

  if (code) {
    codeWrap?.classList.remove(
      "hidden"
    );

    if (languageElement) {
      languageElement.textContent =
        language;
    }

    if (codeElement) {
      codeElement.className =
        `language-${getPrismLanguage(
          language
        )}`;

      codeElement.textContent =
        code;

      if (
        window.Prism
      ) {
        Prism.highlightElement(
          codeElement
        );
      }
    }
  } else {
    codeWrap?.classList.add(
      "hidden"
    );

    if (codeElement) {
      codeElement.textContent =
        "";
    }
  }

  // -------------------------------------------------
  // PROGRESS
  // -------------------------------------------------

  if ($("readerProgress")) {
    $("readerProgress").textContent =
      `${readerIndex + 1} / ${total}`;
  }

  // -------------------------------------------------
  // NAV BUTTONS
  // -------------------------------------------------

  if ($("prevQuestion")) {
    $("prevQuestion").disabled =
      readerIndex <= 0;
  }

  if ($("nextQuestion")) {
    $("nextQuestion").disabled =
      readerIndex >=
      total - 1;
  }

  // -------------------------------------------------
  // EDIT / DELETE
  // -------------------------------------------------

  const isOwner =
    note.userName ===
    currentUser?.name;

  if ($("editNote")) {
    $("editNote").style.display =
      isOwner
        ? ""
        : "none";
  }

  if ($("deleteNote")) {
    $("deleteNote").style.display =
      isOwner
        ? ""
        : "none";
  }
}

// =====================================================
// CLOSE READER
// =====================================================

function closeReader() {
  $("readerModal")?.classList.add(
    "hidden"
  );
}

// =====================================================
// READER NEXT
// =====================================================

function nextQuestion() {
  if (
    readerIndex <
    readerNotes.length - 1
  ) {
    readerIndex++;
    renderReader();
  }
}

function previousQuestion() {
  if (
    readerIndex > 0
  ) {
    readerIndex--;
    renderReader();
  }
}

// =====================================================
// COPY CODE
// =====================================================

async function copyCurrentCode() {
  const note =
    readerNotes[
      readerIndex
    ];

  if (!note?.code) {
    showToast(
      "No code available",
      "error"
    );

    return;
  }

  try {
    await navigator.clipboard.writeText(
      note.code
    );

    showToast(
      "Code copied",
      "success"
    );
  } catch {
    showToast(
      "Unable to copy code",
      "error"
    );
  }
}

// =====================================================
// ADD NOTE
// =====================================================

async function saveNote(
  event
) {
  event.preventDefault();

  if (
    !currentUser?.name
  ) {
    showToast(
      "Please login first",
      "error"
    );

    return;
  }

  const subject =
    String(
      $("subjectInput")
        ?.value || ""
    ).trim();

  const question =
    String(
      $("questionInput")
        ?.value || ""
    ).trim();

  const answer =
    String(
      $("answerInput")
        ?.value || ""
    );

  const code =
    String(
      $("codeInput")
        ?.value || ""
    );

  const language =
    String(
      $("languageInput")
        ?.value || "text"
    );

  const visibility =
    getSelectedVisibility();

  if (
    !subject ||
    !question ||
    !answer.trim()
  ) {
    showToast(
      "Subject, question and answer are required",
      "error"
    );

    return;
  }

  const button =
    $("saveNoteBtn");

  if (button) {
    button.disabled = true;
    button.innerHTML =
      "SAVING... <span>⏳</span>";
  }

  try {
    let result;

    if (editingNoteId) {
      result =
        await apiRequest(
          `/notes/${editingNoteId}`,
          {
            method: "PUT",

            body: JSON.stringify({
              subject,
              question,
              answer,
              code,
              language,
              userName:
                currentUser.name,
              visibility,
            }),
          }
        );

      showToast(
        "Note updated",
        "success"
      );
    } else {
      result =
        await apiRequest(
          "/notes",
          {
            method: "POST",

            body: JSON.stringify({
              subject,
              question,
              answer,
              code,
              language,
              userName:
                currentUser.name,
              visibility,
            }),
          }
        );

      showToast(
        "Note saved",
        "success"
      );
    }

    editingNoteId = null;

    clearNoteForm();

    await loadAllData();

    showPage("notes");
  } catch (error) {
    console.error(
      "SAVE NOTE ERROR:",
      error
    );

    showToast(
      error.message,
      "error"
    );
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML =
        'SAVE NOTE <span>→</span>';
    }
  }
}

// =====================================================
// VISIBILITY
// =====================================================

function getSelectedVisibility() {
  const publicOption =
    $("publicOption");

  const visibility =
    publicOption?.checked
      ? "public"
      : "private";

  const hidden =
    $("visibilityInput");

  if (hidden) {
    hidden.value =
      visibility;
  }

  return visibility;
}

// =====================================================
// CLEAR FORM
// =====================================================

function clearNoteForm() {
  $("noteForm")?.reset();

  if ($("privateOption")) {
    $("privateOption").checked =
      true;
  }

  if ($("publicOption")) {
    $("publicOption").checked =
      false;
  }

  if ($("visibilityInput")) {
    $("visibilityInput").value =
      "private";
  }

  editingNoteId =
    null;

  if ($("saveNoteBtn")) {
    $("saveNoteBtn").innerHTML =
      'SAVE NOTE <span>→</span>';
  }

  const title =
    $("addPage")?.querySelector(
      ".page-intro h1"
    );

  if (title) {
    title.textContent =
      "Add New Note";
  }
}

// =====================================================
// EDIT NOTE
// =====================================================

function editCurrentNote() {
  const note =
    readerNotes[
      readerIndex
    ];

  if (!note) return;

  if (
    note.userName !==
    currentUser?.name
  ) {
    showToast(
      "You can edit only your own notes",
      "error"
    );

    return;
  }

  editingNoteId =
    note._id;

  closeReader();

  showPage("add");

  if ($("subjectInput")) {
    $("subjectInput").value =
      note.subject || "";
  }

  if ($("questionInput")) {
    $("questionInput").value =
      note.question || "";
  }

  if ($("answerInput")) {
    $("answerInput").value =
      note.answer || "";
  }

  if ($("codeInput")) {
    $("codeInput").value =
      note.code || "";
  }

  if ($("languageInput")) {
    $("languageInput").value =
      note.language || "text";
  }

  if (
    note.visibility ===
    "public"
  ) {
    $("publicOption").checked =
      true;
    $("privateOption").checked =
      false;
  } else {
    $("privateOption").checked =
      true;
    $("publicOption").checked =
      false;
  }

  getSelectedVisibility();

  const title =
    $("addPage")?.querySelector(
      ".page-intro h1"
    );

  if (title) {
    title.textContent =
      "Edit Note";
  }

  if ($("saveNoteBtn")) {
    $("saveNoteBtn").innerHTML =
      'UPDATE NOTE <span>→</span>';
  }
}

// =====================================================
// DELETE
// =====================================================

async function deleteCurrentNote() {
  const note =
    readerNotes[
      readerIndex
    ];

  if (!note) return;

  if (
    note.userName !==
    currentUser?.name
  ) {
    showToast(
      "You can delete only your own notes",
      "error"
    );

    return;
  }

  const confirmed =
    window.confirm(
      "Delete this note permanently?"
    );

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(
      `/notes/${note._id}?user=${encodeURIComponent(
        currentUser.name
      )}`,
      {
        method: "DELETE",
      }
    );

    showToast(
      "Note deleted",
      "success"
    );

    closeReader();

    await loadAllData();
  } catch (error) {
    console.error(
      "DELETE NOTE ERROR:",
      error
    );

    showToast(
      error.message,
      "error"
    );
  }
}

// =====================================================
// SUBJECT OPTIONS
// =====================================================

function updateSubjectOptions() {
  const datalist =
    $("subjectOptions");

  if (!datalist) return;

  const names =
    new Set(
      subjects.map(
        (item) =>
          item.name
      )
    );

  // Include visible public subjects too
  visibleNotes.forEach(
    (note) => {
      if (note.subject) {
        names.add(
          note.subject
        );
      }
    }
  );

  datalist.innerHTML =
    [...names]
      .sort((a, b) =>
        String(a).localeCompare(
          String(b)
        )
      )
      .map(
        (name) =>
          `<option value="${escapeHTML(
            name
          )}"></option>`
      )
      .join("");
}

// =====================================================
// PROFILE
// =====================================================

function renderProfile() {
  updateStats();
  updateUserUI();
}

// =====================================================
// SEARCH
// =====================================================

function performSearch(
  value
) {
  const query =
    String(
      value || ""
    )
      .trim()
      .toLowerCase();

  if (!query) {
    renderHome();
    return;
  }

  const results =
    visibleNotes.filter(
      (note) => {
        const combined =
          [
            note.subject,
            note.question,
            note.answer,
            note.code,
            note.language,
            note.userName,
          ]
            .join(" ")
            .toLowerCase();

        return combined.includes(
          query
        );
      }
    );

  renderSearchResults(
    results,
    query
  );
}

// =====================================================
// SEARCH RESULTS
// =====================================================

function renderSearchResults(
  results,
  query
) {
  const feed =
    $("randomFeed");

  if (!feed) return;

  if (!results.length) {
    feed.innerHTML = `
      <div class="empty-state">
        <div>⌕</div>
        <h3>No results</h3>
        <p>
          Nothing matched "${escapeHTML(
            query
          )}".
        </p>
      </div>
    `;

    return;
  }

  feed.innerHTML =
    results
      .map(
        (note, index) =>
          createFeedCard(
            note,
            index
          )
      )
      .join("");

  feed
    .querySelectorAll(
      "[data-open-note]"
    )
    .forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            openReaderById(
              button.dataset
                .openNote,
              results
            );
          }
        );
      }
    );
}

// =====================================================
// PAGE NAVIGATION
// =====================================================

function showPage(
  page
) {
  currentPage =
    page;

  document
    .querySelectorAll(
      ".page"
    )
    .forEach(
      (section) => {
        section.classList.remove(
          "active-page"
        );
      }
    );

  const target =
    $(`${page}Page`);

  if (target) {
    target.classList.add(
      "active-page"
    );
  }

  document
    .querySelectorAll(
      ".nav-btn"
    )
    .forEach(
      (button) => {
        button.classList.toggle(
          "active",
          button.dataset
            .page === page
        );
      }
    );

  const titles = {
    home: "Home",
    notes: "Notes",
    add: "Add",
    profile: "Profile",
  };

  if ($("pageTitle")) {
    $("pageTitle").textContent =
      titles[page] ||
      "Home";
  }

  if (
    page ===
    "home"
  ) {
    renderHome();
  }

  if (
    page ===
    "notes"
  ) {
    renderSubjects();
  }

  if (
    page ===
    "profile"
  ) {
    renderProfile();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// =====================================================
// LOGOUT
// =====================================================

function logout() {
  clearSession();

  myNotes = [];
  visibleNotes = [];
  subjects = [];

  showLoginScreen();

  resetAuthUI();

  showToast(
    "Logged out",
    "success"
  );
}

function resetAuthUI() {
  $("userStep")?.classList.remove(
    "hidden"
  );

  $("passwordStep")?.classList.add(
    "hidden"
  );

  $("createStep")?.classList.add(
    "hidden"
  );

  if ($("passwordInput")) {
    $("passwordInput").value =
      "";
  }

  if (
    $("createPasswordInput")
  ) {
    $("createPasswordInput").value =
      "";
  }

  if (
    $("confirmPasswordInput")
  ) {
    $("confirmPasswordInput").value =
      "";
  }

  if ($("authDescription")) {
    $("authDescription").textContent =
      "Save programming questions, answers and code in one clean notebook.";
  }
}

// =====================================================
// PASSWORD TOGGLE
// =====================================================

function togglePassword(
  inputId,
  buttonId
) {
  const input =
    $(inputId);

  const button =
    $(buttonId);

  if (!input) return;

  if (
    input.type ===
    "password"
  ) {
    input.type =
      "text";

    if (button) {
      button.textContent =
        "🙈";
    }
  } else {
    input.type =
      "password";

    if (button) {
      button.textContent =
        "👁";
    }
  }
}

// =====================================================
// SEARCH PANEL
// =====================================================

function toggleSearch() {
  const panel =
    $("searchPanel");

  if (!panel) return;

  panel.classList.toggle(
    "hidden"
  );

  if (
    !panel.classList.contains(
      "hidden"
    )
  ) {
    $("searchInput")?.focus();
  }
}

// =====================================================
// ANSWER FORMAT
// =====================================================

function formatAnswer(
  text
) {
  const safe =
    escapeHTML(
      String(
        text || ""
      )
    );

  return safe
    .replace(
      /\n/g,
      "<br>"
    );
}

// =====================================================
// PREVIEW
// =====================================================

function makePreview(
  text,
  max
) {
  const clean =
    String(
      text || ""
    )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (
    clean.length <=
    max
  ) {
    return clean;
  }

  return (
    clean.slice(
      0,
      max
    ) + "..."
  );
}

// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

// =====================================================
// PRISM LANGUAGE
// =====================================================

function getPrismLanguage(
  language
) {
  const map = {
    javascript:
      "javascript",

    js:
      "javascript",

    python:
      "python",

    cpp:
      "cpp",

    "c++":
      "cpp",

    java:
      "java",

    html:
      "markup",

    css:
      "css",

    sql:
      "sql",

    text:
      "none",
  };

  return (
    map[
      String(
        language || "text"
      ).toLowerCase()
    ] ||
    "none"
  );
}

// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    // -------------------------------------------------
    // LOAD SESSION
    // -------------------------------------------------

    loadSession();

    // -------------------------------------------------
    // NAVIGATION
    // -------------------------------------------------

    document
      .querySelectorAll(
        ".nav-btn"
      )
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              showPage(
                button.dataset
                  .page
              );
            }
          );
        }
      );

    // -------------------------------------------------
    // AUTH
    // -------------------------------------------------

    $("startBtn")
      ?.addEventListener(
        "click",
        startNotebook
      );

    $("loginBtn")
      ?.addEventListener(
        "click",
        loginUser
      );

    $("createBtn")
      ?.addEventListener(
        "click",
        createNotebook
      );

    // -------------------------------------------------
    // ENTER KEY
    // -------------------------------------------------

    $("nameInput")
      ?.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key ===
            "Enter"
          ) {
            startNotebook();
          }
        }
      );

    $("passwordInput")
      ?.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key ===
            "Enter"
          ) {
            loginUser();
          }
        }
      );

    $("confirmPasswordInput")
      ?.addEventListener(
        "keydown",
        (event) => {
          if (
            event.key ===
            "Enter"
          ) {
            createNotebook();
          }
        }
      );

    // -------------------------------------------------
    // BACK
    // -------------------------------------------------

    $("backToUser")
      ?.addEventListener(
        "click",
        () => {
          $("passwordStep")?.classList.add(
            "hidden"
          );

          $("userStep")?.classList.remove(
            "hidden"
          );

          $("passwordInput").value =
            "";
        }
      );

    $("backToUserFromCreate")
      ?.addEventListener(
        "click",
        () => {
          $("createStep")?.classList.add(
            "hidden"
          );

          $("userStep")?.classList.remove(
            "hidden"
          );

          $("createPasswordInput").value =
            "";

          $("confirmPasswordInput").value =
            "";
        }
      );

    // -------------------------------------------------
    // PASSWORD TOGGLES
    // -------------------------------------------------

    $("togglePassword")
      ?.addEventListener(
        "click",
        () =>
          togglePassword(
            "passwordInput",
            "togglePassword"
          )
      );

    $("toggleCreatePassword")
      ?.addEventListener(
        "click",
        () =>
          togglePassword(
            "createPasswordInput",
            "toggleCreatePassword"
          )
      );

    $("toggleConfirmPassword")
      ?.addEventListener(
        "click",
        () =>
          togglePassword(
            "confirmPasswordInput",
            "toggleConfirmPassword"
          )
      );

    // -------------------------------------------------
    // LOGOUT
    // -------------------------------------------------

    $("logoutBtn")
      ?.addEventListener(
        "click",
        logout
      );

    $("profileChangeBtn")
      ?.addEventListener(
        "click",
        logout
      );

    // -------------------------------------------------
    // SEARCH
    // -------------------------------------------------

    $("searchBtn")
      ?.addEventListener(
        "click",
        toggleSearch
      );

    $("searchInput")
      ?.addEventListener(
        "input",
        (event) => {
          performSearch(
            event.target.value
          );
        }
      );

    // -------------------------------------------------
    // RANDOM
    // -------------------------------------------------

    $("randomBtn")
      ?.addEventListener(
        "click",
        () =>
          renderHome(
            true
          )
      );

    // -------------------------------------------------
    // NOTE FORM
    // -------------------------------------------------

    $("noteForm")
      ?.addEventListener(
        "submit",
        saveNote
      );

    $("clearForm")
      ?.addEventListener(
        "click",
        clearNoteForm
      );

    // -------------------------------------------------
    // VISIBILITY
    // -------------------------------------------------

    $("privateOption")
      ?.addEventListener(
        "change",
        getSelectedVisibility
      );

    $("publicOption")
      ?.addEventListener(
        "change",
        getSelectedVisibility
      );

    // -------------------------------------------------
    // READER
    // -------------------------------------------------

    $("closeReader")
      ?.addEventListener(
        "click",
        closeReader
      );

    $("prevQuestion")
      ?.addEventListener(
        "click",
        previousQuestion
      );

    $("nextQuestion")
      ?.addEventListener(
        "click",
        nextQuestion
      );

    $("copyCode")
      ?.addEventListener(
        "click",
        copyCurrentCode
      );

    $("editNote")
      ?.addEventListener(
        "click",
        editCurrentNote
      );

    $("deleteNote")
      ?.addEventListener(
        "click",
        deleteCurrentNote
      );

    $("readerModal")
      ?.addEventListener(
        "click",
        (event) => {
          if (
            event.target ===
            $("readerModal")
          ) {
            closeReader();
          }
        }
      );

    // -------------------------------------------------
    // ESC CLOSE
    // -------------------------------------------------

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key ===
          "Escape"
        ) {
          closeReader();
        }
      }
    );

    // -------------------------------------------------
    // EXISTING SESSION
    // -------------------------------------------------

    if (
      currentUser &&
      authToken
    ) {
      try {
        await openNotebook();
      } catch (error) {
        console.error(
          "SESSION ERROR:",
          error
        );

        clearSession();

        showLoginScreen();
      }
    } else {
      showLoginScreen();
    }
  }
);
