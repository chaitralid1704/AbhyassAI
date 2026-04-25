import { getApp, getApps, initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore"; // ✅ use this ONLY

const firebaseConfig = {
  apiKey: "AIzaSyBnqMHXqfbsD9RccPVo64THt0sQZ4Kssvc",
  authDomain: "abhyass-ai.firebaseapp.com",
  projectId: "abhyass-ai",
  storageBucket: "abhyass-ai.firebasestorage.app",
  messagingSenderId: "783436042741",
  appId: "1:783436042741:web:a5885501fd7c2915add0bc",
  measurementId: "G-CVVT0NNW9J"
};

// ✅ Initialize Firebase ONLY ONCE
console.log("--- FIREBASE CONFIG LOADED ---", firebaseConfig.projectId);
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Analytics (only in browser)
let analytics;
if (typeof window !== "undefined") {
  analytics = getAnalytics(app);
}

// ✅ Auth
const auth = getAuth(app);

// ✅ Firestore FIX (IMPORTANT)
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false, // extra stability
});

export { app, auth, db, analytics };