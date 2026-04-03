# 연차 규칙표 (Leave Rules)

> 작성일: 2026-04-03
> 근거: 저장소 코드 실제 확인 기준 (leaveUtils.js, AuthContext.jsx, functions/index.js, firestore.rules)
> 상태: 초안 — 사용자 확인 후 확정

---

## 1. 연차 유형

| 유형 코드 | 표시명 | 차감일수 | 날짜 제약 |
|-----------|--------|:--------:|-----------|
| `FULL` | 연차 | `applied_dates.length` (선택 날짜 수) | 복수 날짜 가능 |
| `HALF_AM` | 오전반차 | `0.5` | 단일 날짜만 |
| `HALF_PM` | 오후반차 | `0.5` | 단일 날짜만 |

**차감량 결정 로직** (functions/index.js - approveCEOLeave):
```
deduction = leaveReq.day_count ?? (DEDUCTION_MAP[leaveReq.type] ?? 1.0)
```
- `day_count` 필드 우선 사용, 없으면 type 기반 폴백

---

## 2. 연차 부여 기준 (leaveUtils.js)

### 2-1. 법정 연차 (`getLegalAnnualLeave(yearsWorked)`)

| 근속 연수 | 부여 일수 | 비고 |
|:---------:|:---------:|------|
| < 1년 | 0 | 1년 미만은 getFirstYearLeave로 별도 계산 |
| 1년 | 15일 | 기본 |
| 3년 | 16일 | (3-1)/2 = 1 추가 |
| 5년 | 17일 | |
| ... | ... | 2년마다 +1일 |
| 21년+ | 25일 | **상한: 25일** |

**공식**: `Math.min(15 + Math.floor((yearsWorked - 1) / 2), 25)`

### 2-2. 1년 미만 연차 (`getFirstYearLeave(startDate, endDate, absences)`)

- 입사일로부터 11개월간 월별 결근 유무 확인
- 결근 없는 월: 1일 부여
- **상한: 11일**
- 이월 기한: 입사 다음해 12월 31일 (`getFirstYearCarryoverDeadline`)

---

## 3. 연차 잔여일 관리

### 3-1. 저장 구조

| 항목 | 값 |
|------|------|
| 컬렉션 | `leave_balance` |
| 문서 ID | `{user_id}_{year}` (예: `abc123_2026`) |

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | string | 직원 UID |
| `year` | number | 연도 |
| `total_days` | number | 총 부여일 |
| `used_days` | number | 사용(차감)일 |
| `updated_at` | ISO8601 | 최종 수정 시각 |

### 3-2. 잔여일 계산

```
remaining = total_days - used_days
```

### 3-3. 차감 시점

- **최종 승인(CEO) 시에만 차감** (approveCEOLeave 함수 내부)
- 차감 전 검증: `remaining < deduction` → 오류 반환 ("잔여 연차 부족")
- 문서 미존재 시: `total_days: 0`, `used_days: deduction`으로 신규 생성

---

## 4. 신청 → 승인 흐름

### 4-1. 상태 전이도

```
SUBMITTED
  ├─ 취소 → CANCELLED (본인, SUBMITTED 상태에서만)
  ├─ 반려 → REJECTED (어느 단계에서든)
  └─ 팀 승인 → TEAM_APPROVED
                  └─ 실장 승인(병렬) → FINAL_PENDING
                                          └─ 전원 승인 → CEO_PENDING
                                                          └─ 대표 승인 → FINAL_APPROVED (차감 실행)
```

### 4-2. 각 단계 상세

| 단계 | 트리거 함수 | 입력 상태 | 출력 상태 | 처리자 |
|------|-------------|-----------|-----------|--------|
| 팀 승인 | `approveTeamLeave` | SUBMITTED | TEAM_APPROVED / REJECTED | manager (같은 팀) 또는 위임자 |
| 실장 승인 | `approveFinalLeave` | TEAM_APPROVED, FINAL_PENDING | FINAL_PENDING / CEO_PENDING / REJECTED | approver_senior (병렬 슬롯) |
| 대표 승인 | `approveCEOLeave` | CEO_PENDING | FINAL_APPROVED / REJECTED | approver_final 또는 위임자 |
| 본인 취소 | `cancelLeaveRequest` | SUBMITTED | CANCELLED | 신청자 본인 |

### 4-3. 팀 승인 건너뛰기

- `team_approval_config` 컬렉션에서 `teams[teamId].skipTeamApproval === true`이면
- 신청 시 초기 상태가 `SUBMITTED` 대신 `TEAM_APPROVED`로 설정

### 4-4. 실장 승인 병렬 슬롯

- `final_approvals` 맵에 각 실장의 UID를 키로 슬롯 생성
- 한 명이라도 REJECT → 즉시 전체 REJECTED
- 전원 APPROVE → CEO_PENDING으로 전이
- 일부만 APPROVE → FINAL_PENDING 유지

---

## 5. 신청 데이터 스키마

### 5-1. 컬렉션: `leave_requests`

| 필드 | 타입 | 설명 | 설정 시점 |
|------|------|------|-----------|
| `user_id` | string | 신청자 UID | 생성 |
| `team_id` | string | 소속 팀 | 생성 |
| `type` | string | FULL / HALF_AM / HALF_PM | 생성 |
| `reason` | string | 사유 | 생성 |
| `date` | YYYY-MM-DD | 레거시 호환용 시작일 | 생성 |
| `applied_dates` | string[] | 실제 적용 날짜 배열 | 생성 |
| `start_date` | YYYY-MM-DD | 시작일 | 생성 |
| `end_date` | YYYY-MM-DD | 종료일 | 생성 |
| `day_count` | number | 차감 일수 | 생성 |
| `status` | string | 현재 상태 | 생성/갱신 |
| `created_at` | ISO8601 | 생성 시각 | 생성 |
| `updated_at` | ISO8601 | 최종 수정 시각 | 갱신 |
| `final_approvals` | map | 실장 승인 슬롯 맵 | 실장 단계 |
| `ceo_decision` | map | 대표 결재 정보 | 대표 단계 |
| `rejected_by_uid` | string | 반려자 UID | 반려 시 |
| `rejected_by_name` | string | 반려자 이름 | 반려 시 |
| `rejected_reason` | string | 반려 사유 | 반려 시 |
| `rejected_stage` | string | 반려 단계 (TEAM/FINAL/CEO) | 반려 시 |
| `rejected_at` | ISO8601 | 반려 시각 | 반려 시 |

### 5-2. 신청 시 검증 (AuthContext.jsx - submitLeaveRequest)

1. `applied_dates.length > 0` (최소 1일)
2. 반차(`HALF_AM`/`HALF_PM`)는 단일 날짜만
3. **중복 검사**: 기존 활성 신청(`SUBMITTED`, `TEAM_APPROVED`, `FINAL_PENDING`, `CEO_PENDING`)과 날짜 겹침 불가

---

## 6. 위임 시스템

### 6-1. 위임 유형

| 위임 유형 | 컬렉션 | 위임자 | 수임자 | 적용 단계 |
|-----------|--------|--------|--------|-----------|
| 팀 위임 | `delegations` | manager | 같은 팀 직원 | 팀 승인 (1차) |
| 실장 위임 | `senior_delegations` | approver_senior | 다른 실장급 | 실장 승인 (2차) |
| 대표 위임 | `ceo_delegations` | approver_final | 실장급 이상 | 대표 승인 (3차) |

### 6-2. 공통 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `from_user_id` | string | 위임하는 사람 |
| `to_user_id` | string | 위임받는 사람 (= 문서 ID) |
| `is_active` | boolean | 활성 여부 |
| `start_date` | YYYY-MM-DD | 위임 시작일 |
| `end_date` | YYYY-MM-DD | 위임 종료일 |
| `created_at` | ISO8601 | 생성 시각 |
| `updated_at` | ISO8601 | 수정 시각 |

### 6-3. 유효성 검증

모든 위임은 처리 시점에 `today >= start_date AND today <= end_date` 검증

### 6-4. 클라이언트 쓰기 권한

| 컬렉션 | 클라이언트 쓰기 | 비고 |
|--------|:--------------:|------|
| `delegations` | O | Firestore rules 허용 |
| `senior_delegations` | X | admin 전용 |
| `ceo_delegations` | X | admin 전용 |

---

## 7. 승인 감사 로그

### 7-1. 컬렉션: `approvals`

| 필드 | 타입 | 설명 |
|------|------|------|
| `leave_request_id` | string | 대상 연차 신청 ID |
| `stage` | string | TEAM / FINAL / CEO |
| `action` | string | APPROVE / REJECT |
| `actor_user_id` | string | 실제 처리자 UID |
| `acted_at` | ISO8601 | 처리 시각 |
| `note` | string | 승인/반려 메모 |
| `delegation_from_user_id` | string\|null | 위임 원본자 UID (직접 처리 시 null) |

### 7-2. 접근 제어

- **생성**: Cloud Functions 전용 (클라이언트 차단)
- **읽기**: 처리자 본인, admin, 또는 원 신청자

---

## 8. 알림 (notifications)

| 알림 타입 | 발생 시점 | 수신자 |
|-----------|-----------|--------|
| `LEAVE_TEAM_APPROVED` | 팀 승인 완료 | 신청자 + 전체 실장 |
| `LEAVE_REJECTED` | 어느 단계든 반려 | 신청자 |
| `LEAVE_CEO_PENDING` | 실장 전원 승인 | 신청자 |
| `LEAVE_FINAL_APPROVED` | 대표 최종 승인 | 신청자 |

---

## 9. 미구현 / 확인 필요 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 연차 조정(leave_adjustments) 변경 로그 | 미구현 | 조정 기능 존재하나 이력 추적 없음 |
| 연차 이월(leave_carryovers) 자동 계산 | 미확인 | 컬렉션 존재, 자동화 로직 확인 필요 |
| 잔여일 수동 조정 감사 로그 | 미구현 | 관리자 직접 수정 시 이력 없음 |
| 신청 중복 검사의 날짜 단위 정밀도 | 확인됨 | applied_dates 배열 기반 날짜별 겹침 검사 |
