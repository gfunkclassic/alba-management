import fs from 'fs';

const authRouting = `

// ── 최상위 앱 — Auth 라우팅 ───────────────────────────────
export default function App() {
    const { currentUser, userProfile, loading } = useAuth();
    const [showHRSystem, setShowHRSystem] = React.useState(false);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#5d6c4a] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-[#5d6c4a] font-bold text-sm">로딩 중...</p>
                </div>
            </div>
        );
    }

    if (!currentUser || !userProfile) return <LoginPage />;
    if (userProfile.is_temp_password) return <ChangePasswordPage />;

    const { role } = userProfile;
    if (role === 'FINAL_APPROVER') {
        return showHRSystem
            ? <HRPayrollApp />
            : <FinalApproverView onSwitchToHRSystem={() => setShowHRSystem(true)} />;
    }
    if (role === 'TEAM_APPROVER') return <TeamApproverView />;
    if (role === 'ALBA') return <AlbaView />;

    return (
        <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center">
            <p className="text-[#a65d57] font-bold">알 수 없는 역할: {role}</p>
        </div>
    );
}
`;

fs.appendFileSync('src/App.jsx', authRouting, 'utf8');
console.log('Done: Auth routing appended to App.jsx');
