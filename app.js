/* ==========================================================================
   GYM TRACKER — APP LOGIC
   ==========================================================================
   File map (search these section headers to jump around):
     1. DATA MODEL & STORAGE   - exercises, routines, sessions, active session
     2. APP STATE              - in-memory state while the app is open
     3. INIT                   - runs once when the page loads
     4. NAVIGATION             - bottom nav tabs
     5. LOG TAB: ROUTINES VIEW - pick a routine (or Quick Session) to start
     6. LOG TAB: LIVE SESSION  - the on-the-go accordion logging screen
     7. ROUTINE FORM           - create/edit a routine's name + exercises
     8. HISTORY TAB
     9. STATS TAB
     10. SVG CHART DRAWING
     11. EXPORT / IMPORT / RESET
     12. IN-APP DIALOGS        - styled replacements for alert/confirm/prompt
     13. SMALL HELPERS
   ========================================================================== */


/* ==========================================================================
   1. DATA MODEL & STORAGE
   --------------------------------------------------------------------------
   Everything lives in localStorage — nothing leaves the device.

   EXERCISE (the library — create each one once, reuse everywhere):
     {
       id, name, type: "strength" | "cardio",
       personalBest: null | {
         weight, reps,       // present for type "strength"
         durationMin,        // present for type "cardio"
         date, source: "auto" | "manual"
       }
     }

   ROUTINE (a named group of exercises, e.g. "Push Day"):
     { id, name, exerciseIds: [exerciseId, ...] }

   SESSION (one gym visit, saved to History once you tap Finish):
     {
       id, date, routineId: id|null, routineName: string,
       entries: [ ENTRY, ... ]
     }

   ACTIVE SESSION (same shape as SESSION) — the one currently in progress,
   persisted as you go so refreshing/closing mid-workout doesn't lose it.

   ENTRY (one exercise's activity within a session):
     {
       id, exerciseId, name, type: "strength" | "cardio",
       sets: [ SET, ... ]
     }

   SET:
     strength -> { weight, reps, isPR }
     cardio   -> { durationMin, isPR }
   ========================================================================== */

   const STORAGE_KEY_EXERCISES = "ironlog.exercises";
   const STORAGE_KEY_ROUTINES = "ironlog.routines";
   const STORAGE_KEY_SESSIONS = "ironlog.sessions";
   const STORAGE_KEY_ACTIVE_SESSION = "ironlog.activeSession";
   
   function loadExercises() {
     const raw = localStorage.getItem(STORAGE_KEY_EXERCISES);
     return raw ? JSON.parse(raw) : [];
   }
   function saveExercises() {
     localStorage.setItem(STORAGE_KEY_EXERCISES, JSON.stringify(state.exercises));
   }
   
   function loadRoutines() {
     const raw = localStorage.getItem(STORAGE_KEY_ROUTINES);
     return raw ? JSON.parse(raw) : [];
   }
   function saveRoutines() {
     localStorage.setItem(STORAGE_KEY_ROUTINES, JSON.stringify(state.routines));
   }
   
   function loadSessions() {
     const raw = localStorage.getItem(STORAGE_KEY_SESSIONS);
     return raw ? JSON.parse(raw) : [];
   }
   function saveSessions() {
     localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(state.sessions));
   }
   
   function loadActiveSession() {
     const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_SESSION);
     return raw ? JSON.parse(raw) : null;
   }
   function saveActiveSession() {
     localStorage.setItem(STORAGE_KEY_ACTIVE_SESSION, JSON.stringify(state.activeSession));
   }
   function clearActiveSession() {
     localStorage.removeItem(STORAGE_KEY_ACTIVE_SESSION);
   }
   
   
   /* ==========================================================================
      2. APP STATE
      ========================================================================== */
   const state = {
     exercises: [],                    // the exercise library
     routines: [],                     // saved routines
     sessions: [],                     // finished sessions (History)
     activeSession: null,              // session currently in progress, or null
     expandedExerciseRowIds: new Set(),// which accordion rows are open (session view)
   
     // transient state used only while the routine form is open:
     routineFormEditingId: null,       // null = creating new, else id being edited
     routineFormSelectedIds: new Set() // exercise ids checked in the form
   };
   
   
   /* ==========================================================================
      3. INIT
      ========================================================================== */
   document.addEventListener("DOMContentLoaded", () => {
     state.exercises = loadExercises();
     state.routines = loadRoutines();
     state.sessions = loadSessions();
     state.activeSession = loadActiveSession();
   
     setupNavigation();
     setupLogTab();
     setupStatsTab();
     setupSettingsPanel();
     setupDialog();
   
     renderHeader();
   
     if (state.activeSession) {
       showLogSubview("session");
       renderSessionView();
     } else {
       showLogSubview("routines");
       renderRoutinesList();
     }
   
     renderHistory();
     renderStats();
   });
   
   
   /* ==========================================================================
      4. NAVIGATION
      ========================================================================== */
   function setupNavigation() {
     document.querySelectorAll(".nav-btn").forEach((btn) => {
       btn.addEventListener("click", () => showPage(btn.dataset.page));
     });
   }
   
   /** Switches between the three bottom-nav pages.
    *
    *  The "body > " part of the selector matters: a bare ".page" also matches
    *  any .page nested INSIDE an overlay (the routine form used to have one),
    *  so tapping a tab would stamp hidden onto it and that overlay would then
    *  open completely blank. Only the top-level tab pages should be touched. */
   function showPage(pageId) {
     document.querySelectorAll("body > .page").forEach((el) => el.setAttribute("hidden", ""));
     document.getElementById(pageId).removeAttribute("hidden");

     document.querySelectorAll(".nav-btn").forEach((btn) => {
       btn.classList.toggle("is-active", btn.dataset.page === pageId);
     });

     if (pageId === "page-stats") renderStats();
     if (pageId === "page-history") renderHistory();
   }

   /** Toggles between the two views inside the Log tab. These are plain
    *  <div>s (not .page elements) so switching tabs elsewhere doesn't affect them. */
   function showLogSubview(which) {
     document.getElementById("routines-view").hidden = which !== "routines";
     document.getElementById("session-view").hidden = which !== "session";
   }
   
   
   /* ==========================================================================
      5. LOG TAB: ROUTINES VIEW
      ========================================================================== */
   function renderRoutinesList() {
     const container = document.getElementById("routines-list");
   
     if (state.routines.length === 0) {
       container.innerHTML = `<p class="text-muted" style="font-size:13px;">No routines yet — create one below, or jump straight into a Quick Session.</p>`;
       return;
     }
   
     container.innerHTML = state.routines
       .map(
         (r) => `
           <div class="routine-card" data-routine-id="${r.id}">
             <div>
               <div class="routine-card__name">${escapeHtml(r.name)}</div>
               <div class="routine-card__meta">${r.exerciseIds.length} exercise${r.exerciseIds.length === 1 ? "" : "s"}</div>
             </div>
             <div class="routine-card__chevron">&rsaquo;</div>
           </div>
         `
       )
       .join("");
   
     container.querySelectorAll("[data-routine-id]").forEach((card) => {
       card.addEventListener("click", () => startSessionFromRoutine(card.dataset.routineId));
     });
   }
   
   /** Builds a fresh in-progress session from a routine's exercise list
    *  (or an empty one for a Quick Session with routineId = null). */
   function startSessionFromRoutine(routineId) {
     const routine = routineId ? state.routines.find((r) => r.id === routineId) : null;
     const entries = routine ? routine.exerciseIds.map(makeBlankEntry).filter(Boolean) : [];
   
     state.activeSession = {
       id: uid(),
       date: todayISO(),
       routineId: routine ? routine.id : null,
       routineName: routine ? routine.name : "Quick Session",
       entries
     };
     state.expandedExerciseRowIds = new Set();
     saveActiveSession();
   
     showLogSubview("session");
     renderSessionView();
   }
   
   function makeBlankEntry(exerciseId) {
     const exercise = getExerciseById(exerciseId);
     if (!exercise) return null; // exercise may have been deleted from the library since
     return { id: uid(), exerciseId: exercise.id, name: exercise.name, type: exercise.type, sets: [] };
   }
   
   
   /* ==========================================================================
      6. LOG TAB: LIVE SESSION (the on-the-go accordion screen)
      --------------------------------------------------------------------------
      Uses ONE delegated click listener on the whole list (see setupLogTab)
      instead of re-attaching listeners after every re-render — every
      clickable element below carries a data-action + data-entry-id instead
      of its own listener.
      ========================================================================== */
   function renderSessionView() {
     document.getElementById("session-title").textContent = state.activeSession.routineName || "Session";
     document.getElementById("session-exercise-list").innerHTML = state.activeSession.entries.map(renderExerciseRow).join("");
   }
   
   function renderExerciseRow(entry) {
     const exercise = getExerciseById(entry.exerciseId); // may be missing if deleted from the library mid-flight
     const type = exercise ? exercise.type : entry.type;
     const displayName = exercise ? exercise.name : `${entry.name} (removed from library)`;
     const pbText = exercise ? formatPB(exercise) : null;
   
     const lastEntry = getLastLoggedSetsForExercise(entry.exerciseId, state.activeSession.id);
     const lastText = lastEntry ? formatSetsForDisplay(lastEntry) : "no previous session";
   
     const isExpanded = state.expandedExerciseRowIds.has(entry.id);
     const untouched = entry.sets.length === 0;
   
     const chips = entry.sets
       .map((s, idx) => {
         const label = type === "cardio" ? `${s.durationMin} min` : `${s.weight}\u00d7${s.reps}`;
         return `
           <span class="set-chip ${s.isPR ? "set-chip--pr" : ""}">
             ${label}${s.isPR ? " PR" : ""}
             <button class="set-chip__remove" data-action="remove-set" data-entry-id="${entry.id}" data-set-index="${idx}">&times;</button>
           </span>
         `;
       })
       .join("");
   
     // Pre-fill the input with a sensible starting point: last time's top set,
     // falling back to the current PB, falling back to zero.
     const defaultWeight = lastEntry && lastEntry.sets.length ? lastEntry.sets[0].weight : exercise && exercise.personalBest ? exercise.personalBest.weight : 0;
     const defaultReps = lastEntry && lastEntry.sets.length ? lastEntry.sets[0].reps : 8;
   
     // Layout note: the inputs sit in a CSS grid (not a flex row) and the Add
     // button gets its own full-width line underneath. A flex row of
     // [input] x [input] [button] overflows the screen on iOS Safari, which
     // won't shrink form controls below their intrinsic width no matter what
     // flex-basis/min-width you give them. Grid columns can't overflow.
     const formHtml =
       type === "cardio"
         ? `
           <div class="log-set-form">
             <div class="card__eyebrow">Log Duration</div>
             <div class="log-set-form__grid log-set-form__grid--single">
               <label class="log-set-form__field">
                 <span class="log-set-form__label">Minutes</span>
                 <input type="text" inputmode="decimal" class="log-set-form__input" id="duration-input-${entry.id}" value="0">
               </label>
             </div>
             <button class="btn btn--primary log-set-form__add" data-action="log-set" data-entry-id="${entry.id}">Add</button>
           </div>
         `
         : `
           <div class="log-set-form">
             <div class="card__eyebrow">Log A Set</div>
             <div class="log-set-form__grid">
               <label class="log-set-form__field">
                 <span class="log-set-form__label">Weight</span>
                 <input type="text" inputmode="decimal" class="log-set-form__input" id="weight-input-${entry.id}" value="${defaultWeight}">
               </label>
               <label class="log-set-form__field">
                 <span class="log-set-form__label">Reps</span>
                 <input type="text" inputmode="numeric" class="log-set-form__input" id="reps-input-${entry.id}" value="${defaultReps}">
               </label>
             </div>
             <div class="plate-row">
               <button type="button" class="plate-chip" data-action="plate-step" data-entry-id="${entry.id}" data-step="-5">-5</button>
               <button type="button" class="plate-chip" data-action="plate-step" data-entry-id="${entry.id}" data-step="-2.5">-2.5</button>
               <button type="button" class="plate-chip" data-action="plate-step" data-entry-id="${entry.id}" data-step="2.5">+2.5</button>
               <button type="button" class="plate-chip" data-action="plate-step" data-entry-id="${entry.id}" data-step="5">+5</button>
               <button type="button" class="plate-chip" data-action="plate-step" data-entry-id="${entry.id}" data-step="10">+10</button>
               <button type="button" class="plate-chip" data-action="plate-step" data-entry-id="${entry.id}" data-step="25">+25</button>
             </div>
             <button class="btn btn--primary log-set-form__add" data-action="log-set" data-entry-id="${entry.id}">Add Set</button>
           </div>
         `;
   
     return `
       <div class="exercise-row">
         <div class="exercise-row__header" data-action="toggle-row" data-entry-id="${entry.id}">
           <div>
             <div class="exercise-row__name ${untouched ? "is-untouched" : ""}">${escapeHtml(displayName)}</div>
             <div class="exercise-row__last">last: ${escapeHtml(lastText)}</div>
           </div>
           <button type="button" class="pb-badge ${pbText ? "" : "pb-badge--empty"}" data-action="edit-pb" data-entry-id="${entry.id}">
             ${pbText ? "PB " + pbText : "Set PB"}
           </button>
         </div>
         <div class="exercise-row__body" ${isExpanded ? "" : "hidden"}>
           ${formHtml}
           <div>${chips}</div>
         </div>
       </div>
     `;
   }
   
   /** One delegated listener handles every interaction inside the live
    *  session list (see the data-action attributes rendered above). */
   async function handleSessionListClick(e) {
     const el = e.target.closest("[data-action]");
     if (!el) return;
   
     const entryId = el.dataset.entryId;
     const entry = state.activeSession.entries.find((en) => en.id === entryId);
     if (!entry) return;
     const exercise = getExerciseById(entry.exerciseId);
   
     switch (el.dataset.action) {
       case "toggle-row": {
         if (state.expandedExerciseRowIds.has(entryId)) state.expandedExerciseRowIds.delete(entryId);
         else state.expandedExerciseRowIds.add(entryId);
         renderSessionView();
         break;
       }
   
       case "plate-step": {
         // Mutate the input directly — no re-render, so the row stays open
         // and nothing else on screen shifts while you're mid-set.
         const input = document.getElementById(`weight-input-${entryId}`);
         const step = parseFloat(el.dataset.step);
         input.value = Math.max(0, (parseFloat(input.value) || 0) + step);
         break;
       }
   
       case "log-set": {
         let newSet;
         if (entry.type === "cardio") {
           const durationMin = parseFloat(document.getElementById(`duration-input-${entryId}`).value) || 0;
           if (durationMin <= 0) {
             appAlert("Enter a duration above zero first.");
             return;
           }
           newSet = { durationMin };
         } else {
           const weight = parseFloat(document.getElementById(`weight-input-${entryId}`).value) || 0;
           const reps = parseInt(document.getElementById(`reps-input-${entryId}`).value, 10) || 0;
           if (reps <= 0) {
             appAlert("Enter how many reps you did first.");
             return;
           }
           newSet = { weight, reps };
         }
   
         const isPR = exercise ? isNewPR(exercise, newSet) : false;
         newSet.isPR = isPR;
         entry.sets.push(newSet);
   
         if (isPR && exercise) {
           exercise.personalBest = { ...newSet, date: state.activeSession.date, source: "auto" };
           saveExercises();
         }
   
         saveActiveSession();
         state.expandedExerciseRowIds.add(entryId); // keep the row open after logging
         renderSessionView();
         break;
       }
   
       case "remove-set": {
         entry.sets.splice(parseInt(el.dataset.setIndex, 10), 1);
         saveActiveSession();
         renderSessionView();
         break;
       }
   
       case "edit-pb": {
         if (!exercise) {
           appAlert("This exercise was removed from your library, so its PB can't be edited here.");
           return;
         }
         await editExercisePB(exercise);
         renderSessionView();
         break;
       }
     }
   }
   
   /** Opens the in-app PB editor for one exercise. Strength asks for weight and
    *  reps together in a single dialog (the old version fired two back-to-back
    *  browser prompts, so cancelling the second one silently threw away the
    *  first). Resolves once the dialog is dismissed either way. */
   async function editExercisePB(exercise) {
     const pb = exercise.personalBest;

     if (exercise.type === "cardio") {
       const values = await appPrompt({
         title: "Personal Best",
         message: exercise.name,
         fields: [{ label: "Duration (minutes)", value: pb ? pb.durationMin : "", inputmode: "decimal" }]
       });
       if (!values) return;

       const durationMin = parseFloat(values[0]);
       if (isNaN(durationMin) || durationMin <= 0) {
         await appAlert("That duration didn't look like a number, so nothing was changed.");
         return;
       }
       exercise.personalBest = { durationMin, date: todayISO(), source: "manual" };
     } else {
       const values = await appPrompt({
         title: "Personal Best",
         message: exercise.name,
         fields: [
           { label: "Weight", value: pb ? pb.weight : "", inputmode: "decimal" },
           { label: "Reps", value: pb ? pb.reps : "", inputmode: "numeric" }
         ]
       });
       if (!values) return;

       const weight = parseFloat(values[0]);
       const reps = parseInt(values[1], 10);
       if (isNaN(weight) || isNaN(reps) || reps <= 0) {
         await appAlert("Those numbers didn't look right, so nothing was changed.");
         return;
       }
       exercise.personalBest = { weight, reps, date: todayISO(), source: "manual" };
     }

     saveExercises();
   }
   
   /** Ends the session: drops any exercise nobody actually logged a set for,
    *  then files it into permanent History. */
   async function finishSession() {
     const touchedEntries = state.activeSession.entries.filter((e) => e.sets.length > 0);
     if (touchedEntries.length === 0) {
       await appAlert("Log at least one set before finishing.");
       return;
     }
   
     state.sessions.push({ ...state.activeSession, entries: touchedEntries });
     saveSessions();
   
     clearActiveSession();
     state.activeSession = null;
     state.expandedExerciseRowIds = new Set();
   
     showLogSubview("routines");
     renderRoutinesList();
     renderHeader();
     renderHistory();
     renderStats();
     await appAlert("Session saved to your history.", "Nice work");
   }
   
   /** "+ Add Exercise" inside an active session — adds to THIS session only,
    *  not to the underlying routine. */
   function openSessionExercisePicker() {
     const select = document.getElementById("select-session-add-exercise");
     const alreadyIn = new Set(state.activeSession.entries.map((e) => e.exerciseId));
     const available = state.exercises.filter((ex) => !alreadyIn.has(ex.id));
   
     select.innerHTML = available.length
       ? available.map((ex) => `<option value="${ex.id}">${escapeHtml(ex.name)} (${ex.type})</option>`).join("")
       : `<option value="">— none left, create one below —</option>`;
   
     document.getElementById("input-session-new-exercise").value = "";
     document.getElementById("card-session-exercise-picker").classList.remove("hidden");
   }
   function closeSessionExercisePicker() {
     document.getElementById("card-session-exercise-picker").classList.add("hidden");
   }
   async function confirmSessionExercisePicker() {
     const newName = document.getElementById("input-session-new-exercise").value.trim();
     let exercise;

     if (newName) {
       exercise = { id: uid(), name: newName, type: "strength", personalBest: null };
       state.exercises.push(exercise);
       saveExercises();
     } else {
       const selectedId = document.getElementById("select-session-add-exercise").value;
       if (!selectedId) {
         await appAlert("Pick an exercise from the list, or type a new one.");
         return;
       }
       exercise = getExerciseById(selectedId);
     }
   
     state.activeSession.entries.push(makeBlankEntry(exercise.id));
     saveActiveSession();
     closeSessionExercisePicker();
     renderSessionView();
   }
   
   function setupLogTab() {
     document.getElementById("btn-quick-session").addEventListener("click", () => startSessionFromRoutine(null));
     document.getElementById("btn-new-routine").addEventListener("click", () => openRoutineForm(null));
     document.getElementById("btn-finish-session").addEventListener("click", finishSession);
     document.getElementById("btn-add-session-exercise").addEventListener("click", openSessionExercisePicker);
     document.getElementById("btn-cancel-session-exercise-picker").addEventListener("click", closeSessionExercisePicker);
     document.getElementById("btn-confirm-session-exercise-picker").addEventListener("click", confirmSessionExercisePicker);
   
     // Single delegated listener for every interaction inside the live session list
     document.getElementById("session-exercise-list").addEventListener("click", handleSessionListClick);
   
     // Routine form buttons (the form itself lives outside the tab system — see index.html)
     document.getElementById("btn-cancel-routine").addEventListener("click", closeRoutineForm);
     document.getElementById("btn-save-routine").addEventListener("click", saveRoutineForm);
     document.getElementById("btn-routine-add-new-exercise").addEventListener("click", addExerciseFromRoutineForm);
   }
   
   
   /* ==========================================================================
      7. ROUTINE FORM
      ========================================================================== */
   function openRoutineForm(routineId) {
     state.routineFormEditingId = routineId;

     const routine = routineId ? state.routines.find((r) => r.id === routineId) : null;
     document.getElementById("routine-form-title").textContent = routine ? "Edit Routine" : "New Routine";
     document.getElementById("input-routine-name").value = routine ? routine.name : "";
     document.getElementById("input-routine-new-exercise").value = "";
     state.routineFormSelectedIds = new Set(routine ? routine.exerciseIds : []);
   
     renderRoutineChecklist();
     document.getElementById("card-routine-form").classList.remove("hidden");
   }
   
   function closeRoutineForm() {
     document.getElementById("card-routine-form").classList.add("hidden");
     state.routineFormEditingId = null;
   }
   
   function renderRoutineChecklist() {
     const container = document.getElementById("routine-exercise-checklist");
   
     if (state.exercises.length === 0) {
       container.innerHTML = `<p class="text-muted" style="font-size:13px;">No exercises in your library yet — add one below.</p>`;
       return;
     }
   
     container.innerHTML = state.exercises
       .map(
         (ex) => `
           <label class="checklist-item">
             <input type="checkbox" data-exercise-id="${ex.id}" ${state.routineFormSelectedIds.has(ex.id) ? "checked" : ""}>
             ${escapeHtml(ex.name)} <span class="text-muted" style="font-size:11px; text-transform:uppercase;">(${ex.type})</span>
           </label>
         `
       )
       .join("");
   
     container.querySelectorAll("input[type=checkbox]").forEach((cb) => {
       cb.addEventListener("change", () => {
         if (cb.checked) state.routineFormSelectedIds.add(cb.dataset.exerciseId);
         else state.routineFormSelectedIds.delete(cb.dataset.exerciseId);
       });
     });
   }
   
   /** Quick-add a brand-new exercise without leaving the routine form. */
   function addExerciseFromRoutineForm() {
     const name = document.getElementById("input-routine-new-exercise").value.trim();
     if (!name) return;
   
     const exercise = { id: uid(), name, type: "strength", personalBest: null };
     state.exercises.push(exercise);
     saveExercises();
   
     state.routineFormSelectedIds.add(exercise.id);
     document.getElementById("input-routine-new-exercise").value = "";
     renderRoutineChecklist();
   }
   
   async function saveRoutineForm() {
     const name = document.getElementById("input-routine-name").value.trim();
     if (!name) {
       await appAlert("Give the routine a name before saving.");
       return;
     }

     const exerciseIds = Array.from(state.routineFormSelectedIds);

     if (state.routineFormEditingId) {
       const routine = state.routines.find((r) => r.id === state.routineFormEditingId);
       routine.name = name;
       routine.exerciseIds = exerciseIds;
     } else {
       state.routines.push({ id: uid(), name, exerciseIds });
     }
     saveRoutines();

     closeRoutineForm();
     renderRoutinesList();
   }
   
   
   /* ==========================================================================
      8. HISTORY TAB
      ========================================================================== */
   function renderHistory() {
     const container = document.getElementById("history-list");
     const sorted = [...state.sessions].sort((a, b) => (a.date < b.date ? 1 : -1));
   
     if (sorted.length === 0) {
       container.innerHTML = `
         <div class="empty-state">
           <div class="empty-state__title">No sessions yet</div>
           <div>Start one from the Log tab.</div>
         </div>
       `;
       return;
     }
   
     container.innerHTML = sorted
       .map((session, i) => {
         const sessionNumber = String(sorted.length - i).padStart(3, "0");
         const volume = sessionVolume(session);
         return `
           <div class="card">
             <div class="session-card__top">
               <div>
                 <div class="card__eyebrow">Session ${sessionNumber}${session.routineName ? " &middot; " + escapeHtml(session.routineName) : ""}</div>
                 <div class="card__title" style="margin-bottom:0;">${formatDateLong(session.date)}</div>
               </div>
             </div>
             <div class="text-muted" style="font-size:13px; margin-bottom:8px;">
               ${session.entries.length} exercise${session.entries.length === 1 ? "" : "s"}
               ${volume > 0 ? ` &middot; ${formatNumber(volume)} total volume` : ""}
             </div>
             ${session.entries.map(renderEntryRow).join("")}
             <div class="session-card__actions">
               <button class="btn btn--danger btn--sm" data-delete-session="${session.id}">Delete</button>
             </div>
           </div>
         `;
       })
       .join("");
   
     container.querySelectorAll("[data-delete-session]").forEach((btn) => {
       btn.addEventListener("click", () => deleteSession(btn.dataset.deleteSession));
     });
   }
   
   /** Read-only summary of one exercise entry — used in History cards. */
   function renderEntryRow(entry) {
     let meta;
     if (entry.type === "cardio") {
       const totalMin = entry.sets.reduce((sum, s) => sum + s.durationMin, 0);
       meta = `${entry.sets.length} set${entry.sets.length === 1 ? "" : "s"} &middot; ${totalMin} min total`;
     } else {
       const topSet = entry.sets.reduce((max, s) => (s.weight > max ? s.weight : max), 0);
       meta = `${entry.sets.length} sets &middot; top set ${topSet}`;
     }
     return `
       <div class="entry-row">
         <div class="entry-row__top">
           <span class="entry-row__name">${escapeHtml(entry.name)}</span>
         </div>
         <div class="entry-row__meta">${meta}</div>
       </div>
     `;
   }
   
   async function deleteSession(sessionId) {
     const ok = await appConfirm("This can't be undone.", { title: "Delete session?", okText: "Delete", danger: true });
     if (!ok) return;

     state.sessions = state.sessions.filter((s) => s.id !== sessionId);
     saveSessions();
     renderHistory();
     renderStats();
     renderHeader();
   }
   
   
   /* ==========================================================================
      9. STATS TAB
      ========================================================================== */
   function setupStatsTab() {
     document.getElementById("select-exercise-chart").addEventListener("change", renderStrengthChart);
   }
   
   function renderStats() {
     renderStatTiles();
     populateExerciseChartSelect();
     renderStrengthChart();
     renderConsistencyChart();
     renderVolumeChart();
   }
   
   function renderStatTiles() {
     const totalSessions = state.sessions.length;
     const allTimeVolume = state.sessions.reduce((sum, s) => sum + sessionVolume(s), 0);
     const thisWeekVolume = state.sessions.filter((s) => isInWeek(s.date, 0)).reduce((sum, s) => sum + sessionVolume(s), 0);
     const streak = currentWeekStreak();
   
     document.getElementById("stat-tiles").innerHTML = `
       <div class="stat-tile">
         <div class="stat-tile__value">${totalSessions}</div>
         <div class="stat-tile__label">Total Sessions</div>
       </div>
       <div class="stat-tile">
         <div class="stat-tile__value">${streak}</div>
         <div class="stat-tile__label">Week Streak</div>
       </div>
       <div class="stat-tile">
         <div class="stat-tile__value">${formatNumber(thisWeekVolume)}</div>
         <div class="stat-tile__label">This Week Volume</div>
       </div>
       <div class="stat-tile">
         <div class="stat-tile__value">${formatNumber(allTimeVolume)}</div>
         <div class="stat-tile__label">All-Time Volume</div>
       </div>
     `;
   }
   
   /** The chart's exercise selector is now sourced from the library (by id),
    *  not scanned from session names — more reliable if an exercise is renamed. */
   function populateExerciseChartSelect() {
     const select = document.getElementById("select-exercise-chart");
     const previousValue = select.value;
   
     const strengthExercises = state.exercises.filter((ex) => ex.type === "strength");
     select.innerHTML = strengthExercises.map((ex) => `<option value="${ex.id}">${escapeHtml(ex.name)}</option>`).join("");
   
     if (strengthExercises.some((ex) => ex.id === previousValue)) select.value = previousValue;
   }
   
   function renderStrengthChart() {
     const exerciseId = document.getElementById("select-exercise-chart").value;
     const container = document.getElementById("chart-strength");
   
     if (!exerciseId) {
       container.innerHTML = `<p class="text-muted" style="font-size:13px;">Add a strength exercise to your library to see progress here.</p>`;
       return;
     }
   
     const sorted = [...state.sessions].sort((a, b) => (a.date > b.date ? 1 : -1));
     const points = [];
     let runningMax = 0;
   
     sorted.forEach((session) => {
       session.entries
         .filter((e) => e.type === "strength" && e.exerciseId === exerciseId)
         .forEach((e) => {
           const topSet = e.sets.reduce((max, s) => (s.weight > max ? s.weight : max), 0);
           const isPR = topSet > runningMax;
           if (isPR) runningMax = topSet;
           points.push({ label: formatDateShort(session.date), value: topSet, isPR });
         });
     });
   
     container.innerHTML = drawLineChart(points);
   }
   
   function renderConsistencyChart() {
     const weeks = lastNWeeks(8);
     const values = weeks.map((weekStart) => state.sessions.filter((s) => sameWeek(s.date, weekStart)).length);
     const labels = weeks.map((w) => formatDateShort(w));
     document.getElementById("chart-consistency").innerHTML = drawBarChart(labels, values, "var(--color-accent)");
   }
   
   function renderVolumeChart() {
     const weeks = lastNWeeks(8);
     const values = weeks.map((weekStart) =>
       state.sessions.filter((s) => sameWeek(s.date, weekStart)).reduce((sum, s) => sum + sessionVolume(s), 0)
     );
     const labels = weeks.map((w) => formatDateShort(w));
     document.getElementById("chart-volume").innerHTML = drawBarChart(labels, values, "var(--color-secondary)");
   }
   
   
   /* ==========================================================================
      10. SVG CHART DRAWING
      Hand-rolled, dependency-free (no CDN/chart library), so the app keeps
      working fully offline. Each function returns an SVG string.
      ========================================================================== */
   const CHART_WIDTH = 320;
   const CHART_HEIGHT = 160;
   const CHART_PADDING = 24;
   
   function drawLineChart(points) {
     if (points.length === 0) return `<p class="text-muted" style="font-size:13px;">No data yet for this exercise.</p>`;
     if (points.length === 1) return `<p class="text-muted" style="font-size:13px;">Log this exercise at least twice to see a trend line.</p>`;
   
     const maxVal = Math.max(...points.map((p) => p.value)) * 1.1 || 1;
     const stepX = (CHART_WIDTH - CHART_PADDING * 2) / (points.length - 1);
   
     const coords = points.map((p, i) => {
       const x = CHART_PADDING + i * stepX;
       const y = CHART_HEIGHT - CHART_PADDING - (p.value / maxVal) * (CHART_HEIGHT - CHART_PADDING * 2);
       return { x, y, ...p };
     });
   
     const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
   
     const dots = coords
       .map((c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${c.isPR ? 5 : 3}" fill="${c.isPR ? "var(--color-pr)" : "var(--color-secondary)"}" />`)
       .join("");
   
     const showEvery = points.length > 8 ? Math.ceil(points.length / 8) : 1;
     const labels = coords
       .map((c, i) =>
         i % showEvery === 0
           ? `<text x="${c.x.toFixed(1)}" y="${CHART_HEIGHT - 4}" font-size="8" fill="var(--color-text-muted)" text-anchor="middle">${c.label}</text>`
           : ""
       )
       .join("");
   
     return `
       <svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
         <path d="${linePath}" fill="none" stroke="var(--color-secondary)" stroke-width="2" />
         ${dots}
         ${labels}
       </svg>
     `;
   }
   
   function drawBarChart(labels, values, colorVar) {
     if (values.every((v) => v === 0)) return `<p class="text-muted" style="font-size:13px;">No sessions logged in this period yet.</p>`;
   
     const maxVal = Math.max(...values) * 1.1 || 1;
     const barSlot = (CHART_WIDTH - CHART_PADDING * 2) / values.length;
     const barWidth = barSlot * 0.55;
   
     const bars = values
       .map((v, i) => {
         const barHeight = (v / maxVal) * (CHART_HEIGHT - CHART_PADDING * 2);
         const x = CHART_PADDING + i * barSlot + (barSlot - barWidth) / 2;
         const y = CHART_HEIGHT - CHART_PADDING - barHeight;
         return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="2" fill="${colorVar}" />`;
       })
       .join("");
   
     const labelEls = labels
       .map((label, i) => {
         const x = CHART_PADDING + i * barSlot + barSlot / 2;
         return `<text x="${x.toFixed(1)}" y="${CHART_HEIGHT - 4}" font-size="8" fill="var(--color-text-muted)" text-anchor="middle">${label}</text>`;
       })
       .join("");
   
     return `
       <svg viewBox="0 0 ${CHART_WIDTH} ${CHART_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
         ${bars}
         ${labelEls}
       </svg>
     `;
   }
   
   
   /* ==========================================================================
      11. EXPORT / IMPORT / RESET
      ========================================================================== */
   function setupSettingsPanel() {
     document.getElementById("btn-open-settings").addEventListener("click", () => {
       showPage("page-stats");
       document.getElementById("card-settings").classList.toggle("hidden");
     });
   
     document.getElementById("btn-export").addEventListener("click", exportBackup);
     document.getElementById("btn-import-trigger").addEventListener("click", () => {
       document.getElementById("input-import-file").click();
     });
     document.getElementById("input-import-file").addEventListener("change", importBackup);
     document.getElementById("btn-reset-data").addEventListener("click", resetAllData);
   }
   
   function exportBackup() {
     const payload = {
       exportedAt: new Date().toISOString(),
       exercises: state.exercises,
       routines: state.routines,
       sessions: state.sessions
     };
     const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `iron-log-backup-${todayISO()}.json`;
     a.click();
     URL.revokeObjectURL(url);
   }
   
   function importBackup(evt) {
     const file = evt.target.files[0];
     if (!file) return;
   
     const reader = new FileReader();
     reader.onload = async () => {
       let payload;
       try {
         payload = JSON.parse(reader.result);
         if (!Array.isArray(payload.sessions)) throw new Error("Invalid file format");
       } catch (err) {
         await appAlert("Couldn't read that file — make sure it's a Gym Tracker export.", "Import failed");
         return;
       }

       const ok = await appConfirm(
         `This replaces everything currently on this device with ${payload.sessions.length} session${payload.sessions.length === 1 ? "" : "s"}, plus the exercise library and routines from the file.`,
         { title: "Import backup?", okText: "Import", danger: true }
       );
       if (!ok) return;

       state.sessions = payload.sessions;
       state.exercises = Array.isArray(payload.exercises) ? payload.exercises : [];
       state.routines = Array.isArray(payload.routines) ? payload.routines : [];
       saveSessions();
       saveExercises();
       saveRoutines();

       refreshAllViews();
       await appAlert("Your backup has been restored.", "Import complete");
     };
     reader.readAsText(file);
     evt.target.value = "";
   }
   
   async function resetAllData() {
     const first = await appConfirm("This erases every exercise, routine and logged session on this device.", {
       title: "Erase all data?",
       okText: "Erase",
       danger: true
     });
     if (!first) return;

     const second = await appConfirm("Last chance — this is permanent and can't be undone.", {
       title: "Really sure?",
       okText: "Yes, erase everything",
       danger: true
     });
     if (!second) return;

     state.exercises = [];
     state.routines = [];
     state.sessions = [];
     state.activeSession = null;
     saveExercises();
     saveRoutines();
     saveSessions();
     clearActiveSession();
   
     showLogSubview("routines");
     refreshAllViews();
   }
   
   /** Re-renders every view that could be affected by a bulk data change
    *  (import or reset), without needing to know which tab is on screen. */
   function refreshAllViews() {
     renderHeader();
     renderHistory();
     renderStats();
     if (!document.getElementById("routines-view").hidden) renderRoutinesList();
     if (!document.getElementById("session-view").hidden) renderSessionView();
   }
   
   
   /* ==========================================================================
      12. IN-APP DIALOGS
      --------------------------------------------------------------------------
      Styled stand-ins for the browser's alert() / confirm() / prompt(), which
      render as an OS box titled with the site's domain ("...github.io says").
      Markup lives in index.html as #app-dialog.

      All three return a Promise, so call sites read almost like the originals:

        await appAlert("Nope.")
        if (await appConfirm("Delete?", { danger: true })) { ... }
        const [w, r] = (await appPrompt({ fields: [...] })) ?? [];

      appPrompt resolves to an array of the field values, or null if dismissed.
      ========================================================================== */
   let dialogResolve = null; // set while a dialog is open; called on close

   function setupDialog() {
     const backdrop = document.getElementById("app-dialog");

     // Submitting the <form> = tapping OK, which also makes the phone
     // keyboard's "Go"/"Done" key confirm the dialog.
     document.getElementById("app-dialog-form").addEventListener("submit", (e) => {
       e.preventDefault();
       closeDialog(readDialogValues());
     });

     document.getElementById("app-dialog-cancel").addEventListener("click", () => closeDialog(null));

     // Tapping the dimmed area outside the dialog cancels it.
     backdrop.addEventListener("click", (e) => {
       if (e.target === backdrop) closeDialog(null);
     });

     document.addEventListener("keydown", (e) => {
       if (e.key === "Escape" && dialogResolve) closeDialog(null);
     });
   }

   /** Low-level opener. Resolves with an array of field values on confirm
    *  (an empty array when there are no fields), or null on cancel. */
   function openDialog({ title, message = "", fields = [], okText = "OK", showCancel = true, danger = false }) {
     // Never stack dialogs — resolve whatever is already open as cancelled.
     if (dialogResolve) closeDialog(null);

     document.getElementById("app-dialog-title").textContent = title;

     const messageEl = document.getElementById("app-dialog-message");
     messageEl.textContent = message;
     messageEl.hidden = !message;

     // type="text" + inputmode gives the right phone keypad without the
     // quirks type="number" brings (spinners, and select() throwing in Safari).
     const fieldsEl = document.getElementById("app-dialog-fields");
     fieldsEl.innerHTML = fields
       .map(
         (f, i) => `
           <div class="field">
             <label class="field__label" for="app-dialog-field-${i}">${escapeHtml(f.label)}</label>
             <input type="text" id="app-dialog-field-${i}" inputmode="${f.inputmode || "text"}" value="${escapeHtml(String(f.value ?? ""))}">
           </div>
         `
       )
       .join("");

     const okBtn = document.getElementById("app-dialog-ok");
     okBtn.textContent = okText;
     okBtn.className = "btn " + (danger ? "btn--danger" : "btn--primary");

     const cancelBtn = document.getElementById("app-dialog-cancel");
     cancelBtn.hidden = !showCancel;

     document.getElementById("app-dialog").classList.remove("hidden");

     const firstInput = fieldsEl.querySelector("input");
     if (firstInput) {
       firstInput.focus();
       firstInput.select();
     }

     return new Promise((resolve) => {
       dialogResolve = resolve;
     });
   }

   function readDialogValues() {
     return Array.from(document.querySelectorAll("#app-dialog-fields input")).map((input) => input.value.trim());
   }

   function closeDialog(result) {
     document.getElementById("app-dialog").classList.add("hidden");
     const resolve = dialogResolve;
     dialogResolve = null;
     if (resolve) resolve(result);
   }

   function appAlert(message, title = "Heads up") {
     return openDialog({ title, message, showCancel: false, okText: "Got it" });
   }

   function appConfirm(message, { title = "Are you sure?", okText = "Confirm", danger = false } = {}) {
     return openDialog({ title, message, okText, danger }).then((result) => result !== null);
   }

   function appPrompt({ title, message = "", fields, okText = "Save" }) {
     return openDialog({ title, message, fields, okText });
   }


   /* ==========================================================================
      13. SMALL HELPERS
      ========================================================================== */
   function uid() {
     return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
   }
   
   function todayISO() {
     return new Date().toISOString().slice(0, 10);
   }
   
   function getExerciseById(id) {
     return state.exercises.find((e) => e.id === id);
   }
   
   function formatPB(exercise) {
     if (!exercise || !exercise.personalBest) return null;
     const pb = exercise.personalBest;
     return exercise.type === "cardio" ? `${pb.durationMin} min` : `${pb.weight}\u00d7${pb.reps}`;
   }
   
   function formatSetsForDisplay(entry) {
     if (!entry || !entry.sets || entry.sets.length === 0) return "";
     return entry.type === "cardio"
       ? entry.sets.map((s) => `${s.durationMin} min`).join(", ")
       : entry.sets.map((s) => `${s.weight}\u00d7${s.reps}`).join(", ");
   }
   
   /** Finds the most recent PAST session (excluding the one in progress)
    *  that included this exercise, for the "last: ..." reference line. */
   function getLastLoggedSetsForExercise(exerciseId, excludeSessionId) {
     const sorted = [...state.sessions].filter((s) => s.id !== excludeSessionId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
     for (const session of sorted) {
       const entry = session.entries.find((e) => e.exerciseId === exerciseId);
       if (entry) return entry;
     }
     return null;
   }
   
   /** PR rule: heaviest weight wins; if the weight ties the current PB,
    *  more reps at that weight counts as a new PR. Cardio PR = longest duration. */
   function isNewPR(exercise, candidateSet) {
     if (!exercise.personalBest) return true;
     if (exercise.type === "cardio") return candidateSet.durationMin > exercise.personalBest.durationMin;
     if (candidateSet.weight > exercise.personalBest.weight) return true;
     if (candidateSet.weight === exercise.personalBest.weight && candidateSet.reps > exercise.personalBest.reps) return true;
     return false;
   }
   
   /** Total weight x reps across every strength set in a session (the "volume" metric). */
   function sessionVolume(session) {
     return session.entries
       .filter((e) => e.type === "strength")
       .reduce((sum, e) => sum + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0);
   }
   
   function weekStartOf(dateStr) {
     const d = new Date(dateStr + "T00:00:00");
     const day = d.getDay();
     const diffToMonday = day === 0 ? -6 : 1 - day;
     d.setDate(d.getDate() + diffToMonday);
     return d.toISOString().slice(0, 10);
   }
   
   function sameWeek(dateStr, weekStartStr) {
     return weekStartOf(dateStr) === weekStartStr;
   }
   
   function isInWeek(dateStr, weeksAgo) {
     const targetWeekStart = new Date(weekStartOf(todayISO()) + "T00:00:00");
     targetWeekStart.setDate(targetWeekStart.getDate() - weeksAgo * 7);
     return weekStartOf(dateStr) === targetWeekStart.toISOString().slice(0, 10);
   }
   
   function lastNWeeks(n) {
     const weeks = [];
     const thisWeekStart = new Date(weekStartOf(todayISO()) + "T00:00:00");
     for (let i = n - 1; i >= 0; i--) {
       const d = new Date(thisWeekStart);
       d.setDate(d.getDate() - i * 7);
       weeks.push(d.toISOString().slice(0, 10));
     }
     return weeks;
   }
   
   function currentWeekStreak() {
     let streak = 0;
     let weeksAgo = 0;
     while (weeksAgo < 104) {
       const hasSession = state.sessions.some((s) => isInWeek(s.date, weeksAgo));
       if (!hasSession) break;
       streak++;
       weeksAgo++;
     }
     return streak;
   }
   
   function formatDateLong(dateStr) {
     return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
   }
   
   function formatDateShort(dateStr) {
     return new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
   }
   
   function formatNumber(n) {
     return Math.round(n).toLocaleString();
   }
   
   function escapeHtml(str) {
     const div = document.createElement("div");
     div.textContent = str;
     return div.innerHTML;
   }
   
   function renderHeader() {
     const streak = currentWeekStreak();
     const streakText = streak > 0 ? ` &middot; ${streak} week streak` : "";
     document.getElementById("header-subtitle").innerHTML = formatDateLong(todayISO()) + streakText;
   }