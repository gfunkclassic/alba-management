import React, { useState } from 'react';
import { KeyRound, AlertCircle, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function ChangePasswordPage() {
    const { changePassword, userProfile, logout } = useAuth();
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const validate = () => {
        if (newPw.length < 6) return '새 비밀번호는 6자 이상이어야 합니다.';
        if (newPw === '123456') return '초기 비밀번호와 동일한 비밀번호는 사용할 수 없습니다.';
        if (newPw !== confirmPw) return '새 비밀번호가 일치하지 않습니다.';
        return '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationError = validate();
        if (validationError) { setError(validationError); return; }
        setError('');
        setLoading(true);
        try {
            await changePassword(currentPw, newPw);
        } catch (err) {
            if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                setError('현재 비밀번호가 올바르지 않습니다.');
            } else if (err.code === 'auth/weak-password') {
                setError('새 비밀번호가 너무 약합니다. 더 강한 비밀번호를 사용하세요.');
            } else {
                setError('비밀번호 변경 중 오류가 발생했습니다: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const pwStrength = () => {
        if (!newPw) return { level: 0, label: '', color: '' };
        if (newPw.length < 6) return { level: 1, label: '너무 짧음', color: 'bg-[#a65d57]' };
        if (/^[0-9]+$/.test(newPw) || /^[a-z]+$/.test(newPw)) return { level: 2, label: '약함', color: 'bg-[#d8973c]' };
        if (newPw.length >= 8 && /[A-Z]/.test(newPw) && /[^A-Za-z0-9]/.test(newPw)) return { level: 4, label: '강함', color: 'bg-[#5d6c4a]' };
        return { level: 3, label: '보통', color: 'bg-[#4a6070]' };
    };
    const strength = pwStrength();

    return (
        <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* 안내 배너 */}
                <div className="bg-[#d8973c] border-2 border-[#b87a2c] p-4 mb-6 flex items-start gap-3">
                    <AlertCircle size={18} className="text-white shrink-0 mt-0.5" />
                    <div>
                        <p className="text-white font-bold text-sm">비밀번호 변경 필요</p>
                        <p className="text-white/90 text-xs mt-0.5">초기 비밀번호를 사용 중입니다. 변경 전까지 시스템 접근이 제한됩니다.</p>
                    </div>
                </div>

                <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-8 shadow-lg">
                    <div className="flex items-center gap-2 mb-6">
                        <KeyRound size={20} className="text-[#5d6c4a]" />
                        <h2 className="text-lg font-black text-[#3d472f]">비밀번호 변경</h2>
                    </div>
                    <p className="text-xs text-[#7a7565] mb-5">
                        <span className="font-bold text-[#5d6c4a]">{userProfile?.name}</span>님 ({userProfile?.email})
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 현재 비밀번호 */}
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5">현재 비밀번호</label>
                            <div className="relative">
                                <input
                                    type={showCurrent ? 'text' : 'password'}
                                    value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                                    placeholder="12345 (초기 비밀번호)" required
                                    className="w-full px-3 py-2.5 pr-10 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none"
                                />
                                <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9585]">
                                    {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                        </div>

                        {/* 새 비밀번호 */}
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5">새 비밀번호</label>
                            <div className="relative">
                                <input
                                    type={showNew ? 'text' : 'password'}
                                    value={newPw} onChange={e => setNewPw(e.target.value)}
                                    placeholder="6자 이상" required
                                    className="w-full px-3 py-2.5 pr-10 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none"
                                />
                                <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9585]">
                                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                            </div>
                            {/* 비밀번호 강도 바 */}
                            {newPw && (
                                <div className="mt-1.5 flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-[#e8e4d4] rounded">
                                        <div className={`h-1 rounded transition-all ${strength.color}`} style={{ width: `${strength.level * 25}%` }} />
                                    </div>
                                    <span className="text-[10px] font-bold text-[#7a7565]">{strength.label}</span>
                                </div>
                            )}
                        </div>

                        {/* 비밀번호 확인 */}
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5">새 비밀번호 확인</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                                    placeholder="비밀번호 재입력" required
                                    className="w-full px-3 py-2.5 pr-10 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none"
                                />
                                {confirmPw && newPw === confirmPw && (
                                    <CheckCircle size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5d6c4a]" />
                                )}
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 bg-[#f8f0ef] border border-[#dcc0bc] p-3">
                                <AlertCircle size={14} className="text-[#a65d57] mt-0.5 shrink-0" />
                                <p className="text-[#a65d57] text-xs font-bold">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit" disabled={loading}
                            className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-3 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-[#f5f3e8] border-t-transparent rounded-full animate-spin" /> : <><KeyRound size={16} /> 비밀번호 변경</>}
                        </button>
                    </form>
                </div>

                <button onClick={logout} className="w-full mt-3 text-xs text-[#9a9585] hover:text-[#7a7565] text-center">
                    로그아웃
                </button>
            </div>
        </div>
    );
}
