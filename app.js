const STORAGE_KEY = "lfcPredictionLeagueV4Pin";

const DEFAULT_PLAYERS = [
  { id: cryptoId(), name: "Mohamed Salah", points: 1 },
  { id: cryptoId(), name: "Darwin Núñez", points: 1 },
  { id: cryptoId(), name: "Luis Díaz", points: 1 },
  { id: cryptoId(), name: "Cody Gakpo", points: 1 },
  { id: cryptoId(), name: "Diogo Jota", points: 1 },
  { id: cryptoId(), name: "Dominik Szoboszlai", points: 2 },
  { id: cryptoId(), name: "Harvey Elliott", points: 2 },
  { id: cryptoId(), name: "Alexis Mac Allister", points: 3 },
  { id: cryptoId(), name: "Ryan Gravenberch", points: 3 },
  { id: cryptoId(), name: "Wataru Endo", points: 4 },
  { id: cryptoId(), name: "Virgil van Dijk", points: 5 },
  { id: cryptoId(), name: "Ibrahima Konaté", points: 5 },
  { id: cryptoId(), name: "Andy Robertson", points: 5 },
  { id: cryptoId(), name: "Conor Bradley", points: 5 },
  { id: cryptoId(), name: "Alisson", points: 8 }
];

const DEFAULT_TEAMS = [
  ["Arsenal","ARS"], ["Chelsea","CHE"], ["Manchester City","MCI"], ["Manchester United","MUN"],
  ["Everton","EVE"], ["Tottenham","TOT"], ["Newcastle","NEW"], ["Aston Villa","AVL"],
  ["Brighton","BHA"], ["West Ham","WHU"], ["Crystal Palace","CRY"], ["Fulham","FUL"],
  ["Bournemouth","BOU"], ["Brentford","BRE"], ["Wolves","WOL"], ["Nottingham Forest","NFO"],
  ["Real Madrid","RMA"], ["Barcelona","BAR"], ["Bayern Munich","BAY"], ["PSG","PSG"],
  ["Inter","INT"], ["AC Milan","MIL"], ["Atletico Madrid","ATM"], ["Napoli","NAP"]
].map(([name, code]) => ({ id: cryptoId(), name, code }));

let state = loadState();

function cryptoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now() + Math.random());
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

function loadState() {
  const fallback = { matches: [], players: DEFAULT_PLAYERS, teams: DEFAULT_TEAMS };
  try {
    const loaded = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!loaded) return fallback;
    if (!loaded.players && loaded.playerPoints) {
      loaded.players = Object.entries(loaded.playerPoints).map(([name, points]) => ({ id: cryptoId(), name, points }));
    }
    if (!loaded.teams) loaded.teams = DEFAULT_TEAMS;
    if (!loaded.matches) loaded.matches = [];
    loaded.matches.forEach(match => {
      match.pinHashes = match.pinHashes || { you: "", wife: "" };
      match.locked = match.locked || { you: false, wife: false };
    });
    return { matches: loaded.matches, players: loaded.players, teams: loaded.teams };
  } catch {
    return fallback;
  }
}

function saveState(renderAfter = true) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (renderAfter) render();
}

function normaliseName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function parseScorers(value) {
  return (value || "").split(",").map(normaliseName).filter(Boolean);
}

function getPlayerPoints(playerName) {
  const clean = normaliseName(playerName).toLowerCase();
  const player = state.players.find(p => p.name.toLowerCase() === clean);
  return player ? Number(player.points) : 2;
}

function scorePrediction(prediction, actual) {
  let points = 0;
  const breakdown = [];

  if (
    prediction.scoreL !== "" &&
    prediction.scoreO !== "" &&
    String(prediction.scoreL) === String(actual.scoreL) &&
    String(prediction.scoreO) === String(actual.scoreO)
  ) {
    points += 5;
    breakdown.push("Exact score +5");
  }

  const predictedScorers = parseScorers(prediction.scorers);
  const actualScorers = parseScorers(actual.scorers);
  const usedActualIndexes = [];

  predictedScorers.forEach(player => {
    const index = actualScorers.findIndex((actualPlayer, i) =>
      !usedActualIndexes.includes(i) && actualPlayer.toLowerCase() === player.toLowerCase()
    );

    if (index !== -1) {
      usedActualIndexes.push(index);
      const scorerPoints = getPlayerPoints(player);
      points += scorerPoints;
      breakdown.push(`${player} +${scorerPoints}`);
    }
  });

  return { points, breakdown };
}

async function lockPrediction(matchId, owner, pin) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;
  if (!pin || pin.length < 3) {
    alert("Choose a PIN with at least 3 digits/characters.");
    return;
  }
  match.pinHashes = match.pinHashes || { you: "", wife: "" };
  match.locked = match.locked || { you: false, wife: false };
  match.pinHashes[owner] = await sha256(`${match.id}:${owner}:${pin}`);
  match.locked[owner] = true;
  saveState();
}

async function unlockPrediction(matchId, owner, pin) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match || !match.pinHashes || !match.pinHashes[owner]) return false;
  const hash = await sha256(`${match.id}:${owner}:${pin}`);
  if (hash !== match.pinHashes[owner]) {
    alert("Wrong PIN.");
    return false;
  }
  match.locked[owner] = false;
  saveState();
  return true;
}

async function revealBoth(matchId) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  const youPin = prompt("Enter your PIN:");
  if (youPin === null) return;
  const wifePin = prompt("Enter wife PIN:");
  if (wifePin === null) return;

  const youHash = await sha256(`${match.id}:you:${youPin}`);
  const wifeHash = await sha256(`${match.id}:wife:${wifePin}`);

  if (youHash !== match.pinHashes?.you || wifeHash !== match.pinHashes?.wife) {
    alert("One or both PINs were wrong.");
    return;
  }

  match.locked.you = false;
  match.locked.wife = false;
  match.revealed = true;
  saveState();
}

function calculateMatch(matchId) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;

  if (match.locked?.you || match.locked?.wife) {
    alert("Reveal/unlock both predictions before calculating.");
    return;
  }

  const you = scorePrediction(match.you, match.actual);
  const wife = scorePrediction(match.wife, match.actual);

  match.youPoints = you.points;
  match.wifePoints = wife.points;
  match.youBreakdown = you.breakdown;
  match.wifeBreakdown = wife.breakdown;
  match.calculated = true;
  match.completedAt = new Date().toISOString();

  saveState();
}

function createMatch(opponent, date) {
  const team = state.teams.find(t => t.name === opponent);
  state.matches.push({
    id: Date.now(),
    opponent,
    opponentCode: team ? team.code : opponent.slice(0, 3).toUpperCase(),
    date,
    you: { scoreL: "", scoreO: "", scorers: "" },
    wife: { scoreL: "", scoreO: "", scorers: "" },
    actual: { scoreL: "", scoreO: "", scorers: "" },
    pinHashes: { you: "", wife: "" },
    locked: { you: false, wife: false },
    youPoints: 0,
    wifePoints: 0,
    youBreakdown: [],
    wifeBreakdown: [],
    calculated: false,
    revealed: false,
    createdAt: new Date().toISOString()
  });
  saveState();
}

function setNested(match, path, value) {
  const [section, key] = path.split(".");
  match[section][key] = value;
  saveState(false);
}

function deleteMatch(matchId) {
  const match = state.matches.find(m => m.id === matchId);
  if (!match) return;
  if (!confirm(`Delete Liverpool vs ${match.opponent}?`)) return;
  state.matches = state.matches.filter(m => m.id !== matchId);
  saveState();
}

function addPlayer(name, points) {
  const clean = normaliseName(name);
  if (!clean) return;
  if (state.players.some(p => p.name.toLowerCase() === clean.toLowerCase())) {
    alert("That player is already in the squad list.");
    return;
  }
  state.players.push({ id: cryptoId(), name: clean, points: Number(points) });
  saveState();
}

function updatePlayer(playerId, field, value) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  player[field] = field === "points" ? Number(value) : normaliseName(value);
  saveState();
}

function removePlayer(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  if (!confirm(`Remove ${player.name} from the squad list?`)) return;
  state.players = state.players.filter(p => p.id !== playerId);
  saveState();
}

function addTeam(name, code) {
  const clean = normaliseName(name);
  if (!clean) return;
  if (state.teams.some(t => t.name.toLowerCase() === clean.toLowerCase())) {
    alert("That team is already in the opponent list.");
    return;
  }
  state.teams.push({ id: cryptoId(), name: clean, code: (code || clean.slice(0,3)).toUpperCase() });
  saveState();
}

function updateTeam(teamId, field, value) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;
  team[field] = field === "code" ? value.toUpperCase().slice(0,5) : normaliseName(value);
  saveState();
}

function removeTeam(teamId) {
  const team = state.teams.find(t => t.id === teamId);
  if (!team) return;
  if (!confirm(`Remove ${team.name} from opponents?`)) return;
  state.teams = state.teams.filter(t => t.id !== teamId);
  saveState();
}

function totals() {
  return state.matches.reduce((acc, m) => {
    acc.you += m.youPoints || 0;
    acc.wife += m.wifePoints || 0;
    if (m.calculated) {
      acc.played++;
      if (m.youPoints > m.wifePoints) acc.youWins++;
      if (m.wifePoints > m.youPoints) acc.wifeWins++;
      if (m.youPoints === m.wifePoints) acc.draws++;
    }
    return acc;
  }, { you: 0, wife: 0, played: 0, youWins: 0, wifeWins: 0, draws: 0 });
}

function renderScoreboard() {
  const t = totals();
  const leader = t.you === t.wife ? "Draw" : t.you > t.wife ? "You" : "Wife";
  document.getElementById("scoreboard").innerHTML = `
    <div class="score-card"><span>You</span><strong>${t.you}</strong></div>
    <div class="score-card"><span>Wife</span><strong>${t.wife}</strong></div>
    <div class="score-card"><span>Leader</span><strong>${leader}</strong></div>
    <div class="score-card"><span>Matches</span><strong>${t.played}</strong></div>
  `;
}

function renderOpponentSelect() {
  const select = document.getElementById("opponentSelect");
  const selected = select.value;
  select.innerHTML = `<option value="">Choose opponent</option>`;
  [...state.teams].sort((a,b) => a.name.localeCompare(b.name)).forEach(team => {
    const option = document.createElement("option");
    option.value = team.name;
    option.textContent = team.name;
    select.appendChild(option);
  });
  select.value = selected;
}

function renderMatches() {
  const active = document.getElementById("activeMatches");
  const template = document.getElementById("matchTemplate");
  const openMatches = state.matches.filter(m => !m.calculated).sort((a, b) => b.id - a.id);

  active.innerHTML = "";
  if (!openMatches.length) {
    active.innerHTML = `<div class="empty">No open matches yet. Create the next Liverpool fixture above.</div>`;
    return;
  }

  openMatches.forEach(match => {
    const node = template.content.cloneNode(true);
    node.querySelector(".opponent-name").textContent = match.opponent;
    node.querySelector(".opponent-badge").textContent = match.opponentCode || match.opponent.slice(0,3).toUpperCase();
    node.querySelector(".match-meta").textContent = match.date ? new Date(match.date + "T12:00:00").toLocaleDateString() : "No date set";

    node.querySelectorAll("[data-path]").forEach(input => {
      const path = input.dataset.path;
      const [section, key] = path.split(".");
      input.value = match[section][key] || "";
      input.addEventListener("input", e => setNested(match, path, e.target.value));
    });

    ["you", "wife"].forEach(owner => {
      const card = node.querySelector(`[data-owner-card="${owner}"]`);
      const status = node.querySelector(`[data-status="${owner}"]`);
      const isLocked = !!match.locked?.[owner];

      if (isLocked) {
        card.classList.add("is-locked");
        status.classList.add("locked");
        status.textContent = "Locked";
      } else if (match.pinHashes?.[owner]) {
        status.classList.add("unlocked");
        status.textContent = "Unlocked / revealed";
      } else {
        status.textContent = "Not locked yet";
      }
    });

    node.querySelectorAll(".lock-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const owner = btn.dataset.owner;
        const pinInput = node.querySelector(`[data-pin="${owner}"]`);
        await lockPrediction(match.id, owner, pinInput.value);
      });
    });

    node.querySelectorAll(".unlock-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const owner = btn.dataset.owner;
        const pinInput = node.querySelector(`[data-unlock-pin="${owner}"]`);
        await unlockPrediction(match.id, owner, pinInput.value);
      });
    });

    node.querySelector(".reveal-btn").addEventListener("click", () => revealBoth(match.id));
    node.querySelector(".calculate-btn").addEventListener("click", () => calculateMatch(match.id));
    node.querySelector(".delete-btn").addEventListener("click", () => deleteMatch(match.id));

    active.appendChild(node);
  });
}

function renderPlayers() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  [...state.players].sort((a,b) => a.name.localeCompare(b.name)).forEach(player => {
    const item = document.createElement("div");
    item.className = "manager-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(player.name)}</strong>
        <div class="muted">Correct scorer gives ${player.points} point${Number(player.points) === 1 ? "" : "s"}</div>
      </div>
      <div class="manager-item-actions">
        <select>
          <option value="1">1 pt</option><option value="2">2 pts</option><option value="3">3 pts</option>
          <option value="4">4 pts</option><option value="5">5 pts</option><option value="8">8 pts</option>
        </select>
        <button class="ghost rename">Rename</button>
        <button class="ghost danger remove">Remove</button>
      </div>
    `;
    const select = item.querySelector("select");
    select.value = String(player.points);
    select.addEventListener("change", e => updatePlayer(player.id, "points", e.target.value));
    item.querySelector(".rename").addEventListener("click", () => {
      const next = prompt("Player name:", player.name);
      if (next) updatePlayer(player.id, "name", next);
    });
    item.querySelector(".remove").addEventListener("click", () => removePlayer(player.id));
    list.appendChild(item);
  });
}

function renderTeams() {
  const list = document.getElementById("teamList");
  list.innerHTML = "";
  [...state.teams].sort((a,b) => a.name.localeCompare(b.name)).forEach(team => {
    const item = document.createElement("div");
    item.className = "manager-item";
    item.innerHTML = `
      <div class="team">
        <div class="badge">${escapeHtml(team.code)}</div>
        <div>
          <strong>${escapeHtml(team.name)}</strong>
          <div class="muted">Badge text: ${escapeHtml(team.code)}</div>
        </div>
      </div>
      <div class="manager-item-actions">
        <button class="ghost rename">Edit</button>
        <button class="ghost danger remove">Remove</button>
      </div>
    `;
    item.querySelector(".rename").addEventListener("click", () => {
      const nextName = prompt("Team name:", team.name);
      if (!nextName) return;
      const nextCode = prompt("Badge text:", team.code) || team.code;
      updateTeam(team.id, "name", nextName);
      updateTeam(team.id, "code", nextCode);
    });
    item.querySelector(".remove").addEventListener("click", () => removeTeam(team.id));
    list.appendChild(item);
  });
}

function renderHistory() {
  const history = document.getElementById("history");
  const completed = state.matches.filter(m => m.calculated).sort((a, b) => b.id - a.id);

  history.innerHTML = "";
  if (!completed.length) {
    history.innerHTML = `<div class="empty">Calculated matches will appear here.</div>`;
    return;
  }

  completed.forEach(match => {
    const winner = match.youPoints === match.wifePoints ? "Draw" : match.youPoints > match.wifePoints ? "You won" : "Wife won";
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div>
        <strong>Liverpool ${match.actual.scoreL}-${match.actual.scoreO} ${escapeHtml(match.opponent)}</strong>
        <div class="muted">${match.date || "No date"} • ${winner}</div>
        <div class="muted">You: ${escapeHtml((match.youBreakdown || []).join(", ") || "0")} | Wife: ${escapeHtml((match.wifeBreakdown || []).join(", ") || "0")}</div>
      </div>
      <div>
        <span class="pill">You ${match.youPoints}</span>
        <span class="pill">Wife ${match.wifePoints}</span>
      </div>
    `;
    history.appendChild(item);
  });
}

function render() {
  renderScoreboard();
  renderOpponentSelect();
  renderMatches();
  renderPlayers();
  renderTeams();
  renderHistory();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `lfc-prediction-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (!imported.matches || !Array.isArray(imported.matches)) throw new Error("Invalid backup");
      state = {
        matches: imported.matches,
        players: imported.players || DEFAULT_PLAYERS,
        teams: imported.teams || DEFAULT_TEAMS
      };
      state.matches.forEach(match => {
        match.pinHashes = match.pinHashes || { you: "", wife: "" };
        match.locked = match.locked || { you: false, wife: false };
      });
      saveState();
      alert("Backup imported.");
    } catch {
      alert("That backup file could not be imported.");
    }
  };
  reader.readAsText(file);
}

function resetSeason() {
  if (!confirm("Reset the whole season? Export a backup first if you want to keep it.")) return;
  state.matches = [];
  saveState();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab + "Panel").classList.add("active");
  });
});

document.getElementById("matchForm").addEventListener("submit", event => {
  event.preventDefault();
  const opponent = document.getElementById("opponentSelect").value;
  const date = document.getElementById("dateInput").value;
  if (!opponent) return;
  createMatch(opponent, date);
  event.target.reset();
});

document.getElementById("playerForm").addEventListener("submit", event => {
  event.preventDefault();
  addPlayer(document.getElementById("playerName").value, document.getElementById("playerTier").value);
  event.target.reset();
});

document.getElementById("teamForm").addEventListener("submit", event => {
  event.preventDefault();
  addTeam(document.getElementById("teamName").value, document.getElementById("teamCode").value);
  event.target.reset();
});

document.getElementById("exportBtn").addEventListener("click", exportBackup);
document.getElementById("importFile").addEventListener("change", e => {
  if (e.target.files[0]) importBackup(e.target.files[0]);
});
document.getElementById("resetBtn").addEventListener("click", resetSeason);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

render();
