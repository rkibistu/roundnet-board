import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBk1qSRzrELZ6NE1chg80oJVMm5l2K_8bA",
  authDomain: "roundnet-board.firebaseapp.com",
  databaseURL: "https://roundnet-board-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "roundnet-board",
  storageBucket: "roundnet-board.firebasestorage.app",
  messagingSenderId: "338294859185",
  appId: "1:338294859185:web:c931c7333a0e4f59190990"
};

const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);