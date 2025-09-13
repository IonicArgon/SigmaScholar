import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDNVjz3qU2I7TWkJiLMkFLmMHSddT-XH7k",
  authDomain: "sigma-scholar.firebaseapp.com",
  projectId: "sigma-scholar",
  storageBucket: "sigma-scholar.firebasestorage.app",
  messagingSenderId: "568258362201",
  appId: "1:568258362201:web:e621812191d667bc356a48"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
