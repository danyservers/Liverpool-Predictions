// Firebase config for your project.
// IMPORTANT: Change both emails below to the exact Firebase Authentication emails
// you create for Dany and Isa.

export const firebaseConfig = {
  apiKey: "AIzaSyA1lXwSOmMBWWoyhBHRjuJ0bQTaO7385Zc",
  authDomain: "liverpool-prediction.firebaseapp.com",
  projectId: "liverpool-prediction",
  storageBucket: "liverpool-prediction.firebasestorage.app",
  messagingSenderId: "751064521572",
  appId: "1:751064521572:web:0e432c7a9bcbf3fb297871"
};

// Safer user mapping:
// Use Firebase Authentication UID values, not emails.
// Firebase Console → Authentication → Users → click user → copy User UID.
//
// Replace these placeholders with the two Firebase user UIDs.
export const USER_PROFILES_BY_UID = {
  "ZW3ol5Ldb9QZmj6yoaqsJRPrJzq1": {
    key: "dany",
    name: "Dany"
  },
  "uST7bYIkuVZR3L5quFBcpEyE7XH3": {
    key: "isa",
    name: "Isa"
  }
};

export const ALLOWED_UIDS = [
  "ZW3ol5Ldb9QZmj6yoaqsJRPrJzq1",
  "uST7bYIkuVZR3L5quFBcpEyE7XH3"
];

export const DEFAULT_SEASON_ID = "2025-26";
