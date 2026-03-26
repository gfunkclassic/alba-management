/**
 * roleUtils.js
 * 권한 그룹(roleGroup) 상수 정의 및 기존 role 하위호환 어댑터
 *
 * [roleGroup 값]
 *   - 'employee'        : 일반 사용자 (아르바이트)
 *   - 'manager'         : 1차 승인자 (팀 관리자)
 *   - 'approver_senior' : 상위 승인자 (실장 등, 병렬 최종 승인)
 *   - 'approver_final'  : 최종 승인자 (대표)
 *   - 'sys_admin'       : 시스템 관리자
 */

// ── 권한 그룹 상수 ─────────────────────────────────────────────
export const ROLE_GROUP = {
    EMPLOYEE: 'employee',
    MANAGER: 'manager',
    APPROVER_SENIOR: 'approver_senior',
    APPROVER_FINAL: 'approver_final',
    SYS_ADMIN: 'sys_admin',
};

// ── 직책 표시용 기본 텍스트 ────────────────────────────────────
export const DEFAULT_POSITION = {
    [ROLE_GROUP.EMPLOYEE]: '아르바이트',
    [ROLE_GROUP.MANAGER]: '팀 관리자',
    [ROLE_GROUP.APPROVER_SENIOR]: '실장',
    [ROLE_GROUP.APPROVER_FINAL]: '대표',
    [ROLE_GROUP.SYS_ADMIN]: '최종관리자',
};

// ── 기존 role 값 → 새 구조 매핑 (하위호환) ────────────────────
const LEGACY_ROLE_MAP = {
    'ALBA': { roleGroup: ROLE_GROUP.EMPLOYEE, position: '아르바이트' },
    'TEAM_APPROVER': { roleGroup: ROLE_GROUP.MANAGER, position: '팀 관리자' },
    'FINAL_APPROVER': { roleGroup: ROLE_GROUP.APPROVER_SENIOR, position: '실장' },
    'SUPER_ADMIN': { roleGroup: ROLE_GROUP.SYS_ADMIN, position: '최종관리자' },
    'VIEWER': { roleGroup: ROLE_GROUP.SYS_ADMIN, position: '최종관리자' },
};

/**
 * Firestore에서 읽어온 사용자 프로필을 정규화합니다.
 * - 이미 roleGroup 필드가 있으면 그대로 반환 (새 구조)
 * - 기존 role 필드만 있으면 roleGroup + position 으로 변환 (하위호환)
 * - 두 필드 모두 없으면 employee 로 폴백
 *
 * @param {Object} data - Firestore users 문서 데이터
 * @returns {Object} roleGroup, position 이 보장된 프로필 객체
 */
export function normalizeProfile(data) {
    if (!data) return data;

    // 이미 새 구조인 경우 (roleGroup이 있으면 통과)
    if (data.roleGroup) {
        // position이 없으면 roleGroup 기반 기본값 보정
        if (!data.position) {
            return { ...data, position: DEFAULT_POSITION[data.roleGroup] || '' };
        }
        return data;
    }

    // 기존 role 필드 → 새 구조 변환
    const mapped = LEGACY_ROLE_MAP[data.role];
    if (mapped) {
        return { ...data, ...mapped };
    }

    // 알 수 없는 값 → employee 폴백
    return {
        ...data,
        roleGroup: ROLE_GROUP.EMPLOYEE,
        position: data.position || '아르바이트',
    };
}

// ── 권한 체크 헬퍼 ─────────────────────────────────────────────

/** 최종 승인 권한 (approver_senior 또는 approver_final) */
export const isFinalApprover = (roleGroup) =>
    roleGroup === ROLE_GROUP.APPROVER_SENIOR || roleGroup === ROLE_GROUP.APPROVER_FINAL;

/** 팀 승인 권한 (manager) */
export const isTeamApprover = (roleGroup) =>
    roleGroup === ROLE_GROUP.MANAGER;

/** 시스템 관리자 */
export const isSysAdmin = (roleGroup) =>
    roleGroup === ROLE_GROUP.SYS_ADMIN;

/** 일반 사용자 */
export const isEmployee = (roleGroup) =>
    roleGroup === ROLE_GROUP.EMPLOYEE;

/** 승인 권한 (manager 이상) */
export const canApprove = (roleGroup) =>
    roleGroup === ROLE_GROUP.MANAGER ||
    roleGroup === ROLE_GROUP.APPROVER_SENIOR ||
    roleGroup === ROLE_GROUP.APPROVER_FINAL;

// ── UI 표시용 레이블 / 뱃지 ────────────────────────────────────
export const ROLE_GROUP_LABEL = {
    [ROLE_GROUP.EMPLOYEE]: '아르바이트',
    [ROLE_GROUP.MANAGER]: '팀 관리자',
    [ROLE_GROUP.APPROVER_SENIOR]: '상위 승인자',
    [ROLE_GROUP.APPROVER_FINAL]: '최종 승인자',
    [ROLE_GROUP.SYS_ADMIN]: '시스템 관리자',
};

export const ROLE_GROUP_BADGE = {
    [ROLE_GROUP.EMPLOYEE]: 'bg-[#e8e4d4] text-[#5a5545]',
    [ROLE_GROUP.MANAGER]: 'bg-[#e8ebd8] text-[#5d6c4a]',
    [ROLE_GROUP.APPROVER_SENIOR]: 'bg-[#f8f0ef] text-[#a65d57]',
    [ROLE_GROUP.APPROVER_FINAL]: 'bg-[#f5e8e8] text-[#8b3a36]',
    [ROLE_GROUP.SYS_ADMIN]: 'bg-[#e8e4d4] text-[#d8973c]',
};

/** 계정 관리 UI용 roleGroup 선택 옵션 목록 */
export const ROLE_GROUP_OPTIONS = [
    { value: ROLE_GROUP.EMPLOYEE, label: '아르바이트 (일반 사용자)' },
    { value: ROLE_GROUP.MANAGER, label: '팀 관리자 (1차 승인)' },
    { value: ROLE_GROUP.APPROVER_SENIOR, label: '상위 승인자 (실장급)' },
    { value: ROLE_GROUP.APPROVER_FINAL, label: '최종 승인자 (대표)' },
    { value: ROLE_GROUP.SYS_ADMIN, label: '시스템 관리자' },
];
