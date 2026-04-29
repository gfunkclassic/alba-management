import React, { useState } from 'react';
import { Edit, UserPlus, X } from 'lucide-react';

const EMPLOYMENT_TYPES = ['아르바이트', '계약직', '정직원'];
const EMPLOYMENT_STATUSES = ['재직', '수습', '퇴사예정', '퇴사'];

export default function UserFormModal({ user, onClose, onSave, onDelete }) {
    const [formData, setFormData] = useState(() => {
        const defaults = {
            name: '', team: '', gender: '', bank: '', account: '',
            startDate: new Date().toISOString().split('T')[0],
            insuranceDate: '', insuranceStatus: false, renewalDate: '',
            checkIn: '09:00', checkOut: '18:00', workHours: 8, workDays: '5일',
            wage: 0, wageIncreaseDate: '', previousWage: 0,
            phone: '', rrn: '', address: '', email: '',
            position: '아르바이트', employmentType: '아르바이트', employmentStatus: '재직',
            jobTitle: '', promotionDate: '',
            resignDate: '', resignReason: ''
        };
        if (user) {
            return {
                ...defaults, ...user,
                employmentType: user.employmentType || user.position || '아르바이트',
                employmentStatus: user.employmentStatus || (user.resignDate ? '퇴사' : '재직'),
            };
        }
        return defaults;
    });

    const isAlba = formData.employmentType === '아르바이트';

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'wage' || name === 'previousWage') {
            const numericValue = value.replace(/,/g, '');
            if (!isNaN(numericValue)) setFormData(prev => ({ ...prev, [name]: numericValue === '' ? 0 : Number(numericValue) }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // position 필드를 employmentType으로 동기화 (하위호환)
        const saveData = { ...formData, position: formData.employmentType };
        onSave(saveData);
    };

    const INPUT = "w-full p-2 border border-[#d4cfbf] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none";
    const LABEL = "text-xs font-bold text-[#7a7565] block mb-1";
    const SECTION = "col-span-2 text-xs font-bold text-[#5d6c4a] uppercase tracking-wider mb-1 mt-3";

    return (
        <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-[#f5f3e8] shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border-2 border-[#3d472f]">
                <div className="p-5 border-b-2 border-[#3d472f] flex justify-between items-center bg-[#5d6c4a]">
                    <h3 className="font-bold text-[#f5f3e8] flex items-center gap-2">{user ? <Edit size={20} /> : <UserPlus size={20} />} {user ? '▶ 정보 수정' : '▶ 신규 인원 등록'}</h3>
                    <button onClick={onClose} className="text-[#d4dcc0] hover:text-[#f5f3e8]"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto grid grid-cols-2 gap-4 bg-[#e8e4d4]">

                    {/* ── 고용유형 / 재직상태 ── */}
                    <div className={SECTION}>고용 구분</div>
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                        <div>
                            <label className={LABEL}>고용유형</label>
                            <select name="employmentType" value={formData.employmentType} onChange={handleChange} className={INPUT}>
                                {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className={LABEL}>재직상태</label>
                            <select name="employmentStatus" value={formData.employmentStatus} onChange={handleChange} className={INPUT}>
                                {EMPLOYMENT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* ── 기본 정보 ── */}
                    <div className={SECTION}>기본 정보</div>
                    <div><label className={LABEL}>이름</label><input name="name" value={formData.name} onChange={handleChange} required className={INPUT} /></div>
                    <div><label className={LABEL}>성별</label><select name="gender" value={formData.gender || ''} onChange={handleChange} className={INPUT}><option value="">미입력</option><option value="남">남</option><option value="여">여</option></select></div>
                    <div><label className={LABEL}>연락처</label><input name="phone" value={formData.phone} onChange={handleChange} required className={INPUT} /></div>
                    <div><label className={LABEL}>이메일</label><input name="email" type="email" value={formData.email} onChange={handleChange} className={INPUT} /></div>

                    {/* ── 근무 정보 ── */}
                    <div className={SECTION}>근무 정보</div>
                    <div><label className={LABEL}>{isAlba ? '팀' : '부서'}</label><input name="team" value={formData.team} onChange={handleChange} required className={INPUT} /></div>
                    <div><label className={LABEL}>입사일</label><input name="startDate" type="date" value={formData.startDate} onChange={handleChange} required className={INPUT} /></div>

                    {/* 직원/계약직 전용 */}
                    {!isAlba && (
                        <>
                            <div><label className={LABEL}>직급</label><input name="jobTitle" value={formData.jobTitle || ''} onChange={handleChange} placeholder="사원, 대리, 과장..." className={INPUT} /></div>
                            <div><label className={LABEL}>진급일</label><input name="promotionDate" type="date" value={formData.promotionDate || ''} onChange={handleChange} className={INPUT} /></div>
                        </>
                    )}

                    {/* 아르바이트 전용 */}
                    {isAlba && (
                        <>
                            <div><label className={LABEL}>출근 시간</label><input name="checkIn" type="time" value={formData.checkIn} onChange={handleChange} className={INPUT} /></div>
                            <div><label className={LABEL}>퇴근 시간</label><input name="checkOut" type="time" value={formData.checkOut} onChange={handleChange} className={INPUT} /></div>
                            <div><label className={LABEL}>일 근무(h)</label><input name="workHours" type="number" value={formData.workHours} onChange={handleChange} className={INPUT} /></div>
                            <div><label className={LABEL}>주 근무일수</label><input name="workDays" value={formData.workDays} onChange={handleChange} className={INPUT} /></div>
                        </>
                    )}

                    {/* ── 급여 및 계약 ── */}
                    <div className={SECTION}>급여 및 계약</div>
                    {isAlba && (
                        <>
                            <div><label className={LABEL}>현재 시급</label><input name="wage" type="text" value={Number(formData.wage).toLocaleString()} onChange={handleChange} required className={INPUT} /></div>
                            <div><label className={LABEL}>시급 인상일</label><input name="wageIncreaseDate" type="date" value={formData.wageIncreaseDate} onChange={handleChange} className={INPUT} /></div>
                            <div className="col-span-2"><label className={LABEL}>종전 시급 (인상 전)</label><input name="previousWage" type="text" value={Number(formData.previousWage || 0).toLocaleString()} onChange={handleChange} placeholder="시급 인상일 이전 기록에 적용됩니다" className={INPUT} /></div>
                        </>
                    )}
                    <div><label className={LABEL}>은행</label><input name="bank" value={formData.bank} onChange={handleChange} className={INPUT} /></div>
                    <div><label className={LABEL}>계좌번호</label><input name="account" value={formData.account} onChange={handleChange} className={INPUT} /></div>
                    <div><label className={LABEL}>4대보험 신고일</label><input name="insuranceDate" type="date" value={formData.insuranceDate} onChange={handleChange} className={INPUT} /></div>
                    <div className="flex items-center gap-2 mt-6">
                        <input type="checkbox" name="insuranceStatus" checked={formData.insuranceStatus} onChange={handleChange} id="insStatus" className="w-4 h-4" />
                        <label htmlFor="insStatus" className="text-xs font-bold text-[#7a7565]">4대보험 가입 (체크 시 노무사 산정)</label>
                    </div>
                    {isAlba && (
                        <div><label className={LABEL}>계약 갱신일</label><input name="renewalDate" type="date" value={formData.renewalDate} onChange={handleChange} className={INPUT} /></div>
                    )}

                    {/* ── 추가 정보 ── */}
                    <div className={SECTION}>추가 정보</div>
                    <div><label className={LABEL}>주민등록번호</label><input name="rrn" value={formData.rrn} onChange={handleChange} className={INPUT} /></div>
                    <div className="col-span-2 hidden"><label className={LABEL}>주소</label><input name="address" value={formData.address} onChange={handleChange} className={INPUT} /></div>

                    {/* ── 퇴사 정보 ── */}
                    {(formData.employmentStatus === '퇴사' || formData.employmentStatus === '퇴사예정' || formData.resignDate) && (
                        <>
                            <div className="col-span-2 text-xs font-bold text-[#8d5a4d] uppercase tracking-wider mb-1 mt-3">퇴사 정보</div>
                            <div><label className={LABEL}>퇴사 일자</label><input name="resignDate" type="date" value={formData.resignDate || ''} onChange={handleChange} className={`${INPUT} focus:border-[#8d5a4d]`} /></div>
                            <div><label className={LABEL}>퇴사 사유</label><input name="resignReason" value={formData.resignReason || ''} onChange={handleChange} placeholder="퇴사 사유" className={`${INPUT} focus:border-[#8d5a4d]`} /></div>
                        </>
                    )}

                    {/* ── 버튼 ── */}
                    <div className="col-span-2 pt-4 border-t border-[#d4cfbf] flex justify-between items-center">
                        <div>
                            {user && onDelete && (
                                <button type="button" onClick={() => { if (window.confirm('정말로 이 직원을 삭제하시겠습니까? 관련된 기록이 삭제될 수 있습니다.')) onDelete(user.id); }} className="px-4 py-2 bg-[#8d5a4d] text-[#f5f3e8] font-bold text-sm hover:bg-[#7a4d40] border-2 border-[#7a4540]">삭제</button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#f5f3e8] text-[#5a5545] font-bold text-sm hover:bg-[#e0ddd0] border border-[#d4cfbf]">취소</button>
                            <button type="submit" className="px-6 py-2 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border-2 border-[#3d472f]">저장</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
