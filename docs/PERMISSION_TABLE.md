# 권한표 (Permission Table)

> 작성일: 2026-04-03
> 근거: 저장소 코드 실제 확인 기준 (roleUtils.js, AuthContext.jsx, functions/index.js, App.jsx, firestore.rules)
> 상태: 초안 — 사용자 확인 후 확정

---

## 1. 역할 구분

| roleGroup | 표시명 | 설명 |
|-----------|--------|------|
| `employee` | 아르바이트 | 일반 직원 (연차 신청, 본인 내역 조회) |
| `manager` | 팀 관리자 | 팀 1차 승인자 |
| `approver_senior` | 실장 | 2차 병렬 승인자 |
| `approver_final` | 대표 | 3차 최종 승인자 + 차감 실행 |
| `sys_admin` | 시스템 관리자 | 읽기 전용 뷰어 |

**레거시 매핑** (roleUtils.js에서 확인):
- `ALBA` → `employee`
- `TEAM_APPROVER` → `manager`
- `FINAL_APPROVER` → `approver_senior`
- `SUPER_ADMIN` → `approver_final`
- `VIEWER` → `sys_admin`

---

## 2. 역할별 기능 권한 매트릭스

### 연차 관련

| 기능 | employee | manager | approver_senior | approver_final | sys_admin |
|------|:--------:|:-------:|:---------------:|:--------------:|:---------:|
| 연차 신청 | O | O | O | O | X |
| 본인 내역 조회 | O | O | O | O | O (뷰어) |
| 본인 신청 취소 (SUBMITTED만) | O | O | O | O | X |
| 팀 승인 (1차) | X | O | X | X | X |
| 실장 승인 (2차 병렬) | X | X | O | X | X |
| 대표 승인 (3차 최종) | X | X | X | O | X |
| 반려 | X | O | O | O | X |

### 위임 관련

| 기능 | employee | manager | approver_senior | approver_final | sys_admin |
|------|:--------:|:-------:|:---------------:|:--------------:|:---------:|
| 팀 위임 생성/해제 | X | O | X | X | X |
| 실장 위임 생성/해제 | X | X | O | X | X |
| 대표 위임 생성/해제 | X | X | X | O | X |
| 위임받은 승인 처리 | O* | O* | O* | O* | X |

*위임을 받은 경우에만 가능

### 관리 관련

| 기능 | employee | manager | approver_senior | approver_final | sys_admin |
|------|:--------:|:-------:|:---------------:|:--------------:|:---------:|
| 사용자 계정 승인 | X | X | O | O | X |
| 사용자 계정 반려 | X | X | O | O | X |
| 사용자 정지/해제 | X | X | O | O | X |
| 역할/팀 변경 | X | X | O | O | X |
| 연차 잔여일 관리 | X | X | O | O | X |

### 급여 관련 (코드에서 확인)

| 기능 | employee | manager | approver_senior | approver_final | sys_admin |
|------|:--------:|:-------:|:---------------:|:--------------:|:---------:|
| 급여 조회 (PayrollView) | O | O | O | O | O (뷰어) |
| 출퇴근 기록 입력/업로드 | X | X | O | O | X |
| 급여 계산 실행 | X | X | O | O | X |
| 급여 엑셀 다운로드 | X | X | O | O | X |
| 직원 정보 관리 (HRView) | X | X | O | O | O (뷰어) |

> **주의**: 급여 관련 권한은 App.jsx의 화면 분기 기준이며, Firestore rules에서의 세부 제어는 별도 확인 필요

---

## 3. 화면 접근 범위

| 화면 (View) | 접근 가능 roleGroup | 비고 |
|-------------|---------------------|------|
| AlbaView | `employee` | 내 정보, 연차 신청, 신청 내역 |
| TeamApproverView | `manager` | 팀 승인, 위임 관리, 팀원 목록 |
| FinalApproverView | `approver_senior`, `sys_admin` | 실장 승인, 계정 관리, 잔여일 관리, 위임 |
| SuperAdminView | `approver_final` | 대표 최종 결재, 전체 기록 조회 |

> sys_admin은 FinalApproverView에 접근하되 `VIEWER` 모드 (읽기 전용)

---

## 4. 주의할 권한 충돌 포인트

1. **approver_final과 sys_admin의 레거시 매핑 겹침**: 둘 다 `SUPER_ADMIN`/`VIEWER`에서 분기됨. normalizeProfile()에서 처리하지만 기존 데이터 마이그레이션 상태는 미확인
2. **위임 수신자 범위**: employee가 manager로부터 위임을 받을 수 있음 (AlbaView에 DELEGATE 탭 존재). 이 경우 employee가 팀 승인 권한을 갖게 됨
3. **급여 관련 권한 세분화 미비**: 현재 급여 접근은 화면 분기 수준이며, Firestore rules에서 급여 데이터에 대한 역할별 세부 제어가 어느 수준인지 추가 확인 필요

---

## 5. 사용자 상태 흐름

| 상태 | 설명 |
|------|------|
| `PENDING` | 가입 후 관리자 승인 대기 |
| `ACTIVE` | 정상 사용 가능 |
| `REJECTED` | 가입 거절됨 |
| `SUSPENDED` | 계정 정지됨 |

> 로그인 시 PENDING/REJECTED/SUSPENDED 상태이면 차단 (AuthContext.jsx 87-105행)

---

## 6. 미구현 / 후속 설계 필요 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 연차 조정 로그 조회 권한 | 미구현 | 조정 기능 자체는 존재하나 변경 이력 로그 미존재 |
| 팀원 목록 확장 (팀 관리자) | 사용자 제공 기준 | 현재 팀원 목록은 조회만 가능 |
| 엑셀 다운로드 권한 세분화 | 미확인 | 현재는 화면 접근 기준으로만 제어 |
| 급여 명세서 직원 본인 다운로드 | 사용자 제공 기준 | 현재 직원 본인은 급여 조회만 가능, 다운로드 기능 미확인 |
