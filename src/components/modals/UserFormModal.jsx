import React, { useState } from 'react';
import { Edit, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const EMPLOYMENT_TYPES = ['아르바이트', '계약직', '정직원'];
const EMPLOYMENT_STATUSES = ['재직', '수습', '퇴사예정', '퇴사'];

// 자동 계정 생성용 helper (표시 전용 비교)
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();
const EMAIL_FORMAT_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 연락처 자동 하이픈 포맷 — 한국 휴대폰(010) 11자리 우선, 02 지역번호와 10자리도 자연스럽게 처리
// 입력 중 점진적으로 하이픈을 붙이고, 11자리를 초과하는 숫자는 잘라낸다
const formatPhoneNumber = (value) => {
    if (value === null || value === undefined) return '';
    const digits = String(value).replace(/\D/g, '').slice(0, 11);
    if (!digits) return '';
    // 서울 지역번호 02 (총 9~10자리)
    if (digits.startsWith('02')) {
        if (digits.length <= 2) return digits;
        if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
        if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
        return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
    }
    // 휴대폰(010, 011 등) / 기타 지역번호(031, 032 등)
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

export default function UserFormModal({ user, onClose, onSave, onDelete }) {
    const { createUser, getAllUsers } = useAuth();
    const [submitting, setSubmitting] = useState(false);
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
        if (name === 'phone') {
            // 입력 중 자동 하이픈 포맷 (숫자만 입력해도 자연스럽게 하이픈 추가)
            setFormData(prev => ({ ...prev, phone: formatPhoneNumber(value) }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;
        // position 필드를 employmentType으로 동기화 (하위호환)
        // 연락처는 저장 직전 한 번 더 포맷 정규화 (paste/legacy 데이터 보호)
        const normalizedPhone = formatPhoneNumber(formData.phone);
        const saveData = { ...formData, phone: normalizedPhone, position: formData.employmentType };
        const isNewMode = !user;
        const trimmedEmail = String(formData.email || '').trim();
        const isAlbaEmployee = (formData.employmentType === '아르바이트') || (formData.position === '아르바이트');

        setSubmitting(true);
        // 1) 직원 등록/수정 저장 — 실패하면 그대로 종료(기존 흐름 유지)
        try {
            await Promise.resolve(onSave(saveData));
        } catch (err) {
            // 부모(handleUserSave)가 자체 에러 처리. 우리는 종료만.
            setSubmitting(false);
            return;
        }
        // onSave 성공 시 부모가 closeModal('userForm')을 호출 → 모달 곧 언마운트
        // 직원 등록은 이미 완료. 자동 계정 생성은 신규 + 아르바이트 + 이메일 정상 + 미중복 케이스만.

        if (!isNewMode) return; // 수정 모드: 자동 생성 대상 아님
        if (!isAlbaEmployee) return; // 아르바이트 외: 자동 생성 대상 아님(수동 흐름 유지)

        if (!trimmedEmail) {
            window.alert('직원 정보는 저장되었습니다.\n이메일이 없어 아르바이트 계정 자동 생성은 건너뛰었습니다.');
            return;
        }
        if (!EMAIL_FORMAT_RE.test(trimmedEmail)) {
            window.alert('직원 정보는 저장되었습니다.\n이메일 형식이 올바르지 않아 아르바이트 계정 자동 생성은 건너뛰었습니다.');
            return;
        }

        // 사전 중복 체크 (실패 시 createUser의 auth/email-already-in-use 캐치로 보강)
        try {
            const existing = await getAllUsers();
            const target = normalizeEmail(trimmedEmail);
            const dup = (existing || []).some((u) => normalizeEmail(u.email) === target);
            if (dup) {
                window.alert('직원 정보는 저장되었습니다.\n동일 이메일 계정이 이미 있어 아르바이트 계정 자동 생성은 건너뛰었습니다.');
                return;
            }
        } catch (err) {
            console.warn('[UserFormModal] 계정 중복 사전 체크 실패 (계정 생성 시 재확인):', err);
        }

        // 2) 자동 계정 생성 — 실패해도 직원 등록은 그대로 유지
        const createPayload = {
            name: formData.name,
            email: trimmedEmail,
            contact_email: trimmedEmail,
            roleGroup: 'employee',
            role: 'employee',
            position: '아르바이트',
            team_id: formData.team || null,
        };
        console.debug('[UserFormModal] createUser payload (사전):', createPayload);
        try {
            await createUser(createPayload);
            window.alert('직원 정보가 저장되었고, 아르바이트 계정이 자동 생성되었습니다.\n초기 비밀번호는 123456입니다.');
        } catch (err) {
            if (err && err.code === 'auth/email-already-in-use') {
                window.alert('직원 정보는 저장되었습니다.\n동일 이메일 계정이 이미 있어 아르바이트 계정 자동 생성은 건너뛰었습니다.');
            } else {
                console.error('[UserFormModal] 아르바이트 계정 자동 생성 실패:', {
                    error: err,
                    code: err?.code,
                    message: err?.message,
                    payload: {
                        name: createPayload.name,
                        email: createPayload.email,
                        roleGroup: createPayload.roleGroup,
                        role: createPayload.role,
                        position: createPayload.position,
                        team_id: createPayload.team_id,
                    },
                });
                const code = err?.code || 'unknown';
                const message = err?.message || '원인 미확인';
                window.alert(`직원 정보는 저장되었지만 아르바이트 계정 자동 생성에 실패했습니다.\n계정·권한 관리에서 수동으로 생성해 주세요.\n\n오류 코드: ${code}\n오류 메시지: ${message}`);
            }
        }
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
                            <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 bg-[#f5f3e8] text-[#5a5545] font-bold text-sm hover:bg-[#e0ddd0] border border-[#d4cfbf] disabled:opacity-50 disabled:cursor-not-allowed">취소</button>
                            <button type="submit" disabled={submitting} className="px-6 py-2 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border-2 border-[#3d472f] disabled:opacity-60 disabled:cursor-not-allowed">{submitting ? '저장 중...' : '저장'}</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
