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

const defaultConfig = () => ({
  activeSeasonId: DEFAULT_SEASON_ID,
  seasons: [{ id: DEFAULT_SEASON_ID, name: DEFAULT_SEASON_ID }],
  players: DEFAULT_PLAYERS,
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

function normaliseName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function parseScorers(value) {
  if (Array.isArray(value)) return value.map(normaliseName).filter(Boolean).slice(0, 3);
  return String(value || "").split(",").map(normaliseName).filter(Boolean).slice(0, 3);
}

function getPlayerPoints(playerName, gameType) {
  if (gameType === "other") return 1;
  const clean = normaliseName(playerName).toLowerCase();
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
      configState = { ...defaultConfig(), ...snap.data() };
      render();
    }
  });

  unsubscribeMatches = onSnapshot(collection(db, "matches"), snapshot => {
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
  if (!currentProfile) return;
  const match = matches.find(m => m.id === matchId);
  if (!match || match.revealed) {
    alert("This match has already been revealed, so predictions are locked.");
    return;
  }

  const scoreHome = String(data.scoreHome ?? "").trim();
  const scoreAway = String(data.scoreAway ?? "").trim();

  if (scoreHome === "" || scoreAway === "") {
    alert("Add your predicted score before saving.");
    return;
  }

  await setDoc(doc(db, "matches", matchId, "predictions", currentProfile.key), {
    ownerKey: currentProfile.key,
    ownerName: currentProfile.name,
    scoreHome,
    scoreAway,
    scorers: parseScorers(data.scorers),
    submittedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(doc(db, "matches", matchId), {
    submitted: {
      [currentProfile.key]: true
    },
    updatedAt: serverTimestamp()
  }, { merge: true });

  setCloudStatus("Prediction saved to cloud", "online");
  alert("Prediction saved.");
}

async function createLfcMatch(opponent, date) {
  const team = configState.opponents.find(t => t.name === opponent);
  await addDoc(collection(db, "matches"), {
    gameType: "lfc",
    seasonId: configState.activeSeasonId,
    home: "Liverpool",
    away: opponent,
    opponent,
    opponentCode: team?.code || opponent.slice(0, 3).toUpperCase(),
    date,
    actualHome: "",
    actualAway: "",
    actualScorers: [],
    revealed: false,
    calculated: false,
    discordPosted: false,
    submitted: { dany: false, isa: false },
    createdAt: serverTimestamp()
  });
}

async function createOtherMatch(home, away, date) {
  await addDoc(collection(db, "matches"), {
    gameType: "other",
    seasonId: configState.activeSeasonId,
    home: normaliseName(home),
    away: normaliseName(away),
    opponent: normaliseName(away),
    opponentCode: normaliseName(away).slice(0, 3).toUpperCase(),
    date,
    actualHome: "",
    actualAway: "",
    actualScorers: [],
    revealed: false,
    calculated: false,
    discordPosted: false,
    submitted: { dany: false, isa: false },
    createdAt: serverTimestamp()
  });
}

async function revealAndCalculate(matchId, actualData) {
  const match = matches.find(m => m.id === matchId);
  if (!match) return;

  if (actualData.actualHome === "" || actualData.actualAway === "") {
    alert("Enter the actual score before revealing.");
    return;
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
  predictionsByMatch[matchId] = {};
  predictionSnap.docs.forEach(d => {
    predictionsByMatch[matchId][d.id] = { id: d.id, ...d.data() };
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

  setCloudStatus("Revealed and calculated", "online");
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

async function deleteMatch(matchId) {
  if (!confirm("Delete this match?")) return;
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

function renderOpponentSelect() {
  const select = document.getElementById("lfcOpponentSelect");
  const selected = select.value;
  select.innerHTML = `<option value="">Choose opponent</option>`;
  [...configState.opponents].sort((a,b) => a.name.localeCompare(b.name)).forEach(team => {
    const option = document.createElement("option");
    option.value = team.name;
    option.textContent = team.name;
    select.appendChild(option);
  });
  select.value = selected;
}

function setupScorerPickers(node, match, existingScorers = []) {
  const scorerFields = [
    node.querySelector('[data-own="scorer0"]'),
    node.querySelector('[data-own="scorer1"]'),
    node.querySelector('[data-own="scorer2"]')
  ];

  if (match.gameType !== "lfc") {
    scorerFields.forEach((field, index) => {
      if (field) field.value = existingScorers[index] || "";
    });
    return;
  }

  const players = [...configState.players].sort((a, b) => a.name.localeCompare(b.name));

  scorerFields.forEach((field, index) => {
    if (!field) return;

    const select = document.createElement("select");
    select.dataset.own = field.dataset.own;
    select.innerHTML = `<option value="">No scorer selected</option>` + players.map(player => {
      const points = Number(player.points);
      const label = `${escapeHtml(player.name)} (${points} pt${points === 1 ? "" : "s"})`;
      return `<option value="${escapeHtml(player.name)}">${label}</option>`;
    }).join("");

    select.value = existingScorers[index] || "";
    field.replaceWith(select);
  });
}

function setupActualScorerPicker(node, match, existingActualScorers = []) {
  const actualField = node.querySelector('[data-actual="actualScorers"]');
  if (!actualField) return;

  if (match.gameType !== "lfc") {
    actualField.value = parseScorers(existingActualScorers).join(", ");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "actual-scorer-dropdowns";
  wrapper.dataset.actual = "actualScorersGroup";

  const players = [...configState.players].sort((a, b) => a.name.localeCompare(b.name));
  const optionHtml = `<option value="">No scorer selected</option>` + players.map(player => {
    return `<option value="${escapeHtml(player.name)}">${escapeHtml(player.name)}</option>`;
  }).join("");

  for (let i = 0; i < 6; i++) {
    const select = document.createElement("select");
    select.dataset.actualScorerIndex = String(i);
    select.innerHTML = optionHtml;
    select.value = existingActualScorers[i] || "";
    wrapper.appendChild(select);
  }

  actualField.replaceWith(wrapper);
}

function getActualScorersFromNode(node) {
  const group = node.querySelector('[data-actual="actualScorersGroup"]');
  if (group) {
    return Array.from(group.querySelectorAll("select"))
      .map(select => select.value)
      .filter(Boolean);
  }

  const textArea = node.querySelector('[data-actual="actualScorers"]');
  return textArea ? textArea.value : "";
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
    <div class="team"><div class="badge opponent-badge">${escapeHtml(match.home.slice(0,3).toUpperCase())}</div><strong>${escapeHtml(match.home)}</strong></div>
    <span class="versus">vs</span>
    <div class="team"><div class="badge opponent-badge">${escapeHtml(match.away.slice(0,3).toUpperCase())}</div><strong>${escapeHtml(match.away)}</strong></div>
  `;
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
    node.querySelector(".fixture").innerHTML = fixtureHtml(match);
    node.querySelector(".match-meta").textContent = match.date || "No date set";

    const otherKey = currentProfile.key === "dany" ? "isa" : "dany";
    const otherName = otherKey === "dany" ? "Dany" : "Isa";
    const myPred = getPred(match.id, currentProfile.key);
    const otherPred = getPred(match.id, otherKey);
    const mySubmitted = !!match.submitted?.[currentProfile.key] || !!myPred;
    const otherSubmitted = !!match.submitted?.[otherKey];

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
    saved.textContent = mySubmitted
      ? "Your prediction is saved to the cloud. You can still edit until reveal."
      : "No prediction saved yet.";

    const existingMyScorers = myPred ? parseScorers(myPred.scorers) : [];
    if (myPred && !match.revealed) {
      node.querySelector('[data-own="scoreHome"]').value = myPred.scoreHome ?? "";
      node.querySelector('[data-own="scoreAway"]').value = myPred.scoreAway ?? "";
    }
    setupScorerPickers(node, match, existingMyScorers);

    node.querySelector('[data-actual="actualHome"]').value = match.actualHome ?? "";
    node.querySelector('[data-actual="actualAway"]').value = match.actualAway ?? "";
    setupActualScorerPicker(node, match, parseScorers(match.actualScorers));

    if (match.revealed) {
      root.classList.add("is-revealed");
      node.querySelector(".flip-card").classList.add("revealed");
      node.querySelector(".own-revealed").innerHTML = `<h3>Your revealed prediction</h3>${predictionHtml(myPred, match)}`;
      node.querySelector(".opponent-prediction-view").innerHTML = predictionHtml(otherPred, match);
    }

    node.querySelector(".save-prediction-btn")?.addEventListener("click", async () => {
      const scorers = [
        node.querySelector('[data-own="scorer0"]').value,
        node.querySelector('[data-own="scorer1"]').value,
        node.querySelector('[data-own="scorer2"]').value
      ];
      await savePrediction(match.id, {
        scoreHome: node.querySelector('[data-own="scoreHome"]').value,
        scoreAway: node.querySelector('[data-own="scoreAway"]').value,
        scorers
      });
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
      <div>
        <strong>${escapeHtml(match.home)} ${escapeHtml(match.actualHome)}-${escapeHtml(match.actualAway)} ${escapeHtml(match.away)}</strong>
        <div class="muted">${escapeHtml(match.seasonId)} • ${match.gameType === "lfc" ? "Liverpool" : "Other"} • Round winner: ${escapeHtml(match.summary?.roundWinner || "-")}</div>
        <div class="muted">Dany: ${escapeHtml((match.summary?.danyBreakdown || []).join(", ") || "0")} | Isa: ${escapeHtml((match.summary?.isaBreakdown || []).join(", ") || "0")}</div>
      </div>
      <div>
        <span class="pill">Dany ${match.summary?.danyPoints || 0}</span>
        <span class="pill">Isa ${match.summary?.isaPoints || 0}</span>
      </div>
    `;
    history.appendChild(item);
  });
}

function render() {
  if (!currentProfile) return;
  renderScoreboard();
  renderOpponentSelect();
  renderMatchList("lfcMatches", "lfc");
  renderMatchList("otherMatches", "other");
  renderPlayers();
  renderSeasons();
  renderHistory();
}

function exportBackup() {
  const blob = new Blob([JSON.stringify({ configState, matches, predictionsByMatch }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `prediction-league-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
  await createLfcMatch(document.getElementById("lfcOpponentSelect").value, document.getElementById("lfcDateInput").value);
  event.target.reset();
});

document.getElementById("otherMatchForm").addEventListener("submit", async event => {
  event.preventDefault();
  await createOtherMatch(
    document.getElementById("otherHomeInput").value,
    document.getElementById("otherAwayInput").value,
    document.getElementById("otherDateInput").value
  );
  event.target.reset();
});

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

document.getElementById("exportBtn").addEventListener("click", exportBackup);

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
      setAccountBadge("Signed out");
      setCloudStatus("Signed out", "offline");
      return;
    }

    currentProfile = USER_PROFILES_BY_UID[user.uid];

    if (!currentProfile) {
      showApp(false);
      setAccountBadge("Not allowed");
      setCloudStatus("Signed in, but not allowed", "offline");
      alert("This Firebase user UID is not listed in USER_PROFILES_BY_UID inside firebase-config.js.");
      return;
    }

    showApp(true);
    setAccountBadge(`Logged in as ${currentProfile.name}`);
    setCloudStatus("Live cloud sync", "online");
    await initialiseCloud();
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

boot();
