import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

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
const auth = getAuth(app);

async function check() {
    await signInWithEmailAndPassword(auth, "fmj@fairplay142.com", "vpvmf142^^");
    console.log("Fetching notifications...");
    const q = query(
        collection(db, 'notifications'),
        where('to_user_id', '==', auth.currentUser.uid),
        orderBy('created_at', 'desc'),
        limit(5)
    );
    const snap = await getDocs(q);
    snap.docs.forEach(doc => {
        console.log(doc.id, "=>", doc.data());
    });
    process.exit(0);
}

check().catch(console.error);
