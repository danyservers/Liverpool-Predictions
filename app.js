import { firebaseConfig, USER_PROFILES_BY_UID, DEFAULT_SEASON_ID } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  getFirestore,
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

const DEFAULT_PLAYERS = [
  { id: cryptoId(), name: "Mohamed Salah", points: 1 },
  { id: cryptoId(), name: "Alexander Isak", points: 1 },
  { id: cryptoId(), name: "Cody Gakpo", points: 1 },
  { id: cryptoId(), name: "Hugo Ekitike", points: 1 },
  { id: cryptoId(), name: "Federico Chiesa", points: 2 },
  { id: cryptoId(), name: "Florian Wirtz", points: 2 },
  { id: cryptoId(), name: "Dominik Szoboszlai", points: 2 },
  { id: cryptoId(), name: "Harvey Elliott", points: 2 },
  { id: cryptoId(), name: "Curtis Jones", points: 3 },
  { id: cryptoId(), name: "Alexis Mac Allister", points: 3 },
  { id: cryptoId(), name: "Ryan Gravenberch", points: 3 },
  { id: cryptoId(), name: "Wataru Endo", points: 4 },
  { id: cryptoId(), name: "Trey Nyoni", points: 4 },
  { id: cryptoId(), name: "Virgil van Dijk", points: 5 },
  { id: cryptoId(), name: "Ibrahima Konaté", points: 5 },
  { id: cryptoId(), name: "Milos Kerkez", points: 5 },
  { id: cryptoId(), name: "Conor Bradley", points: 5 },
  { id: cryptoId(), name: "Andy Robertson", points: 5 },
  { id: cryptoId(), name: "Jeremie Frimpong", points: 5 },
  { id: cryptoId(), name: "Joe Gomez", points: 5 },
  { id: cryptoId(), name: "Giovanni Leoni", points: 5 },
  { id: cryptoId(), name: "Alisson Becker", points: 8 },
  { id: cryptoId(), name: "Giorgi Mamardashvili", points: 8 }
];

const DEFAULT_OTHER_PLAYERS = [
  { id: cryptoId(), name: "Erling Haaland", points: 1 },
  { id: cryptoId(), name: "Alexander Sørloth", points: 1 },
  { id: cryptoId(), name: "Martin Ødegaard", points: 2 },
  { id: cryptoId(), name: "Antonio Nusa", points: 2 },
  { id: cryptoId(), name: "Oscar Bobb", points: 2 },
  { id: cryptoId(), name: "Sander Berge", points: 4 },
  { id: cryptoId(), name: "Leo Østigård", points: 5 },
  { id: cryptoId(), name: "David Raya", points: 8 },
  { id: cryptoId(), name: "Álvaro Morata", points: 1 },
  { id: cryptoId(), name: "Lamine Yamal", points: 1 },
  { id: cryptoId(), name: "Nico Williams", points: 2 },
  { id: cryptoId(), name: "Dani Olmo", points: 2 },
  { id: cryptoId(), name: "Pedri", points: 3 },
  { id: cryptoId(), name: "Fabián Ruiz", points: 3 },
  { id: cryptoId(), name: "Rodri", points: 4 },
  { id: cryptoId(), name: "Dani Carvajal", points: 5 },
  { id: cryptoId(), name: "Aymeric Laporte", points: 5 },
  { id: cryptoId(), name: "Unai Simón", points: 8 }
];

const DEFAULT_OPPONENTS = [
  ["Arsenal","ARS"], ["Chelsea","CHE"], ["Manchester City","MCI"], ["Manchester United","MUN"],
  ["Everton","EVE"], ["Tottenham","TOT"], ["Newcastle","NEW"], ["Aston Villa","AVL"],
  ["Brighton","BHA"], ["West Ham","WHU"], ["Crystal Palace","CRY"], ["Fulham","FUL"],
  ["Bournemouth","BOU"], ["Brentford","BRE"], ["Wolves","WOL"], ["Nottingham Forest","NFO"],
  ["Real Madrid","RMA"], ["Barcelona","BAR"], ["Bayern Munich","BAY"], ["PSG","PSG"],
  ["Inter","INT"], ["AC Milan","MIL"], ["Atletico Madrid","ATM"], ["Napoli","NAP"]
].map(([name, code]) => ({ id: cryptoId(), name, code }));

function cryptoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now() + Math.random());
}

const DEFAULT_OTHER_TEAMS = [
  { id: cryptoId(), name: "Norway", code: "NOR" },
  { id: cryptoId(), name: "Spain", code: "ESP" },
  { id: cryptoId(), name: "Denmark", code: "DEN" },
  { id: cryptoId(), name: "Sweden", code: "SWE" },
  { id: cryptoId(), name: "England", code: "ENG" },
  { id: cryptoId(), name: "France", code: "FRA" },
  { id: cryptoId(), name: "Germany", code: "GER" },
  { id: cryptoId(), name: "Italy", code: "ITA" },
  { id: cryptoId(), name: "Portugal", code: "POR" },
  { id: cryptoId(), name: "Netherlands", code: "NED" }
];

const defaultConfig = () => ({
  activeSeasonId: DEFAULT_SEASON_ID,
  seasons: [{ id: DEFAULT_SEASON_ID, name: DEFAULT_SEASON_ID }],
  players: DEFAULT_PLAYERS,
  otherPlayers: DEFAULT_OTHER_PLAYERS,
  otherTeams: DEFAULT_OTHER_TEAMS,
  opponents: DEFAULT_OPPONENTS
});

let app;
let auth;
let db;
let functions;
let currentUser = null;
let currentProfile = null;
let configState = defaultConfig();
let matches = [];
let predictionsByMatch = {};
let unsubscribeConfig = null;
let unsubscribeMatches = null;
let predictionUnsubs = [];

function hasFirebaseConfig() {
  return firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("PASTE_");
}

function configRef() {
  return doc(db, "config", "current");
}

function setCloudStatus(text, mode = "") {
  const el = document.getElementById("cloudStatus");
  el.textContent = text;
  el.classList.remove("online", "offline");
  if (mode) el.classList.add(mode);
}

function showApp(show) {
  document.getElementById("appMain").classList.toggle("ready", show);
  document.getElementById("authPanel").classList.toggle("hidden-auth", show);
}

function setAccountBadge(text) {
  const badge = document.getElementById("accountBadge");
  if (badge) badge.textContent = text;
}

function setHeaderLoggedIn(isLoggedIn) {
  document.querySelectorAll("#accountBadge, #signOutBtn, #backupActions").forEach(el => {
    if (el) el.classList.toggle("hidden-control", !isLoggedIn);
  });
}

function normaliseName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function parseScorers(value) {
  if (Array.isArray(value)) return value.map(normaliseName).filter(Boolean).slice(0, 3);
  return String(value || "").split(",").map(normaliseName).filter(Boolean).slice(0, 3);
}

function getPlayerPoints(playerName, gameType) {
  const clean = normaliseName(playerName).toLowerCase();

  if (gameType === "other") {
    const otherPlayer = (configState.otherPlayers || []).find(p => p.name.toLowerCase() === clean);
    return otherPlayer ? Number(otherPlayer.points) : 1;
  }

  const player = configState.players.find(p => p.name.toLowerCase() === clean);
  return player ? Number(player.points) : 2;
}

function scorePrediction(prediction, match) {
  if (!prediction) return { points: 0, breakdown: [] };

  let points = 0;
  const breakdown = [];

  if (
    prediction.scoreHome !== "" &&
    prediction.scoreAway !== "" &&
    String(prediction.scoreHome) === String(match.actualHome) &&
    String(prediction.scoreAway) === String(match.actualAway)
  ) {
    points += 5;
    breakdown.push("Exact score +5");
  }

  const predictedScorers = parseScorers(prediction.scorers);
  const actualScorers = parseScorers(match.actualScorers);
  const usedActualIndexes = [];

  predictedScorers.forEach(player => {
    const index = actualScorers.findIndex((actualPlayer, i) =>
      !usedActualIndexes.includes(i) && actualPlayer.toLowerCase() === player.toLowerCase()
    );

    if (index !== -1) {
      usedActualIndexes.push(index);
      const scorerPoints = getPlayerPoints(player, match.gameType);
      points += scorerPoints;
      breakdown.push(`${player} +${scorerPoints}`);
    }
  });

  return { points, breakdown };
}

function getPred(matchId, playerKey) {
  return predictionsByMatch[matchId]?.[playerKey] || null;
}

function calculateSummary(match) {
  const dany = scorePrediction(getPred(match.id, "dany"), match);
  const isa = scorePrediction(getPred(match.id, "isa"), match);

  let seasonDany = 0;
  let seasonIsa = 0;
  let overallDany = 0;
  let overallIsa = 0;

  matches.forEach(m => {
    if (!m.calculated || m.gameType !== match.gameType || m.id === match.id) return;
    overallDany += m.summary?.danyPoints || 0;
    overallIsa += m.summary?.isaPoints || 0;
    if (m.seasonId === match.seasonId) {
      seasonDany += m.summary?.danyPoints || 0;
      seasonIsa += m.summary?.isaPoints || 0;
    }
  });

  seasonDany += dany.points;
  seasonIsa += isa.points;
  overallDany += dany.points;
  overallIsa += isa.points;

  return {
    danyPoints: dany.points,
    isaPoints: isa.points,
    danyBreakdown: dany.breakdown,
    isaBreakdown: isa.breakdown,
    roundWinner: dany.points === isa.points ? "Draw" : dany.points > isa.points ? "Dany" : "Isa",
    seasonDany,
    seasonIsa,
    seasonLeader: seasonDany === seasonIsa ? "Draw" : seasonDany > seasonIsa ? "Dany" : "Isa",
    overallDany,
    overallIsa,
    overallLeader: overallDany === overallIsa ? "Draw" : overallDany > overallIsa ? "Dany" : "Isa"
  };
}

async function initialiseCloud() {
  const snap = await getDoc(configRef());
  if (!snap.exists()) {
    await setDoc(configRef(), { ...defaultConfig(), updatedAt: serverTimestamp() });
  }

  unsubscribeConfig = onSnapshot(configRef(), snap => {
    if (snap.exists()) {
      persistVisibleDraftsBeforeRender();
      configState = { ...defaultConfig(), ...snap.data() };
      render();
    }
  });

  unsubscribeMatches = onSnapshot(collection(db, "matches"), snapshot => {
    persistVisibleDraftsBeforeRender();
    matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    listenToPredictions();
    render();
  });
}

function listenToPredictions() {
  predictionUnsubs.forEach(unsub => unsub());
  predictionUnsubs = [];
  predictionsByMatch = {};

  matches.forEach(match => {
    predictionsByMatch[match.id] = {};

    const ownKey = currentProfile?.key;
    if (ownKey) {
      const ownRef = doc(db, "matches", match.id, "predictions", ownKey);
      const unsubOwn = onSnapshot(ownRef, snap => {
        persistVisibleDraftsBeforeRender();
        predictionsByMatch[match.id][ownKey] = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        render();
      });
      predictionUnsubs.push(unsubOwn);
    }

    if (match.revealed) {
      ["dany", "isa"].forEach(key => {
        if (key === ownKey) return;
        const otherRef = doc(db, "matches", match.id, "predictions", key);
        const unsubOther = onSnapshot(otherRef, snap => {
          persistVisibleDraftsBeforeRender();
          predictionsByMatch[match.id][key] = snap.exists() ? { id: snap.id, ...snap.data() } : null;
          render();
        });
        predictionUnsubs.push(unsubOther);
      });
    }
  });
}

async function saveConfig(patch) {
  await setDoc(configRef(), { ...configState, ...patch, updatedAt: serverTimestamp() }, { merge: true });
}

async function savePrediction(matchId, data) {
  if (!currentProfile) {
    throw new Error("No logged-in profile was found.");
  }

  const match = matches.find(m => m.id === matchId);
  if (!match) {
    throw new Error("Match was not found in the local match list.");
  }

  if (match.revealed) {
    throw new Error("This match has already been revealed, so predictions are locked.");
  }

  const scoreHome = String(data.scoreHome ?? "").trim();
  const scoreAway = String(data.scoreAway ?? "").trim();

  if (scoreHome === "" || scoreAway === "") {
    throw new Error("Add your predicted score before saving.");
  }

  const scorers = parseScorers(data.scorers);

  await setDoc(doc(db, "matches", matchId, "predictions", currentProfile.key), {
    ownerKey: currentProfile.key,
    ownerName: currentProfile.name,
    scoreHome,
    scoreAway,
    scorers,
    submittedAt: serverTimestamp()
  }, { merge: true });

  await updateDoc(doc(db, "matches", matchId), {
    [`submitted.${currentProfile.key}`]: true,
    updatedAt: serverTimestamp()
  });

  setCloudStatus("Prediction saved to cloud", "online");
}

function todayDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().slice(0, 10);
}

function setDefaultMatchDates() {
  const today = todayDateString();
  ["lfcDateInput", "otherDateInput"].forEach(id => {
    const input = document.getElementById(id);
    if (input && !input.value) input.value = today;
  });
}

// Display helper only. This does not change scoring, prediction storage, or actual score order.
function displayTeamsForMatch(match) {
  if (match.gameType === "lfc" && match.isAway === true) {
    return {
      home: match.away || match.opponent || "Opponent",
      away: "Liverpool"
    };
  }

  return {
    home: match.home,
    away: match.away
  };
}

async function createLfcMatch(opponentName, date, isAway = false) {
  const cleanOpponent = normaliseName(opponentName);
  const opponent = (configState.opponents || []).find(o => o.name === cleanOpponent);

  if (!cleanOpponent) {
    throw new Error("Opponent is missing.");
  }

  await addDoc(collection(db, "matches"), {
    gameType: "lfc",
    seasonId: configState.activeSeasonId,
    home: "Liverpool",
    away: cleanOpponent,
    opponent: cleanOpponent,
    opponentCode: opponent?.code || cleanOpponent.slice(0, 3).toUpperCase(),
    date: date || todayDateString(),
    isAway: Boolean(isAway),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    revealed: false,
    calculated: false,
    submitted: {},
    actualHome: "",
    actualAway: "",
    actualScorers: []
  });
}

async function createOtherMatch(home, away, date) {
  const cleanHome = normaliseName(home);
  const cleanAway = normaliseName(away);
  const homeTeam = (configState.otherTeams || []).find(t => t.name === cleanHome);
  const awayTeam = (configState.otherTeams || []).find(t => t.name === cleanAway);

  if (!cleanHome || !cleanAway) {
    throw new Error("Both teams are required.");
  }

  await addDoc(collection(db, "matches"), {
    gameType: "other",
    seasonId: configState.activeSeasonId,
    home: cleanHome,
    away: cleanAway,
    homeCode: homeTeam?.code || cleanHome.slice(0, 3).toUpperCase(),
    opponent: cleanAway,
    opponentCode: awayTeam?.code || cleanAway.slice(0, 3).toUpperCase(),
    date: date || todayDateString(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    revealed: false,
    calculated: false,
    submitted: {},
    actualHome: "",
    actualAway: "",
    actualScorers: []
  });
}

async function revealAndCalculate(matchId, actualData) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  if (actualData.actualHome === "" || actualData.actualAway === "") {
    throw new Error("Please enter end result.");
  }

  if (!match.submitted?.dany || !match.submitted?.isa) {
    const ok = confirm("One or both predictions are not marked as submitted. Reveal anyway?");
    if (!ok) return;
  }

  const matchRef = doc(db, "matches", matchId);
  const actualHome = String(actualData.actualHome).trim();
  const actualAway = String(actualData.actualAway).trim();
  const actualScorers = parseScorers(actualData.actualScorers);

  // First reveal the match so Firestore rules allow both predictions to be read.
  await updateDoc(matchRef, {
    actualHome,
    actualAway,
    actualScorers,
    revealed: true,
    revealedAt: serverTimestamp()
  });

  // Then fetch both predictions and calculate using fresh data.
  const predictionSnap = await getDocs(collection(db, "matches", matchId, "predictions"));
  const freshPredictions = {};
  predictionsByMatch[matchId] = {};
  predictionSnap.docs.forEach(d => {
    freshPredictions[d.id] = { id: d.id, ...d.data() };
    predictionsByMatch[matchId][d.id] = freshPredictions[d.id];
  });

  const updatedMatch = {
    ...match,
    actualHome,
    actualAway,
    actualScorers,
    revealed: true
  };

  const summary = calculateSummary(updatedMatch);

  await updateDoc(matchRef, {
    calculated: true,
    summary,
    updatedAt: serverTimestamp()
  });

  const localIndex = matches.findIndex(m => m.id === matchId);
  if (localIndex !== -1) {
    matches[localIndex] = {
      ...updatedMatch,
      calculated: true,
      summary
    };
  }

  setCloudStatus("Revealed and calculated", "online");
  render();
  showRoundSummary(matches[localIndex] || { ...updatedMatch, calculated: true, summary }, freshPredictions);
  setTimeout(() => postToDiscord(matchId, true), 1000);
}

async function postToDiscord(matchId, silent = false) {
  try {
    const callable = httpsCallable(functions, "postMatchSummary");
    await callable({ matchId });
    if (!silent) alert("Posted to Discord.");
  } catch (error) {
    console.warn(error);
    if (!silent) alert("Discord posting is not set up yet, or this match was already posted.");
  }
}

async function deleteMatch(matchId, ask = true) {
  if (ask && !confirm("Delete this match?")) return;

  try {
    const predSnap = await getDocs(collection(db, "matches", matchId, "predictions"));
    await Promise.all(predSnap.docs.map(pred => deleteDoc(doc(db, "matches", matchId, "predictions", pred.id))));
  } catch (error) {
    console.warn("Could not delete prediction subdocuments:", error);
  }

  await deleteDoc(doc(db, "matches", matchId));
}

async function deleteSeason(seasonId) {
  const season = configState.seasons.find(s => s.id === seasonId);
  if (!season) return;

  const usedMatches = matches.filter(m => m.seasonId === seasonId);
  let warning = `Delete season "${season.name}"?`;
  if (usedMatches.length) {
    warning += `\n\nThis season has ${usedMatches.length} match event(s). The matches will remain in history, but the season option will be removed.`;
  }

  if (!confirm(warning)) return;

  const remaining = configState.seasons.filter(s => s.id !== seasonId);
  if (!remaining.length) {
    alert("You need at least one season. Create another season before deleting this one.");
    return;
  }

  const nextActive = configState.activeSeasonId === seasonId
    ? remaining[0].id
    : configState.activeSeasonId;

  await saveConfig({
    seasons: remaining,
    activeSeasonId: nextActive
  });
}

function totals(gameType, seasonId = null) {
  return matches.reduce((acc, m) => {
    if (!m.calculated || m.gameType !== gameType) return acc;
    if (seasonId && m.seasonId !== seasonId) return acc;
    acc.dany += m.summary?.danyPoints || 0;
    acc.isa += m.summary?.isaPoints || 0;
    acc.played++;
    return acc;
  }, { dany: 0, isa: 0, played: 0 });
}

function renderOtherTeamSelects() {
  const teams = [...(configState.otherTeams || [])].sort((a, b) => a.name.localeCompare(b.name));
  setupSmartPicker("otherHomePicker", teams, "Search or choose home team");
  setupSmartPicker("otherAwayPicker", teams, "Search or choose away team");
}

function renderOtherTeamList() {
  const list = document.getElementById("otherTeamList");
  const count = document.getElementById("otherTeamCount");
  const searchInput = document.getElementById("otherTeamSearchInput");
  if (!list) return;

  const teams = [...(configState.otherTeams || [])].sort((a, b) => a.name.localeCompare(b.name));
  if (count) count.textContent = `${teams.length} teams saved`;

  const query = (searchInput?.value || "").trim().toLowerCase();
  const filteredTeams = query
    ? teams.filter(team => team.name.toLowerCase().includes(query) || (team.code || "").toLowerCase().includes(query))
    : teams;

  list.innerHTML = "";
  filteredTeams.forEach(team => {
    const item = document.createElement("div");
    item.className = "manager-item compact-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(team.name)}</strong>
        <div class="muted">${escapeHtml(team.code || team.name.slice(0,3).toUpperCase())}</div>
      </div>
      <div class="manager-item-actions">
        <button type="button" class="ghost rename">Rename</button>
        <button type="button" class="ghost danger remove">Remove</button>
      </div>
    `;

    item.querySelector(".rename").addEventListener("click", async () => {
      const nextName = prompt("Team name:", team.name);
      if (!nextName) return;
      const nextCode = prompt("Badge code:", team.code || nextName.slice(0,3).toUpperCase());
      team.name = normaliseName(nextName);
      team.code = normaliseName(nextCode || nextName.slice(0,3)).toUpperCase();
      await saveConfig({ otherTeams: configState.otherTeams });
    });

    item.querySelector(".remove").addEventListener("click", async () => {
      if (!confirm(`Remove ${team.name}?`)) return;
      configState.otherTeams = (configState.otherTeams || []).filter(t => t.id !== team.id);
      await saveConfig({ otherTeams: configState.otherTeams });
    });

    list.appendChild(item);
  });
}

function renderOtherScoreboard() {
  const el = document.getElementById("otherScoreboard");
  if (!el) return;

  const season = totals("other", configState.activeSeasonId);
  const overall = totals("other");
  const leader = season.dany === season.isa ? "Draw" : season.dany > season.isa ? "Dany" : "Isa";

  el.innerHTML = `
    <div class="score-card"><span>Other season</span><strong>${season.dany}-${season.isa}</strong><small>Dany - Isa</small></div>
    <div class="score-card"><span>Other overall</span><strong>${overall.dany}-${overall.isa}</strong></div>
    <div class="score-card"><span>Other leader</span><strong>${leader}</strong></div>
    <div class="score-card"><span>Other matches</span><strong>${season.played}</strong></div>
  `;
}

function renderScoreboard() {
  const lfcSeason = totals("lfc", configState.activeSeasonId);
  const lfcOverall = totals("lfc");
  const otherSeason = totals("other", configState.activeSeasonId);
  const leader = lfcSeason.dany === lfcSeason.isa ? "Draw" : lfcSeason.dany > lfcSeason.isa ? "Dany" : "Isa";

  document.getElementById("scoreboard").innerHTML = `
    <div class="score-card"><span>Active season</span><strong>${escapeHtml(configState.activeSeasonId)}</strong></div>
    <div class="score-card"><span>LFC season</span><strong>${lfcSeason.dany}-${lfcSeason.isa}</strong><small>Dany - Isa</small></div>
    <div class="score-card"><span>LFC overall</span><strong>${lfcOverall.dany}-${lfcOverall.isa}</strong></div>
    <div class="score-card"><span>Season leader</span><strong>${leader}</strong></div>
  `;
}

const smartPickers = {};

function normalizeChoice(value) {
  return normaliseName(value).toLowerCase();
}

function resolveSavedTeamName(value, teams) {
  const query = normalizeChoice(value);
  if (!query) return "";

  const exact = teams.find(team =>
    team.name.toLowerCase() === query ||
    (team.code || "").toLowerCase() === query
  );
  if (exact) return exact.name;

  const startsWith = teams.filter(team =>
    team.name.toLowerCase().startsWith(query) ||
    (team.code || "").toLowerCase().startsWith(query)
  );
  if (startsWith.length === 1) return startsWith[0].name;

  const contains = teams.filter(team =>
    team.name.toLowerCase().includes(query) ||
    (team.code || "").toLowerCase().includes(query)
  );
  if (contains.length === 1) return contains[0].name;

  return "";
}

function getSmartPickerValue(pickerId) {
  const state = smartPickers[pickerId];
  if (!state) return "";

  const selected = state.selected || "";
  const typed = state.input?.value || "";

  if (selected && state.items.some(item => item.name === selected)) {
    return selected;
  }

  const resolved = resolveSavedTeamName(typed, state.items);
  if (resolved) {
    state.selected = resolved;
    state.input.value = resolved;
    state.root.classList.add("has-selection");
    return resolved;
  }

  return "";
}

function clearSmartPicker(pickerId) {
  const state = smartPickers[pickerId];
  if (!state) return;
  state.selected = "";
  state.input.value = "";
  state.root.classList.remove("has-selection");
}

function setupSmartPicker(pickerId, items, placeholder = "Search or choose") {
  const root = document.getElementById(pickerId);
  if (!root) return;

  const previous = smartPickers[pickerId]?.selected || "";
  const oldText = smartPickers[pickerId]?.input?.value || "";

  root.innerHTML = `
    <div class="smart-picker-control">
      <input type="text" class="smart-picker-input" placeholder="${escapeHtml(placeholder)}" autocomplete="off" />
      <button type="button" class="smart-picker-button" aria-label="Open list">⌄</button>
    </div>
    <div class="smart-picker-menu"></div>
  `;

  const input = root.querySelector(".smart-picker-input");
  const button = root.querySelector(".smart-picker-button");
  const menu = root.querySelector(".smart-picker-menu");

  const state = {
    root,
    input,
    button,
    menu,
    items: [...items].sort((a, b) => a.name.localeCompare(b.name)),
    selected: previous
  };

  smartPickers[pickerId] = state;

  if (previous && state.items.some(item => item.name === previous)) {
    input.value = previous;
    state.selected = previous;
    root.classList.add("has-selection");
  } else if (oldText) {
    input.value = oldText;
  }

  const renderMenu = (force = false) => {
    const query = input.value.trim().toLowerCase();
    const filtered = query
      ? state.items.filter(item =>
          item.name.toLowerCase().includes(query) ||
          (item.code || "").toLowerCase().includes(query)
        )
      : state.items;

    const visible = filtered.slice(0, 30);

    menu.innerHTML = visible.length
      ? visible.map(item => `
          <button type="button" class="smart-picker-option" data-name="${escapeHtml(item.name)}">
            <span>${escapeHtml(item.name)}</span>
            <small>${escapeHtml(item.code || "")}</small>
          </button>
        `).join("")
      : `<div class="smart-picker-empty">No saved team found</div>`;

    if (force) menu.classList.add("open");
  };

  const selectItem = name => {
    state.selected = name;
    input.value = name;
    root.classList.add("has-selection");
    menu.classList.remove("open");
  };

  input.addEventListener("focus", () => renderMenu(true));
  input.addEventListener("click", () => renderMenu(true));
  input.addEventListener("input", () => {
    state.selected = "";
    root.classList.remove("has-selection");
    renderMenu(true);
  });
  input.addEventListener("keydown", event => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      renderMenu(true);
      menu.querySelector(".smart-picker-option")?.focus();
    }
    if (event.key === "Enter") {
      const resolved = resolveSavedTeamName(input.value, state.items);
      if (resolved) {
        event.preventDefault();
        selectItem(resolved);
      }
    }
    if (event.key === "Escape") menu.classList.remove("open");
  });

  button.addEventListener("click", () => {
    input.focus();
    renderMenu(true);
  });

  menu.addEventListener("mousedown", event => {
    const option = event.target.closest(".smart-picker-option");
    if (!option) return;
    event.preventDefault();
    selectItem(option.dataset.name);
  });

  menu.addEventListener("keydown", event => {
    const option = event.target.closest(".smart-picker-option");
    if (!option) return;

    if (event.key === "Enter") {
      event.preventDefault();
      selectItem(option.dataset.name);
      input.focus();
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      option.nextElementSibling?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      option.previousElementSibling?.focus() || input.focus();
    }
  });

  input.addEventListener("blur", () => {
    setTimeout(() => menu.classList.remove("open"), 180);
  });

  renderMenu(false);
}

function renderOpponentSelect() {
  const opponents = [...(configState.opponents || [])].sort((a, b) => a.name.localeCompare(b.name));
  setupSmartPicker("lfcOpponentPicker", opponents, "Search or choose opponent");
  renderOpponentManager();
}

function renderOpponentManager() {
  const list = document.getElementById("opponentList");
  const count = document.getElementById("opponentCount");
  const searchInput = document.getElementById("opponentSearchInput");
  if (!list) return;

  const teams = [...(configState.opponents || [])].sort((a, b) => a.name.localeCompare(b.name));
  if (count) count.textContent = `${teams.length} opponents saved`;

  const query = (searchInput?.value || "").trim().toLowerCase();
  const filtered = query
    ? teams.filter(team => team.name.toLowerCase().includes(query) || (team.code || "").toLowerCase().includes(query))
    : teams;

  list.innerHTML = "";
  filtered.forEach(team => {
    const item = document.createElement("div");
    item.className = "manager-item compact-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(team.name)}</strong>
        <div class="muted">${escapeHtml(team.code || team.name.slice(0,3).toUpperCase())}</div>
      </div>
      <div class="manager-item-actions">
        <button type="button" class="ghost rename">Rename</button>
        <button type="button" class="ghost danger remove">Remove</button>
      </div>
    `;

    item.querySelector(".rename").addEventListener("click", async () => {
      const nextName = prompt("Opponent name:", team.name);
      if (!nextName) return;
      const nextCode = prompt("Badge code:", team.code || nextName.slice(0,3).toUpperCase());
      team.name = normaliseName(nextName);
      team.code = normaliseName(nextCode || nextName.slice(0,3)).toUpperCase();
      await saveConfig({ opponents: configState.opponents });
    });

    item.querySelector(".remove").addEventListener("click", async () => {
      if (!confirm(`Remove ${team.name}?`)) return;
      configState.opponents = (configState.opponents || []).filter(t => t.id !== team.id);
      await saveConfig({ opponents: configState.opponents });
    });

    list.appendChild(item);
  });
}

function fixtureHtml(match) {
  if (match.gameType === "lfc") {
    return `
      <div class="team"><div class="badge lfc-badge">LFC</div><strong>Liverpool</strong></div>
      <span class="versus">vs</span>
      <div class="team"><div class="badge opponent-badge">${escapeHtml(match.opponentCode || match.away.slice(0,3).toUpperCase())}</div><strong>${escapeHtml(match.away)}</strong></div>
    `;
  }

  return `
    <div class="team"><div class="badge opponent-badge">${escapeHtml(match.homeCode || match.home.slice(0,3).toUpperCase())}</div><strong>${escapeHtml(match.home)}</strong></div>
    <span class="versus">vs</span>
    <div class="team"><div class="badge opponent-badge">${escapeHtml(match.opponentCode || match.away.slice(0,3).toUpperCase())}</div><strong>${escapeHtml(match.away)}</strong></div>
  `;
}

function draftKey(matchId) {
  return `predictionDraft:${currentProfile?.key || "unknown"}:${matchId}`;
}

function getPredictionDraft(matchId) {
  try {
    return JSON.parse(sessionStorage.getItem(draftKey(matchId)) || "null");
  } catch {
    return null;
  }
}

function savePredictionDraft(matchId, data) {
  try {
    sessionStorage.setItem(draftKey(matchId), JSON.stringify(data));
  } catch {
    // Ignore draft storage errors; cloud save still works.
  }
}

function clearPredictionDraft(matchId) {
  try {
    sessionStorage.removeItem(draftKey(matchId));
  } catch {
    // Ignore.
  }
}

function actualDraftKey(matchId) {
  return `actualDraft:${currentProfile?.key || "unknown"}:${matchId}`;
}

function getActualDraft(matchId) {
  try {
    return JSON.parse(sessionStorage.getItem(actualDraftKey(matchId)) || "null");
  } catch {
    return null;
  }
}

function saveActualDraft(matchId, data) {
  try {
    sessionStorage.setItem(actualDraftKey(matchId), JSON.stringify(data));
  } catch {
    // Ignore draft storage errors.
  }
}

function clearActualDraft(matchId) {
  try {
    sessionStorage.removeItem(actualDraftKey(matchId));
  } catch {
    // Ignore.
  }
}

function setupActualScorerPicker(node, match, existingActualScorers = []) {
  updatePlayerDatalists();

  const actualField = node.querySelector('[data-actual="actualScorers"]');
  if (!actualField) return;

  // Avoid double-wrapping if this function is ever called again on the same node.
  if (actualField.dataset.actual === "actualScorersGroup") return;

  const wrapper = document.createElement("div");
  wrapper.className = "actual-scorer-dropdowns searchable-scorers";
  wrapper.dataset.actual = "actualScorersGroup";

  const listId = match.gameType === "lfc" ? "lfcPlayerOptions" : "otherPlayerOptions";
  const scorers = Array.isArray(existingActualScorers)
    ? existingActualScorers
    : parseScorers(existingActualScorers);

  for (let i = 0; i < 6; i++) {
    const input = document.createElement("input");
    input.dataset.actualScorerIndex = String(i);
    input.setAttribute("list", listId);
    input.placeholder = `Search actual scorer ${i + 1}`;
    input.autocomplete = "off";
    input.value = scorers[i] || "";
    wrapper.appendChild(input);
  }

  actualField.replaceWith(wrapper);
}

function getActualScorersFromNode(node) {
  const group = node.querySelector('[data-actual="actualScorersGroup"]');

  if (group) {
    return Array.from(group.querySelectorAll("input, select"))
      .map(field => normaliseName(field.value || ""))
      .filter(Boolean);
  }

  const field = node.querySelector('[data-actual="actualScorers"]');
  if (!field) return [];

  return parseScorers(field.value);
}

function readActualForm(card) {
  return {
    actualHome: card.querySelector('[data-actual="actualHome"]')?.value ?? "",
    actualAway: card.querySelector('[data-actual="actualAway"]')?.value ?? "",
    actualScorers: getActualScorersFromNode(card)
  };
}

function attachActualDraftListeners(card, matchId) {
  card.querySelectorAll("[data-actual], [data-actual-scorer-index]").forEach(input => {
    input.addEventListener("input", () => saveActualDraft(matchId, readActualForm(card)));
    input.addEventListener("change", () => saveActualDraft(matchId, readActualForm(card)));
  });
}

function setupScorerPickers(node, match, existingScorers = []) {
  updatePlayerDatalists();

  const scorerFields = [
    node.querySelector('[data-own="scorer0"]'),
    node.querySelector('[data-own="scorer1"]'),
    node.querySelector('[data-own="scorer2"]')
  ];

  const listId = match.gameType === "lfc" ? "lfcPlayerOptions" : "otherPlayerOptions";

  scorerFields.forEach((field, index) => {
    if (!field) return;

    // If the template already has an input, keep it and only configure it.
    const input = field.tagName?.toLowerCase() === "input"
      ? field
      : document.createElement("input");

    input.dataset.own = field.dataset.own;
    input.setAttribute("list", listId);
    input.placeholder = `Search scorer ${index + 1}`;
    input.autocomplete = "off";
    input.value = existingScorers[index] || "";

    if (input !== field) {
      field.replaceWith(input);
    }
  });
}


function readPredictionForm(card) {
  return {
    scoreHome: card.querySelector('[data-own="scoreHome"]')?.value ?? "",
    scoreAway: card.querySelector('[data-own="scoreAway"]')?.value ?? "",
    scorers: [
      card.querySelector('[data-own="scorer0"]')?.value ?? "",
      card.querySelector('[data-own="scorer1"]')?.value ?? "",
      card.querySelector('[data-own="scorer2"]')?.value ?? ""
    ]
  };
}

function attachDraftListeners(card, matchId) {
  card.querySelectorAll("[data-own]").forEach(input => {
    input.addEventListener("input", () => savePredictionDraft(matchId, readPredictionForm(card)));
    input.addEventListener("change", () => savePredictionDraft(matchId, readPredictionForm(card)));
  });
}

function persistVisibleDraftsBeforeRender() {
  document.querySelectorAll(".match-card[data-match-id]").forEach(card => {
    const matchId = card.dataset.matchId;
    const rootMatch = matches.find(match => match.id === matchId);

    if (!matchId || rootMatch?.revealed) return;

    const scoreHome = card.querySelector('[data-own="scoreHome"]')?.value ?? "";
    const scoreAway = card.querySelector('[data-own="scoreAway"]')?.value ?? "";
    const scorer0 = card.querySelector('[data-own="scorer0"]')?.value ?? "";
    const scorer1 = card.querySelector('[data-own="scorer1"]')?.value ?? "";
    const scorer2 = card.querySelector('[data-own="scorer2"]')?.value ?? "";

    const hasAnyPredictionDraft = scoreHome !== "" || scoreAway !== "" || scorer0 !== "" || scorer1 !== "" || scorer2 !== "";

    if (hasAnyPredictionDraft) {
      savePredictionDraft(matchId, {
        scoreHome,
        scoreAway,
        scorers: [scorer0, scorer1, scorer2]
      });
    }

    const actualDraft = readActualForm(card);
    const actualScorers = Array.isArray(actualDraft.actualScorers)
      ? actualDraft.actualScorers
      : parseScorers(actualDraft.actualScorers);
    const hasAnyActualDraft = actualDraft.actualHome !== "" || actualDraft.actualAway !== "" || actualScorers.length > 0;

    if (hasAnyActualDraft) {
      saveActualDraft(matchId, actualDraft);
    }
  });
}

function renderMatchList(containerId, gameType) {
  const container = document.getElementById(containerId);
  const template = document.getElementById("matchTemplate");
  const openMatches = matches
    .filter(m => m.gameType === gameType && !m.calculated && m.seasonId === configState.activeSeasonId)
    .sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  container.innerHTML = "";
  if (!openMatches.length) {
    container.innerHTML = `<div class="empty">No open matches in this tab.</div>`;
    return;
  }

  openMatches.forEach(match => {
    const node = template.content.cloneNode(true);
    const root = node.querySelector(".match-card");
    root.dataset.matchId = match.id;
    node.querySelector(".fixture").innerHTML = fixtureHtml(match);
    node.querySelector(".match-meta").textContent = match.date || "No date set";

    const leftScoreLabel = match.gameType === "lfc" ? "LFC" : "Home";
    const rightScoreLabel = match.gameType === "lfc" ? "Opponent" : "Away";
    node.querySelector('[data-own="scoreHome"]').placeholder = leftScoreLabel;
    node.querySelector('[data-own="scoreAway"]').placeholder = rightScoreLabel;
    node.querySelector('[data-actual="actualHome"]').placeholder = leftScoreLabel;
    node.querySelector('[data-actual="actualAway"]').placeholder = rightScoreLabel;

    const otherKey = currentProfile.key === "dany" ? "isa" : "dany";
    const otherName = otherKey === "dany" ? "Dany" : "Isa";
    const myPred = getPred(match.id, currentProfile.key);
    const otherPred = getPred(match.id, otherKey);
    const mySubmitted = !!match.submitted?.[currentProfile.key] || !!myPred;
    const otherSubmitted = !!match.submitted?.[otherKey];
    const localDraft = getPredictionDraft(match.id);
    const formSource = localDraft || myPred || null;

    node.querySelector(".other-name").textContent = otherName;
    node.querySelector(".other-name-back").textContent = `${otherName}'s prediction`;

    const hiddenCard = node.querySelector(".flip-card");
    hiddenCard.classList.add(otherSubmitted ? "submitted" : "not-submitted");
    node.querySelector(".face-down").textContent = otherSubmitted
      ? `${otherName} has placed a prediction`
      : `${otherName} has not placed a prediction yet`;

    const saved = node.querySelector(".saved-status");
    saved.classList.toggle("submitted", mySubmitted);
    saved.classList.toggle("not-submitted", !mySubmitted);
    saved.textContent = localDraft
      ? "You have an unsaved draft on this device."
      : mySubmitted
        ? "Your prediction is saved to the cloud. You can still edit until reveal."
        : "No prediction saved yet.";

    const existingMyScorers = formSource ? parseScorers(formSource.scorers) : [];
    if (formSource && !match.revealed) {
      node.querySelector('[data-own="scoreHome"]').value = formSource.scoreHome ?? "";
      node.querySelector('[data-own="scoreAway"]').value = formSource.scoreAway ?? "";
    }
    setupScorerPickers(node, match, existingMyScorers);
    attachDraftListeners(node, match.id);

    const localActualDraft = getActualDraft(match.id);
    const actualSource = localActualDraft || {
      actualHome: match.actualHome ?? "",
      actualAway: match.actualAway ?? "",
      actualScorers: parseScorers(match.actualScorers)
    };

    node.querySelector('[data-actual="actualHome"]').value = actualSource.actualHome ?? "";
    node.querySelector('[data-actual="actualAway"]').value = actualSource.actualAway ?? "";
    setupActualScorerPicker(node, match, parseScorers(actualSource.actualScorers));
    attachActualDraftListeners(node, match.id);

    if (match.revealed) {
      root.classList.add("is-revealed");
      node.querySelector(".flip-card").classList.add("revealed");
      node.querySelector(".own-revealed").innerHTML = `<h3>Your revealed prediction</h3>${predictionHtml(myPred, match)}`;
      node.querySelector(".opponent-prediction-view").innerHTML = predictionHtml(otherPred, match);
    }

    node.querySelector(".save-prediction-btn")?.addEventListener("click", async event => {
      const btn = event.currentTarget;
      const statusBox = node.querySelector(".saved-status");

      const scorers = [
        node.querySelector('[data-own="scorer0"]').value,
        node.querySelector('[data-own="scorer1"]').value,
        node.querySelector('[data-own="scorer2"]').value
      ];

      btn.disabled = true;
      btn.textContent = "Saving...";
      statusBox.textContent = "Saving prediction to cloud...";
      statusBox.classList.remove("not-submitted");
      statusBox.classList.add("submitted");

      try {
        await savePrediction(match.id, {
          scoreHome: node.querySelector('[data-own="scoreHome"]').value,
          scoreAway: node.querySelector('[data-own="scoreAway"]').value,
          scorers
        });

        statusBox.textContent = "Your prediction is saved to the cloud. You can still edit until reveal.";
        statusBox.classList.add("submitted");
        statusBox.classList.remove("not-submitted");
        btn.textContent = "Saved ✓";

        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = "Save my prediction";
        }, 900);
      } catch (error) {
        console.error("Save prediction failed:", error);
        statusBox.textContent = `Save failed: ${error.message || "Unknown error"}`;
        statusBox.classList.remove("submitted");
        statusBox.classList.add("not-submitted");
        setCloudStatus("Save failed", "offline");
        btn.disabled = false;
        btn.textContent = "Save my prediction";
        alert(`Save failed: ${error.message || "Unknown error"}`);
      }
    });

    node.querySelector(".reveal-btn").addEventListener("click", async event => {
      const btn = event.currentTarget;
      btn.disabled = true;
      btn.textContent = "Revealing...";
      try {
        await revealAndCalculate(match.id, {
          actualHome: node.querySelector('[data-actual="actualHome"]').value,
          actualAway: node.querySelector('[data-actual="actualAway"]').value,
          actualScorers: getActualScorersFromNode(node)
        });
      } finally {
        btn.disabled = false;
        btn.textContent = "Reveal Prediction";
      }
    });

    node.querySelector(".discord-btn").addEventListener("click", () => postToDiscord(match.id));
    node.querySelector(".delete-btn").addEventListener("click", () => deleteMatch(match.id));

    container.appendChild(node);
  });
}

function predictionHtml(pred, match) {
  if (!pred) return `<div class="empty">No prediction saved.</div>`;

  let points = "";
  if (match.revealed || match.calculated) {
    const score = scorePrediction(pred, match);
    points = `<div class="pill">${score.points} pts</div><div class="muted">${escapeHtml(score.breakdown.join(", ") || "No scoring picks")}</div>`;
  }

  return `
    <div class="pred-line"><strong>Score:</strong> ${escapeHtml(pred.scoreHome ?? "-")} - ${escapeHtml(pred.scoreAway ?? "-")}</div>
    <div class="pred-line"><strong>Scorers:</strong> ${escapeHtml(parseScorers(pred.scorers).join(", ") || "-")}</div>
    ${points}
  `;
}

function renderPlayers() {
  const list = document.getElementById("playerList");
  list.innerHTML = "";
  [...configState.players].sort((a,b) => a.name.localeCompare(b.name)).forEach(player => {
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
        <button type="button" class="ghost rename">Rename</button>
        <button type="button" class="ghost danger remove">Remove</button>
      </div>
    `;
    const select = item.querySelector("select");
    select.value = String(player.points);
    select.addEventListener("change", async e => {
      player.points = Number(e.target.value);
      await saveConfig({ players: configState.players });
    });
    item.querySelector(".rename").addEventListener("click", async () => {
      const next = prompt("Player name:", player.name);
      if (!next) return;
      player.name = normaliseName(next);
      await saveConfig({ players: configState.players });
    });
    item.querySelector(".remove").addEventListener("click", async () => {
      if (!confirm(`Remove ${player.name}?`)) return;
      configState.players = configState.players.filter(p => p.id !== player.id);
      await saveConfig({ players: configState.players });
    });
    list.appendChild(item);
  });
}

function renderOtherPlayers() {
  const list = document.getElementById("otherPlayerList");
  if (!list) return;

  list.innerHTML = "";
  [...(configState.otherPlayers || [])].sort((a,b) => a.name.localeCompare(b.name)).forEach(player => {
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
        <button type="button" class="ghost rename">Rename</button>
        <button type="button" class="ghost danger remove">Remove</button>
      </div>
    `;
    const select = item.querySelector("select");
    select.value = String(player.points);
    select.addEventListener("change", async e => {
      player.points = Number(e.target.value);
      await saveConfig({ otherPlayers: configState.otherPlayers });
    });
    item.querySelector(".rename").addEventListener("click", async () => {
      const next = prompt("Player name:", player.name);
      if (!next) return;
      player.name = normaliseName(next);
      await saveConfig({ otherPlayers: configState.otherPlayers });
    });
    item.querySelector(".remove").addEventListener("click", async () => {
      if (!confirm(`Remove ${player.name}?`)) return;
      configState.otherPlayers = configState.otherPlayers.filter(p => p.id !== player.id);
      await saveConfig({ otherPlayers: configState.otherPlayers });
    });
    list.appendChild(item);
  });
}

function renderSeasons() {
  const list = document.getElementById("seasonList");
  list.innerHTML = "";
  configState.seasons.forEach(season => {
    const lfc = totals("lfc", season.id);
    const other = totals("other", season.id);
    const item = document.createElement("div");
    item.className = "season-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(season.name)}</strong>
        <div class="muted">LFC: Dany ${lfc.dany} - Isa ${lfc.isa} • Other: Dany ${other.dany} - Isa ${other.isa}</div>
      </div>
      <div class="manager-item-actions">
        ${season.id === configState.activeSeasonId ? '<span class="pill">Active</span>' : '<button type="button" class="ghost activate">Set active</button>'}
        <button type="button" class="ghost danger delete-season">Delete</button>
      </div>
    `;
    item.querySelector(".activate")?.addEventListener("click", async () => {
      await saveConfig({ activeSeasonId: season.id });
    });
    item.querySelector(".delete-season")?.addEventListener("click", async () => {
      await deleteSeason(season.id);
    });
    list.appendChild(item);
  });
}

function predictionDetailHtml(label, pred, match, score) {
  const predictedScorers = parseScorers(pred?.scorers);
  const actualScorers = parseScorers(match.actualScorers).map(s => s.toLowerCase());
  const exact = pred &&
    String(pred.scoreHome) === String(match.actualHome) &&
    String(pred.scoreAway) === String(match.actualAway);

  const scorerRows = predictedScorers.length
    ? predictedScorers.map(player => {
        const hit = actualScorers.includes(player.toLowerCase());
        const pts = hit ? getPlayerPoints(player, match.gameType) : 0;
        return `
          <div class="summary-line ${hit ? "hit" : "miss"}">
            <span>${hit ? "✓" : "✕"} ${escapeHtml(player)}</span>
            <strong>${hit ? `+${pts}` : "0"}</strong>
          </div>
        `;
      }).join("")
    : `<div class="summary-line miss"><span>No scorers picked</span><strong>0</strong></div>`;

  return `
    <div class="summary-card reveal-player-card">
      <div class="summary-card-head">
        <h3>${escapeHtml(label)}</h3>
        <div class="summary-points">${score.points} pts</div>
      </div>
      <div class="pred-line"><strong>Prediction:</strong> ${escapeHtml(pred?.scoreHome ?? "-")} - ${escapeHtml(pred?.scoreAway ?? "-")}</div>
      <div class="summary-line ${exact ? "hit" : "miss"}">
        <span>${exact ? "✓" : "✕"} Exact score</span>
        <strong>${exact ? "+5" : "0"}</strong>
      </div>
      <div class="scorer-summary-title">Goalscorer picks</div>
      ${scorerRows}
      <p class="muted breakdown-text">${escapeHtml(score.breakdown.join(", ") || "No scoring picks")}</p>
    </div>
  `;
}

function showRoundSummary(match, predictionMap = null) {
  const modal = document.getElementById("roundSummaryModal");
  const content = document.getElementById("roundSummaryContent");
  if (!modal || !content) return;

  const danyPred = predictionMap?.dany || getPred(match.id, "dany");
  const isaPred = predictionMap?.isa || getPred(match.id, "isa");
  const danyScore = scorePrediction(danyPred, match);
  const isaScore = scorePrediction(isaPred, match);
  const summary = match.summary || {
    danyPoints: danyScore.points,
    isaPoints: isaScore.points,
    roundWinner: danyScore.points === isaScore.points ? "Draw" : danyScore.points > isaScore.points ? "Dany" : "Isa",
    seasonLeader: "-",
    overallLeader: "-"
  };

  content.innerHTML = `
    <div class="actual-summary">
      <div>
        <h3>${escapeHtml(displayTeamsForMatch(match).home)} ${escapeHtml(match.actualHome)}-${escapeHtml(match.actualAway)} ${escapeHtml(displayTeamsForMatch(match).away)}</h3>
        <p>Actual scorers: <strong>${escapeHtml(parseScorers(match.actualScorers).join(", ") || "-")}</strong></p>
      </div>
      <div class="actual-badge">${escapeHtml(match.gameType === "lfc" ? "Liverpool" : "Other")}</div>
    </div>
    <div class="summary-cards reveal-summary-grid">
      ${predictionDetailHtml("Dany", danyPred, match, danyScore)}
      ${predictionDetailHtml("Isa", isaPred, match, isaScore)}
      <div class="summary-card winner-card">
        <h3>Round result</h3>
        <div class="summary-points">${escapeHtml(summary.roundWinner || "-")}</div>
        <div class="summary-line"><span>Dany</span><strong>${summary.danyPoints ?? danyScore.points} pts</strong></div>
        <div class="summary-line"><span>Isa</span><strong>${summary.isaPoints ?? isaScore.points} pts</strong></div>
        <div class="summary-line"><span>Season leader</span><strong>${escapeHtml(summary.seasonLeader || "-")}</strong></div>
        <div class="summary-line"><span>Overall leader</span><strong>${escapeHtml(summary.overallLeader || "-")}</strong></div>
      </div>
    </div>
  `;

  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeRoundSummary() {
  const modal = document.getElementById("roundSummaryModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

function summaryCardHtml(match) {
  const s = match.summary || {};
  const danyBreakdown = (s.danyBreakdown || []).join(", ") || "No scoring picks";
  const isaBreakdown = (s.isaBreakdown || []).join(", ") || "No scoring picks";

  return `
    <div class="summary-cards">
      <div class="summary-card">
        <h3>Dany</h3>
        <div class="summary-points">${s.danyPoints || 0} pts</div>
        <p>${escapeHtml(danyBreakdown)}</p>
      </div>
      <div class="summary-card">
        <h3>Isa</h3>
        <div class="summary-points">${s.isaPoints || 0} pts</div>
        <p>${escapeHtml(isaBreakdown)}</p>
      </div>
      <div class="summary-card winner-card">
        <h3>Round</h3>
        <div class="summary-points">${escapeHtml(s.roundWinner || "-")}</div>
        <p>Season leader: ${escapeHtml(s.seasonLeader || "-")} • Overall leader: ${escapeHtml(s.overallLeader || "-")}</p>
      </div>
    </div>
  `;
}

async function deleteHistoryMatch(matchId) {
  if (!confirm("Delete this completed match? Scores will update automatically.")) return;
  await deleteMatch(matchId, false);
}

function renderHistory() {
  const history = document.getElementById("history");
  const completed = matches
    .filter(m => m.calculated)
    .sort((a,b) => (b.revealedAt?.seconds || 0) - (a.revealedAt?.seconds || 0));

  history.innerHTML = "";
  if (!completed.length) {
    history.innerHTML = `<div class="empty">Revealed matches will appear here.</div>`;
    return;
  }

  completed.forEach(match => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <div class="history-main">
        <strong>${escapeHtml(displayTeamsForMatch(match).home)} ${escapeHtml(match.actualHome)}-${escapeHtml(match.actualAway)} ${escapeHtml(displayTeamsForMatch(match).away)}</strong>
        <div class="muted">${escapeHtml(match.seasonId)} • ${match.gameType === "lfc" ? "Liverpool" : "Other"} • Round winner: ${escapeHtml(match.summary?.roundWinner || "-")}</div>
        ${summaryCardHtml(match)}
      </div>
      <div class="history-actions">
        <span class="pill">Dany ${match.summary?.danyPoints || 0}</span>
        <span class="pill">Isa ${match.summary?.isaPoints || 0}</span>
        <button type="button" class="ghost danger delete-history">Delete</button>
      </div>
    `;
    item.querySelector(".delete-history").addEventListener("click", () => deleteHistoryMatch(match.id));
    history.appendChild(item);
  });
}

function updatePlayerDatalists() {
  const lfcList = document.getElementById("lfcPlayerOptions");
  const otherList = document.getElementById("otherPlayerOptions");

  if (lfcList) {
    lfcList.innerHTML = [...(configState.players || [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(player => `<option value="${escapeHtml(player.name)}">${escapeHtml(player.name)} - ${player.points} pts</option>`)
      .join("");
  }

  if (otherList) {
    otherList.innerHTML = [...(configState.otherPlayers || [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(player => `<option value="${escapeHtml(player.name)}">${escapeHtml(player.name)} - ${player.points} pts</option>`)
      .join("");
  }
}

function safeRenderStep(name, fn) {
  try {
    fn();
  } catch (error) {
    console.error(`Render step failed: ${name}`, error);
  }
}

function render() {
  if (!currentProfile) return;

  safeRenderStep("updatePlayerDatalists", updatePlayerDatalists);
  safeRenderStep("setDefaultMatchDates", setDefaultMatchDates);
  safeRenderStep("renderScoreboard", renderScoreboard);
  safeRenderStep("renderOpponentSelect", renderOpponentSelect);
  safeRenderStep("renderMatchList lfc", () => renderMatchList("lfcMatches", "lfc"));
  safeRenderStep("renderMatchList other", () => renderMatchList("otherMatches", "other"));
  safeRenderStep("renderPlayers", renderPlayers);
  safeRenderStep("renderOtherPlayers", renderOtherPlayers);
  safeRenderStep("renderOtherTeamSelects", renderOtherTeamSelects);
  safeRenderStep("renderOtherTeamList", renderOtherTeamList);
  safeRenderStep("renderOtherScoreboard", renderOtherScoreboard);
  safeRenderStep("renderSeasons", renderSeasons);
  safeRenderStep("renderHistory", renderHistory);
}

async function exportBackup() {
  try {
    const allMatches = [];
    const allPredictions = {};

    const matchSnap = await getDocs(collection(db, "matches"));
    matchSnap.docs.forEach(matchDoc => {
      allMatches.push({ id: matchDoc.id, ...matchDoc.data() });
    });

    for (const match of allMatches) {
      const predictionSnap = await getDocs(collection(db, "matches", match.id, "predictions"));
      allPredictions[match.id] = {};
      predictionSnap.docs.forEach(predDoc => {
        allPredictions[match.id][predDoc.id] = { id: predDoc.id, ...predDoc.data() };
      });
    }

    const backup = {
      version: 20,
      exportedAt: new Date().toISOString(),
      configState,
      matches: allMatches,
      predictionsByMatch: allPredictions
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prediction-league-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setCloudStatus("Backup exported", "online");
  } catch (error) {
    console.error("Export failed:", error);
    alert(`Export failed: ${error.message || "Unknown error"}`);
  }
}

async function importBackupFile(file) {
  if (!file) return;

  const ok = confirm(
    "Import backup? This will replace your current editable config, matches, predictions and history with the backup file."
  );

  if (!ok) return;

  try {
    const text = await file.text();
    const backup = JSON.parse(text);

    if (!backup || !backup.configState || !Array.isArray(backup.matches)) {
      throw new Error("This does not look like a valid Prediction League backup file.");
    }

    setCloudStatus("Importing backup...", "online");

    await setDoc(configRef(), {
      ...backup.configState,
      updatedAt: serverTimestamp()
    }, { merge: false });

    // Delete current matches and their prediction subdocuments.
    const currentMatchSnap = await getDocs(collection(db, "matches"));
    for (const currentMatch of currentMatchSnap.docs) {
      const predictionSnap = await getDocs(collection(db, "matches", currentMatch.id, "predictions"));
      await Promise.all(predictionSnap.docs.map(predDoc =>
        deleteDoc(doc(db, "matches", currentMatch.id, "predictions", predDoc.id))
      ));
      await deleteDoc(doc(db, "matches", currentMatch.id));
    }

    // Restore matches and predictions.
    for (const match of backup.matches) {
      const { id, ...matchData } = match;
      if (!id) continue;

      await setDoc(doc(db, "matches", id), {
        ...matchData,
        restoredAt: serverTimestamp()
      }, { merge: false });

      const predictions = backup.predictionsByMatch?.[id] || {};
      for (const [predictionId, predictionData] of Object.entries(predictions)) {
        const { id: ignoredPredictionId, ...cleanPredictionData } = predictionData || {};
        await setDoc(doc(db, "matches", id, "predictions", predictionId), cleanPredictionData, { merge: false });
      }
    }

    setCloudStatus("Backup imported", "online");
    alert("Backup imported successfully.");
  } catch (error) {
    console.error("Import failed:", error);
    setCloudStatus("Import failed", "offline");
    alert(`Import failed: ${error.message || "Unknown error"}`);
  } finally {
    const input = document.getElementById("importBackupFile");
    if (input) input.value = "";
  }
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
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

document.getElementById("lfcMatchForm").addEventListener("submit", async event => {
  event.preventDefault();

  const opponent = getSmartPickerValue("lfcOpponentPicker");
  const date = document.getElementById("lfcDateInput").value || todayDateString();
  const isAway = document.getElementById("lfcAwayInput")?.checked === true;

  if (!opponent) {
    alert("Please choose an opponent from the saved opponent list. Use Manage opponents if you need to add a new team.");
    return;
  }

  try {
    await createLfcMatch(opponent, date, isAway);
    event.target.reset();
    const awayInput = document.getElementById("lfcAwayInput");
    if (awayInput) awayInput.checked = false;
    setDefaultMatchDates();
    clearSmartPicker("lfcOpponentPicker");
    setCloudStatus("Match event created", "online");
  } catch (error) {
    console.error("Create Liverpool match failed:", error);
    alert(`Could not create match: ${error.message || "Unknown error"}`);
  }
});

document.getElementById("otherMatchForm").addEventListener("submit", async event => {
  event.preventDefault();

  const home = getSmartPickerValue("otherHomePicker");
  const away = getSmartPickerValue("otherAwayPicker");
  const date = document.getElementById("otherDateInput").value || todayDateString();

  if (!home || !away) {
    alert("Please choose both teams from the saved team list. Use Manage teams if you need to add a new team.");
    return;
  }

  if (home === away) {
    alert("Choose two different teams.");
    return;
  }

  try {
    await createOtherMatch(home, away, date);
    event.target.reset();
    setDefaultMatchDates();
    clearSmartPicker("otherHomePicker");
    clearSmartPicker("otherAwayPicker");
    setCloudStatus("Other match event created", "online");
  } catch (error) {
    console.error("Create other match failed:", error);
    alert(`Could not create other match: ${error.message || "Unknown error"}`);
  }
});

document.getElementById("toggleOpponentManagerBtn")?.addEventListener("click", () => {
  const content = document.getElementById("opponentManager");
  const btn = document.getElementById("toggleOpponentManagerBtn");
  if (!content || !btn) return;

  const collapsed = content.classList.toggle("collapsed");
  btn.textContent = collapsed ? "Manage opponents" : "Hide opponent manager";
});

document.getElementById("opponentSearchInput")?.addEventListener("input", renderOpponentManager);

document.getElementById("addOpponentBtn").addEventListener("click", async () => {
  const name = normaliseName(document.getElementById("newOpponentInput").value);
  const code = normaliseName(document.getElementById("newOpponentCodeInput").value || name.slice(0,3)).toUpperCase();
  if (!name) return;
  if (configState.opponents.some(o => o.name.toLowerCase() === name.toLowerCase())) {
    alert("Opponent already exists.");
    return;
  }
  configState.opponents.push({ id: cryptoId(), name, code });
  await saveConfig({ opponents: configState.opponents });
  document.getElementById("newOpponentInput").value = "";
  document.getElementById("newOpponentCodeInput").value = "";
});

document.getElementById("playerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = normaliseName(document.getElementById("playerName").value);
  const points = Number(document.getElementById("playerTier").value);
  if (!name) return;
  configState.players.push({ id: cryptoId(), name, points });
  await saveConfig({ players: configState.players });
  event.target.reset();
});

document.getElementById("toggleOtherTeamsBtn")?.addEventListener("click", () => {
  const content = document.getElementById("otherTeamsManager");
  const btn = document.getElementById("toggleOtherTeamsBtn");
  if (!content || !btn) return;

  const collapsed = content.classList.toggle("collapsed");
  btn.textContent = collapsed ? "Open team manager" : "Hide team manager";
});

document.getElementById("otherTeamSearchInput")?.addEventListener("input", renderOtherTeamList);

document.getElementById("addOtherTeamBtn")?.addEventListener("click", async () => {
  const name = normaliseName(document.getElementById("newOtherTeamInput").value);
  const code = normaliseName(document.getElementById("newOtherTeamCodeInput").value || name.slice(0,3)).toUpperCase();

  if (!name) return;

  configState.otherTeams = configState.otherTeams || [];
  if (configState.otherTeams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
    alert("Team already exists.");
    return;
  }

  configState.otherTeams.push({ id: cryptoId(), name, code });
  await saveConfig({ otherTeams: configState.otherTeams });

  document.getElementById("newOtherTeamInput").value = "";
  document.getElementById("newOtherTeamCodeInput").value = "";
});

document.getElementById("toggleOtherPlayersBtn")?.addEventListener("click", () => {
  const content = document.getElementById("otherPlayersManager");
  const btn = document.getElementById("toggleOtherPlayersBtn");
  if (!content || !btn) return;

  const collapsed = content.classList.toggle("collapsed");
  btn.textContent = collapsed ? "Open player tiers" : "Hide player tiers";
});

document.getElementById("otherPlayerForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  const name = normaliseName(document.getElementById("otherPlayerName").value);
  const points = Number(document.getElementById("otherPlayerTier").value);
  if (!name) return;

  configState.otherPlayers = configState.otherPlayers || [];
  configState.otherPlayers.push({ id: cryptoId(), name, points });
  await saveConfig({ otherPlayers: configState.otherPlayers });
  event.target.reset();
});

document.getElementById("seasonForm").addEventListener("submit", async event => {
  event.preventDefault();
  const name = normaliseName(document.getElementById("seasonNameInput").value);
  if (!name) return;
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (configState.seasons.some(s => s.id === id)) {
    alert("That season already exists.");
    return;
  }
  configState.seasons.push({ id, name });
  await saveConfig({ seasons: configState.seasons, activeSeasonId: id });
  event.target.reset();
});

document.addEventListener("click", async event => {
  const saveBtn = event.target.closest(".save-prediction-btn");
  if (!saveBtn) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const card = saveBtn.closest(".match-card");
  if (!card) {
    alert("Could not find match card.");
    return;
  }

  const matchId = card.dataset.matchId;
  const statusBox = card.querySelector(".saved-status");

  const scoreHomeInput = card.querySelector('[data-own="scoreHome"]');
  const scoreAwayInput = card.querySelector('[data-own="scoreAway"]');
  const scorer0 = card.querySelector('[data-own="scorer0"]');
  const scorer1 = card.querySelector('[data-own="scorer1"]');
  const scorer2 = card.querySelector('[data-own="scorer2"]');

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";
  if (statusBox) {
    statusBox.textContent = "Saving prediction to cloud...";
    statusBox.classList.remove("not-submitted");
    statusBox.classList.add("submitted");
  }

  try {
    await savePrediction(matchId, {
      scoreHome: scoreHomeInput?.value ?? "",
      scoreAway: scoreAwayInput?.value ?? "",
      scorers: [
        scorer0?.value ?? "",
        scorer1?.value ?? "",
        scorer2?.value ?? ""
      ]
    });

    clearPredictionDraft(matchId);

    if (statusBox) {
      statusBox.textContent = "Your prediction is saved to the cloud. You can still edit until reveal.";
      statusBox.classList.add("submitted");
      statusBox.classList.remove("not-submitted");
    }

    saveBtn.textContent = "Saved ✓";
    setTimeout(() => {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save my prediction";
    }, 1000);
  } catch (error) {
    console.error("Global save handler failed:", error);
    if (statusBox) {
      statusBox.textContent = `Save failed: ${error.message || "Unknown error"}`;
      statusBox.classList.remove("submitted");
      statusBox.classList.add("not-submitted");
    }
    saveBtn.disabled = false;
    saveBtn.textContent = "Save my prediction";
    setCloudStatus("Save failed", "offline");
    alert(`Save failed: ${error.message || "Unknown error"}`);
  }
}, true);


document.addEventListener("click", async event => {
  const revealBtn = event.target.closest(".reveal-btn");
  if (!revealBtn) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  const card = revealBtn.closest(".match-card");
  if (!card) {
    alert("Could not find match card.");
    return;
  }

  const matchId = card.dataset.matchId;
  const actualHome = card.querySelector('[data-actual="actualHome"]')?.value ?? "";
  const actualAway = card.querySelector('[data-actual="actualAway"]')?.value ?? "";

  if (String(actualHome).trim() === "" || String(actualAway).trim() === "") {
    alert("Please enter end result.");
    return;
  }

  revealBtn.disabled = true;
  revealBtn.textContent = "Revealing...";
  setCloudStatus("Revealing prediction...", "online");

  try {
    await revealAndCalculate(matchId, {
      actualHome,
      actualAway,
      actualScorers: getActualScorersFromNode(card)
    });

    clearPredictionDraft(matchId);
    clearActualDraft(matchId);
    revealBtn.textContent = "Revealed ✓";
    setCloudStatus("Prediction revealed and scores updated", "online");
  } catch (error) {
    console.error("Reveal failed:", error);
    setCloudStatus("Reveal failed", "offline");
    alert(`Reveal failed: ${error.message || "Unknown error"}`);
    revealBtn.disabled = false;
    revealBtn.textContent = "Reveal Prediction";
  }
}, true);


document.getElementById("exportBtn").addEventListener("click", exportBackup);
document.getElementById("importBackupFile")?.addEventListener("change", event => {
  importBackupFile(event.target.files?.[0]);
});

document.getElementById("closeSummaryBtn")?.addEventListener("click", closeRoundSummary);
document.getElementById("roundSummaryModal")?.addEventListener("click", event => {
  if (event.target.id === "roundSummaryModal") closeRoundSummary();
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeRoundSummary();
});


document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("emailInput").value.trim().toLowerCase();
  const password = document.getElementById("passwordInput").value;
  try {
    setCloudStatus("Signing in...");
    await signInWithEmailAndPassword(auth, email, password);
    event.target.reset();
  } catch (error) {
    console.error(error);
    setCloudStatus("Sign-in failed", "offline");
    alert("Could not sign in. Check email/password and Firebase Authentication setup.");
  }
});

document.getElementById("signOutBtn").addEventListener("click", async () => {
  if (auth) await signOut(auth);
});

async function boot() {
  setHeaderLoggedIn(false);
  if (!hasFirebaseConfig()) {
    setCloudStatus("Firebase config needed", "offline");
    return;
  }

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);

  onAuthStateChanged(auth, async user => {
    currentUser = user;
    currentProfile = null;

    if (!user) {
      if (unsubscribeConfig) unsubscribeConfig();
      if (unsubscribeMatches) unsubscribeMatches();
      predictionUnsubs.forEach(unsub => unsub());
      showApp(false);
      setHeaderLoggedIn(false);
      setAccountBadge("Signed out");
      setCloudStatus("Signed out", "offline");
      return;
    }

    currentProfile = USER_PROFILES_BY_UID[user.uid];

    if (!currentProfile) {
      showApp(false);
      setHeaderLoggedIn(false);
      setAccountBadge("Not allowed");
      setCloudStatus("Signed in, but not allowed", "offline");
      alert("This Firebase user UID is not listed in USER_PROFILES_BY_UID inside firebase-config.js.");
      return;
    }

    showApp(true);
    setHeaderLoggedIn(true);
    setAccountBadge(`Logged in as ${currentProfile.name}`);
    setCloudStatus("Live cloud sync", "online");
    await initialiseCloud();
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
    } catch (error) {
      console.warn("Could not clear old service worker cache:", error);
    }
  });
}

boot();
