import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyAxQ4Zp_OnKBjHPT-JoU1x54yjC_zJUYG0",
    authDomain: "alba-3b27d.firebaseapp.com",
    projectId: "alba-3b27d",
    storageBucket: "alba-3b27d.firebasestorage.app",
    messagingSenderId: "56462459100",
    appId: "1:56462459100:web:a9a0b51732ff86e0fb3419"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

// 팀 상수
export const TEAMS = ['카페', '생산기획', 'QC', 'ER', 'LM'];

// 역할 상수
export const ROLES = {
    ALBA: 'ALBA',
    TEAM_APPROVER: 'TEAM_APPROVER',
    FINAL_APPROVER: 'FINAL_APPROVER',
};

export const ROLE_LABELS = {
    ALBA: '아르바이트',
    TEAM_APPROVER: '팀 관리자',
    FINAL_APPROVER: '최종 관리자',
};
