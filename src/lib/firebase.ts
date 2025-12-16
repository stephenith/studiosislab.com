import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBCyysoV8aLwsIxUhoimjxnl3LD7Z8yzVs",
  authDomain: "studiosislab.firebaseapp.com",
  projectId: "studiosislab",
  storageBucket: "studiosislab.firebasestorage.app",
  messagingSenderId: "412505896748",
  appId: "1:412505896748:web:269a2cec85ac9db3699e89",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);