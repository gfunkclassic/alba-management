import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAxQ4Zp_OnKBjHPT-JoU1x54yjC_zJUYG0",
    authDomain: "alba-3b27d.firebaseapp.com",
    projectId: "alba-3b27d",
    storageBucket: "alba-3b27d.firebasestorage.app",
    messagingSenderId: "56462459100",
    appId: "1:56462459100:web:a9a0b51732ff86e0fb3419"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUsers() {
    console.log("Fetching users...");
    const snap = await getDocs(collection(db, "users"));
    snap.forEach(doc => {
        const data = doc.data();
        console.log(`User: ${data.name}, Email: ${data.email}, Role: ${data.role}, Team: ${data.team_id}`);
    });

    console.log("\nFetching notifications...");
    const notifSnap = await getDocs(collection(db, "notifications"));
    notifSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Notif to: ${data.to_user_id}, Type: ${data.type}, Data:`, data.data || data.payload);
    });
    process.exit(0);
}

checkUsers().catch(console.error);
