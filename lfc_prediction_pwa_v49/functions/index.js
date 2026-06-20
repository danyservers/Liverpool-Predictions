const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const DISCORD_WEBHOOK_URL = defineSecret("DISCORD_WEBHOOK_URL");

const ALLOWED_UIDS = [
  "ZW3ol5Ldb9QZmj6yoaqsJRPrJzq1",
  "uST7bYIkuVZR3L5quFBcpEyE7XH3"
];

exports.postMatchSummary = onCall({ secrets: [DISCORD_WEBHOOK_URL] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid || !ALLOWED_UIDS.includes(uid)) {
    throw new HttpsError("permission-denied", "Not allowed.");
  }

  const { matchId } = request.data || {};
  if (!matchId) {
    throw new HttpsError("invalid-argument", "Missing matchId.");
  }

  const db = admin.firestore();
  const matchRef = db.collection("matches").doc(matchId);
  const matchSnap = await matchRef.get();

  if (!matchSnap.exists) {
    throw new HttpsError("not-found", "Match not found.");
  }

  const match = matchSnap.data();

  if (!match.calculated || !match.revealed || !match.summary) {
    throw new HttpsError("failed-precondition", "Match must be revealed and calculated first.");
  }

  if (match.discordPosted) {
    return { ok: true, skipped: true, reason: "Already posted." };
  }

  const title = match.gameType === "lfc"
    ? "🔴 Liverpool Prediction League"
    : "🌍 Other Match Prediction League";

  const fixture = `${match.home} ${match.actualHome}-${match.actualAway} ${match.away}`;
  const s = match.summary;

  const content = [
    `**${title}**`,
    ``,
    `**${fixture}**`,
    ``,
    `Dany: **${s.danyPoints} pts**`,
    `Isa: **${s.isaPoints} pts**`,
    ``,
    `Round winner: **${s.roundWinner}**`,
    `Season leader: **${s.seasonLeader}**`,
    `Overall leader: **${s.overallLeader}**`,
    ``,
    `Dany picks: ${s.danyBreakdown?.join(", ") || "0"}`,
    `Isa picks: ${s.isaBreakdown?.join(", ") || "0"}`
  ].join("\n");

  const response = await fetch(DISCORD_WEBHOOK_URL.value(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    throw new HttpsError("internal", `Discord failed with status ${response.status}`);
  }

  await matchRef.update({
    discordPosted: true,
    discordPostedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ok: true };
});
