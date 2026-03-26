import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyAxQ4Zp_OnKBjHPT-JoU1x54yjC_zJUYG0",
    authDomain: "alba-3b27d.firebaseapp.com",
    projectId: "alba-3b27d",
    storageBucket: "alba-3b27d.firebasestorage.app",
    messagingSenderId: "56462459100",
    appId: "1:56462459100:web:a9a0b51732ff86e0fb3419"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function testNotification() {
    try {
        console.log("Logging in as 김지연...");
        const userCred = await signInWithEmailAndPassword(auth, "drtrtdes12@fairplay142.com", "123456");
        console.log("Logged in successfully:", userCred.user.uid);

        console.log("Adding test notification...");
        const docRef = await addDoc(collection(db, "notifications"), {
            to_user_id: "test_admin", // 테스트용 수신자
            type: "LEAVE_SUBMITTED",
            data: { user_name: "김지연", type: "FULL", date: "2026-03-20" },
            is_read: false,
            created_at: new Date().toISOString()
        });

        console.log("Notification created successfully with ID:", docRef.id);
        console.log("TEST PASSED!");
    } catch (error) {
        console.error("TEST FAILED:", error.message);
    }
    process.exit(0);
}

testNotification();
