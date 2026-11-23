import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js";

const STATUS_LABELS = { todo: "To Do", progress: "In Progress", done: "Done" };
const PRIORITY_LABELS = { low: "Rendah", medium: "Sedang", high: "Tinggi" };
const PRIORITY_ORDER = { low: 1, medium: 2, high: 3 };
const MONTH_NAMES_FULL = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const TASK_COLUMNS =
  "id, title, description, status, priority, deadline, deadline_time, created_at, archived_at";
const PAGE_SIZE = 500;
const TIMELINE_DAYS = 10;

const fullDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "full" });
const shortDate = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" });
const monthName = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
});
const weekday = new Intl.DateTimeFormat("id-ID", { weekday: "short" });

const startupState = document.getElementById("startup-state");
const authPage = document.getElementById("auth-page");
const authForm = document.getElementById("auth-form");
const authFields = document.getElementById("auth-fields");
const authSubmit = document.getElementById("auth-submit");
const authToggle = document.getElementById("auth-toggle");
const authError = document.getElementById("auth-error");
const authNotice = document.getElementById("auth-notice");
const workspace = document.getElementById("workspace");
const logoutButton = document.getElementById("logout");
const viewButtons = document.querySelectorAll("[data-view]");
const searchTask = document.getElementById("search-task");
const timelineRange = document.getElementById("timeline-range");
const timelineDays = document.getElementById("timeline-days");
const timelineRows = document.getElementById("timeline-rows");
const timelineState = document.getElementById("timeline-state");

const headerDate = document.getElementById("header-date");
const completionSummary = document.getElementById("completion-summary");
const completionCount = document.getElementById("completion-count");
const completionBar = document.getElementById("completion-bar");
const addForm = document.getElementById("add-form");
const addFields = document.getElementById("add-fields");
const addDialog = document.getElementById("add-dialog");
const openAddButton = document.getElementById("open-add");
const saveAdd = document.getElementById("save-add");
const addRequestError = document.getElementById("add-request-error");
const statusFilters = document.querySelectorAll("#status-filters button");
const priorityFilter = document.getElementById("priority-filter");
const periodFilters = document.querySelectorAll("[data-period]");
const monthFilterBar = document.getElementById("month-filter-bar");
const yearView = document.getElementById("year-view");
const yearViewTitle = document.getElementById("year-view-title");
const yearViewCount = document.getElementById("year-view-count");
const yearViewBack = document.getElementById("year-view-back");
const yearTaskList = document.getElementById("year-task-list");
const yearTaskState = document.getElementById("year-task-state");
const rekapRing = document.getElementById("rekap-ring-value");
const rekapPercent = document.getElementById("rekap-percent");
const rekapTotal = document.getElementById("rekap-total");
const rekapDone = document.getElementById("rekap-done");
const rekapLate = document.getElementById("rekap-late");
const rekapHigh = document.getElementById("rekap-high");
const rekapMonthBars = document.getElementById("rekap-month-bars");
const taskTemplate = document.getElementById("task-template");
const taskList = document.getElementById("task-list");
const taskState = document.getElementById("task-state");
const archiveList = document.getElementById("archive-list");
const archiveState = document.getElementById("archive-state");
const requestError = document.getElementById("request-error");
const requestErrorText = document.getElementById("request-error-text");
const retryButton = document.getElementById("retry-button");
const saveStatus = document.getElementById("save-status");
const editDialog = document.getElementById("edit-dialog");
const editForm = document.getElementById("edit-form");
const editFields = document.getElementById("edit-fields");
const editRequestError = document.getElementById("edit-request-error");
const saveEdit = document.getElementById("save-edit");
const calendarDays = document.getElementById("calendar-days");
const calendarHeading = document.getElementById("calendar-month");
const selectedDateHeading = document.getElementById("selected-date");
const dayTaskCount = document.getElementById("day-task-count");
const dayTaskList = document.getElementById("day-task-list");
const profileDialog = document.getElementById("profile-dialog");
const profileForm = document.getElementById("profile-form");
const accountAvatar = document.getElementById("account-avatar");
const openProfileButton = document.getElementById("open-profile");
const cancelProfileButton = document.getElementById("cancel-profile");
const saveProfileButton = document.getElementById("save-profile");
const profileRequestError = document.getElementById("profile-request-error");
const profileSuccess = document.getElementById("profile-success");

let client;
let userId = null;
let sessionVersion = 0;
let isRegistering = false;
// Setiap objek mewakili satu baris Supabase. Daftar dan kalender memakai array yang sama.
let tasks = [];
let activePeriod = "all";
let activeMonth = null; // 0–11, hanya dipakai saat activePeriod === "year".
let yearDetail = false; // true = tampilkan daftar task bulan terpilih, bukan kartu.
let activeStatus = "all";
let editingTaskId = null;
let isLoading = false;
let hasLoaded = false;
let isSaving = false;
let visibleMonth = new Date();
let selectedDate = getDateKey(visibleMonth);
let timelineStart = getTimelineStart();

function getDateKey(date) {
  // Format YYYY-MM-DD dalam waktu lokal cocok dengan format kolom deadline di Supabase.
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateKey(dateKey, formatter) {
  // Tambahkan jam lokal supaya tanggal tampil sesuai hari yang dipilih pengguna.
  return formatter.format(new Date(`${dateKey}T00:00:00`));
}

function getTimeKey(date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function formatDeadlineTime(time) {
  return time.slice(0, 5).replace(":", ".");
}

function formatDeadline(task, formatter) {
  const date = formatDateKey(task.deadline, formatter);
  return task.deadline_time
    ? `${date}, pukul ${formatDeadlineTime(task.deadline_time)}`
    : date;
}

function getSupabaseClient() {
  if (!SUPABASE_URL.trim() || !SUPABASE_ANON_KEY.trim()) {
    throw new Error("Isi SUPABASE_URL dan SUPABASE_ANON_KEY di config.js.");
  }
  if (typeof window.supabase?.createClient !== "function") {
    throw new Error("Library Supabase gagal dimuat. Periksa koneksi internet.");
  }
  return window.supabase.createClient(
    SUPABASE_URL.trim(),
    SUPABASE_ANON_KEY.trim(),
  );
}

function showRequestError(message = "", canRetry = false) {
  const target = editDialog.open
    ? editRequestError
    : addDialog.open
      ? addRequestError
      : requestErrorText;
  for (const element of [editRequestError, addRequestError, requestErrorText]) {
    element.textContent = element === target ? message : "";
    element.hidden = !element.textContent;
  }
  requestError.hidden = target !== requestErrorText || !message;
  retryButton.hidden = requestError.hidden || !canRetry;
}

function updateControls() {
  // Kunci kontrol saat menyimpan supaya pengguna tidak mengirim perubahan ganda.
  addFields.disabled = !hasLoaded || isLoading || isSaving;
  openAddButton.disabled = addFields.disabled;
  editFields.disabled = isSaving;
  saveAdd.textContent = isSaving ? "Menyimpan..." : "Tambah";
  saveEdit.textContent = isSaving ? "Menyimpan..." : "Simpan";
  saveStatus.textContent =
    isSaving && !editDialog.open && !addDialog.open ? "Menyimpan..." : "";
  for (const list of [taskList, archiveList, yearTaskList]) {
    list.setAttribute("aria-busy", String(isLoading || isSaving));
    for (const action of list.querySelectorAll("[data-task-action]")) {
      action.disabled = isSaving;
    }
  }
  for (const task of timelineRows.querySelectorAll("button")) {
    task.disabled = isSaving;
  }
}

/**
 * READ — Mengambil seluruh task milik pengguna dari tabel Supabase `tasks`.
 * Data diambil secara berpage (maksimal 500 per request) sampai tidak ada data lagi.
 * Hasilnya disimpan ke array `tasks` dan tampilan diperbarui.
 */
async function loadTasks() {
  if (!userId || isLoading || isSaving) return;
  const requestVersion = sessionVersion;

  // Sequence: tampilkan loading, ambil data, lalu perbarui tampilan.
  isLoading = true;
  showRequestError();
  updateControls();
  renderDashboard();

  try {
    const loadedTasks = [];
    // Iteration: ambil maksimal 500 task per permintaan. Halaman yang lebih pendek menandai akhir data.
    for (let start = 0; ; start += PAGE_SIZE) {
      const { data, error } = await client
        .from("tasks")
        .select(TASK_COLUMNS)
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .range(start, start + PAGE_SIZE - 1);

      if (requestVersion !== sessionVersion) return;
      if (error) throw error;
      loadedTasks.push(...data);
      if (data.length < PAGE_SIZE) break;
    }
    tasks = loadedTasks;
    hasLoaded = true;
  } catch (error) {
    if (requestVersion === sessionVersion) {
      const missingColumn =
        error.code === "42703" &&
        /archived_at|deadline_time/.test(error.message);
      const message = missingColumn
        ? "Jalankan database.sql di SQL Editor Supabase untuk memperbarui tabel task."
        : `Gagal memuat task. ${error.message}`;
      showRequestError(message, true);
    }
  } finally {
    if (requestVersion === sessionVersion) {
      isLoading = false;
      renderDashboard();
      updateControls();
    }
  }
}

/**
 * Wrapper generik untuk operasi tulis (CREATE / UPDATE / DELETE) ke Supabase.
 * Menerima fungsi query, fungsi callback untuk memproses hasil, dan pesan gagal.
 * Memastikan array `tasks` hanya diperbarui setelah Supabase mengonfirmasi perubahan.
 */
async function saveTask(createQuery, applyResult, failureMessage) {
  if (!userId || !hasLoaded || isLoading || isSaving) return;
  // Abaikan respons lama jika pengguna sudah keluar atau berganti akun.
  const requestVersion = sessionVersion;

  isSaving = true;
  showRequestError();
  updateControls();

  try {
    const { data, error } = await createQuery();
    if (requestVersion !== sessionVersion) return;
    // Supabase mengirim error di dalam respons. Lempar ke catch agar pesannya tampil di halaman.
    if (error) throw error;
    // Perbarui array hanya setelah Supabase mengonfirmasi perubahan.
    applyResult(data);
  } catch (error) {
    if (requestVersion === sessionVersion)
      showRequestError(`${failureMessage} ${error.message}`);
  } finally {
    // Setelah berhasil atau gagal, segarkan tampilan dan aktifkan kembali kontrol.
    if (requestVersion === sessionVersion) {
      isSaving = false;
      renderDashboard();
      updateControls();
    }
  }
}

function showFieldError(field, message) {
  const errorText = document.getElementById(
    field.getAttribute("aria-describedby"),
  );
  errorText.textContent = message;
  errorText.hidden = !message;
  field.setAttribute("aria-invalid", String(Boolean(message)));
}

function validateTitle(title) {
  // Selection: pesan berbeda untuk judul kosong dan terlalu pendek.
  if (!title) return "Judul task wajib diisi.";
  if ([...title].length < 3) return "Judul task minimal 3 karakter.";
  return "";
}

function validateDescription(description) {
  return "";
}

function validatePriority(priority) {
  if (!priority) return "Prioritas wajib dipilih.";
  return "";
}

function validateDeadline(field, isCreating, now) {
  if (field.validity.badInput) return "Masukkan tanggal yang valid.";
  if (!field.value) return "Tanggal deadline wajib diisi.";
  // Batas tanggal berlaku saat menambah. Saat edit, deadline lama boleh dipertahankan.
  if (isCreating && field.value < getDateKey(now)) {
    return "Deadline tidak boleh sebelum hari ini.";
  }
  return "";
}

function validateDeadlineTime(field, deadline, isCreating, now) {
  if (field.validity.badInput || field.validity.stepMismatch)
    return "Masukkan jam dan menit yang valid.";
  if (!field.value) return "Jam deadline wajib diisi.";
  if (!deadline) return "Isi tanggal deadline terlebih dahulu.";
  if (
    isCreating &&
    deadline === getDateKey(now) &&
    field.value < getTimeKey(now)
  ) {
    return "Jam deadline hari ini sudah lewat.";
  }
  return "";
}

function readTaskForm(form, isCreating) {
  const titleField = form.elements.namedItem("title");
  const descriptionField = form.elements.namedItem("description");
  const priorityField = form.elements.namedItem("priority");
  const deadlineField = form.elements.namedItem("deadline");
  const timeField = form.elements.namedItem("deadline_time");
  const title = titleField.value.trim();
  const description = descriptionField.value.trim();
  const priority = priorityField.value;
  const now = new Date();
  const titleError = validateTitle(title);
  const descriptionError = validateDescription(description);
  const priorityError = validatePriority(priority);
  const deadlineError = validateDeadline(deadlineField, isCreating, now);
  const timeError = validateDeadlineTime(
    timeField,
    deadlineField.value,
    isCreating,
    now,
  );

  showFieldError(titleField, titleError);
  showFieldError(descriptionField, descriptionError);
  showFieldError(priorityField, priorityError);
  showFieldError(deadlineField, deadlineError);
  showFieldError(timeField, timeError);
  for (const [field, error] of [
    [titleField, titleError],
    [descriptionField, descriptionError],
    [priorityField, priorityError],
    [deadlineField, deadlineError],
    [timeField, timeError],
  ]) {
    if (error) {
      field.focus();
      return null;
    }
  }

  return {
    title,
    description,
    priority,
    deadline: deadlineField.value,
    deadline_time: timeField.value,
  };
}

/**
 * CREATE — Menambahkan task baru ke database Supabase.
 * Memvalidasi input form sebelum menyimpan. Setelah berhasil, task dimasukkan ke awal array `tasks`.
 */
function addTask(event) {
  event.preventDefault();
  const newTask = readTaskForm(addForm, true);
  if (!newTask) return;

  return saveTask(
    // Ambil baris yang baru disimpan, lengkap dengan ID dan status bawaan dari database.
    () => client.from("tasks").insert(newTask).select(TASK_COLUMNS).single(),
    (savedTask) => {
      tasks.unshift(savedTask);
      addForm.reset();
      addDialog.close();
    },
    "Gagal menambah task.",
  );
}

/**
 * UPDATE — Memperbarui task yang sudah ada di database berdasarkan ID.
 * Mengganti data task di array `tasks` dengan hasil yang dikembalikan Supabase setelah konfirmasi.
 */
function updateTask(id, changes, afterUpdate, failureMessage) {
  return saveTask(
    // Batasi update ke satu ID, lalu ganti objek terkait dengan baris yang dikembalikan database.
    () =>
      client
        .from("tasks")
        .update(changes)
        .eq("id", id)
        .select(TASK_COLUMNS)
        .single(),
    (savedTask) => {
      tasks = tasks.map((task) =>
        task.id === savedTask.id ? savedTask : task,
      );
      afterUpdate?.();
    },
    failureMessage,
  );
}

/**
 * UPDATE — Mengubah status task (To Do / In Progress / Done).
 * Dipanggil saat pengguna mengubah dropdown status pada kartu task.
 */
function updateStatus(id, status) {
  return updateTask(id, { status }, null, "Gagal mengubah status task.");
}

function isActiveTask(task) {
  return !task.archived_at;
}

/**
 * UPDATE — Arsipkan task aktif atau pulihkan task dari arsip.
 * Mengisi atau mengosongkan kolom `archived_at`. Status dan deadline tetap disimpan.
 */
function toggleArchive(task) {
  const archiving = isActiveTask(task);
  // Status dan deadline tetap disimpan. Pulihkan dengan mengosongkan waktu arsip.
  const archivedAt = archiving ? new Date().toISOString() : null;
  const failureMessage = archiving
    ? "Gagal mengarsipkan task."
    : "Gagal memulihkan task.";
  return updateTask(task.id, { archived_at: archivedAt }, null, failureMessage);
}

function openEditDialog(task) {
  if (isSaving) return;
  editingTaskId = task.id;
  const titleField = editForm.elements.namedItem("title");
  const deadlineField = editForm.elements.namedItem("deadline");
  const timeField = editForm.elements.namedItem("deadline_time");
  titleField.value = task.title;
  editForm.elements.namedItem("description").value = task.description ?? "";
  editForm.elements.namedItem("priority").value = task.priority;
  deadlineField.value = task.deadline ?? "";
  timeField.value = task.deadline_time?.slice(0, 5) ?? "";
  showFieldError(titleField, "");
  showFieldError(deadlineField, "");
  showFieldError(timeField, "");
  editDialog.showModal();
  showRequestError();
}

function editTask(event) {
  event.preventDefault();
  const changes = readTaskForm(editForm, false);
  if (!changes || editingTaskId === null) return;

  return updateTask(
    editingTaskId,
    changes,
    () => editDialog.close(),
    "Gagal mengedit task.",
  );
}

/**
 * DELETE — Menghapus task dari database berdasarkan ID.
 * Meminta konfirmasi kepada pengguna terlebih dahulu. Task aktif dihapus, task arsip dihapus permanen.
 * Setelah berhasil, task dikeluarkan dari array `tasks`.
 */
function deleteTask(task) {
  const action = isActiveTask(task) ? "Hapus" : "Hapus permanen";
  if (!window.confirm(`${action} task "${task.title}"?`)) return;

  return saveTask(
    // ID dari respons menentukan objek mana yang dikeluarkan dari array setelah penghapusan.
    () => client.from("tasks").delete().eq("id", task.id).select("id").single(),
    (deletedTask) => {
      tasks = tasks.filter((item) => item.id !== deletedTask.id);
    },
    "Gagal menghapus task.",
  );
}

function filterTasks(status = activeStatus) {
  // Task harus cocok dengan kedua filter. Pilihan "all" meloloskan kondisi filter tersebut.

  const priority = priorityFilter.value;
  return tasks.filter((task) => {
    const matchesStatus = status === "all" || task.status === status;
    const matchesPriority = priority === "all" || task.priority === priority;
    return (
      isActiveTask(task) &&
      matchesStatus &&
      matchesPriority &&
      matchesPeriod(task) &&
      matchesSearch(task)
    );
  });
}

function renderStatusFilters() {
  for (const button of statusFilters) {
    const status = button.dataset.status;
    button.querySelector(".filter-count").textContent =
      filterTasks(status).length;
    button.setAttribute("aria-pressed", String(activeStatus === status));
  }
}

function renderTaskDeadline(card, task) {
  if (!task.deadline) return;

  const deadline = card.querySelector(".task-deadline");
  const time = deadline.querySelector("time");
  time.dateTime = task.deadline_time
    ? `${task.deadline}T${task.deadline_time.slice(0, 5)}`
    : task.deadline;
  time.textContent = formatDeadline(task, shortDate);
  deadline.hidden = false;
}

function updateDeadlineBadges(now = new Date()) {
  const today = getDateKey(now);
  const dateTime = `${today}T${getTimeKey(now)}`;

  for (const card of taskList.children) {
    const deadline = card.querySelector(".task-deadline time").dateTime;
    if (!deadline) continue;

    // Tanggal tanpa jam baru terlambat setelah hari berganti. Jam dibandingkan sampai menit.
    // Task yang sudah Done TETAP memakai badge "Terlambat" bila deadline sudah lewat,
    // supaya penanda auto-selesai (dari cron maupun klien) tidak hilang.
    const isLate = deadline < (deadline.includes("T") ? dateTime : today);
    const isToday = !isLate && deadline.startsWith(today);
    const badge = card.querySelector(".deadline-badge");
    badge.textContent = isLate ? "Terlambat" : isToday ? "Hari ini" : "";
    badge.classList.toggle("is-late", isLate);
    badge.classList.toggle("is-today", isToday);
    badge.hidden = !isLate && !isToday;
  }
}

/**
 * AUTO-COMPLETE — Menentukan apakah sebuah task sudah melewati deadline-nya.
 * Task tanpa jam dianggap terlambat setelah hari berganti; dengan jam dibandingkan sampai menit.
 */
function isOverdue(task, now = new Date()) {
  if (!task.deadline || task.status === "done" || !isActiveTask(task))
    return false;
  const deadlineValue = task.deadline_time
    ? `${task.deadline}T${task.deadline_time.slice(0, 5)}`
    : task.deadline;
  const nowValue = task.deadline_time
    ? `${getDateKey(now)}T${getTimeKey(now)}`
    : getDateKey(now);
  return deadlineValue < nowValue;
}

/**
 * AUTO-COMPLETE — Mengubah status semua task terlambat menjadi "done" secara otomatis.
 * Diubah dalam satu permintaan Supabase agar aman dan efisien.
 * Hanya berjalan saat aplikasi aktif (dipanggil dari refreshClock).
 */
function autoCompleteOverdueTasks() {
  if (!userId || !hasLoaded || isLoading || isSaving) return;
  const overdueIds = tasks
    .filter((task) => isOverdue(task))
    .map((task) => task.id);
  if (overdueIds.length === 0) return;

  return saveTask(
    () =>
      client
        .from("tasks")
        .update({ status: "done" })
        .in("id", overdueIds)
        .eq("user_id", userId)
        .select(TASK_COLUMNS),
    (updated) => {
      // Perbarui array `tasks` dengan baris yang sudah berstatus "done" dari database.
      const byId = new Map(updated.map((task) => [task.id, task]));
      tasks = tasks.map((task) => byId.get(task.id) ?? task);
    },
    "Gagal menyelesaikan task terlambat.",
  );
}

/**
 * AUTO-SELESAI — Menarik ulang status task dari database tanpa menampilkan loading.
 * Perlu karena pg_cron dapat mengubah status saat browser tetap terbuka; tanpa ini
 * array `tasks` (dan badge "Terlambat") masih memakai status lama sampai reload.
 * Hanya status & arsip yang disalin supaya field lokal lain tidak tertimpa.
 */
async function syncTaskStatuses() {
  if (!userId || !hasLoaded || isLoading || isSaving) return;
  const requestVersion = sessionVersion;

  const { data, error } = await client
    .from("tasks")
    .select("id, status, archived_at")
    .eq("user_id", userId);

  if (requestVersion !== sessionVersion || error || !data) return;

  const remote = new Map(data.map((row) => [row.id, row]));
  const changed = tasks.some((task) => {
    const row = remote.get(task.id);
    return (
      row &&
      (row.status !== task.status ||
        Boolean(row.archived_at) !== Boolean(task.archived_at))
    );
  });
  if (!changed) return;

  tasks = tasks.map((task) => {
    const row = remote.get(task.id);
    return row
      ? { ...task, status: row.status, archived_at: row.archived_at }
      : task;
  });
  renderDashboard();
}

function createTaskCard(task) {
  // Salin template untuk setiap task. Isi judul lewat textContent agar input dibaca sebagai teks biasa.
  const card = taskTemplate.content.firstElementChild.cloneNode(true);
  const status = card.querySelector(".status-select");
  const editButton = card.querySelector(".edit-button");
  const archiveButton = card.querySelector(".archive-button");
  const restoreButton = card.querySelector(".restore-button");
  const deleteButton = card.querySelector(".delete-button");
  const archived = !isActiveTask(task);

  card.classList.add(`priority-${task.priority}`, `status-${task.status}`);
  card.classList.toggle("is-done", task.status === "done");
  card.querySelector(".task-title").textContent = task.title;
  card.querySelector(".priority-text").textContent =
    `Prioritas ${PRIORITY_LABELS[task.priority]}`;
  renderTaskDeadline(card, task);

  const descriptionEl = card.querySelector(".task-description");
  if (task.description) {
    descriptionEl.textContent = task.description;
    descriptionEl.hidden = false;
  }

  card.querySelector(".status-control").hidden = archived;
  editButton.hidden = archived;
  archiveButton.hidden = archived;
  restoreButton.hidden = !archived;

  if (archived) {
    const date = card.querySelector(".archived-date");
    const time = date.querySelector("time");
    const badge = card.querySelector(".archived-status");
    time.dateTime = task.archived_at;
    time.textContent = shortDate.format(new Date(task.archived_at));
    date.hidden = false;
    badge.textContent = STATUS_LABELS[task.status];
    badge.hidden = false;
    restoreButton.setAttribute("aria-label", `Pulihkan ${task.title}`);
    restoreButton.addEventListener("click", () => toggleArchive(task));
  } else {
    status.value = task.status;
    status.setAttribute("aria-label", `Ubah status ${task.title}`);
    status.addEventListener("change", () =>
      updateStatus(task.id, status.value),
    );
    editButton.setAttribute("aria-label", `Edit ${task.title}`);
    editButton.addEventListener("click", () => openEditDialog(task));
    archiveButton.setAttribute("aria-label", `Arsipkan ${task.title}`);
    archiveButton.addEventListener("click", () => toggleArchive(task));
  }
  deleteButton.setAttribute(
    "aria-label",
    `${archived ? "Hapus permanen" : "Hapus"} ${task.title}`,
  );
  deleteButton.addEventListener("click", () => deleteTask(task));
  return card;
}

function renderTaskList(list, state, visibleTasks, emptyMessage) {
  list.replaceChildren();
  state.hidden = false;

  if (isLoading) {
    state.textContent = "Memuat...";
  } else if (!hasLoaded) {
    state.textContent = "Daftar task belum tersedia.";
  } else if (visibleTasks.length === 0) {
    state.textContent = emptyMessage;
  } else {
    state.hidden = true;
    for (const task of visibleTasks) {
      list.append(createTaskCard(task));
    }
  }
}

function renderTasks() {
  renderStatusFilters();
  renderTaskList(taskList, taskState, filterTasks(), periodEmptyMessage());
  updateDeadlineBadges();
}

function renderArchive() {
  const archivedTasks = tasks.filter(
    (task) =>
      !isActiveTask(task) && matchesPeriod(task) && matchesSearch(task),
  );
  archivedTasks.sort(
    (first, second) =>
      Date.parse(second.archived_at) - Date.parse(first.archived_at),
  );
  const emptyMessage = searchTask.value.trim()
    ? "Tidak ada arsip yang cocok."
    : "Belum ada task yang diarsipkan.";
  renderTaskList(archiveList, archiveState, archivedTasks, emptyMessage);
}

function groupTasksByDeadline() {
  // Kunci Map adalah tanggal. Simpan task dan prioritas tertinggi untuk titik kalender.
  const groups = new Map();

  for (const task of tasks) {
    if (
      !isActiveTask(task) ||
      !task.deadline ||
      !matchesPeriod(task) ||
      !matchesSearch(task)
    )
      continue;
    if (!groups.has(task.deadline)) {
      groups.set(task.deadline, { tasks: [], priority: task.priority });
    }

    const group = groups.get(task.deadline);
    group.tasks.push(task);
    if (PRIORITY_ORDER[task.priority] > PRIORITY_ORDER[group.priority]) {
      group.priority = task.priority;
    }
  }
  return groups;
}

function createCalendarDay(date, day, today, group) {
  const button = document.createElement("button");
  const number = document.createElement("span");
  button.type = "button";
  button.className = "calendar-day";
  button.setAttribute("aria-pressed", String(date === selectedDate));
  if (date === today) button.setAttribute("aria-current", "date");

  const dateLabel = formatDateKey(date, fullDate);
  button.setAttribute(
    "aria-label",
    group ? `${dateLabel}, ${group.tasks.length} task` : dateLabel,
  );
  number.className = "day-number";
  number.textContent = String(day);
  button.append(number);

  if (group) {
    const dot = document.createElement("span");
    dot.className = `deadline-dot priority-${group.priority}`;
    button.append(dot);
  }

  button.addEventListener("click", () => {
    selectedDate = date;
    renderSchedule(getDateKey(new Date()));
    calendarDays.querySelector('[aria-pressed="true"]').focus();
  });
  return button;
}

function renderCalendar(today, groups) {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  // getDay() mulai dari Minggu (0). Geser supaya Senin menjadi 0.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  // Hari ke-0 bulan berikutnya adalah hari terakhir bulan ini.
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Enam baris menampung bulan terpanjang tanpa menggeser panel task saat ganti bulan.
  const totalCells = 6 * 7;

  calendarHeading.textContent = monthName.format(visibleMonth);
  calendarDays.replaceChildren();

  for (let index = 0; index < totalCells; index += 1) {
    const day = index - offset + 1;
    if (day < 1 || day > daysInMonth) {
      const blank = document.createElement("span");
      blank.setAttribute("aria-hidden", "true");
      calendarDays.append(blank);
    } else {
      const date = getDateKey(new Date(year, month, day));
      calendarDays.append(
        createCalendarDay(date, day, today, groups.get(date)),
      );
    }
  }
}

function renderSelectedTasks(dayTasks) {
  selectedDateHeading.textContent = formatDateKey(selectedDate, fullDate);
  dayTaskList.replaceChildren();

  if (isLoading) {
    dayTaskCount.textContent = "Memuat...";
  } else if (!hasLoaded) {
    dayTaskCount.textContent = "Data task belum tersedia.";
  } else {
    dayTaskCount.textContent = `${dayTasks.length} task`;
    for (const task of [...dayTasks].sort(compareDeadlines)) {
      const item = document.createElement("li");
      const details = document.createElement("div");
      const title = document.createElement("span");
      const status = document.createElement("span");
      item.className = `day-task priority-${task.priority} status-${task.status}`;
      item.classList.toggle("is-done", task.status === "done");
      title.className = "day-task-title";
      title.textContent = task.title;
      details.className = "day-task-details";
      details.append(title);
      if (task.deadline_time) {
        const time = document.createElement("time");
        time.className = "day-task-time";
        time.dateTime = task.deadline_time;
        time.textContent = `Pukul ${formatDeadlineTime(task.deadline_time)}`;
        details.append(time);
      }
      status.className = "status-badge";
      status.textContent = STATUS_LABELS[task.status];

      if (task.description) {
        // Deskripsi ditempatkan di dalam details agar muncul di bawah judul, bukan di samping.
        const desc = document.createElement("p");
        desc.className = "day-task-description";
        desc.textContent = task.description;
        details.append(desc);
      }

      item.append(details, status);
      dayTaskList.append(item);
    }
  }
}

function renderSchedule(today) {
  // Kalender memakai deadline task aktif, tanpa mengikuti filter status dan prioritas di daftar.
  const groups = groupTasksByDeadline();
  renderCalendar(today, groups);
  renderSelectedTasks(groups.get(selectedDate)?.tasks ?? []);
}

function changeMonth(step) {
  const today = new Date();
  visibleMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + step,
    1,
  );
  const isCurrentMonth =
    visibleMonth.getFullYear() === today.getFullYear() &&
    visibleMonth.getMonth() === today.getMonth();
  selectedDate = getDateKey(isCurrentMonth ? today : visibleMonth);
  renderSchedule(getDateKey(today));
}

function setView(view) {
  for (const name of ["list", "timeline", "calendar", "archive", "rekap"]) {
    document.getElementById(`${name}-view`).hidden = name !== view;
  }
  for (const button of viewButtons) {
    button.setAttribute("aria-pressed", String(button.dataset.view === view));
  }
  openAddButton.hidden = view === "archive" || view === "rekap";
  workspace.classList.toggle("showing-rekap", view === "rekap");
  searchTask.placeholder = view === "archive" ? "Cari arsip" : "Cari task";
  if (view === "rekap") renderRekap();
}

function getPeriodRange(period, now = new Date()) {
  if (period === "all") return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "today") {
    const key = getDateKey(today);
    return [key, key];
  }

  if (period === "week") {
    // Senin = awal minggu, sama seperti grid kalender di renderCalendar().
    const start = shiftDate(today, -((today.getDay() + 6) % 7));
    return [getDateKey(start), getDateKey(shiftDate(start, 6))];
  }

  if (period === "month") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return [getDateKey(start), getDateKey(end)];
  }

  if (period === "year") {
    return [`${today.getFullYear()}-01-01`, `${today.getFullYear()}-12-31`];
  }

  return null;
}

function matchesPeriod(task) {
  if (activePeriod === "all") return true;
  if (!task.deadline) return false;

  const range = getPeriodRange(activePeriod);
  if (!range) return true;
  // Format YYYY-MM-DD aman dibandingkan sebagai string (sudah zero-padded).
  if (task.deadline < range[0] || task.deadline > range[1]) return false;

  // "Tahun ini" + bulan yang dipilih → hanya task di bulan itu.
  if (activePeriod === "year" && activeMonth !== null) {
    return Number(task.deadline.slice(5, 7)) - 1 === activeMonth;
  }
  return true;
}

function syncPeriodButtons() {
  for (const button of periodFilters) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.period === activePeriod),
    );
  }
  const isYear = activePeriod === "year";
  monthFilterBar.hidden = !isYear || yearDetail;
  yearViewBack.hidden = !isYear || !yearDetail;
  yearTaskList.hidden = !isYear || !yearDetail;
  yearTaskState.hidden = !isYear || !yearDetail;
  yearView.hidden = !isYear;
  workspace.classList.toggle("showing-year", isYear);
  for (const button of monthFilterBar.querySelectorAll("[data-month]")) {
    button.setAttribute(
      "aria-pressed",
      String(isYear && Number(button.dataset.month) === activeMonth),
    );
  }
  if (isYear) {
    renderMonthCounts();
    renderYearView();
  }
}

function renderMonthCounts() {
  const yearPrefix = `${new Date().getFullYear()}-`;
  const counts = Array(12).fill(0);
  for (const task of tasks) {
    if (!isActiveTask(task) || !task.deadline) continue;
    if (!task.deadline.startsWith(yearPrefix) || !matchesSearch(task)) continue;
    counts[Number(task.deadline.slice(5, 7)) - 1] += 1;
  }
  for (const button of monthFilterBar.querySelectorAll("[data-month]")) {
    button.querySelector(".month-count").textContent =
      `${counts[Number(button.dataset.month)]} task`;
  }
}

function renderYearView() {
  if (activePeriod !== "year") return;
  if (!yearDetail || activeMonth === null) {
    yearViewTitle.textContent = "Pilih bulan";
    yearViewCount.textContent = "";
    return;
  }

  const monthLabel = MONTH_NAMES_FULL[activeMonth];
  const yearPrefix = `${new Date().getFullYear()}-`;
  const monthTasks = tasks.filter(
    (task) =>
      isActiveTask(task) &&
      task.deadline &&
      task.deadline.startsWith(yearPrefix) &&
      Number(task.deadline.slice(5, 7)) - 1 === activeMonth &&
      matchesSearch(task),
  );
  monthTasks.sort(compareDeadlines);
  yearViewTitle.textContent = `Task bulan ${monthLabel}`;
  yearViewCount.textContent = `${monthTasks.length} task`;
  renderTaskList(
    yearTaskList,
    yearTaskState,
    monthTasks,
    `Belum ada task di bulan ${monthLabel}.`,
  );
}

function periodEmptyMessage() {
  if (activePeriod === "all") return "Belum ada task";
  if (activePeriod === "year" && activeMonth !== null)
    return "Tidak ada task pada bulan ini.";
  return "Tidak ada task pada periode ini.";
}

function matchesSearch(task) {
  const query = searchTask.value.trim().toLocaleLowerCase("id-ID");
  return task.title.toLocaleLowerCase("id-ID").includes(query);
}

function shiftDate(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function getTimelineStart() {
  // Timeline dimulai dari hari ini agar tanggal aktif selalu terlihat di awal periode.
  return new Date();
}

function compareDeadlines(first, second) {
  // Task tanpa jam ditampilkan setelah task dengan jam pada tanggal yang sama.
  return (
    first.deadline.localeCompare(second.deadline) ||
    (first.deadline_time ?? "24:00").localeCompare(
      second.deadline_time ?? "24:00",
    )
  );
}

function createTimelineRow(task, startIndex, endIndex) {
  const row = document.createElement("li");
  const button = document.createElement("button");
  row.className = "timeline-row";
  // Batang berjalan dari indeks tanggal dibuat (created_at) sampai indeks tanggal deadline.
  const widthPercent =
    Math.max(1, endIndex - startIndex + 1) * (100 / TIMELINE_DAYS);
  button.type = "button";
  button.className = `timeline-event status-${task.status} priority-${task.priority}`;
  button.textContent = task.deadline_time
    ? `${formatDeadlineTime(task.deadline_time)}  ${task.title}`
    : task.title;
  button.title = `${task.title} · ${STATUS_LABELS[task.status]} · ${formatDeadline(task, fullDate)}`;
  button.setAttribute("aria-label", `Edit ${button.title}`);
  button.addEventListener("click", () => openEditDialog(task));
  button.style.left = `${(startIndex / TIMELINE_DAYS) * 100}%`;
  button.style.width = `${widthPercent}%`;
  row.append(button);
  return row;
}

function renderTimeline(today) {
  const dateKeys = [];
  timelineDays.replaceChildren();
  timelineRows.replaceChildren();

  for (let index = 0; index < TIMELINE_DAYS; index += 1) {
    const date = shiftDate(timelineStart, index);
    const key = getDateKey(date);
    const day = document.createElement("span");
    const number = document.createElement("strong");
    day.className = "timeline-day";
    day.title = fullDate.format(date);
    day.append(weekday.format(date));
    number.textContent = date.getDate();
    day.append(number);
    if (key === today) day.setAttribute("aria-current", "date");
    timelineDays.append(day);
    dateKeys.push(key);
  }

  timelineRange.textContent = `${shortDate.format(timelineStart)} – ${shortDate.format(shiftDate(timelineStart, TIMELINE_DAYS - 1))}`;
  const todayIndex = dateKeys.indexOf(today);
  timelineRows.classList.toggle("has-today", todayIndex >= 0);
  timelineRows.style.setProperty("--today-index", todayIndex);

  const scheduled = tasks.filter((task) => {
    if (
      !isActiveTask(task) ||
      !task.deadline ||
      !matchesPeriod(task) ||
      !matchesSearch(task)
    )
      return false;
    // Task muncul jika deadline-nya atau tanggal dibuat ada dalam periode.
    const startKey = getDateKey(new Date(task.created_at));
    return dateKeys.includes(task.deadline) || dateKeys.includes(startKey);
  });
  scheduled.sort(compareDeadlines);
  for (const task of scheduled) {
    const startKey = getDateKey(new Date(task.created_at));
    const startIndex = Math.max(
      0,
      Math.min(TIMELINE_DAYS - 1, dateKeys.indexOf(startKey)),
    );
    const endIndex = Math.max(
      0,
      Math.min(TIMELINE_DAYS - 1, dateKeys.indexOf(task.deadline)),
    );
    // Pastikan batang minimal lebar 1 hari meski dibuat dan jatuh tempo sama hari.
    const finalEndIndex = Math.max(startIndex, endIndex);
    timelineRows.append(createTimelineRow(task, startIndex, finalEndIndex));
  }

  timelineState.hidden = scheduled.length > 0;
  if (isLoading) {
    timelineState.textContent = "Memuat…";
  } else if (!hasLoaded) {
    timelineState.textContent = "Data task belum tersedia.";
  } else {
    timelineState.textContent = searchTask.value.trim()
      ? "Tidak ada task yang cocok pada periode ini."
      : "Belum ada deadline pada periode ini.";
  }
}

function moveTimeline(step) {
  timelineStart =
    step === 0
      ? getTimelineStart()
      : shiftDate(timelineStart, step * TIMELINE_DAYS);
  renderTimeline(getDateKey(new Date()));
  updateControls();
}

function renderCompletion() {
  completionSummary.hidden = !hasLoaded;
  if (!hasLoaded) return;

  // Progres memakai semua task aktif, termasuk yang tidak cocok dengan filter daftar.
  const activeTasks = tasks.filter(isActiveTask);
  const completedCount = activeTasks.filter(
    (task) => task.status === "done",
  ).length;
  completionBar.max = Math.max(activeTasks.length, 1);
  completionBar.value = completedCount;
  completionCount.textContent = `${completedCount} dari ${activeTasks.length} selesai`;
}

function renderRekap() {
  // Sama seperti renderCompletion: jangan timpa angka rekap saat data belum siap.
  if (!hasLoaded) return;
  const activeTasks = tasks.filter(isActiveTask);
  const counts = {
    todo: activeTasks.filter((task) => task.status === "todo").length,
    progress: activeTasks.filter((task) => task.status === "progress").length,
    done: activeTasks.filter((task) => task.status === "done").length,
    low: activeTasks.filter((task) => task.priority === "low").length,
    medium: activeTasks.filter((task) => task.priority === "medium").length,
    high: activeTasks.filter((task) => task.priority === "high").length,
  };
  const total = activeTasks.length;
  const late = activeTasks.filter(isOverdue).length;
  const percent = total ? Math.round((counts.done / total) * 100) : 0;

  rekapTotal.textContent = total;
  rekapDone.textContent = counts.done;
  rekapLate.textContent = late;
  rekapHigh.textContent = counts.high;
  rekapPercent.textContent = `${percent}%`;

  const circumference = 2 * Math.PI * 50;
  rekapRing.style.strokeDasharray = `${circumference}`;
  rekapRing.style.strokeDashoffset = `${circumference * (1 - percent / 100)}`;

  const statusMax = Math.max(counts.todo, counts.progress, counts.done, 1);
  const priorityMax = Math.max(counts.low, counts.medium, counts.high, 1);
  for (const key of ["todo", "progress", "done"]) {
    document.getElementById(`bar-${key}`).style.width =
      `${(counts[key] / statusMax) * 100}%`;
    document.getElementById(`val-${key}`).textContent = counts[key];
  }
  for (const key of ["low", "medium", "high"]) {
    document.getElementById(`bar-${key}`).style.width =
      `${(counts[key] / priorityMax) * 100}%`;
    document.getElementById(`val-${key}`).textContent = counts[key];
  }

  const yearPrefix = `${new Date().getFullYear()}-`;
  const monthly = Array(12).fill(0);
  for (const task of activeTasks) {
    if (task.deadline?.startsWith(yearPrefix)) {
      monthly[Number(task.deadline.slice(5, 7)) - 1] += 1;
    }
  }
  const monthMax = Math.max(...monthly, 1);
  const monthLabels = [
    "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
    "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
  ];
  rekapMonthBars.replaceChildren();
  monthly.forEach((count, index) => {
    const item = document.createElement("div");
    item.className = "month-bar-item";
    const track = document.createElement("div");
    track.className = "month-bar-track";
    const fill = document.createElement("div");
    fill.className = "month-bar-fill";
    fill.style.height = `${(count / monthMax) * 100}%`;
    fill.title = `${count} task`;
    track.append(fill);
    const label = document.createElement("span");
    label.textContent = monthLabels[index];
    const value = document.createElement("strong");
    value.textContent = count;
    item.append(track, label, value);
    rekapMonthBars.append(item);
  });
}

function renderDashboard() {
  const today = getDateKey(new Date());
  headerDate.dateTime = today;
  headerDate.textContent = formatDateKey(today, fullDate);
  addForm.elements.namedItem("deadline").min = today;
  renderCompletion();
  // Rekap dihitung lebih awal agar tidak terlewat bila render view lain bermasalah.
  renderRekap();
  renderTasks();
  renderArchive();
  renderSchedule(today);
  renderTimeline(today);
  if (activePeriod === "year") {
    renderMonthCounts();
    renderYearView();
  }
}

function showAuthMessage(element, message = "") {
  element.textContent = message;
  element.hidden = !message;
}

function setAuthMode(register) {
  isRegistering = register;
  const name = authForm.elements.namedItem("displayName");
  const password = authForm.elements.namedItem("password");
  document.getElementById("auth-name-field").hidden = !register;
  name.required = register;
  name.disabled = !register;
  password.value = "";
  password.autocomplete = register ? "new-password" : "current-password";
  document.getElementById("auth-password-hint").hidden = !register;
  if (register) {
    password.minLength = 8;
    password.setAttribute("aria-describedby", "auth-password-hint");
  } else {
    password.removeAttribute("minlength");
    password.removeAttribute("aria-describedby");
  }
  document.getElementById("auth-heading").textContent = register
    ? "Daftar akun"
    : "Masuk";
  document.getElementById("auth-intro").textContent = register
    ? "Simpan task dan deadline di akunmu."
    : "Atur task, deadline, dan jadwalmu dalam satu tempat.";
  document.getElementById("auth-switch-text").textContent = register
    ? "Sudah punya akun?"
    : "Belum punya akun?";
  authSubmit.textContent = register ? "Daftar" : "Masuk";
  authToggle.textContent = register ? "Masuk" : "Daftar";
  showAuthMessage(authError);
  showAuthMessage(authNotice);
}

async function submitAuth(event) {
  event.preventDefault();
  if (authFields.disabled) return;

  const email = authForm.elements.namedItem("email").value.trim();
  const password = authForm.elements.namedItem("password").value;
  const displayName = authForm.elements.namedItem("displayName").value.trim();
  showAuthMessage(authError);
  showAuthMessage(authNotice);
  if (isRegistering && !displayName) {
    showAuthMessage(authError, "Isi nama terlebih dahulu.");
    return;
  }

  authFields.disabled = true;
  authToggle.disabled = true;
  authSubmit.textContent = "Memproses…";
  try {
    // Supabase Auth yang menerima kredensial dan menyimpan akun pengguna.
    if (isRegistering) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: `${window.location.origin}${window.location.pathname}`,
        },
      });
      if (error) throw error;
      if (!data.session) {
        setAuthMode(false);
        showAuthMessage(
          authNotice,
          "Periksa email untuk tautan konfirmasi, lalu masuk ke akunmu.",
        );
      }
    } else {
      const { error } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    }
  } catch (error) {
    const messages = {
      invalid_credentials: "Email atau kata sandi salah.",
      email_not_confirmed: "Konfirmasi emailmu terlebih dahulu.",
    };
    showAuthMessage(authError, messages[error.code] ?? error.message);
  } finally {
    authFields.disabled = false;
    authToggle.disabled = false;
    authSubmit.textContent = isRegistering ? "Daftar" : "Masuk";
  }
}

async function signOut() {
  logoutButton.disabled = true;
  showRequestError();
  try {
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw error;
  } catch (error) {
    showRequestError(`Gagal keluar. ${error.message}`);
  } finally {
    logoutButton.disabled = false;
  }
}

function showProfileError(message = "") {
  profileRequestError.textContent = message;
  profileRequestError.hidden = !message;
}

function showProfileSuccess(message = "") {
  profileSuccess.textContent = message;
  profileSuccess.hidden = !message;
}

function showProfileFieldError(field, message) {
  const errorText = document.getElementById(
    field.getAttribute("aria-describedby"),
  );
  if (!errorText) return;
  errorText.textContent = message;
  errorText.hidden = !message;
  field.setAttribute("aria-invalid", String(Boolean(message)));
}

function openProfileDialog() {
  if (!userId) return;
  profileForm.reset();
  const nameInput = profileForm.elements.namedItem("display_name");
  nameInput.value = document.getElementById("account-name").textContent.trim();
  // Reset pesan error dan berhasil
  showProfileError();
  showProfileSuccess();
  showProfileFieldError(nameInput, "");
  showProfileFieldError(profileForm.elements.namedItem("password"), "");
  showProfileFieldError(profileForm.elements.namedItem("password_confirm"), "");
  profileDialog.showModal();
}

function updateProfile(event) {
  event.preventDefault();
  if (!userId) return;

  const nameInput = profileForm.elements.namedItem("display_name");
  const passwordInput = profileForm.elements.namedItem("password");
  const confirmInput = profileForm.elements.namedItem("password_confirm");

  const displayName = nameInput.value.trim();
  const password = passwordInput.value;
  const passwordConfirm = confirmInput.value;

  // Reset semua error
  showProfileError();
  showProfileSuccess();
  showProfileFieldError(nameInput, "");
  showProfileFieldError(passwordInput, "");
  showProfileFieldError(confirmInput, "");

  let hasError = false;

  if (!displayName) {
    showProfileFieldError(nameInput, "Nama tampilan wajib diisi.");
    hasError = true;
  }

  const hasPassword = password.length > 0;
  const hasConfirm = passwordConfirm.length > 0;

  if (hasPassword !== hasConfirm) {
    const target = hasPassword ? confirmInput : passwordInput;
    showProfileFieldError(
      target,
      "Kata sandi baru dan konfirmasi harus diisi bersama-sama.",
    );
    target.focus();
    hasError = true;
  }

  if (hasPassword && password.length < 8) {
    showProfileFieldError(passwordInput, "Kata sandi baru minimal 8 karakter.");
    passwordInput.focus();
    hasError = true;
  }

  if (hasPassword && password !== passwordConfirm) {
    showProfileFieldError(confirmInput, "Konfirmasi kata sandi tidak cocok.");
    confirmInput.focus();
    hasError = true;
  }

  if (hasError) return;

  const updateParams = { data: { display_name: displayName } };
  if (hasPassword) {
    updateParams.password = password;
  }

  saveProfileButton.disabled = true;
  saveProfileButton.textContent = "Menyimpan...";

  client.auth
    .updateUser(updateParams)
    .then(({ data, error }) => {
      if (error) throw error;
      // Perbarui nama yang ditampilkan di sidebar
      const nameEl = document.getElementById("account-name");
      if (nameEl) nameEl.textContent = displayName;
      showProfileSuccess("Profil berhasil diperbarui.");
      profileForm.reset();
      nameInput.value = displayName;
    })
    .catch((error) => {
      showProfileError(`Gagal memperbarui profil. ${error.message}`);
    })
    .finally(() => {
      saveProfileButton.disabled = false;
      saveProfileButton.textContent = "Simpan";
    });
}

function applySession(session) {
  const user = session?.user;
  const nextUserId = user?.id ?? null;
  startupState.hidden = true;
  authPage.hidden = Boolean(user);
  workspace.hidden = !user;
  // Refresh token tidak mengubah pemilik. Muat ulang hanya saat identitas berubah.
  if (nextUserId === userId) return;

  userId = nextUserId;
  sessionVersion += 1;
  tasks = [];
  isLoading = false;
  hasLoaded = false;
  isSaving = false;
  if (addDialog.open) addDialog.close();
  if (editDialog.open) editDialog.close();
  addForm.reset();
  editForm.reset();
  searchTask.value = "";
  priorityFilter.value = "all";
  activeStatus = "all";
  activePeriod = "all";
  activeMonth = null;
  yearDetail = false;
  syncPeriodButtons();
  visibleMonth = new Date();
  selectedDate = getDateKey(visibleMonth);
  timelineStart = getTimelineStart();
  setView("timeline");
  showRequestError();
  updateControls();

  if (!user) {
    renderDashboard();
    authForm.reset();
    setAuthMode(false);
    return;
  }

  const savedName = user.user_metadata?.display_name;
  const name =
    typeof savedName === "string" && savedName.trim()
      ? savedName
      : (user.email ?? "Pengguna");
  document.getElementById("account-name").textContent = name;
  document.getElementById("account-email").textContent = user.email;
  document.getElementById("account-avatar").textContent =
    [...name][0]?.toUpperCase() ?? "?";
  authForm.reset();
  setAuthMode(false);
  loadTasks();
}

// Hubungkan tombol, filter, dan form ke fungsi yang dijalankan saat pengguna berinteraksi.
for (const button of viewButtons) {
  button.addEventListener("click", () => setView(button.dataset.view));
}
for (const [id, step] of [
  ["timeline-back", -1],
  ["timeline-today", 0],
  ["timeline-next", 1],
]) {
  document
    .getElementById(id)
    .addEventListener("click", () => moveTimeline(step));
}
for (const button of statusFilters) {
  button.addEventListener("click", () => {
    activeStatus = button.dataset.status;
    renderTasks();
    updateControls();
  });
}

priorityFilter.addEventListener("change", () => {
  renderTasks();
  updateControls();
});

for (const button of periodFilters) {
  button.addEventListener("click", () => {
    activePeriod = button.dataset.period;
    activeMonth = null;
    yearDetail = false;
    syncPeriodButtons();
    renderDashboard();
    updateControls();
  });
}

// Tombol bulan dibuat otomatis dan hanya dipakai saat "Tahun ini" aktif.
for (const [index, name] of [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
].entries()) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-button";
  button.dataset.month = String(index);
  const nameEl = document.createElement("span");
  nameEl.className = "month-name";
  nameEl.textContent = name;
  const countEl = document.createElement("span");
  countEl.className = "month-count";
  countEl.textContent = "0";
  button.append(nameEl, countEl);
  button.addEventListener("click", () => {
    activePeriod = "year";
    activeMonth = index;
    yearDetail = true;
    syncPeriodButtons();
    renderDashboard();
    updateControls();
  });
  monthFilterBar.append(button);
}
yearViewBack.addEventListener("click", () => {
  activeMonth = null;
  yearDetail = false;
  syncPeriodButtons();
  renderDashboard();
  updateControls();
});
syncPeriodButtons();

addForm.addEventListener("submit", addTask);
openAddButton.addEventListener("click", () => {
  addDialog.showModal();
  showRequestError();
  showFieldError(addForm.elements.namedItem("title"), "");
  showFieldError(addForm.elements.namedItem("deadline"), "");
  showFieldError(addForm.elements.namedItem("deadline_time"), "");
});
document
  .getElementById("cancel-add")
  .addEventListener("click", () => addDialog.close());
addDialog.addEventListener("cancel", (event) => {
  if (isSaving) event.preventDefault();
});
editForm.addEventListener("submit", editTask);
editDialog.addEventListener("cancel", (event) => {
  if (isSaving) event.preventDefault();
});
editDialog.addEventListener("close", () => {
  editingTaskId = null;
});
document
  .getElementById("cancel-edit")
  .addEventListener("click", () => editDialog.close());
document
  .getElementById("previous-month")
  .addEventListener("click", () => changeMonth(-1));
document
  .getElementById("next-month")
  .addEventListener("click", () => changeMonth(1));
retryButton.addEventListener("click", loadTasks);
searchTask.addEventListener("input", () => {
  renderDashboard();
  updateControls();
});
authForm.addEventListener("submit", submitAuth);
authToggle.addEventListener("click", () => setAuthMode(!isRegistering));
logoutButton.addEventListener("click", signOut);
openProfileButton.addEventListener("click", openProfileDialog);
openProfileButton.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openProfileDialog();
  }
});
accountAvatar.addEventListener("click", openProfileDialog);
accountAvatar.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openProfileDialog();
  }
});
cancelProfileButton.addEventListener("click", () => profileDialog.close());
profileForm.addEventListener("submit", updateProfile);
profileDialog.addEventListener("close", () => {
  showProfileError();
  showProfileSuccess();
});

function refreshClock() {
  if (!userId) return;

  const now = new Date();
  if (headerDate.dateTime !== getDateKey(now)) {
    renderDashboard();
    updateControls();
  } else {
    updateDeadlineBadges(now);
  }
  // Task yang sudah terlambat otomatis ditandai selesai.
  autoCompleteOverdueTasks();
  // pg_cron bisa mengubah status saat web tetap terbuka; segarkan status agar badge ikut benar.
  syncTaskStatuses();
}

window.addEventListener("focus", refreshClock);
window.setInterval(refreshClock, 15000);

try {
  client = getSupabaseClient();
  client.auth.onAuthStateChange((_event, session) => {
    // Jadwalkan loadTasks setelah callback selesai agar operasi Supabase tidak saling menunggu.
    window.setTimeout(() => applySession(session), 0);
  });
} catch (error) {
  startupState.textContent = error.message;
}
