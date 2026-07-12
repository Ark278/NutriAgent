/* ══════════════════════════════════════════════
   NutriBot — AI Nutrition Agent | Main JS
   IBM Watsonx.ai + Flask Application
   ══════════════════════════════════════════════ */

"use strict";

// ── App State ─────────────────────────────────
const State = {
  profile:       JSON.parse(localStorage.getItem("nutribot_profile") || "null"),
  chatHistory:   [],
  waterCount:    parseInt(localStorage.getItem("nutribot_water") || "0"),
  darkMode:      localStorage.getItem("nutribot_dark") === "true",
  todayLog:      [],
  targets:       null,
};

// ── On DOM Ready ──────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initDarkMode();
  initProfile();
  loadDailyTip();
  loadTodayLog();
  renderWaterGlasses();
  setTodayDate();

  // Pre-fill time in tracker
  const timeInput = document.getElementById("track-time");
  if (timeInput) {
    const now = new Date();
    timeInput.value = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  }
});

// ════════════════════════════════════════════════
// TAB NAVIGATION
// ════════════════════════════════════════════════
function showTab(tab) {
  document.querySelectorAll(".tab-content-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));

  const panel = document.getElementById(`tab-content-${tab}`);
  const btn   = document.getElementById(`tab-${tab}`);
  if (panel) panel.classList.add("active");
  if (btn)   btn.classList.add("active");

  // Close offcanvas if open
  const offcanvas = document.getElementById("mobileMenu");
  if (offcanvas) {
    const bsOC = bootstrap.Offcanvas.getInstance(offcanvas);
    if (bsOC) bsOC.hide();
  }

  // Refresh data when switching tabs
  if (tab === "dashboard") refreshDashboard();
  if (tab === "tracker")   loadTodayLog();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ════════════════════════════════════════════════
// DARK MODE
// ════════════════════════════════════════════════
function initDarkMode() {
  if (State.darkMode) applyDarkMode(true);
  const btn = document.getElementById("darkModeToggle");
  if (btn) btn.addEventListener("click", toggleDarkMode);
}

function toggleDarkMode() {
  State.darkMode = !State.darkMode;
  localStorage.setItem("nutribot_dark", State.darkMode);
  applyDarkMode(State.darkMode);
}

function applyDarkMode(on) {
  document.documentElement.setAttribute("data-bs-theme", on ? "dark" : "light");
  const icon = document.getElementById("darkIcon");
  if (icon) icon.className = on ? "bi bi-sun-fill" : "bi bi-moon-stars-fill";
}

// ════════════════════════════════════════════════
// PROFILE
// ════════════════════════════════════════════════
function openProfileModal() {
  const modal = new bootstrap.Modal(document.getElementById("profileModal"));
  if (State.profile) populateProfileForm(State.profile);
  modal.show();
}

function populateProfileForm(p) {
  const fields = ["name","age","gender","weight","height","goal","diet","activity","allergies","calories","split"];
  fields.forEach(f => {
    const el = document.getElementById(`p-${f}`);
    if (el && p[f] !== undefined) el.value = p[f];
  });
}

function saveProfile() {
  const p = {
    name:     document.getElementById("p-name").value.trim(),
    age:      parseInt(document.getElementById("p-age").value) || null,
    gender:   document.getElementById("p-gender").value,
    weight:   parseFloat(document.getElementById("p-weight").value) || null,
    height:   parseFloat(document.getElementById("p-height").value) || null,
    goal:     document.getElementById("p-goal").value,
    diet_type: document.getElementById("p-diet").value,
    activity_level: document.getElementById("p-activity").value,
    allergies: document.getElementById("p-allergies").value.trim() || "None",
    calories: parseInt(document.getElementById("p-calories").value) || null,
    split:    document.getElementById("p-split").value,
  };

  // Auto-calculate calories if not provided but measurements exist
  if (!p.calories && p.weight && p.height && p.age) {
    const bmr = calcBMR(p.weight, p.height, p.age, p.gender);
    const tdee = calcTDEE(bmr, p.activity_level);
    if      (p.goal === "lose weight") p.calories = Math.max(1200, Math.round(tdee - 400));
    else if (p.goal === "gain muscle") p.calories = Math.round(tdee + 350);
    else p.calories = Math.round(tdee);
  }

  State.profile  = p;
  State.targets  = p.calories ? calcMacros(p.calories, p.split) : null;
  localStorage.setItem("nutribot_profile", JSON.stringify(p));

  bootstrap.Modal.getInstance(document.getElementById("profileModal")).hide();
  initProfile();
  showToast(`Profile saved for ${p.name || "you"}!`, "success");
  refreshDashboard();
}

function initProfile() {
  const p = State.profile;
  updateNavProfile(p);
  renderProfileSummary(p);
  renderDailyTargets(p);

  if (p && !State.targets && p.calories) {
    State.targets = calcMacros(p.calories, p.split || "balanced");
  }
}

function updateNavProfile(p) {
  const el = document.getElementById("navProfileName");
  if (el) el.textContent = p?.name ? p.name.split(" ")[0] : "My Profile";
}

function renderProfileSummary(p) {
  const el = document.getElementById("profileSummary");
  if (!el) return;
  if (!p) { el.innerHTML = `<p class="text-muted text-center py-2">No profile set. <a href="#" onclick="openProfileModal()">Set up profile</a> for personalized advice.</p>`; return; }
  el.innerHTML = `
    <div class="profile-row"><span>Name</span><span class="fw-500">${p.name || "—"}</span></div>
    <div class="profile-row"><span>Age / Gender</span><span class="fw-500">${p.age || "—"} / ${capitalize(p.gender || "—")}</span></div>
    <div class="profile-row"><span>Weight / Height</span><span class="fw-500">${p.weight || "—"} kg / ${p.height || "—"} cm</span></div>
    <div class="profile-row"><span>Goal</span><span class="fw-500">${capitalize(p.goal || "—")}</span></div>
    <div class="profile-row"><span>Diet</span><span class="fw-500">${capitalize(p.diet_type || "—")}</span></div>
    <div class="profile-row"><span>Target Calories</span><span class="fw-500 text-success">${p.calories || "—"} kcal</span></div>
  `;
}

function renderDailyTargets(p) {
  const el = document.getElementById("daily-targets-panel");
  if (!el) return;
  if (!p?.calories) { el.innerHTML = `<p class="text-muted text-center small">Set your profile to see targets</p>`; return; }
  const m = calcMacros(p.calories, p.split || "balanced");
  el.innerHTML = `
    <div class="target-item"><span>Calories</span><span class="target-val text-success">${p.calories} kcal</span></div>
    <div class="target-item"><span>Protein</span><span class="target-val text-primary">${m.protein_g}g <small class="text-muted">(${m.protein_pct}%)</small></span></div>
    <div class="target-item"><span>Carbs</span><span class="target-val text-warning">${m.carbs_g}g <small class="text-muted">(${m.carbs_pct}%)</small></span></div>
    <div class="target-item"><span>Fat</span><span class="target-val text-danger">${m.fat_g}g <small class="text-muted">(${m.fat_pct}%)</small></span></div>
    <div class="target-item"><span>Fiber</span><span class="target-val text-info">${m.fiber_g}g</span></div>
  `;
}

// ════════════════════════════════════════════════
// CHAT
// ════════════════════════════════════════════════
function handleChatKey(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 140) + "px";
}

async function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg   = input.value.trim();
  if (!msg) return;

  appendMessage("user", msg);
  input.value = ""; input.style.height = "auto";
  State.chatHistory.push({ role: "user", content: msg });

  const sendBtn = document.getElementById("sendBtn");
  sendBtn.disabled = true;

  const typingId = appendTyping();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg,
        history: State.chatHistory.slice(-6),
        profile: State.profile || {},
      }),
    });
    const data = await res.json();
    removeTyping(typingId);

    if (data.error) {
      appendMessage("bot", `⚠️ Error: ${data.error}`);
    } else {
      appendMessage("bot", data.reply, data.timestamp);
      State.chatHistory.push({ role: "assistant", content: data.reply });
    }
  } catch (err) {
    removeTyping(typingId);
    appendMessage("bot", "⚠️ Could not reach the server. Please check your connection.");
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function sendQuick(msg) {
  document.getElementById("chatInput").value = msg;
  sendMessage();
}

function appendMessage(role, content, time = null) {
  const container = document.getElementById("chatMessages");
  const isBot = role === "bot";
  const timeStr = time || new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const div = document.createElement("div");
  div.className = `message ${isBot ? "bot-message" : "user-message"}`;
  div.innerHTML = `
    <div class="message-avatar"><i class="bi bi-${isBot ? "robot" : "person-fill"}"></i></div>
    <div class="message-bubble">
      ${formatMessageContent(content)}
      <span class="message-time">${timeStr}</span>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function formatMessageContent(text) {
  // Convert markdown-ish formatting to HTML
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^•\s/gm, "• ")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/,"<p>").replace(/$/,"</p>");
}

function appendTyping() {
  const id = "typing-" + Date.now();
  const container = document.getElementById("chatMessages");
  const div = document.createElement("div");
  div.className = "message bot-message"; div.id = id;
  div.innerHTML = `
    <div class="message-avatar"><i class="bi bi-robot"></i></div>
    <div class="message-bubble">
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return id;
}

function removeTyping(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function clearChat() {
  const container = document.getElementById("chatMessages");
  const welcome = container.firstElementChild;
  container.innerHTML = "";
  if (welcome) container.appendChild(welcome);
  State.chatHistory = [];
}

// ════════════════════════════════════════════════
// DAILY TIP
// ════════════════════════════════════════════════
async function loadDailyTip() {
  const el = document.getElementById("dailyTip");
  if (!el) return;
  try {
    const res  = await fetch("/api/nutrition-tip");
    const data = await res.json();
    el.innerHTML = `<div class="d-flex gap-2"><span>💡</span><span>${formatPlanText(data.tip)}</span></div>`;
  } catch {
    el.innerHTML = `<span>💡 Stay hydrated! Aim for 8 glasses of water daily and include seasonal fruits in your diet.</span>`;
  }
}

// ════════════════════════════════════════════════
// MEAL TRACKER
// ════════════════════════════════════════════════
function setTodayDate() {
  const el = document.getElementById("todayDate");
  if (el) el.textContent = new Date().toLocaleDateString("en-IN", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}

async function loadTodayLog() {
  try {
    const res  = await fetch("/api/tracker/today");
    const data = await res.json();
    State.todayLog = data.meals || [];
    renderTodayLog(data.meals, data.totals);
    updateQuickStats(data.totals);
    updateProgressBars(data.totals);
    updateDashboardStats(data.totals);
  } catch {}
}

function renderTodayLog(meals, totals) {
  const el = document.getElementById("todayMealList");
  if (!el) return;
  if (!meals || meals.length === 0) {
    el.innerHTML = `<div class="empty-state"><i class="bi bi-journal-plus"></i><p>No meals logged today</p><small>Start by logging your breakfast!</small></div>`;
    return;
  }
  el.innerHTML = meals.map(m => `
    <div class="meal-log-item" id="meal-${m.id}">
      <div>
        <div class="meal-log-name">${escHtml(m.meal)}</div>
        <div class="meal-log-time">${m.time}</div>
        <div class="meal-log-macros">
          <span>P: ${m.protein}g</span>
          <span>C: ${m.carbs}g</span>
          <span>F: ${m.fat}g</span>
          ${m.fiber ? `<span>Fiber: ${m.fiber}g</span>` : ""}
        </div>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="meal-log-cal">${m.calories} kcal</span>
        <button class="btn btn-sm btn-ghost" onclick="deleteMeal(${m.id})" title="Delete">
          <i class="bi bi-trash3 text-danger"></i>
        </button>
      </div>
    </div>`).join("") + `
    <div class="meal-log-item" style="background:var(--surface-2)">
      <div><strong>Daily Total</strong></div>
      <div class="d-flex gap-3 align-items-center">
        <span class="text-muted small">P:${totals.protein}g C:${totals.carbs}g F:${totals.fat}g</span>
        <strong class="text-success">${totals.calories} kcal</strong>
      </div>
    </div>`;
}

async function logMeal() {
  const meal = document.getElementById("track-meal").value.trim();
  const cal  = parseInt(document.getElementById("track-calories").value) || 0;
  if (!meal || !cal) { showToast("Meal name and calories are required", "danger"); return; }

  const time = document.getElementById("track-time").value;
  const timeStr = time ? formatTime12h(time) : new Date().toLocaleTimeString("en-US", {hour:"2-digit",minute:"2-digit"});

  try {
    const res = await fetch("/api/tracker/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meal,
        calories: cal,
        protein: parseFloat(document.getElementById("track-protein").value) || 0,
        carbs:   parseFloat(document.getElementById("track-carbs").value)   || 0,
        fat:     parseFloat(document.getElementById("track-fat").value)     || 0,
        fiber:   parseFloat(document.getElementById("track-fiber").value)   || 0,
        time:    timeStr,
      }),
    });
    const data = await res.json();
    if (data.success) {
      clearTrackerForm();
      loadTodayLog();
      showToast("Meal logged successfully!", "success");
    }
  } catch (e) { showToast("Failed to log meal", "danger"); }
}

function clearTrackerForm() {
  ["track-meal","track-calories","track-protein","track-carbs","track-fat","track-fiber"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

async function deleteMeal(id) {
  try {
    await fetch(`/api/tracker/delete/${id}`, { method: "DELETE" });
    loadTodayLog();
    showToast("Meal removed", "success");
  } catch { showToast("Failed to delete", "danger"); }
}

async function clearTodayLog() {
  if (!confirm("Clear all meals logged today?")) return;
  try {
    await fetch("/api/tracker/clear", { method: "DELETE" });
    loadTodayLog();
    showToast("Today's log cleared", "success");
  } catch {}
}

function updateProgressBars(totals) {
  const p = State.profile;
  const t = calcMacros(p?.calories || 2000, p?.split || "balanced");

  setBar("prog-cal",  totals.calories || 0, t.calories,  "prog-cal-text",  `${totals.calories || 0} / ${t.calories} kcal`);
  setBar("prog-pro",  totals.protein  || 0, t.protein_g, "prog-pro-text",  `${totals.protein  || 0} / ${t.protein_g} g`);
  setBar("prog-carb", totals.carbs    || 0, t.carbs_g,   "prog-carb-text", `${totals.carbs    || 0} / ${t.carbs_g} g`);
  setBar("prog-fat",  totals.fat      || 0, t.fat_g,     "prog-fat-text",  `${totals.fat      || 0} / ${t.fat_g} g`);
}

function setBar(barId, val, max, textId, text) {
  const bar  = document.getElementById(`${barId}-bar`);
  const textEl = document.getElementById(textId);
  if (bar)    bar.style.width = Math.min(100, Math.round((val / max) * 100)) + "%";
  if (textEl) textEl.textContent = text;
}

function updateQuickStats(totals) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set("qs-calories", `${totals?.calories || 0} kcal`);
  set("qs-protein",  `${totals?.protein  || 0}g`);
  set("qs-carbs",    `${totals?.carbs    || 0}g`);
  set("qs-fat",      `${totals?.fat      || 0}g`);
}

// ── AI Auto-Fill Meal ─────────────────────────
function openAnalyzeAndLog() {
  const modal = new bootstrap.Modal(document.getElementById("analyzeLogModal"));
  modal.show();
}

async function aiAnalyzeForLog() {
  const input = document.getElementById("aiAnalyzeInput").value.trim();
  if (!input) { showToast("Please describe a meal", "danger"); return; }

  toggleBtn("aiAnalyzeBtn", true);
  const resultEl = document.getElementById("aiAnalyzeResult");
  const logForm  = document.getElementById("aiAnalyzeLogForm");
  resultEl.classList.add("d-none"); logForm.classList.add("d-none");

  try {
    const res  = await fetch("/api/analyze-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal: input }),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, "danger"); return; }

    resultEl.innerHTML = `
      <div class="mb-1">${data.analysis}</div>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <span class="badge bg-success">🔥 ${data.calories} kcal</span>
        <span class="badge bg-primary">Protein: ${data.protein}g</span>
        <span class="badge bg-warning text-dark">Carbs: ${data.carbs}g</span>
        <span class="badge bg-danger">Fat: ${data.fat}g</span>
        <span class="badge bg-secondary">Fiber: ${data.fiber}g</span>
      </div>`;
    resultEl.classList.remove("d-none");

    document.getElementById("ai-meal-name").value = data.meal;
    document.getElementById("ai-calories").value  = data.calories;
    document.getElementById("ai-protein").value   = data.protein;
    document.getElementById("ai-carbs").value     = data.carbs;
    document.getElementById("ai-fat").value       = data.fat;

    logForm.classList.remove("d-none");
  } catch { showToast("Analysis failed", "danger"); }
  finally { toggleBtn("aiAnalyzeBtn", false); }
}

async function logFromAI() {
  const meal = document.getElementById("ai-meal-name").value.trim();
  const cal  = parseInt(document.getElementById("ai-calories").value) || 0;
  if (!meal || !cal) { showToast("Name and calories required", "danger"); return; }

  try {
    const res = await fetch("/api/tracker/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meal,
        calories: cal,
        protein: parseFloat(document.getElementById("ai-protein").value) || 0,
        carbs:   parseFloat(document.getElementById("ai-carbs").value)   || 0,
        fat:     parseFloat(document.getElementById("ai-fat").value)     || 0,
      }),
    });
    const data = await res.json();
    if (data.success) {
      bootstrap.Modal.getInstance(document.getElementById("analyzeLogModal")).hide();
      loadTodayLog();
      showTab("tracker");
      showToast("Meal logged from AI analysis!", "success");
    }
  } catch { showToast("Failed to log", "danger"); }
}

// ════════════════════════════════════════════════
// DASHBOARD
// ════════════════════════════════════════════════
async function refreshDashboard() {
  await loadTodayLog();
}

function updateDashboardStats(totals) {
  const p = State.profile;
  const t = calcMacros(p?.calories || 2000, p?.split || "balanced");
  State.targets = t;

  const goalCal  = t.calories;
  const goalPro  = t.protein_g;
  const goalCarb = t.carbs_g;
  const goalFat  = t.fat_g;

  setText("dash-calories", totals?.calories || 0);
  setText("dash-protein",  `${totals?.protein || 0}g`);
  setText("dash-carbs",    `${totals?.carbs   || 0}g`);
  setText("dash-fat",      `${totals?.fat     || 0}g`);

  setText("dash-calorie-goal", `Goal: ${Math.round(goalCal)} kcal`);
  setText("dash-protein-goal", `Goal: ${Math.round(goalPro)}g`);
  setText("dash-carbs-goal",   `Goal: ${Math.round(goalCarb)}g`);
  setText("dash-fat-goal",     `Goal: ${Math.round(goalFat)}g`);

  setProgressBar("dash-calorie-bar", totals?.calories, goalCal);
  setProgressBar("dash-protein-bar", totals?.protein,  goalPro);
  setProgressBar("dash-carbs-bar",   totals?.carbs,    goalCarb);
  setProgressBar("dash-fat-bar",     totals?.fat,      goalFat);

  // Update fiber
  setText("fiber-val", `${totals?.fiber || 0}g`);
  setText("fiber-goal", `Goal: ${t.fiber_g}g`);
  setProgressBar("fiber-bar", totals?.fiber || 0, t.fiber_g);

  // Update donut chart
  updateDonutChart(totals?.calories || 0, totals?.protein || 0, totals?.carbs || 0, totals?.fat || 0);

  // Update dashboard meal list
  renderDashMeals(State.todayLog);
}

function updateDonutChart(total, protein, carbs, fat) {
  const circumference = 2 * Math.PI * 70; // r=70
  const totalMacroKcal = (protein * 4) + (carbs * 4) + (fat * 9);
  const ref = totalMacroKcal || 1;

  const proteinDash  = (protein * 4 / ref) * circumference;
  const carbsDash    = (carbs   * 4 / ref) * circumference;
  const fatDash      = (fat     * 9 / ref) * circumference;

  // Calculate offsets (stacked)
  const proteinOffset = 0;
  const carbsOffset   = circumference - proteinDash;
  const fatOffset     = circumference - proteinDash - carbsDash;

  const dp = document.getElementById("donut-protein");
  const dc = document.getElementById("donut-carbs");
  const df = document.getElementById("donut-fat");

  if (dp) { dp.setAttribute("stroke-dasharray", `${proteinDash} ${circumference - proteinDash}`); dp.setAttribute("stroke-dashoffset", proteinOffset * -1); }
  if (dc) { dc.setAttribute("stroke-dasharray", `${carbsDash} ${circumference - carbsDash}`);     dc.setAttribute("stroke-dashoffset", -(proteinDash)); }
  if (df) { df.setAttribute("stroke-dasharray", `${fatDash} ${circumference - fatDash}`);         df.setAttribute("stroke-dashoffset", -(proteinDash + carbsDash)); }

  const kcalEl = document.getElementById("donut-kcal");
  if (kcalEl) kcalEl.textContent = total || 0;
}

function renderDashMeals(meals) {
  const el = document.getElementById("dash-meal-list");
  if (!el) return;
  if (!meals || meals.length === 0) {
    el.innerHTML = `<p class="text-muted text-center py-4">No meals logged today.<br>Go to <a href="#" onclick="showTab('tracker')">Meal Tracker</a> to add meals.</p>`;
    return;
  }
  el.innerHTML = meals.map(m => `
    <div class="meal-list-compact-item">
      <span>${escHtml(m.meal)}</span>
      <span class="fw-600 text-success">${m.calories} kcal</span>
    </div>`).join("");
}

// ════════════════════════════════════════════════
// MEAL ANALYSIS (DASHBOARD)
// ════════════════════════════════════════════════
async function analyzeMeal() {
  const input  = document.getElementById("analyzeMealInput").value.trim();
  if (!input) { showToast("Please describe a meal to analyze", "danger"); return; }
  toggleBtn("analyzeBtn", true);
  const resultEl = document.getElementById("analyzeResult");
  resultEl.classList.add("d-none");

  try {
    const res  = await fetch("/api/analyze-meal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meal: input }),
    });
    const data = await res.json();
    resultEl.textContent = data.analysis || data.error;
    resultEl.classList.remove("d-none");
  } catch { resultEl.textContent = "Analysis failed. Check your connection."; resultEl.classList.remove("d-none"); }
  finally { toggleBtn("analyzeBtn", false); }
}

// ════════════════════════════════════════════════
// MEAL PLANNER
// ════════════════════════════════════════════════
async function generateMealPlan() {
  const payload = {
    calories:    parseInt(document.getElementById("plan-calories").value) || 2000,
    diet_type:   document.getElementById("plan-diet").value,
    days:        parseInt(document.getElementById("plan-days").value) || 1,
    preferences: document.getElementById("plan-cuisine").value,
    goal:        document.getElementById("plan-goal").value,
    allergies:   document.getElementById("plan-allergies").value || "none",
  };
  toggleBtn("planBtn", true);
  const contentEl = document.getElementById("mealPlanContent");
  contentEl.innerHTML = `<div class="d-flex align-items-center gap-3 p-4"><div class="spinner-border text-success"></div><span>Generating your personalized meal plan with IBM Granite AI...</span></div>`;

  try {
    const res  = await fetch("/api/meal-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.plan) {
      contentEl.innerHTML = `<div class="p-4 plan-text">${formatPlanText(data.plan)}</div>`;
      const copyBtn = document.getElementById("copyPlanBtn");
      if (copyBtn) { copyBtn.style.display = ""; copyBtn._planText = data.plan; }
    } else {
      contentEl.innerHTML = `<div class="p-4 text-danger">Error: ${data.error}</div>`;
    }
  } catch { contentEl.innerHTML = `<div class="p-4 text-danger">Failed to generate plan. Check connection.</div>`; }
  finally { toggleBtn("planBtn", false); }
}

function copyPlan() {
  const btn = document.getElementById("copyPlanBtn");
  if (btn?._planText) {
    navigator.clipboard.writeText(btn._planText).then(() => showToast("Plan copied to clipboard!", "success"));
  }
}

function formatPlanText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/🌅|☀️|🍽️|🍎|🌙|💧/g, match => `<span style="font-size:1.1em">${match}</span>`)
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

// ════════════════════════════════════════════════
// BMI CALCULATOR
// ════════════════════════════════════════════════
async function calculateBMI() {
  const payload = {
    weight:      parseFloat(document.getElementById("bmi-weight").value),
    height:      parseFloat(document.getElementById("bmi-height").value),
    age:         parseInt(document.getElementById("bmi-age").value),
    gender:      document.getElementById("bmi-gender").value,
    activity:    document.getElementById("bmi-activity").value,
    goal:        document.getElementById("bmi-goal").value,
    macro_split: document.getElementById("bmi-split").value,
  };
  if (!payload.weight || !payload.height || !payload.age) { showToast("Please fill all required fields", "danger"); return; }

  try {
    const res  = await fetch("/api/bmi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, "danger"); return; }
    renderBMIResults(data);
  } catch (e) { showToast("Calculation failed", "danger"); }
}

function renderBMIResults(data) {
  document.getElementById("bmiPlaceholder").style.display = "none";
  document.getElementById("bmiResults").style.display = "";

  // BMI
  const circle = document.getElementById("bmiCircle");
  const bmiVal = document.getElementById("bmiValue");
  bmiVal.textContent = data.bmi;
  circle.className = `bmi-circle ${data.color}`;

  const catEl = document.getElementById("bmiCategory");
  catEl.textContent = data.category;
  catEl.className = `badge bg-${data.color === "success" ? "success" : data.color === "warning" ? "warning" : "danger"}`;

  setText("bmrValue",        data.bmr);
  setText("tdeeValue",       data.tdee);
  setText("targetCalories",  data.target_calories);

  // Macro targets
  const m = data.macros;
  document.getElementById("macroTargets").innerHTML = `
    <div class="col-6 col-sm-3">
      <div class="macro-target-item">
        <div class="macro-target-val text-primary">${m.protein_g}g</div>
        <div class="macro-target-label">Protein</div>
        <div class="macro-target-pct">${m.protein_pct}%</div>
      </div>
    </div>
    <div class="col-6 col-sm-3">
      <div class="macro-target-item">
        <div class="macro-target-val text-warning">${m.carbs_g}g</div>
        <div class="macro-target-label">Carbs</div>
        <div class="macro-target-pct">${m.carbs_pct}%</div>
      </div>
    </div>
    <div class="col-6 col-sm-3">
      <div class="macro-target-item">
        <div class="macro-target-val text-danger">${m.fat_g}g</div>
        <div class="macro-target-label">Fat</div>
        <div class="macro-target-pct">${m.fat_pct}%</div>
      </div>
    </div>
    <div class="col-6 col-sm-3">
      <div class="macro-target-item">
        <div class="macro-target-val text-success">${data.target_calories}</div>
        <div class="macro-target-label">Calories</div>
        <div class="macro-target-pct">kcal/day</div>
      </div>
    </div>`;

  // BMI scale pointer
  const pointer = document.getElementById("bmiPointer");
  if (pointer) {
    // Map BMI 15-35 to 0-100%
    const pct = Math.min(100, Math.max(0, ((data.bmi - 15) / 20) * 100));
    pointer.style.left = pct + "%";
  }

  // Save to profile targets
  State.targets = data.macros;
  State.targets.calories = data.target_calories;
  showToast("Calculations complete!", "success");
}

// ════════════════════════════════════════════════
// WATER TRACKER
// ════════════════════════════════════════════════
function renderWaterGlasses() {
  const container = document.getElementById("waterGlasses");
  if (!container) return;
  container.innerHTML = Array.from({ length: 8 }, (_, i) =>
    `<div class="water-glass ${i < State.waterCount ? "filled" : ""}" onclick="toggleWater(${i})"></div>`
  ).join("");
  const countEl = document.getElementById("waterCount");
  if (countEl) countEl.textContent = `${State.waterCount} / 8 glasses`;
}

function addWater() {
  if (State.waterCount < 8) { State.waterCount++; saveWater(); renderWaterGlasses(); }
}

function removeWater() {
  if (State.waterCount > 0) { State.waterCount--; saveWater(); renderWaterGlasses(); }
}

function toggleWater(idx) {
  State.waterCount = idx < State.waterCount ? idx : idx + 1;
  saveWater(); renderWaterGlasses();
}

function saveWater() { localStorage.setItem("nutribot_water", State.waterCount); }

// ════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════
function calcBMR(weight, height, age, gender) {
  return gender?.toLowerCase() === "female"
    ? 10*weight + 6.25*height - 5*age - 161
    : 10*weight + 6.25*height - 5*age + 5;
}

function calcTDEE(bmr, activity) {
  const m = { sedentary:1.2, light:1.375, moderate:1.55, active:1.725, very_active:1.9 };
  return bmr * (m[activity] || 1.55);
}

function calcMacros(calories, split = "balanced") {
  const p = State.profile || {};

  // If profile isn't complete, fall back to percentage-based calculation
  if (!p.weight || !p.goal) {
    const key = (split || "balanced").toLowerCase().replace(/[-\s]/g, "_");

    const s = {
      balanced:     { carbs: 0.50, protein: 0.25, fat: 0.25 },
      high_protein: { carbs: 0.35, protein: 0.35, fat: 0.30 },
      low_carb:     { carbs: 0.25, protein: 0.35, fat: 0.40 },
      keto:         { carbs: 0.05, protein: 0.30, fat: 0.65 },
    }[key] || { carbs: 0.50, protein: 0.25, fat: 0.25 };

    return {
      calories,
      carbs_g:     Math.round((calories * s.carbs) / 4),
      protein_g:   Math.round((calories * s.protein) / 4),
      fat_g:       Math.round((calories * s.fat) / 9),
      fiber_g:     Math.round((calories / 1000) * 14 * 10) / 10,
      carbs_pct:   Math.round(s.carbs * 100),
      protein_pct: Math.round(s.protein * 100),
      fat_pct:     Math.round(s.fat * 100),
    };
  }

  // Evidence-based calculation using body weight
  const weight = p.weight;

  let proteinPerKg = 1.2;
  switch ((p.goal || "").toLowerCase()) {
    case "lose weight":                        proteinPerKg = 1.8; break;
    case "gain muscle": case "build muscle":   proteinPerKg = 2.0; break;
    case "gain weight":                        proteinPerKg = 1.5; break;
    default:                                   proteinPerKg = 1.2;
  }
  const protein_g = Math.round(weight * proteinPerKg);

  let fat_pct = 25;
  switch ((split || "").toLowerCase().replace(/[-\s]/g, "_")) {
    case "low_carb":    fat_pct = 40; break;
    case "keto":        fat_pct = 65; break;
    case "high_protein":fat_pct = 25; break;
    default:            fat_pct = 25;
  }
  const fat_g = Math.round((calories * (fat_pct / 100)) / 9);

  const proteinCalories = protein_g * 4;
  const fatCalories     = fat_g * 9;
  let carbCalories = calories - proteinCalories - fatCalories;
  if (carbCalories < 0) carbCalories = 0;
  const carbs_g = Math.round(carbCalories / 4);

  // Fiber: 14g per 1000 kcal
  const fiber_g = Math.round((calories / 1000) * 14 * 10) / 10;

  const protein_pct = Math.round((proteinCalories / calories) * 100);
  const carbs_pct   = Math.round((carbCalories    / calories) * 100);

  return { calories, protein_g, carbs_g, fat_g, fiber_g, protein_pct, carbs_pct, fat_pct };
}

function setProgressBar(id, val, max) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(100, Math.round(((val || 0) / (max || 1)) * 100)) + "%";
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function toggleBtn(prefix, loading) {
  const text    = document.getElementById(`${prefix}-text`);
  const spinner = document.getElementById(`${prefix}-spinner`);
  if (text)    text.classList.toggle("d-none", loading);
  if (spinner) spinner.classList.toggle("d-none", !loading);
}

function showToast(msg, type = "success") {
  const toast = document.getElementById("appToast");
  const body  = document.getElementById("toastMsg");
  if (!toast || !body) return;
  body.textContent = msg;
  toast.className = `toast align-items-center border-0 bg-${type === "success" ? "success" : "danger"} text-white`;
  new bootstrap.Toast(toast, { delay: 3000 }).show();
}

function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""; }
function escHtml(str) { return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
function formatTime12h(t) { const [h,m]=t.split(":"); const hh=parseInt(h); return `${hh%12||12}:${m} ${hh<12?"AM":"PM"}`; }
