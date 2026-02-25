import React, { useState } from 'react';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
        } catch (err) {
            if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
                setError('이메일 또는 비밀번호가 올바르지 않습니다.');
            } else if (err.code === 'auth/too-many-requests') {
                setError('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
            } else {
                setError('로그인 중 오류가 발생했습니다: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* 로고 / 타이틀 */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#5d6c4a] border-4 border-[#3d472f] mb-4">
                        <span className="text-[#f5f3e8] text-2xl font-black">A</span>
                    </div>
                    <h1 className="text-2xl font-black text-[#3d472f] tracking-tight">아르바이트 관리</h1>
                    <p className="text-sm text-[#7a7565] mt-1">연차 승인 시스템</p>
                </div>

                {/* 로그인 카드 */}
                <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-8 shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5 uppercase tracking-wide">
                                이메일
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="example@company.com"
                                required
                                className="w-full px-3 py-2.5 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5 uppercase tracking-wide">
                                비밀번호
                            </label>
                            <div className="relative">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="비밀번호 입력"
                                    required
                                    className="w-full px-3 py-2.5 pr-10 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none transition-colors"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9585] hover:text-[#5a5545]"
                                >
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 bg-[#f8f0ef] border border-[#dcc0bc] p-3">
                                <AlertCircle size={14} className="text-[#a65d57] mt-0.5 shrink-0" />
                                <p className="text-[#a65d57] text-xs font-bold">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-3 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-[#f5f3e8] border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn size={16} />
                                    로그인
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-[#9a9585] mt-4">
                    계정이 없으신가요? 관리자에게 문의하세요.
                </p>
            </div>
        </div>
    );
}
