import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Sun, AlertCircle, Check, X, LogOut, Search, RefreshCw, CheckCircle, Clock, ShieldOff, Edit2, UserCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_GROUP_OPTIONS, ROLE_GROUP_LABEL, ROLE_GROUP_BADGE, normalizeProfile, getFunctionalPermissions } from '../../utils/roleUtils';
import LeaveBalanceManager from '../leave/LeaveBalanceManager';
import SeniorDelegationManager from '../leave/SeniorDelegationManager';
import SeniorDelegateInbox from '../leave/SeniorDelegateInbox';
import CEODelegateInbox from '../leave/CEODelegateInbox';
import { ConfirmModal, AlertModal } from '../modals/DialogModals';
import NotificationBell from '../notifications/NotificationBell';


function CreateUserPanel({ onCreated }) {
    const { createUser, teams, addTeam } = useAuth();
    const [form, setForm] = useState({ name: '', email: '', contact_email: '', roleGroup: 'employee', position: '아르바이트', team_id: '' });
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [isAddingNewTeam, setIsAddingNewTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setResult(null);
        setLoading(true);
        try {
            await createUser(form);
            setResult({ success: true, message: `${form.name} (${form.email}) 계정 생성 완료. 초기 비밀번호: 123456` });
            setForm({ name: '', email: '', contact_email: '', roleGroup: 'employee', position: '아르바이트', team_id: '카페' });
            onCreated?.();
        } catch (err) {
            if (err.code === 'auth/email-already-in-use') {
                setResult({ success: false, message: '이미 사용 중인 이메일입니다.' });
            } else {
                setResult({ success: false, message: '계정 생성 실패: ' + err.message });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleAddNewTeam = async () => {
        const t = newTeamName.trim();
        if (!t || teams.includes(t)) { alert('유효하지 않거나 이미 존재하는 팀명입니다.'); return; }
        try {
            await addTeam(t);
            setForm(f => ({ ...f, team_id: t }));
            setIsAddingNewTeam(false);
            setNewTeamName('');
        } catch (e) {
            alert('팀 추가 실패: ' + e.message);
        }
    };

    const inputCls = "w-full p-2 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none";

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#3d472f] p-6">
            <h3 className="font-bold text-[#3d472f] mb-4 flex items-center gap-2">
                <UserPlus size={18} className="text-[#5d6c4a]" /> 계정 생성
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">이름 *</label>
                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="홍길동" className={inputCls} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">로그인 이메일 *</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="hong-login@company.com" className={inputCls} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">표시용 이메일 <span className="text-[#9a9585] font-normal">(= 회사메일, 선택)</span></label>
                    <input type="email" value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="hong@company.com (비어두면 로그인이메일 사용)" className={inputCls} />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">권한 그룹 *</label>
                    <select value={form.roleGroup} onChange={e => {
                        const rg = e.target.value;
                        const defaultPos = ROLE_GROUP_OPTIONS.find(o => o.value === rg)?.label.split(' ')[0] || '';
                        setForm(f => ({ ...f, roleGroup: rg }));
                    }} className={inputCls}>
                        {ROLE_GROUP_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-[10px] font-bold text-[#7a7565] block mb-1">직책 (표시용)</label>
                    <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="예: 아르바이트, 팀 관리자, 실장" className={inputCls} />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-[10px] font-bold text-[#7a7565]">팀 *</label>
                        {!isAddingNewTeam && (
                            <button type="button" onClick={() => setIsAddingNewTeam(true)} className="text-[10px] text-[#5d6c4a] font-bold hover:underline">+ 새 팀 추가</button>
                        )}
                    </div>
                    {isAddingNewTeam ? (
                        <div className="flex gap-2">
                            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="새 팀 이름"
                                className="flex-1 min-w-0 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm p-1.5 outline-none focus:border-[#5d6c4a]" autoFocus />
                            <button type="button" onClick={handleAddNewTeam} disabled={!newTeamName.trim()} className="bg-[#5d6c4a] shrink-0 text-[#f5f3e8] px-3 font-bold text-xs border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:opacity-50">추가</button>
                            <button type="button" onClick={() => { setIsAddingNewTeam(false); setNewTeamName(''); }} className="bg-[#e8e4d4] shrink-0 text-[#7a7565] px-3 font-bold text-xs border-2 border-[#c5c0b0] hover:bg-[#d5d0c0]">취소</button>
                        </div>
                    ) : (
                        <select value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} className={inputCls} required>
                            <option value="" disabled>팀 선택</option>
                            {teams.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    )}
                </div>
                <div className="md:col-span-2">
                    {result && (
                        <div className={`flex items-start gap-2 p-3 mb-3 border ${result.success ? 'bg-[#e8ebd8] border-[#b8c4a0] text-[#5d6c4a]' : 'bg-[#f8f0ef] border-[#dcc0bc] text-[#a65d57]'}`}>
                            {result.success ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
                            <p className="text-xs font-bold">{result.message}</p>
                        </div>
                    )}
                    <button type="submit" disabled={loading} className="w-full bg-[#5d6c4a] text-[#f5f3e8] py-2.5 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:bg-[#c5c0b0] disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {loading ? <div className="w-4 h-4 border-2 border-[#f5f3e8] border-t-transparent rounded-full animate-spin" /> : <><UserPlus size={16} /> 계정 생성 (초기 비밀번호: 123456)</>}
                    </button>
                </div>
            </form>
        </div>
    );
}

function PendingUsersPanel({ onApproved }) {
    const { getPendingUsers, approveUser, rejectUser, teams } = useAuth();
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [approving, setApproving] = useState({});
    const [selections, setSelections] = useState({}); // uid -> { role, team_id }

    const load = useCallback(async () => {
        setLoading(true);
        try { setPending(await getPendingUsers()); } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [getPendingUsers]);

    useEffect(() => { load(); }, [load]);

    const sel = (uid) => selections[uid] || { roleGroup: 'employee', team_id: teams[0] || '' };
    const setSel = (uid, key, val) => setSelections(s => ({ ...s, [uid]: { ...sel(uid), [key]: val } }));

    const handleApprove = async (uid) => {
        setApproving(a => ({ ...a, [uid]: 'approving' }));
        try {
            // approveUser에 roleGroup + position 전달 (AuthContext 호환)
            const s = sel(uid);
            await approveUser(uid, { role: s.roleGroup, roleGroup: s.roleGroup, team_id: s.team_id });
            onApproved?.();
            await load();
        } catch (e) { alert('승인 실패: ' + e.message); }
        finally { setApproving(a => ({ ...a, [uid]: null })); }
    };

    const handleReject = async (uid) => {
        if (!window.confirm('가입을 거절하시가습니까?')) return;
        setApproving(a => ({ ...a, [uid]: 'rejecting' }));
        try { await rejectUser(uid); await load(); }
        catch (e) { alert('거절 실패: ' + e.message); }
        finally { setApproving(a => ({ ...a, [uid]: null })); }
    };

    if (!loading && pending.length === 0) return null;

    return (
        <div className="bg-[#fdf6e3] border-2 border-[#d8973c]">
            <div className="p-4 border-b-2 border-[#d8973c] flex items-center gap-2">
                <Clock size={16} className="text-[#d8973c]" />
                <span className="font-bold text-[#7a5a1a] text-sm">가입 요청 관리</span>
                <span className="bg-[#d8973c] text-white text-[10px] font-black px-2 py-0.5">{pending.length}명 대기</span>
            </div>
            <div className="divide-y divide-[#e8d8a0]">
                {loading ? (
                    <div className="p-4 text-xs text-center text-[#9a9585]">조회 중...</div>
                ) : pending.map(u => (
                    <div key={u.uid} className="p-4 flex flex-wrap gap-3 items-center">
                        <div className="flex-1 min-w-[140px]">
                            <p className="font-bold text-[#3d472f] text-sm">{u.name}</p>
                            <p className="text-[10px] text-[#9a9585] font-mono">{u.contact_email || u.email}</p>
                            <p className="text-[10px] text-[#9a9585]">신청일: {u.created_at?.slice(0, 10)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <select value={sel(u.uid).roleGroup} onChange={e => setSel(u.uid, 'roleGroup', e.target.value)}
                                className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#d8973c]">
                                {ROLE_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <select value={sel(u.uid).team_id} onChange={e => setSel(u.uid, 'team_id', e.target.value)}
                                className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#d8973c]">
                                <option value="" disabled>팀 선택</option>
                                {teams.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                            <button onClick={() => handleApprove(u.uid)} disabled={!!approving[u.uid]}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#5d6c4a] border-2 border-[#3d472f] text-[#f5f3e8] text-[10px] font-bold hover:bg-[#4a5639] disabled:opacity-50">
                                <Check size={11} /> 승인
                            </button>
                            <button onClick={() => handleReject(u.uid)} disabled={!!approving[u.uid]}
                                className="flex items-center gap-1 px-3 py-1.5 bg-[#a65d57] border-2 border-[#7a3f3a] text-white text-[10px] font-bold hover:bg-[#7a3f3a] disabled:opacity-50">
                                <X size={11} /> 거절
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function TeamsManagementPanel({ onTeamUpdated }) {
    const { teams, addTeam, removeTeam, updateTeamName } = useAuth();
    const [newTeam, setNewTeam] = useState('');
    const [adding, setAdding] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null);
    const [editName, setEditName] = useState('');
    const [saving, setSaving] = useState(false);

    // Modal States
    const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, team: null });
    const [confirmRename, setConfirmRename] = useState({ isOpen: false, oldName: null, newName: null });
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', isSuccess: false });

    const showAlert = (title, message, isSuccess = false) => {
        setAlertConfig({ isOpen: true, title, message, isSuccess });
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        const t = newTeam.trim();
        if (!t || teams.includes(t)) { showAlert('오류', '유효하지 않거나 이미 존재하는 팀명입니다.'); return; }
        setAdding(true);
        try {
            await addTeam(t);
            setNewTeam('');
            if (onTeamUpdated) onTeamUpdated();
        }
        catch (err) { showAlert('오류', '팀 추가 실패: ' + err.message); }
        finally { setAdding(false); }
    };

    const requestRemove = (t) => {
        setConfirmDelete({ isOpen: true, team: t });
    };

    const executeRemove = async () => {
        const t = confirmDelete.team;
        if (!t) return;
        try {
            await removeTeam(t);
            if (onTeamUpdated) onTeamUpdated();
            showAlert('완료', '팀이 성공적으로 삭제되었습니다.', true);
        } catch (err) {
            console.error('팀 삭제 에러:', err);
            showAlert('삭제 실패', err.message);
        }
    };

    const requestRename = (e, oldName) => {
        e.preventDefault();
        const t = editName.trim();
        if (t === oldName) { setEditingTeam(null); return; }
        if (!t || teams.includes(t)) { showAlert('오류', '유효하지 않거나 이미 존재하는 팀명입니다.'); return; }

        setConfirmRename({ isOpen: true, oldName, newName: t });
    };

    const executeRename = async () => {
        const { oldName, newName } = confirmRename;
        if (!oldName || !newName) return;

        setSaving(true);
        try {
            await updateTeamName(oldName, newName);
            setEditingTeam(null);
            if (onTeamUpdated) onTeamUpdated();
            showAlert('완료', '성공적으로 팀 이름이 변경되었습니다.', true);
        } catch (err) {
            console.error('팀 이름 변경 에러:', err);
            showAlert('변경 실패', `메시지: ${err.message}\n코드: ${err.code || '없음'}`);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-6 max-w-2xl mx-auto mt-6">
            <h3 className="font-bold text-[#3d472f] mb-6 flex items-center gap-2">
                <AlertCircle size={18} className="text-[#5d6c4a]" /> 부서 / 팀 목록 관리
            </h3>

            <form onSubmit={handleAdd} className="flex gap-2 mb-8">
                <input value={newTeam} onChange={e => setNewTeam(e.target.value)} placeholder="새로운 팀(부서) 이름 입력"
                    className="flex-1 px-3 py-2.5 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm focus:border-[#5d6c4a] outline-none" maxLength={20} />
                <button type="submit" disabled={adding || !newTeam.trim()}
                    className="bg-[#5d6c4a] text-[#f5f3e8] px-6 font-bold text-sm border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:opacity-50 transition-colors">
                    추가
                </button>
            </form>

            <div className="space-y-2">
                <p className="text-xs font-bold text-[#7a7565] mb-2 uppercase tracking-wide">현재 등록된 팀 ({teams.length}개)</p>
                {teams.length === 0 && <p className="text-sm text-[#9a9585]">등록된 팀이 없습니다.</p>}
                {teams.map(t => (
                    <div className="flex justify-between items-center py-3 border-b border-[#e8d5b5] bg-white px-4">
                        {editingTeam === t ? (
                            <form onSubmit={(e) => requestRename(e, t)} className="flex-1 flex gap-2">
                                <input value={editName} onChange={e => setEditName(e.target.value)}
                                    className="flex-1 border-2 border-[#5d6c4a] px-2 py-1 outline-none text-sm text-[#5a5545]"
                                    autoFocus disabled={saving} />
                                <button type="submit" disabled={saving}
                                    className="px-3 bg-[#5d6c4a] text-white text-xs font-bold hover:bg-[#4a5839] disabled:opacity-50">
                                    {saving ? '저장...' : '저장'}
                                </button>
                                <button type="button" onClick={() => setEditingTeam(null)} disabled={saving}
                                    className="px-3 bg-[#e8e4d4] text-[#7a7565] text-xs font-bold hover:bg-[#d5d0bc]">
                                    취소
                                </button>
                            </form>
                        ) : (
                            <>
                                <span className="font-bold text-[#3d472f]">{t}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingTeam(t); setEditName(t); }} className="text-xs px-2 py-1 border border-[#c5c0b0] text-[#7a7565] hover:bg-[#f5f3e8]">수정</button>
                                    <button onClick={() => requestRemove(t)} className="text-xs px-2 py-1 border border-[#a65d57] text-[#a65d57] hover:bg-[#f8f0ef]">삭제</button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </div>

            <ConfirmModal
                isOpen={confirmDelete.isOpen}
                onClose={() => setConfirmDelete({ isOpen: false, team: null })}
                onConfirm={executeRemove}
                title="팀 삭제"
                message={`'${confirmDelete.team}' 팀을 삭제하시겠습니까?\n\n기존 계정들의 소속 정보는 유지되지만,\n새로운 계정을 만들거나 부서를 지정할 때 목록에서 사라집니다.`}
                confirmText="삭제하기"
                cancelText="취소"
                isDanger={true}
            />

            <ConfirmModal
                isOpen={confirmRename.isOpen}
                onClose={() => setConfirmRename({ isOpen: false, oldName: null, newName: null })}
                onConfirm={executeRename}
                title="팀 이름 변경"
                message={`정말 '${confirmRename.oldName}'을(를) '${confirmRename.newName}'(으)로 변경하시겠습니까?\n\n이 팀에 소속된 모든 유저의 정보, 연차 내역, 그리고 위임 내역이 함께 안전하게 업데이트됩니다.`}
                confirmText="변경하기"
                cancelText="취소"
            />

            <AlertModal
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                title={alertConfig.title}
                message={alertConfig.message}
                isSuccess={alertConfig.isSuccess}
            />
        </div>
    );
}

function EditUserModal({ user, onClose, onSaved }) {
    const { updateUserRoleAndTeam, teams, addTeam } = useAuth();
    const normalized = normalizeProfile(user);
    const [roleGroup, setRoleGroup] = useState(normalized?.roleGroup || 'employee');
    const [position, setPosition] = useState(normalized?.position || '');
    const [contactEmail, setContactEmail] = useState(user?.contact_email || '');
    const [team, setTeam] = useState(user?.team_id || '');
    const [saving, setSaving] = useState(false);
    const [isAddingNewTeam, setIsAddingNewTeam] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');

    if (!user) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateUserRoleAndTeam(user.uid, roleGroup, team, position, contactEmail || undefined);
            onSaved?.();
        } catch (e) { alert('수정 실패: ' + e.message); }
        finally { setSaving(false); }
    };

    const handleAddNewTeam = async () => {
        const t = newTeamName.trim();
        if (!t || teams.includes(t)) { alert('유효하지 않거나 이미 존재하는 팀명입니다.'); return; }
        try {
            await addTeam(t);
            setTeam(t);
            setIsAddingNewTeam(false);
            setNewTeamName('');
        } catch (e) {
            alert('팀 추가 실패: ' + e.message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-[#f5f3e8] border-2 border-[#3d472f] w-full max-w-sm shadow-xl">
                <div className="p-4 border-b-2 border-[#c5c0b0] flex justify-between items-center bg-[#e8e4d4]">
                    <h3 className="font-bold text-[#3d472f] text-sm">계정 정보 수정</h3>
                    <button onClick={onClose} className="text-[#7a7565] hover:text-[#3d472f]"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <p className="text-xs font-bold text-[#7a7565] mb-1">대상자</p>
                        <p className="text-sm font-bold text-[#3d472f]">{user.name} <span className="text-xs font-normal text-[#9a9585]">({user.email})</span></p>
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[#7a7565] block mb-1">권한 그룹 변경</label>
                        <select value={roleGroup} onChange={e => setRoleGroup(e.target.value)}
                            className="w-full border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm p-2 outline-none focus:border-[#5d6c4a]">
                            {ROLE_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        {(() => {
                            const perms = getFunctionalPermissions(roleGroup);
                            if (perms.length === 0) return null;
                            return (
                                <div className="mt-2 p-2.5 bg-[#faf8f0] border border-[#e8e4d4]">
                                    <p className="text-[10px] font-bold text-[#7a7565] mb-1.5">이 역할로 가능한 기능</p>
                                    <ul className="space-y-0.5">
                                        {perms.map(p => (
                                            <li key={p} className="flex items-center gap-1.5 text-[11px] text-[#3d472f]">
                                                <Check size={11} className="text-[#5d6c4a] shrink-0" />
                                                <span>{p}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })()}
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[#7a7565] block mb-1">직책 (표시용)</label>
                        <input value={position} onChange={e => setPosition(e.target.value)}
                            placeholder="예: 아르바이트, 팀 관리자, 실장"
                            className="w-full border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm p-2 outline-none focus:border-[#5d6c4a]" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-[#7a7565] block mb-1">표시용 이메일 <span className="text-[10px] text-[#9a9585] font-normal">(비우면 로그인 이메일 사용)</span></label>
                        <input value={contactEmail} onChange={e => setContactEmail(e.target.value)}
                            type="email"
                            placeholder="예: kgh@company.com"
                            className="w-full border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm p-2 outline-none focus:border-[#5d6c4a]" />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs font-bold text-[#7a7565]">팀 변경</label>
                            {!isAddingNewTeam && (
                                <button type="button" onClick={() => setIsAddingNewTeam(true)} className="text-[10px] text-[#5d6c4a] font-bold hover:underline">+ 새 팀 추가</button>
                            )}
                        </div>
                        {isAddingNewTeam ? (
                            <div className="flex gap-2">
                                <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="새 팀 이름"
                                    className="flex-1 min-w-0 border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm p-1.5 outline-none focus:border-[#5d6c4a]" autoFocus />
                                <button type="button" onClick={handleAddNewTeam} disabled={!newTeamName.trim()} className="bg-[#5d6c4a] shrink-0 text-[#f5f3e8] px-3 font-bold text-xs border-2 border-[#3d472f] hover:bg-[#4a5639] disabled:opacity-50">추가</button>
                                <button type="button" onClick={() => { setIsAddingNewTeam(false); setNewTeamName(''); }} className="bg-[#e8e4d4] shrink-0 text-[#7a7565] px-3 font-bold text-xs border-2 border-[#c5c0b0] hover:bg-[#d5d0c0]">취소</button>
                            </div>
                        ) : (
                            <select value={team} onChange={e => setTeam(e.target.value)}
                                className="w-full border-2 border-[#c5c0b0] bg-[#faf8f0] text-sm p-2 outline-none focus:border-[#5d6c4a]">
                                <option value="" disabled>팀 선택</option>
                                {teams.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        )}
                    </div>
                </div>
                <div className="p-4 border-t-2 border-[#c5c0b0] flex gap-2">
                    <button onClick={onClose} className="flex-1 py-2 text-sm font-bold border-2 border-[#c5c0b0] text-[#7a7565] hover:bg-[#e8e4d4]">취소</button>
                    <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-sm font-bold border-2 border-[#3d472f] bg-[#5d6c4a] text-[#f5f3e8] hover:bg-[#4a5639] disabled:opacity-50">저장</button>
                </div>
            </div>
        </div>
    );
}

export default function FinalApproverView({ onSwitchToHRSystem, roleGroup: propRoleGroup }) {
    const { userProfile, logout, getAllUsers, suspendUser, teams, updateUserRoleAndTeam, addTeam, removeTeam, getMyActiveSeniorDelegation, getMyActiveCEODelegation } = useAuth();
    // prop으로 받은 roleGroup 우선, 없으면 userProfile에서 추출
    const viewRoleGroup = propRoleGroup || userProfile?.roleGroup || '';
    const isSysAdmin = viewRoleGroup === 'sys_admin';
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterTeam, setFilterTeam] = useState('전체');
    const [filterRole, setFilterRole] = useState('전체');
    const [activeTab, setActiveTab] = useState(() => {
        return localStorage.getItem('final_approver_active_tab') || 'ACCOUNTS';
    });
    const [editingUser, setEditingUser] = useState(null);
    const [seniorDelegation, setSeniorDelegation] = useState(null);
    const [ceoDelegation, setCeoDelegation] = useState(null);
    const [ceoDelegationChecked, setCeoDelegationChecked] = useState(false);

    useEffect(() => {
        localStorage.setItem('final_approver_active_tab', activeTab);
    }, [activeTab]);

    useEffect(() => {
        if (!isSysAdmin) {
            getMyActiveSeniorDelegation().then(setSeniorDelegation).catch(() => setSeniorDelegation(null));
            getMyActiveCEODelegation()
                .then(d => { console.log('[CEODelegation]', d); setCeoDelegation(d); })
                .catch(e => { console.error('[CEODelegation err]', e); setCeoDelegation(null); })
                .finally(() => setCeoDelegationChecked(true));
        } else {
            setCeoDelegationChecked(true);
        }
    }, [isSysAdmin]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const data = await getAllUsers();
            setUsers(data.sort((a, b) => a.name?.localeCompare(b.name)));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadUsers(); }, []);

    const filtered = users.filter(u => {
        const nu = normalizeProfile(u);
        const matchSearch = u.name?.includes(search) || u.email?.includes(search);
        const matchTeam = filterTeam === '전체' || u.team_id === filterTeam;
        const matchRole = filterRole === '전체' || nu.roleGroup === filterRole;
        return matchSearch && matchTeam && matchRole;
    });



    const ALL_TABS = [
        { key: 'ACCOUNTS', label: '계정 관리', icon: <Users size={15} /> },
        { key: 'TEAMS', label: '시스템 팀 관리', icon: <AlertCircle size={15} /> },
        { key: 'LEAVE', label: '연차 잔여 관리', icon: <Sun size={15} /> },
    ];
    // approver_senior(실장)에게만 대결 위임 탭 추가. sys_admin은 제외.
    const TABS = isSysAdmin
        ? ALL_TABS
        : [...ALL_TABS, { key: 'DELEGATION', label: '대결 위임', icon: <UserCheck size={15} /> }];

    return (
        <div className="min-h-screen bg-[#e8e4d4]">
            {/* 헤더 */}
            <header className="bg-[#3d472f] border-b-2 border-[#2d3721] px-6 py-3 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#5d6c4a] border-2 border-[#f5f3e8] flex items-center justify-center text-[#f5f3e8] font-black text-sm">A</div>
                    <span className="text-[#f5f3e8] font-bold text-sm">아르바이트 관리</span>
                    <span className="text-[10px] bg-[#a65d57] text-white font-bold px-2 py-0.5">
                        {isSysAdmin ? (userProfile?.position || '최종관리자') : (userProfile?.position || '승인자')}
                    </span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                        <span className="text-[#b8c4a0] text-xs font-bold mr-1">{userProfile?.name}님</span>
                        <div className="pt-1.5">
                            <NotificationBell userId={userProfile?.uid} onNavigate={(tab) => {
                                localStorage.setItem('app_active_tab', tab === 'HISTORY' ? 'LEAVE' : tab);
                                if (onSwitchToHRSystem) onSwitchToHRSystem();
                            }} />
                        </div>
                    </div>
                    <div className="w-px h-4 bg-[#5d6c4a]"></div>
                    <button onClick={logout} className="flex items-center gap-1 text-[#b8c4a0] hover:text-[#f5f3e8] text-xs"><LogOut size={14} /> 로그아웃</button>
                </div>
            </header>

            {/* 탭 바 */}
            <div className="bg-[#f5f3e8] border-b-2 border-[#c5c0b0] flex items-center">
                <div className="flex flex-1">
                    {TABS.map(t => (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-1.5 px-5 py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === t.key ? 'border-[#5d6c4a] text-[#5d6c4a]' : 'border-transparent text-[#7a7565] hover:text-[#5a5545]'}`}>
                            {t.icon} {t.label}
                        </button>
                    ))}
                </div>
                {onSwitchToHRSystem && (
                    <button onClick={onSwitchToHRSystem} className="mr-4 text-[10px] bg-[#5d6c4a] border border-[#3d472f] text-[#f5f3e8] px-3 py-1.5 font-bold hover:bg-[#4a5639]">
                        {isSysAdmin ? '← 인사급여 시스템' : '← 인사급여 시스템'}
                    </button>
                )}
            </div>

            <main className="max-w-6xl mx-auto p-6 space-y-6">

                {/* ── 계정 관리 ───────────────── */}
                {activeTab === 'ACCOUNTS' && (<>
                    {/* 가입 요청 */}
                    <PendingUsersPanel onApproved={loadUsers} />

                    {editingUser && (
                        <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSaved={() => { setEditingUser(null); loadUsers(); }} />
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: '전체 계정', value: `${users.length}명` },
                            { label: '아르바이트', value: `${users.filter(u => normalizeProfile(u).roleGroup === 'employee').length}명` },
                            { label: '팀 관리자', value: `${users.filter(u => normalizeProfile(u).roleGroup === 'manager').length}명` },
                            { label: '비번 변경 필요', value: `${users.filter(u => u.is_temp_password).length}명`, danger: true },
                        ].map(card => (
                            <div key={card.label} className={`border-2 p-4 ${card.danger ? 'bg-[#f8f0ef] border-[#dcc0bc]' : 'bg-[#f5f3e8] border-[#c5c0b0]'}`}>
                                <p className="text-xs font-bold text-[#7a7565] mb-1">{card.label}</p>
                                <p className={`text-2xl font-black ${card.danger ? 'text-[#a65d57]' : 'text-[#3d472f]'}`}>{card.value}</p>
                            </div>
                        ))}
                    </div>
                    <CreateUserPanel onCreated={loadUsers} />
                    <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0]">
                        <div className="p-4 border-b-2 border-[#c5c0b0] flex flex-wrap gap-3 items-center justify-between">
                            <h3 className="font-bold text-[#3d472f] flex items-center gap-2"><Users size={18} className="text-[#5d6c4a]" /> 전체 계정 목록</h3>
                            <div className="flex gap-2 flex-wrap">
                                <div className="relative">
                                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9a9585]" />
                                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름/이메일" className="pl-8 pr-3 py-1.5 border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs focus:border-[#5d6c4a] outline-none w-36" />
                                </div>
                                <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#5d6c4a]">
                                    <option value="전체">전체 팀</option>
                                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="border-2 border-[#c5c0b0] bg-[#faf8f0] text-xs px-2 py-1.5 outline-none focus:border-[#5d6c4a]">
                                    <option value="전체">전체 권한</option>
                                    {ROLE_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <button onClick={loadUsers} className="flex items-center gap-1 border-2 border-[#c5c0b0] bg-[#f5f3e8] px-2 py-1.5 text-xs text-[#5a5545] hover:bg-[#e8e4d4]">
                                    <RefreshCw size={12} /> 새로고침
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-[#e8e4d4] sticky top-0 text-xs font-bold text-[#5d6c4a] uppercase">
                                    <tr>
                                        <th className="p-3 pl-4 text-left">이름</th>
                                        <th className="p-3 text-left">이메일</th>
                                        <th className="p-3 text-center">팀</th>
                                        <th className="p-3 text-center">역할</th>
                                        <th className="p-3 text-center">비밀번호</th>
                                        <th className="p-3 text-center">등록일</th>
                                        <th className="p-3 text-center">관리</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#ebe8db]">
                                    {loading ? <tr><td colSpan={7} className="p-8 text-center text-[#9a9585] text-xs">불러오는 중...</td></tr>
                                        : filtered.map(u => (
                                            <tr key={u.uid} className={`hover:bg-[#f4f5eb] ${u.status === 'SUSPENDED' ? 'opacity-60' : ''}`}>
                                                <td className="p-3 pl-4 font-bold text-[#3d472f]">{u.name}</td>
                                                <td className="p-3 text-[#5a5545] text-xs font-mono">
                                                    {u.contact_email || u.email}
                                                    {u.contact_email && u.contact_email !== u.email && (
                                                        <span className="block text-[10px] text-[#9a9585] mt-0.5">{u.email}</span>
                                                    )}
                                                </td>
                                                <td className="p-3 text-center"><span className="text-xs bg-[#e8e4d4] px-2 py-0.5 font-bold text-[#5a5545]">{u.team_id || '-'}</span></td>
                                                <td className="p-3 text-center">
                                                    <span className={`text-xs font-bold px-2 py-0.5 ${ROLE_GROUP_BADGE[normalizeProfile(u).roleGroup] || 'bg-[#e8e4d4] text-[#5a5545]'}`}>
                                                        {u.position || ROLE_GROUP_LABEL[normalizeProfile(u).roleGroup] || '-'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-center">
                                                    {u.is_temp_password
                                                        ? <span className="text-xs font-bold text-[#d8973c] flex items-center justify-center gap-1"><AlertCircle size={11} />변경 필요</span>
                                                        : <span className="text-xs text-[#5d6c4a] font-bold flex items-center justify-center gap-1"><Check size={11} />변경 완료</span>}
                                                </td>
                                                <td className="p-3 text-center text-xs text-[#7a7565]">{u.created_at?.slice(0, 10)}</td>
                                                <td className="p-3 text-center flex items-center justify-center gap-1.5">
                                                    <button onClick={() => setEditingUser(u)}
                                                        disabled={u.status === 'SUSPENDED' || (!isSysAdmin && normalizeProfile(u).roleGroup === 'sys_admin')}
                                                        className="text-[9px] font-bold px-2 py-1 border border-[#5d6c4a] text-[#5d6c4a] hover:bg-[#e8ebd8] flex items-center gap-0.5 disabled:opacity-50">
                                                        <Edit2 size={10} /> 수정
                                                    </button>
                                                    {u.status === 'SUSPENDED' ? (
                                                        <button onClick={() => suspendUser(u.uid, false).then(loadUsers)}
                                                            className="text-[9px] font-bold px-2 py-1 border border-[#d8973c] text-[#d8973c] hover:bg-[#fdf6e3]">
                                                            정지해제
                                                        </button>
                                                    ) : (!isSysAdmin && normalizeProfile(u).roleGroup === 'sys_admin') ? (
                                                        <span className="text-[10px] text-[#c5c0b0]">-</span>
                                                    ) : (
                                                        <button onClick={() => { if (window.confirm(`${u.name} 계정을 정지하시겠습니까?`)) suspendUser(u.uid, true).then(loadUsers); }}
                                                            className="text-[9px] font-bold px-2 py-1 border border-[#a65d57] text-[#a65d57] hover:bg-[#f8f0ef] flex items-center gap-1">
                                                            <ShieldOff size={10} /> 정지
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    {!loading && filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-[#9a9585] text-xs">해당하는 계정이 없습니다.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>)}

                {/* 시스템 팀/부서 관리 탭 */}
                {activeTab === 'TEAMS' && (
                    <TeamsManagementPanel onTeamUpdated={loadUsers} />
                )}
                {/* ── 연차 잔여 관리 ──────────── */}
                {activeTab === 'LEAVE' && (
                    <LeaveBalanceManager users={users.filter(u => normalizeProfile(u).roleGroup === 'employee')} />
                )}
                {/* ── 대결 위임 (approver_senior 전용) ─ */}
                {activeTab === 'DELEGATION' && !isSysAdmin && (
                    <div className="space-y-6">
                        <SeniorDelegationManager />
                        {seniorDelegation && <SeniorDelegateInbox delegation={seniorDelegation} />}
                        {ceoDelegation
                            ? <CEODelegateInbox delegation={ceoDelegation} />
                            : (
                                <div className="bg-[#f5f3e8] border-2 border-[#c5c0b0] p-4 text-xs text-[#9a9585]">
                                    대표 위임 승인함 — {ceoDelegationChecked ? '현재 활성 대표 위임 없음' : '확인 중...'}
                                </div>
                            )
                        }
                    </div>
                )}

            </main>
        </div>
    );
}
