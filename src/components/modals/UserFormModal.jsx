import React, { useState } from 'react';
import { Edit, UserPlus, X } from 'lucide-react';

export default function UserFormModal({ user, onClose, onSave, onDelete }) {
    const [formData, setFormData] = useState(user || {
        name: '', team: '', gender: '남', bank: '', account: '',
        startDate: new Date().toISOString().split('T')[0],
        insuranceDate: '', insuranceStatus: false, renewalDate: '',
        checkIn: '09:00', checkOut: '18:00', workHours: 8, workDays: '5일',
        wage: 0, wageIncreaseDate: '', previousWage: 0,
        phone: '', rrn: '', address: '', email: '', position: '아르바이트',
        resignDate: '', resignReason: ''
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'wage' || name === 'previousWage') {
            const numericValue = value.replace(/,/g, '');
            if (!isNaN(numericValue)) setFormData(prev => ({ ...prev, [name]: numericValue === '' ? 0 : Number(numericValue) }));
            return;
        }
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };

    return (
        <div className="fixed inset-0 bg-[#3d3929]/70 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-[#f5f3e8] shadow-lg w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border-2 border-[#3d472f]">
                <div className="p-5 border-b-2 border-[#3d472f] flex justify-between items-center bg-[#5d6c4a]">
                    <h3 className="font-bold text-[#f5f3e8] flex items-center gap-2">{user ? <Edit size={20} /> : <UserPlus size={20} />} {user ? '▶ 정보 수정' : '▶ 신규 인원 등록'}</h3>
                    <button onClick={onClose} className="text-[#d4dcc0] hover:text-[#f5f3e8]"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto grid grid-cols-2 gap-4 bg-[#e8e4d4]">
                    <div className="col-span-2 text-xs font-bold text-[#5d6c4a] uppercase tracking-wider mb-1">기본 정보</div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">이름</label><input name="name" value={formData.name} onChange={handleChange} required className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">성별</label><select name="gender" value={formData.gender} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none"><option value="남">남</option><option value="여">여</option></select></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">주민등록번호</label><input name="rrn" value={formData.rrn} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">연락처</label><input name="phone" value={formData.phone} onChange={handleChange} required className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-[#7a7565] block mb-1">주소</label><input name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-[#7a7565] block mb-1">이메일</label><input name="email" type="email" value={formData.email} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div className="col-span-2 text-xs font-bold text-[#5d6c4a] uppercase tracking-wider mb-1 mt-2">근무 정보</div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">팀</label><input name="team" value={formData.team} onChange={handleChange} required className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">입사일</label><input name="startDate" type="date" value={formData.startDate} onChange={handleChange} required className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">출근 시간</label><input name="checkIn" type="time" value={formData.checkIn} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">퇴근 시간</label><input name="checkOut" type="time" value={formData.checkOut} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">일 근무(h)</label><input name="workHours" type="number" value={formData.workHours} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">주 근무일수</label><input name="workDays" value={formData.workDays} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div className="col-span-2 text-xs font-bold text-[#5d6c4a] uppercase tracking-wider mb-1 mt-2">급여 및 계약</div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">현재 시급</label><input name="wage" type="text" value={Number(formData.wage).toLocaleString()} onChange={handleChange} required className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">시급 인상일</label><input name="wageIncreaseDate" type="date" value={formData.wageIncreaseDate} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div className="col-span-2"><label className="text-xs font-bold text-[#7a7565] block mb-1">종전 시급 (인상 전)</label><input name="previousWage" type="text" value={Number(formData.previousWage || 0).toLocaleString()} onChange={handleChange} placeholder="시급 인상일 이전 기록에 적용됩니다" className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">은행</label><input name="bank" value={formData.bank} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">계좌번호</label><input name="account" value={formData.account} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">4대보험 신고일</label><input name="insuranceDate" type="date" value={formData.insuranceDate} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    <div className="flex items-center gap-2 mt-6">
                        <input type="checkbox" name="insuranceStatus" checked={formData.insuranceStatus} onChange={handleChange} id="insStatus" className="w-4 h-4" />
                        <label htmlFor="insStatus" className="text-xs font-bold text-[#7a7565]">4대보험 가입 (체크 시 노무사 산정)</label>
                    </div>
                    <div><label className="text-xs font-bold text-[#7a7565] block mb-1">계약 갱신일</label><input name="renewalDate" type="date" value={formData.renewalDate} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#5d6c4a] outline-none" /></div>
                    {formData.resignDate && (
                        <>
                            <div className="col-span-2 text-xs font-bold text-[#a65d57] uppercase tracking-wider mb-1 mt-2">퇴사 정보</div>
                            <div><label className="text-xs font-bold text-[#7a7565] block mb-1">퇴사 일자</label><input name="resignDate" type="date" value={formData.resignDate || ''} onChange={handleChange} className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#a65d57] outline-none" /></div>
                            <div><label className="text-xs font-bold text-[#7a7565] block mb-1">퇴사 사유</label><input name="resignReason" value={formData.resignReason || ''} onChange={handleChange} placeholder="퇴사 사유" className="w-full p-2 border-2 border-[#c5c0b0] bg-[#f5f3e8] text-sm focus:border-[#a65d57] outline-none" /></div>
                        </>
                    )}
                    <div className="col-span-2 pt-4 border-t-2 border-[#c5c0b0] flex justify-between items-center">
                        <div>
                            {user && onDelete && (
                                <button type="button" onClick={() => { if (window.confirm('정말로 이 직원을 삭제하시겠습니까? 관련된 기록이 삭제될 수 있습니다.')) onDelete(user.id); }} className="px-4 py-2 bg-[#a65d57] text-[#f5f3e8] font-bold text-sm hover:bg-[#8a4d47] border-2 border-[#7a4540]">삭제</button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button type="button" onClick={onClose} className="px-4 py-2 bg-[#f5f3e8] text-[#5a5545] font-bold text-sm hover:bg-[#e0ddd0] border-2 border-[#c5c0b0]">취소</button>
                            <button type="submit" className="px-6 py-2 bg-[#5d6c4a] text-[#f5f3e8] font-bold text-sm hover:bg-[#4a5639] border-2 border-[#3d472f]">저장</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
