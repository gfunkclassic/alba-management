import React, { useState } from 'react';
import { UserPlus, AlertCircle, Eye, EyeOff, Check, LogIn } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function RegisterPage({ onGoToLogin }) {
    const { selfRegister } = useAuth();
    const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const inputCls = "w-full px-3 py-2.5 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none transition-colors";

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.name.trim()) { setError('이름을 입력해주세요.'); return; }
        if (form.password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return; }
        if (form.password !== form.confirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
        setLoading(true);
        try {
            await selfRegister({ name: form.name.trim(), email: form.email, password: form.password });
            setDone(true);
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setError('이미 사용 중인 이메일입니다.');
            } else if (err.code === 'auth/weak-password') {
                setError('비밀번호가 너무 약합니다. 6자 이상 입력해주세요.');
            } else {
                setError('등록 실패: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // 등록 완료 화면
    if (done) {
        return (
            <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center p-4">
                <div className="w-full max-w-sm text-center">
                    <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-8 shadow-lg">
                        <div className="w-14 h-14 bg-[#5d6c4a] border-2 border-[#3d472f] flex items-center justify-center mx-auto mb-4">
                            <Check size={28} className="text-[#f5f3e8]" />
                        </div>
                        <h2 className="text-xl font-black text-[#3d472f] mb-2">가입 신청 완료</h2>
                        <p className="text-sm text-[#7a7565] mb-6">관리자 승인 후 로그인할 수 있습니다.<br />승인까지 시간이 걸릴 수 있습니다.</p>
                        <button onClick={onGoToLogin}
                            className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-2.5 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] flex items-center justify-center gap-2">
                            <LogIn size={15} /> 로그인 화면으로
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#e8e4d4] flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#5d6c4a] border-4 border-[#3d472f] mb-4">
                        <span className="text-[#f5f3e8] text-2xl font-black">A</span>
                    </div>
                    <h1 className="text-2xl font-black text-[#3d472f] tracking-tight">회원 가입</h1>
                    <p className="text-sm text-[#7a7565] mt-1">아르바이트 관리 시스템</p>
                </div>

                <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-8 shadow-lg">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5 uppercase tracking-wide">이름 *</label>
                            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="홍길동" required className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5 uppercase tracking-wide">이메일 *</label>
                            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                placeholder="example@company.com" required className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5 uppercase tracking-wide">비밀번호 * (6자 이상)</label>
                            <div className="relative">
                                <input type={showPw ? 'text' : 'password'} value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    placeholder="비밀번호 입력" required className={`${inputCls} pr-10`} />
                                <button type="button" onClick={() => setShowPw(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9a9585] hover:text-[#5a5545]">
                                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-[#7a7565] mb-1.5 uppercase tracking-wide">비밀번호 확인 *</label>
                            <input type="password" value={form.confirm}
                                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                                placeholder="비밀번호 재입력" required className={inputCls} />
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 bg-[#f8f0ef] border border-[#dcc0bc] p-3">
                                <AlertCircle size={14} className="text-[#a65d57] mt-0.5 shrink-0" />
                                <p className="text-[#a65d57] text-xs font-bold">{error}</p>
                            </div>
                        )}

                        <button type="submit" disabled={loading}
                            className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-3 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors">
                            {loading
                                ? <div className="w-4 h-4 border-2 border-[#f5f3e8] border-t-transparent rounded-full animate-spin" />
                                : <><UserPlus size={16} /> 가입 신청</>}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-[#7a7565] mt-4">
                    이미 계정이 있으신가요?{' '}
                    <button onClick={onGoToLogin} className="text-[#5d6c4a] font-bold hover:underline">로그인</button>
                </p>
                <p className="text-center text-[10px] text-[#9a9585] mt-2">※ 가입 후 관리자 승인이 필요합니다.</p>
            </div>
        </div>
    );
}
