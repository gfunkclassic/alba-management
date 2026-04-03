# 수정 로그 기준표 (Edit Log Standards)

> 작성일: 2026-04-03
> 근거: 저장소 코드 실제 확인 기준 (functions/index.js, AuthContext.jsx, firestore.rules, AdminApprovalHistory.jsx)
> 상태: 초안 — 사용자 확인 후 확정

---

## 1. 현재 감사 로그 현황

### 구현됨

| 영역 | 컬렉션 | 기록 내용 | 생성 주체 |
|------|--------|-----------|-----------|
| 연차 승인/반려 | `approvals` | 단계, 행위, 처리자, 시각, 메모, 위임 정보 | Cloud Functions 전용 |

### 미구현

| 영역 | 현재 상태 | 영향 |
|------|-----------|------|
| 근태 수정 | 덮어쓰기, 이력 없음 | 누가 언제 근태를 수정했는지 추적 불가 |
| 급여 상태 변경 | 현재값만 저장 | 상태 변경 시점/변경자 확인 불가 |
| 직원 정보 수정 | 덮어쓰기, 이력 없음 | 시급/계좌 등 변경 이력 추적 불가 |
| 연차 잔여일 조정 | 최종값만 저장 | 수동 조정의 사유/변경자 추적 불가 |
| 연차 이월 | 최종값만 저장 | 이월 처리 이력 추적 불가 |

---

## 2. 기존 감사 로그 상세: 연차 승인 (`approvals`)

### 2-1. 문서 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| `leave_request_id` | string | 대상 연차 신청 ID |
| `stage` | string | `TEAM` / `FINAL` / `CEO` |
| `action` | string | `APPROVE` / `REJECT` |
| `actor_user_id` | string | 실제 처리자 UID |
| `acted_at` | ISO8601 | 처리 시각 |
| `note` | string | 메모 (위임 대행 시 "[FINAL_APPROVER 대행]" 접두사 포함) |
| `delegation_from_user_id` | string\|null | 위임 원본자 UID (직접 처리 시 null) |

### 2-2. 생성 시점

| Cloud Function | 단계 | 생성 조건 |
|----------------|------|-----------|
| `approveTeamLeave` | TEAM | 승인 또는 반려 시 |
| `approveFinalLeave` | FINAL | 승인 또는 반려 시 |
| `approveCEOLeave` | CEO | 승인 또는 반려 시 |

### 2-3. 접근 권한

| 조건 | 읽기 |
|------|:----:|
| 처리자 본인 (`actor_user_id == uid`) | O |
| admin (FINAL_APPROVER, approver_senior, approver_final, sys_admin) | O |
| 클라이언트 생성/수정/삭제 | **X (차단)** |

### 2-4. 조회 UI (AdminApprovalHistory.jsx)

| 뷰어 | 조회 범위 | 정렬 | 제한 |
|------|-----------|------|------|
| 팀 관리자 | 본인 처리 건만 | acted_at DESC | 최근 50건 |
| 실장/대표 | 전체 | acted_at DESC | 최근 50건 |

---

## 3. 권장 감사 로그 설계안

> 아래는 코드에 미구현된 영역에 대한 설계 제안입니다. 구현 여부는 사용자 판단에 따릅니다.

### 3-1. 근태 수정 로그

**제안 컬렉션**: `attendance_logs`

| 필드 | 타입 | 설명 |
|------|------|------|
| `employee_id` | string | 대상 직원 ID |
| `date` | YYYY-MM-DD | 수정된 근무일 |
| `field` | string | 변경 필드명 (checkIn, checkOut, overtime, reason 등) |
| `old_value` | any | 변경 전 값 |
| `new_value` | any | 변경 후 값 |
| `changed_by` | string | 변경자 UID |
| `changed_at` | ISO8601 | 변경 시각 |
| `source` | string | 변경 경로 ('UPLOAD' / 'MANUAL' / 'CALENDAR') |

**적용 위치**:
- `handleAttendanceUpload` (엑셀 업로드 시)
- 캘린더 직접 수정 시 (현재 수정 핸들러)

### 3-2. 급여 상태 변경 로그

**제안 컬렉션**: `payroll_status_logs`

| 필드 | 타입 | 설명 |
|------|------|------|
| `month` | YYYY-MM | 대상 급여월 |
| `old_status` | string | 변경 전 상태 |
| `new_status` | string | 변경 후 상태 |
| `changed_by` | string | 변경자 UID |
| `changed_at` | ISO8601 | 변경 시각 |
| `note` | string | 변경 사유 (선택) |

### 3-3. 직원 정보 변경 로그

**제안 컬렉션**: `employee_change_logs`

| 필드 | 타입 | 설명 |
|------|------|------|
| `employee_id` | string | 대상 직원 ID |
| `field` | string | 변경 필드명 (wage, account, team 등) |
| `old_value` | any | 변경 전 값 |
| `new_value` | any | 변경 후 값 |
| `changed_by` | string | 변경자 UID |
| `changed_at` | ISO8601 | 변경 시각 |
| `source` | string | 변경 경로 ('UPLOAD' / 'MANUAL') |

### 3-4. 연차 잔여일 조정 로그

**제안 컬렉션**: `leave_adjustment_logs`

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | string | 대상 직원 UID |
| `year` | number | 대상 연도 |
| `adjustment_type` | string | 'MANUAL' / 'CARRYOVER' / 'SYSTEM' |
| `old_total` | number | 변경 전 total_days |
| `new_total` | number | 변경 후 total_days |
| `old_used` | number | 변경 전 used_days |
| `new_used` | number | 변경 후 used_days |
| `changed_by` | string | 변경자 UID |
| `changed_at` | ISO8601 | 변경 시각 |
| `reason` | string | 조정 사유 |

---

## 4. 구현 우선순위 제안

| 순위 | 영역 | 사유 |
|:----:|------|------|
| 1 | 근태 수정 로그 | 급여 산출 근거 — 분쟁 시 가장 빈번하게 확인 필요 |
| 2 | 연차 잔여일 조정 로그 | 수동 조정 시 사유 추적 필수 |
| 3 | 급여 상태 변경 로그 | 확정/수정 책임 소재 명확화 |
| 4 | 직원 정보 변경 로그 | 시급 변경 등 급여 영향 이력 |

---

## 5. 현재 Firestore 보안 규칙 요약 (로그 관련)

| 컬렉션 | 읽기 | 쓰기 | 비고 |
|--------|:----:|:----:|------|
| `approvals` | 처리자/admin/신청자 | **Cloud Functions 전용** | 클라이언트 차단 |
| `attendance` | 인증된 사용자 | admin | 로그 미생성 |
| `payroll_status` | 인증된 사용자 | admin | 로그 미생성 |
| `employees` | 인증된 사용자 | admin | 로그 미생성 |
| `leave_adjustments` | 인증된 사용자 | admin | 로그 미생성 |
| `leave_carryovers` | 인증된 사용자 | admin | 로그 미생성 |

> **참고**: 로그 컬렉션 신설 시 `approvals`과 동일하게 Cloud Functions 전용 쓰기 + admin 읽기 권한 적용 권장
