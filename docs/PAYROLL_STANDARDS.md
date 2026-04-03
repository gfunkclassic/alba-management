# 급여 계산 기준표 (Payroll Standards)

> 작성일: 2026-04-03
> 근거: 저장소 코드 실제 확인 기준 (App.jsx calculateMonthlyWage, useLeaveData.js, firestore.rules)
> 상태: 초안 — 사용자 확인 후 확정

---

## 1. 급여 계산 함수

**위치**: `src/App.jsx` (lines 212~426)
**함수**: `calculateMonthlyWage(user, targetMonth)`

---

## 2. 핵심 계산 공식

### 2-1. 일급 계산 (`calculateDailyWage`)

```
총근무시간 = 퇴근시각 - 출근시각 - 점심시간(1시간, 13:00~14:00)
정규근무시간 = 총근무시간 - 연장근무시간
기본급 = 정규근무시간 × 시급
연장수당 = 연장근무시간 × 시급 × 1.5
일급합계 = 기본급 + 연장수당
```

- **시간 형식**: "09시" 또는 "09:00" 모두 인식
- **연장근무 배율**: **1.5배**
- **점심시간 공제**: 13:00~14:00 (1시간) 자동 차감

### 2-2. 시급 변동 처리

```
if (근무일 < 시급인상일)
  적용시급 = 이전시급(previousWage)
else
  적용시급 = 현재시급(wage)
```

### 2-3. 주휴수당 (Holiday Bonus)

**발생 조건**:
1. 해당 주 총 근무시간 >= 15시간
2. 해당 주에 결근(`reason = '결근'`) 없음

**계산**:
```
주휴시간 = min(주간근무시간 / 5, 8)
주휴수당 = 주휴시간 × 해당주_시급
```

**집계 규칙**: 목요일이 대상 월에 속하는 주만 포함

### 2-4. 세금 공제

| 구분 | 공제율 | 공식 |
|------|:------:|------|
| 3.3% 공제자 (미가입) | 3.3% | `Math.floor((총급여 × 0.033) / 10) × 10` |
| 4대보험 가입자 | 0% | 별도 공제 없음 (보험료는 외부 처리) |

- **10원 미만 절사** (floor 후 10 단위 반올림)

### 2-5. 추정 급여 (근태 기록 없을 때)

```
월기본급(추정) = (일기본급 × 5일) × 4.345주
월주휴(추정) = 주휴수당_추정 × 4.345주 (workHours >= 3일 때만)
추정총급여 = Math.round(월기본급 + 월주휴)
```

- **4.345** = 월평균 주수 상수

---

## 3. 출력 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `estimated` | number | 추정 월급 (근태 기록 없을 때) |
| `actual` | number | 실제 총급여 (근태 기록 있을 때) |
| `displayTotal` | number | 표시용 총급여 (actual 우선, 없으면 estimated) |
| `deduction` | number | 3.3% 공제액 |
| `finalPayout` | number | 실지급액 (displayTotal - deduction) |
| `totalActualHours` | number | 총 실근무시간 |
| `totalActualOvertime` | number | 총 연장근무시간 |
| `hasRecord` | boolean | 해당 월 근태 기록 존재 여부 |
| `actualBasePayOnly` | number | 기본급 합계 (주휴 제외) |
| `actualHolidayPay` | number | 주휴수당 합계 |
| `weeklyLogsList` | array | 주간별 내역 |
| `dailyBreakdown` | array | 일별 내역 |

---

## 4. 근태 데이터

### 4-1. 저장 구조

| 항목 | 값 |
|------|------|
| 컬렉션 | `attendance` |
| 문서 ID | `{userId}` (문자열) |
| 구조 | `{ records: { "YYYY-MM-DD": record, ... } }` |

### 4-2. 근태 레코드 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `checkIn` | string | 출근시간 ("09:00" 또는 "09시") |
| `checkOut` | string | 퇴근시간 |
| `overtime` | number | 연장근무시간 (0~24) |
| `reason` | string | 근태사유 ('결근', '연차', '공휴일' 등) |
| `earlyLeaveReason` | string | 조기퇴근 사유 |
| `overtimeReason` | string | 연장근무 사유 |

### 4-3. 업로드 방식

**함수**: `handleAttendanceUpload` (App.jsx lines 645~707)
**파일 형식**: CSV 또는 XLSX

| 엑셀 열 | 필수 | 대체 헤더명 |
|---------|:----:|------------|
| 이름 | O | name |
| 근무일자 | O | 날짜 |
| 출근시간 | X | 출근 |
| 퇴근시간 | X | 퇴근 |
| 연장시간 | X | 연장 |
| 근태사유 | X | 사유, 비고 |
| 조기퇴근사유 | X | 조기퇴근 |
| 연장근무사유 | X | 연장근무 |

**특수 처리**:
- `reason`에 '결근' 포함 시 → checkIn/checkOut 강제 빈값
- 값 없으면 해당 직원의 기본 출퇴근 시간 사용
- `setDoc(..., { merge: true })` — 기존 기록에 병합

---

## 5. 급여 엑셀 다운로드

### 5-1. 4대보험 가입자 엑셀

**파일명**: `{YYYY-MM}_4대보험가입자_노무사전달용.xlsx`

**시트 구성**:
1. **"전체 급여 요약"**: 이름, 은행, 계좌번호, 기본급, 주휴수당, 합계, 비고, 상태
2. **개인별 시트** (직원 이름): 시급 정보, 주간 내역, 근태 특이사항, 급여 합산

### 5-2. 3.3% 공제자 CSV

**파일명**: `{YYYY-MM}_3.3공제자_본사지급요청.csv`

**열**: 성별, 이름, 은행, 계좌번호, 팀, 급여(세전), 3.3%공제, 실지급액, 비고

### 5-3. 근태 양식 템플릿

**파일명**: `근태양식_{YYYY-MM}_{팀명}.xlsx`
- 평일(월~금)만 포함
- 기본 출퇴근 시간 사전 입력

---

## 6. 급여 상태 관리

### 6-1. 저장 구조

| 항목 | 값 |
|------|------|
| 컬렉션 | `payroll_status` |
| 문서 ID | `global` |
| 구조 | `{ statuses: { "YYYY-MM": status, ... } }` |
| 로컬 캐시 | `localStorage: alba_payroll_status` |

### 6-2. 상태 흐름

```
DRAFT → REVIEW → CONFIRMED
                    ↓
                 AMENDING (수정 필요 시)
```

| 상태 | 설명 | 근태 수정 |
|------|------|:---------:|
| `DRAFT` | 입력 중 | O |
| `REVIEW` | 검토 요청 | O |
| `CONFIRMED` | 확정 완료 | **X (잠금)** |
| `AMENDING` | 수정 중 | O |

---

## 7. 직원 정보 (HR)

### 7-1. 저장 구조

| 항목 | 값 |
|------|------|
| 컬렉션 | `employees` |
| 문서 ID | `{employee.id}` (문자열) |

### 7-2. 주요 필드

| 필드 | 설명 | 급여 계산 사용 |
|------|------|:--------------:|
| `name` | 이름 | - |
| `team` | 소속 팀 | - |
| `wage` | 현재 시급(원) | O |
| `previousWage` | 이전 시급(원) | O |
| `wageIncreaseDate` | 시급 인상일 | O |
| `checkIn` / `checkOut` | 기본 출퇴근 시간 | O |
| `workHours` | 일 근무시간 | O |
| `startDate` | 입사일 | O |
| `resignDate` | 퇴사일 | O |
| `insuranceStatus` | 4대보험 가입 여부 | O |
| `bank` / `account` | 은행/계좌 | 엑셀 출력용 |
| `gender` | 성별 | 엑셀 출력용 |

---

## 8. Firestore 보안 규칙 (급여 관련)

| 컬렉션 | 읽기 | 쓰기 | 비고 |
|--------|:----:|:----:|------|
| `employees` | 인증된 사용자 | admin만 | |
| `attendance` | 인증된 사용자 | admin만 | |
| `payroll_status` | 인증된 사용자 | admin만 | |

**admin 정의**: `FINAL_APPROVER` role 또는 `approver_final` / `approver_senior` / `sys_admin` roleGroup

---

## 9. 미구현 / 확인 필요 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| 근태 수정 감사 로그 | **미구현** | setDoc merge 시 변경 이력 없음 |
| 급여 확정 승인 워크플로우 | **미구현** | 상태 변경은 수동, 승인 절차 없음 |
| 급여 상태 변경 이력 | **미구현** | 현재 상태만 저장, 변경 시각/변경자 없음 |
| 직원 정보 변경 이력 | **미구현** | 덮어쓰기 방식, 이전 값 보존 안 됨 |
| 급여 명세서 직원 본인 다운로드 | **미확인** | 현재 직원은 조회만 가능 |
| CONFIRMED 상태 잠금의 서버측 검증 | **미확인** | 현재 클라이언트 분기 수준 |
