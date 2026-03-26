import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";

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

async function run() {
    try {
        console.log("Logging in as 권신우 (Admin)...");
        // 권신우 아이디가 뭔지 모르겠음...
        // initialUsers.js 에서 확인: 권신우 email 은 shinw0o@naver.com
        const userCred = await signInWithEmailAndPassword(auth, "shinw0o@naver.com", "123456");
        console.log("Logged in successfully:", userCred.user.uid);

        console.log("Querying notifications...");
        const q = query(
            collection(db, "notifications"),
            where("to_user_id", "==", userCred.user.uid),
            // orderBy("created_at", "desc"),
            limit(10)
        );
        const snap = await getDocs(q);
        snap.forEach(d => console.log(d.id, d.data()));
        console.log("Done.");
    } catch (error) {
        console.error("TEST FAILED:", error.message);
    }
    process.exit(0);
}

run();
