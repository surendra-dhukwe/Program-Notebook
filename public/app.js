const API_BASE = "";

"use strict";

/* =========================================================
   PROGRAM NOTEBOOK
   Premium Cyberpunk Frontend
========================================================= */

const state = {
  user: localStorage.getItem("programNotebookUser") || "",

  notes: [],

  subjects: [],

  currentSubject: "",

  currentNoteIndex: 0,

  readerNotes: [],

  editingId: null,

  randomNotes: []
};


/* =========================================================
   SHORT DOM HELPER
========================================================= */

const $ = (id) => document.getElementById(id);


/* =========================================================
   SAFE JSON FETCH
========================================================= */

async function apiFetch(url, options = {}) {
  const response = await fetch(url, options);

  const contentType =
    response.headers.get("content-type") || "";

  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();

    throw new Error(
      `Server returned non-JSON response (${response.status}).`
    );
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}


/* =========================================================
   INITIALIZE
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

  setupEvents();

  if (state.user) {
    openApp();
  } else {
    if ($("loginScreen")) {
      $("loginScreen").classList.remove("hidden");
    }
  }

});


/* =========================================================
   EVENTS
========================================================= */

function setupEvents() {

  if ($("startBtn")) {
    $("startBtn").addEventListener(
      "click",
      startNotebook
    );
  }


  if ($("nameInput")) {

    $("nameInput").addEventListener(
      "keydown",
      (event) => {

        if (event.key === "Enter") {
          startNotebook();
        }

      }
    );

  }


  document
    .querySelectorAll(".nav-btn")
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          switchPage(
            button.dataset.page
          );

        }
      );

    });


  if ($("logoutBtn")) {
    $("logoutBtn").addEventListener(
      "click",
      changeUser
    );
  }


  if ($("profileChangeBtn")) {
    $("profileChangeBtn").addEventListener(
      "click",
      changeUser
    );
  }


  if ($("randomBtn")) {
    $("randomBtn").addEventListener(
      "click",
      renderRandomFeed
    );
  }


  if ($("searchBtn")) {
    $("searchBtn").addEventListener(
      "click",
      () => {

        if ($("searchPanel")) {
          $("searchPanel").classList.toggle(
            "hidden"
          );
        }

      }
    );
  }


  if ($("searchInput")) {
    $("searchInput").addEventListener(
      "input",
      searchNotes
    );
  }


  if ($("noteForm")) {
    $("noteForm").addEventListener(
      "submit",
      saveNote
    );
  }


  if ($("clearForm")) {

    $("clearForm").addEventListener(
      "click",
      clearNoteForm
    );

  }


  if ($("closeReader")) {

    $("closeReader").addEventListener(
      "click",
      closeReader
    );

  }


  if ($("readerModal")) {

    $("readerModal").addEventListener(
      "click",
      (event) => {

        if (
          event.target.id ===
          "readerModal"
        ) {
          closeReader();
        }

      }
    );

  }


  if ($("copyCode")) {

    $("copyCode").addEventListener(
      "click",
      copyCode
    );

  }


  /* Previous / Next buttons */

  if ($("prevQuestion")) {

    $("prevQuestion").addEventListener(
      "click",
      showPreviousQuestion
    );

  }


  if ($("nextQuestion")) {

    $("nextQuestion").addEventListener(
      "click",
      showNextQuestion
    );

  }


  /* Edit */

  if ($("editNote")) {

    $("editNote").addEventListener(
      "click",
      editCurrentNote
    );

  }


  /* Delete */

  if ($("deleteNote")) {

    $("deleteNote").addEventListener(
      "click",
      deleteCurrentNote
    );

  }


  /* Code language */

  if ($("languageInput")) {

    $("languageInput").addEventListener(
      "change",
      updateCodePlaceholder
    );

  }

}


/* =========================================================
   LOGIN
========================================================= */

async function startNotebook(event) {
  if (event) {
    event.preventDefault();
  }

  const input = document.getElementById("nameInput");

  if (!input) {
    showMessage("Name input not found", "error");
    return;
  }

  const name = input.value.trim();

  if (!name) {
    showMessage("Please enter your name", "error");
    input.focus();
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/users`,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json"
        },

        body: JSON.stringify({
          name: name
        })
      }
    );

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      const text = await response.text();

      console.error(
        "Non JSON response:",
        text
      );

      throw new Error(
        `Server returned non-JSON response (${response.status})`
      );
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
        "Unable to open notebook"
      );
    }

    state.user = data.user.name;

    localStorage.setItem(
      "programNotebookUser",
      state.user
    );

    showMessage(
      `Welcome ${state.user} 👋`,
      "success"
    );

    setTimeout(() => {
      openApp();
    }, 500);

  } catch (error) {

    console.error(
      "START NOTEBOOK ERROR:",
      error
    );

    showMessage(
      error.message ||
      "Something went wrong",
      "error"
    );
  }
}


function showMessage(message, type = "success") {

  let box = document.getElementById("messageBox");

  if (!box) {

    box = document.createElement("div");

    box.id = "messageBox";

    document.body.appendChild(box);

  }

  box.textContent = message;

  box.className = `message-box ${type}`;

  box.classList.add("show");

  clearTimeout(
    window.messageTimer
  );

  window.messageTimer = setTimeout(() => {

    box.classList.remove("show");

  }, 3500);
}

/* =========================================================
   OPEN APP
========================================================= */

function openApp() {

  if ($("loginScreen")) {
    $("loginScreen").classList.add(
      "hidden"
    );
  }


  if ($("app")) {
    $("app").classList.remove(
      "hidden"
    );
  }


  updateUserUI();

  loadData();

}


/* =========================================================
   USER UI
========================================================= */

function updateUserUI() {

  const name =
    state.user || "User";

  const initial =
    name.charAt(0).toUpperCase();


  setText(
    "welcomeName",
    name
  );

  setText(
    "sideName",
    name
  );

  setText(
    "topName",
    name
  );

  setText(
    "profileName",
    name
  );

  setText(
    "profileLabel",
    name
  );


  setText(
    "avatar",
    initial
  );

  setText(
    "topAvatar",
    initial
  );

  setText(
    "bigAvatar",
    initial
  );

}


/* =========================================================
   CHANGE USER
========================================================= */

function changeUser() {

  localStorage.removeItem(
    "programNotebookUser"
  );

  location.reload();

}


/* =========================================================
   LOAD DATA
========================================================= */

async function loadData() {

  try {

    if (!state.user) {
      return;
    }


    const user =
      encodeURIComponent(
        state.user
      );


    const [
      notes,
      subjects
    ] = await Promise.all([

      apiFetch(
        `/api/notes?user=${user}`
      ),

      apiFetch(
        `/api/subjects?user=${user}`
      )

    ]);


    if (!Array.isArray(notes)) {

      throw new Error(
        "Notes API returned invalid data."
      );

    }


    if (!Array.isArray(subjects)) {

      throw new Error(
        "Subjects API returned invalid data."
      );

    }


    state.notes =
      notes;

    state.subjects =
      subjects;


    updateStats();

    renderRandomFeed();

    renderSubjects();

    fillSubjectOptions();


  } catch (error) {

    console.error(
      "LOAD DATA ERROR:",
      error
    );


    toast(
      error.message ||
      "Could not load notebook data."
    );

  }

}


/* =========================================================
   STATS
========================================================= */

function updateStats() {

  setText(
    "subjectCount",
    state.subjects.length
  );


  setText(
    "questionCount",
    state.notes.length
  );


  setText(
    "feedCount",
    `${state.notes.length} notes`
  );


  setText(
    "profileSubjects",
    state.subjects.length
  );


  setText(
    "profileQuestions",
    state.notes.length
  );

}


/* =========================================================
   PAGE SWITCH
========================================================= */

function switchPage(page) {

  document
    .querySelectorAll(".page")
    .forEach((item) => {

      item.classList.remove(
        "active-page"
      );

    });


  const target =
    $(`${page}Page`);

  if (target) {

    target.classList.add(
      "active-page"
    );

  }


  document
    .querySelectorAll(".nav-btn")
    .forEach((button) => {

      button.classList.toggle(
        "active",
        button.dataset.page === page
      );

    });


  const titles = {

    home: "Home",

    notes: "Notes",

    add: "Add Note",

    profile: "Profile"

  };


  setText(
    "pageTitle",
    titles[page] || "Home"
  );


  if (page === "notes") {

    renderSubjects();

  }

}


/* =========================================================
   SHUFFLE
========================================================= */

function shuffle(array) {

  return [...array].sort(
    () => Math.random() - 0.5
  );

}


/* =========================================================
   RANDOM HOME FEED
========================================================= */

function renderRandomFeed() {

  const feed =
    $("randomFeed");

  if (!feed) return;


  state.randomNotes =
    shuffle(state.notes);


  if (!state.randomNotes.length) {

    feed.innerHTML = `

      <div
        class="empty-state"
        style="grid-column:1/-1"
      >

        <div>＋</div>

        <h3>
          Your notebook is empty
        </h3>

        <p>
          Go to Add and create your
          first subject and question.
        </p>

      </div>

    `;

    return;

  }


  feed.innerHTML =
    state.randomNotes
      .map(
        (note, index) => `

      <article
        class="note-card"
        data-id="${escapeAttr(
          note._id
        )}"
      >

        <span class="subject-tag">

          ${escapeHTML(
            note.subject
          )}

        </span>

        <div class="question-number">

          Q.${String(
            index + 1
          ).padStart(2, "0")}

        </div>

        <h3>

          ${escapeHTML(
            note.question
          )}

        </h3>

        <p>

          ${escapeHTML(
            truncate(
              note.answer,
              150
            )
          )}

        </p>

        <div class="note-meta">

          ${
            note.code
              ? "⌘ Code included"
              : "✦ Concept note"
          }

          · Click to open

        </div>

      </article>

    `
      )
      .join("");


  attachNoteCardEvents(
    feed
  );

}


/* =========================================================
   ATTACH CARD EVENTS
========================================================= */

function attachNoteCardEvents(
  container
) {

  container
    .querySelectorAll(
      ".note-card"
    )
    .forEach((card) => {

      card.addEventListener(
        "click",
        () => {

          const note =
            state.notes.find(
              (item) =>
                item._id ===
                card.dataset.id
            );


          if (note) {

            openReader(
              note
            );

          }

        }
      );

    });

}


/* =========================================================
   SUBJECTS
========================================================= */

function renderSubjects() {

  const list =
    $("subjectList");

  if (!list) return;


  if (!state.subjects.length) {

    list.innerHTML = `

      <div
        class="empty-state"
        style="min-height:250px"
      >

        <div>＋</div>

        <h3>
          No subjects
        </h3>

        <p>
          Create one from Add.
        </p>

      </div>

    `;


    if ($("questionArea")) {

      $("questionArea").innerHTML = `

        <div class="empty-state">

          <h3>
            Nothing to show
          </h3>

        </div>

      `;

    }

    return;

  }


  if (
    !state.currentSubject ||
    !state.subjects.some(
      (subject) =>
        subject.name ===
        state.currentSubject
    )
  ) {

    state.currentSubject =
      state.subjects[0].name;

  }


  list.innerHTML =
    state.subjects
      .map(
        (subject) => `

      <button
        class="subject-item ${
          state.currentSubject ===
          subject.name
            ? "active"
            : ""
        }"
        data-subject="${escapeAttr(
          subject.name
        )}"
      >

        <b>

          ${escapeHTML(
            subject.name
          )}

        </b>

        <span>

          ${subject.count}

        </span>

      </button>

    `
      )
      .join("");


  list
    .querySelectorAll(
      ".subject-item"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        () => {

          state.currentSubject =
            button.dataset.subject;

          renderSubjects();

        }
      );

    });


  renderQuestions(
    state.currentSubject
  );

}


/* =========================================================
   QUESTIONS
========================================================= */

function renderQuestions(
  subject
) {

  const area =
    $("questionArea");

  if (!area) return;


  const notes =
    state.notes.filter(
      (note) =>
        note.subject ===
        subject
    );


  if (!notes.length) {

    area.innerHTML = `

      <div class="empty-state">

        <h3>
          No questions
        </h3>

        <p>
          Add a question to this subject.
        </p>

      </div>

    `;

    return;

  }


  area.innerHTML = `

    <div
      style="padding:8px 8px 15px"
    >

      <span class="eyebrow">

        ${escapeHTML(
          subject
        )}

      </span>

      <h3
        style="
          font-family:'Space Grotesk';
          font-size:23px;
          margin:7px 0 0
        "
      >

        Questions

      </h3>

    </div>


    ${notes
      .map(
        (note, index) => `

      <div
        class="question-item"
        data-id="${escapeAttr(
          note._id
        )}"
      >

        <div class="question-number">

          Q.${String(
            index + 1
          ).padStart(2, "0")}

        </div>

        <h3>

          ${escapeHTML(
            note.question
          )}

        </h3>

        <p>

          Click to open answer

          ${
            note.code
              ? " · Code available"
              : ""
          }

        </p>

      </div>

    `
      )
      .join("")}

  `;


  area
    .querySelectorAll(
      ".question-item"
    )
    .forEach((item) => {

      item.addEventListener(
        "click",
        () => {

          const subjectNotes =
            state.notes.filter(
              (note) =>
                note.subject ===
                subject
            );


          const index =
            subjectNotes.findIndex(
              (note) =>
                note._id ===
                item.dataset.id
            );


          if (index >= 0) {

            state.readerNotes =
              subjectNotes;

            state.currentNoteIndex =
              index;

            openReader(
              subjectNotes[index]
            );

          }

        }
      );

    });

}


/* =========================================================
   READER
========================================================= */

function openReader(
  note
) {

  if (!note) return;


  if (
    !state.readerNotes.length ||
    !state.readerNotes.some(
      (item) =>
        item._id ===
        note._id
    )
  ) {

    state.readerNotes =
      state.notes.filter(
        (item) =>
          item.subject ===
          note.subject
      );

  }


  const index =
    state.readerNotes.findIndex(
      (item) =>
        item._id ===
        note._id
    );


  if (index >= 0) {

    state.currentNoteIndex =
      index;

  }


  renderReader();


  if ($("readerModal")) {

    $("readerModal").classList.remove(
      "hidden"
    );

  }

}


/* =========================================================
   RENDER READER
========================================================= */

function renderReader() {

  const note =
    state.readerNotes[
      state.currentNoteIndex
    ];


  if (!note) return;


  setText(
    "readerSubject",
    note.subject
  );


  setText(
    "readerQuestion",
    note.question
  );


  setText(
    "readerAnswer",
    note.answer
  );


  /* Question number */

  setText(
    "readerNumber",
    `Q.${String(
      state.currentNoteIndex + 1
    ).padStart(2, "0")}`
  );


  /* Code */

  const codeWrap =
    $("readerCodeWrap");

  const codeElement =
    $("readerCode");


  if (
    note.code &&
    note.code.trim()
  ) {

    if (codeWrap) {

      codeWrap.classList.remove(
        "hidden"
      );

    }


    if (codeElement) {

      codeElement.textContent =
        note.code;


      const language =
        normalizeLanguage(
          note.language
        );


      codeElement.className =
        `language-${language}`;


      if (
        typeof Prism !==
        "undefined"
      ) {

        Prism.highlightElement(
          codeElement
        );

      }

    }

  } else {

    if (codeWrap) {

      codeWrap.classList.add(
        "hidden"
      );

    }

  }


  /* Language */

  setText(
    "readerLanguage",
    languageName(
      note.language
    )
  );


  updateReaderButtons();

}


/* =========================================================
   READER BUTTONS
========================================================= */

function updateReaderButtons() {

  const total =
    state.readerNotes.length;

  const current =
    state.currentNoteIndex;


  if ($("prevQuestion")) {

    $("prevQuestion").disabled =
      current <= 0;

  }


  if ($("nextQuestion")) {

    $("nextQuestion").disabled =
      current >= total - 1;

  }


  setText(
    "readerProgress",
    `${current + 1} / ${total}`
  );

}


/* =========================================================
   PREVIOUS
========================================================= */

function showPreviousQuestion() {

  if (
    state.currentNoteIndex <= 0
  ) {

    return;

  }


  state.currentNoteIndex--;

  renderReader();

}


/* =========================================================
   NEXT
========================================================= */

function showNextQuestion() {

  if (
    state.currentNoteIndex >=
    state.readerNotes.length - 1
  ) {

    return;

  }


  state.currentNoteIndex++;

  renderReader();

}


/* =========================================================
   CLOSE READER
========================================================= */

function closeReader() {

  if ($("readerModal")) {

    $("readerModal").classList.add(
      "hidden"
    );

  }

}


/* =========================================================
   EDIT CURRENT NOTE
========================================================= */

function editCurrentNote() {

  const note =
    state.readerNotes[
      state.currentNoteIndex
    ];


  if (!note) return;


  state.editingId =
    note._id;


  setValue(
    "subjectInput",
    note.subject
  );


  setValue(
    "questionInput",
    note.question
  );


  setValue(
    "answerInput",
    note.answer
  );


  setValue(
    "codeInput",
    note.code || ""
  );


  setValue(
    "languageInput",
    normalizeLanguage(
      note.language
    )
  );


  switchPage("add");


  updateFormMode();


  closeReader();


  toast(
    "Edit mode enabled."
  );

}


/* =========================================================
   FORM MODE
========================================================= */

function updateFormMode() {

  const button =
    $("saveNoteBtn");


  if (!button) return;


  if (state.editingId) {

    button.textContent =
      "UPDATE NOTE";

  } else {

    button.textContent =
      "SAVE NOTE";

  }

}


/* =========================================================
   SAVE / UPDATE NOTE
========================================================= */

async function saveNote(
  event
) {

  event.preventDefault();


  const subject =
    getValue(
      "subjectInput"
    ).trim();


  const question =
    getValue(
      "questionInput"
    ).trim();


  const answer =
    getValue(
      "answerInput"
    ).trim();


  const code =
    getValue(
      "codeInput"
    );


  const language =
    normalizeLanguage(
      getValue(
        "languageInput"
      )
    );


  const payload = {

    subject,

    question,

    answer,

    code,

    language,

    userName:
      state.user

  };


  if (
    !subject ||
    !question ||
    !answer
  ) {

    toast(
      "Subject, question and answer are required."
    );

    return;

  }


  try {

    let url =
      "/api/notes";

    let method =
      "POST";


    if (state.editingId) {

      url =
        `/api/notes/${encodeURIComponent(
          state.editingId
        )}`;

      method =
        "PUT";

    }


    const data =
      await apiFetch(
        url,
        {

          method,

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              payload
            )

        }
      );


    console.log(
      "Saved:",
      data
    );


    clearNoteForm();


    state.editingId =
      null;


    updateFormMode();


    toast(
      method === "PUT"
        ? "Note updated successfully."
        : "Note saved successfully."
    );


    await loadData();


    state.currentSubject =
      subject;


    switchPage(
      "notes"
    );


    renderSubjects();


  } catch (error) {

    console.error(
      "SAVE ERROR:",
      error
    );


    toast(
      error.message ||
      "Could not save note."
    );

  }

}


/* =========================================================
   DELETE CURRENT NOTE
========================================================= */

async function deleteCurrentNote() {

  const note =
    state.readerNotes[
      state.currentNoteIndex
    ];


  if (!note) return;


  const confirmed =
    confirm(
      `Delete this note?\n\n${note.question}`
    );


  if (!confirmed) return;


  try {

    const user =
      encodeURIComponent(
        state.user
      );


    await apiFetch(
      `/api/notes/${encodeURIComponent(
        note._id
      )}?user=${user}`,
      {
        method: "DELETE"
      }
    );


    toast(
      "Note deleted successfully."
    );


    closeReader();


    await loadData();


  } catch (error) {

    console.error(
      "DELETE ERROR:",
      error
    );


    toast(
      error.message ||
      "Could not delete note."
    );

  }

}


/* =========================================================
   CLEAR FORM
========================================================= */

function clearNoteForm() {

  const form =
    $("noteForm");


  if (form) {

    form.reset();

  }


  state.editingId =
    null;


  updateFormMode();

}


/* =========================================================
   SUBJECT OPTIONS
========================================================= */

function fillSubjectOptions() {

  const options =
    $("subjectOptions");


  if (!options) return;


  options.innerHTML =
    state.subjects
      .map(
        (subject) =>
          `<option value="${escapeAttr(
            subject.name
          )}"></option>`
      )
      .join("");

}


/* =========================================================
   SEARCH
========================================================= */

function searchNotes() {

  const input =
    $("searchInput");


  const feed =
    $("randomFeed");


  if (!input || !feed) {
    return;
  }


  const q =
    input.value
      .toLowerCase()
      .trim();


  if (!q) {

    renderRandomFeed();

    return;

  }


  const filtered =
    state.notes.filter(
      (note) =>

        String(
          note.subject
        )
          .toLowerCase()
          .includes(q)

        ||

        String(
          note.question
        )
          .toLowerCase()
          .includes(q)

        ||

        String(
          note.answer
        )
          .toLowerCase()
          .includes(q)

        ||

        String(
          note.code || ""
        )
          .toLowerCase()
          .includes(q)

    );


  if (!filtered.length) {

    feed.innerHTML = `

      <div
        class="empty-state"
        style="grid-column:1/-1"
      >

        <h3>
          No result
        </h3>

        <p>
          Try another keyword.
        </p>

      </div>

    `;

    return;

  }


  feed.innerHTML =
    filtered
      .map(
        (note, index) => `

      <article
        class="note-card"
        data-id="${escapeAttr(
          note._id
        )}"
      >

        <span class="subject-tag">

          ${escapeHTML(
            note.subject
          )}

        </span>

        <div class="question-number">

          Q.${String(
            index + 1
          ).padStart(2, "0")}

        </div>

        <h3>

          ${escapeHTML(
            note.question
          )}

        </h3>

        <p>

          ${escapeHTML(
            truncate(
              note.answer,
              150
            )
          )}

        </p>

        <div class="note-meta">

          Search result · Click to open

        </div>

      </article>

    `
      )
      .join("");


  attachNoteCardEvents(
    feed
  );

}


/* =========================================================
   COPY CODE
========================================================= */

async function copyCode() {

  const code =
    $("readerCode");


  if (!code) return;


  try {

    await navigator.clipboard.writeText(
      code.textContent
    );


    toast(
      "Code copied."
    );


  } catch (error) {

    console.error(error);

    toast(
      "Copy failed."
    );

  }

}


/* =========================================================
   LANGUAGE
========================================================= */

function normalizeLanguage(
  language
) {

  const value =
    String(
      language || "text"
    )
      .toLowerCase()
      .trim();


  const map = {

    js: "javascript",

    javascript:
      "javascript",

    python:
      "python",

    py:
      "python",

    cpp:
      "cpp",

    "c++":
      "cpp",

    java:
      "java",

    html:
      "html",

    css:
      "css",

    sql:
      "sql",

    text:
      "text",

    plaintext:
      "text"

  };


  return (
    map[value] ||
    "text"
  );

}


/* =========================================================
   LANGUAGE NAME
========================================================= */

function languageName(
  language
) {

  const names = {

    javascript:
      "JavaScript",

    python:
      "Python",

    cpp:
      "C++",

    java:
      "Java",

    html:
      "HTML",

    css:
      "CSS",

    sql:
      "SQL",

    text:
      "Plain Text"

  };


  return (
    names[
      normalizeLanguage(
        language
      )
    ] ||
    "Plain Text"
  );

}


/* =========================================================
   CODE PLACEHOLDER
========================================================= */

function updateCodePlaceholder() {

  const input =
    $("codeInput");

  if (!input) return;


  const language =
    normalizeLanguage(
      getValue(
        "languageInput"
      )
    );


  const names = {

    javascript:
      "Write JavaScript code here...",

    python:
      "Write Python code here...",

    cpp:
      "Write C++ code here...",

    java:
      "Write Java code here...",

    html:
      "Write HTML code here...",

    css:
      "Write CSS code here...",

    sql:
      "Write SQL query here...",

    text:
      "Write code or text here..."

  };


  input.placeholder =
    names[language];

}


/* =========================================================
   TOAST
========================================================= */

function toast(
  message
) {

  const element =
    $("toast");


  if (!element) {

    console.log(
      message
    );

    return;

  }


  element.textContent =
    message;


  element.classList.add(
    "show"
  );


  clearTimeout(
    window.toastTimer
  );


  window.toastTimer =
    setTimeout(
      () => {

        element.classList.remove(
          "show"
        );

      },
      3000
    );

}


/* =========================================================
   HELPERS
========================================================= */

function setText(
  id,
  value
) {

  const element =
    $(id);


  if (element) {

    element.textContent =
      value;

  }

}


function setValue(
  id,
  value
) {

  const element =
    $(id);


  if (element) {

    element.value =
      value ?? "";

  }

}


function getValue(
  id
) {

  const element =
    $(id);


  return element
    ? element.value
    : "";

}


function truncate(
  text,
  length
) {

  const value =
    String(
      text || ""
    );


  if (
    value.length <=
    length
  ) {

    return value;

  }


  return (
    value.slice(
      0,
      length
    ) + "..."
  );

}


/* =========================================================
   HTML ESCAPE
========================================================= */

function escapeHTML(
  value
) {

  return String(
    value ?? ""
  ).replace(
    /[&<>"']/g,
    (character) => ({

      "&": "&amp;",

      "<": "&lt;",

      ">": "&gt;",

      '"': "&quot;",

      "'": "&#039;"

    })[character]
  );

}


/* =========================================================
   ATTRIBUTE ESCAPE
========================================================= */

function escapeAttr(
  value
) {

  return escapeHTML(
    value
  )
    .replace(
      /`/g,
      "&#096;"
    );

}
