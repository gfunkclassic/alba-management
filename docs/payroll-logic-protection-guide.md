# 급여 로직 보호 가이드 (Payroll Logic Protection Guide)

> 작성일: 2026-05-18
> 상태: 보호 문서 (코드 변경 0건 / read-only 정리)
> 대상 브랜치: master HEAD `2a7df0e` (PR #143 머지 시점)
> 목적: 회사 GitHub 이전 전, 급여 산식/표시/다운로드/출력 구조 방어
> 관련 PR: #120~#143
> 비고: 본 문서는 기존 `docs/payroll-recognition-design.md`(fmj-worklog 인정시간 설계),
> `docs/PAYROLL_STANDARDS.md`와 별개이며, 어느 것도 덮어쓰지 않는다.

---

## 1. 문서 목적

- 회사 GitHub 이전 후 대표/다른 작업자가 함께 보더라도 급여 로직의 의도와 금지영역을 이해하도록 한다.
- 다음 사고를 방지한다.
  1. 금액을 맞추기 위한 직원명/팀명/월 기준 하드코딩
  2. 기본급·야근수당·주휴수당·연차·반차가 서로 섞이는 것
  3. 화면 표시와 다운로드 금액이 다른 기준을 쓰는 것
  4. 실제근무시간 / 급여 인정시간 / 야근시간 의미 혼동
  5. `calculateMonthlyWage` / `downloadLaborSubmission` 임의 수정으로 산식 붕괴
  6. PR #120~#143 확정 정책 누락으로 과거 버그 재발
- **원칙**: 급여 산식은 회사 운영 정책을 일반 산식으로 구현한 것이다. 화면/다운로드/출력은 산식 결과를 **표시하는 계층**일 뿐이며, 표시 계층에서 금액을 다시 계산하거나 보정하지 않는다.

---

## 2. 현재 급여 계산 구조 요약

| 계층 | 파일/함수 | 역할 |
|---|---|---|
| 출퇴근 원천 | Firestore `attendance/{empId}.records` | 실제 checkIn/checkOut/overtime/reason만 저장. 인정시간 미저장 |
| 일별 계산 | `src/App.jsx` `calculateDailyWage` | 출퇴근 절삭 → basePay/overtimePay/hours/regularHours/actualOvertime 산출 |
| 일별 보정 체인 | `applyDailyRecognitionCap` → `applyAnnualLeaveCredit` → `applyHalfDayLeaveCredit` | cap(소정시간 상한) → 연차 인정 → 반차 보전 순으로 일별 결과 보정 |
| 월별 계산 | `src/App.jsx` `calculateMonthlyWage` | 일별 누적 + 주휴 산정 → 월 급여/시간 필드 산출 (단일 산식 출처) |
| 리스트 화면 | `src/components/PayrollView.jsx` | 인정시간/금액 **표시만**. 산식 없음 |
| 상세 모달 | `src/components/modals/PayrollDetailModal.jsx` | `wage` props **표시만**. 화면 UI + print-only A4 명세서(포털) |
| 노무사 제출 양식 | `src/App.jsx` `downloadLaborSubmission` | 일반급여/야근수당/주휴수당 분해 + 일별/주차표. 산식 재계산 없음 |
| 4대보험/노무사 전달 | `src/App.jsx` `downloadInsuredCSV` | 요약 CSV. (야근수당 컬럼 분해는 후속 과제) |
| 출력/PDF | PayrollDetailModal print-only 블록 + `src/index.css` `@media print` | 화면 표시값 기반 A4 1장 명세서. 산식 무관 |

**계층 분리 원칙**: 산식은 `calculateDailyWage` / `calculateMonthlyWage` **한 곳**에서만. 표시/다운로드/출력 계층은 산출된 `wage` 값을 골라 보여줄 뿐, 새 계산식을 만들지 않는다.

---

## 3. 핵심 급여 정책

### 3-1. 출퇴근 절삭 기준 (PR #131)
- 조기 출근(예 08:50/08:57)은 업무 시작 09:00(직원별 scheduledIn) 기준으로 봄 → 조기 출근분 정규 미인정.
- 야근 인정이 아닌 늦은 퇴근(예 17:05/17:24)은 정규 종료(직원별 scheduledOut) 기준으로 절삭.
- `overtime > 0`인 날은 additive 모델 유지(절삭 후 OT 별도 가산).
- scheduledIn/scheduledOut(직원 checkIn/checkOut 계약값) 누락 시 절삭 미적용(원천 보존).
- 실제 입력 시각을 분 단위 그대로 기본급에 반영하지 않는다. 야근이 아닌 잔여 퇴근시간은 기본급 증가 요소가 아니다.

### 3-2. 기본급 산정 기준 (PR #133)
- `regularHours = Math.max(0, Math.floor(totalHours + 1e-9))` — 일별 floor(분 단위 잔여 절삭, 1e-9는 부동소수 정수 보정).
- `daily.basePay = regularHours × wage`.
- 분 단위 잔여는 기본급에 반영하지 않는다.
- 화면/다운로드의 총 근무시간은 기본급 기준과 일관되게 `totalRegularHours`(Σ regularHours)를 우선 사용한다 (PR #135).

### 3-3. 야근수당 기준 (PR #127, #128, #136)
- 야근은 정규근무에서 차감하지 않는다(additive). `actualOvertime = record.overtime`(정수, "2h" 등 파싱 정상화 PR #127).
- `overtimePay = actualOvertime × wage × 1.5`.
- 야근수당은 기본급과 분리 표시. 노무사 제출 양식에서 일반급여(`baseOnlyPay`) / 야근수당(`totalOvertimePay`) / 주휴수당(`actualHolidayPay`) 분리(PR #136).

### 3-4. 주휴수당 기준 (PR #124, #129, #132)
- 주휴 판단·시간은 `weeklyHours`(OT 제외 정규시간 = Σ `daily.regularHours`) 기준(PR #129).
- 주차 귀속은 Friday-rule(주의 금요일이 속한 월로 귀속, PR #124).
- 월경계라도 정상 주차(입사/퇴사 주차 아님)면 직원별 소정근로시간(`workHours`) 기준으로 주휴 인정(PR #132, D안).
- 현재 D안 발생 조건: 주 15h 이상 + 해당 주 결근 없음. (입사/퇴사 주차는 `weeklyHours/5` cap8 비례)
- 향후 "소정근로일 개근" 정밀화(중도입사/퇴사/부분주차 포함)는 **노무사 확인 후 별도 작업 필요** — 현재 미반영.

### 3-5. 연차/반차 기준 (PR #122, #123)
- 연차일: 직원별 1일 계약 근무시간(`workHours`) 기준으로 인정.
- 반차일: 실제근무 + 반차 인정분을 합산해 직원별 1일 계약 근무시간까지 보전.
- 휴무/연차/반차는 출퇴근 원천시간으로 억지 계산하지 않고 reason(시스템 상태/정책)으로 반영.

### 3-6. 직원별 계약 근무시간 기준
- 남양주 7h / 본사 8h처럼 **사업장 고정값으로 단정 금지**.
- 직원별 인사관리 정보의 일 근무(h)/계약 근무시간(`employees.workHours`)을 우선 사용.
- 추후 fmj-worklog 업로드 연동 시에도 직원별 계약시간 기준 유지.

---

## 4. 주요 필드 의미 (현재 코드 기준)

| 필드 | 의미 | 주의 |
|---|---|---|
| `daily.hours` | cap 후 정규 인정시간, **floor 미적용(unfloored)** = totalHours | 표시 원천 아님(아래 참고) |
| `daily.regularHours` | `floor(totalHours+1e-9)` — **basePay 산정 기준** | 기본급/주휴 누적 기준 |
| `daily.actualOvertime` | `record.overtime` (정수, OT 시간) | 정규와 별개 |
| `daily.basePay` | `regularHours × wage` | |
| `daily.overtimePay` | `actualOvertime × wage × 1.5` | |
| `totalActualHours` | Σ `daily.hours` (unfloored) — **레거시 표시 필드** | `totalRegularHours`와 **다름**. 화면/다운로드는 `totalRegularHours` 우선 |
| `totalRegularHours` | Σ `daily.regularHours` (floored) — 화면/다운로드 시간 표시 기준 (PR #135) | basePay와 일관 |
| `totalActualOvertime` | Σ `daily.actualOvertime` (야근 시간 합) | 야근 "시간" |
| `actualBasePayOnly` | `Math.round(actualBaseOvertimePay)` = **기본급 + 야근수당 합산**(레거시 호환) | 이름과 달리 base+OT. 신규 표시/분해엔 사용 금지 |
| `baseOnlyPay` | Σ `daily.basePay` — **순수 기본급** (PR #136) | 노무사 양식 일반급여 |
| `totalOvertimePay` | Σ `daily.overtimePay` — **야근수당 금액** (PR #136) | 노무사 양식 야근수당 |
| `actualHolidayPay` | 주휴수당 합 | |
| `actual` | `Math.round(actualBaseOvertimePay + actualHolidayPay)` — **세전 총급여(불변 산식)** | 분해 변경해도 이 값은 유지 |
| `dailyBreakdown[]` | 일별 {date,checkIn,checkOut,hours,regularHours,overtimeHours,basePay,reason,isRecorded} | 상세 모달/명세서 표시용 |
| `weeklyLogsList[]` | 주차별 {weekStr,daysWorked,totalHours,holidayPay,holidayHours} | 주휴 근거 |
| `weeklyHours` | 주차별 Σ `daily.regularHours` (OT 제외) | 주휴 판단 기준 |

**혼동 방지 핵심**
- `hours` ≠ `regularHours` (전자 unfloored, 후자 floored=기본급 기준)
- `totalActualHours` ≠ `totalRegularHours` (표시는 `totalRegularHours` 우선)
- `actualBasePayOnly`는 base+OT 의미(레거시). 노무사 분해는 `baseOnlyPay`/`totalOvertimePay`/`actualHolidayPay`/`actual` 사용.

---

## 5. 화면 / 다운로드 / 출력 기준

### 5-1. PayrollView
- 리스트 화면. 급여 인정시간(`totalRegularHours` 우선) / 금액 표시 담당.
- **금액 산식을 여기서 만들지 않는다.** `calculateMonthlyWage` 결과만 표시.

### 5-2. PayrollDetailModal
- 계산된 `wage` props를 받아 표시(재계산 없음).
- 화면용 모달 UI와 print-only A4 명세서는 **레이아웃은 분리, 값 출처는 동일**(`wage`).
- print-only 블록은 `createPortal`로 body 직속 렌더, `@media print`에서 `body > #root` 숨김 → 빈 페이지 방지(PR #143).

### 5-3. downloadLaborSubmission (노무사 제출 양식)
- 일반급여=`baseOnlyPay`, 야근수당=`totalOvertimePay`, 주휴수당=`actualHolidayPay`, 총=`actual` (PR #136).
- 총액(`actual`) 산식 불변. 2026-04 기준 `baseOnlyPay+totalOvertimePay+actualHolidayPay = actual` 정합(정수 wage·정수 OT에서 diff 0).
- 양식 구조 변경 시 화면/명세서/다운로드 정합성 재검증 필수.

### 5-4. downloadInsuredCSV
- 현재 야근수당 컬럼 구조 변경 **미진행**. 기본급 컬럼이 base+OT(`actualBasePayOnly`)를 사용하는 상태.
- 야근수당 컬럼 추가는 양식 구조 변경 → 별도 정책 판단 + 노무사/4대보험 양식 합의 필요. **후속 검토**.

### 5-5. A4 급여명세서 출력
- PayrollDetailModal print-only 영역. PR #143 기준 빈 2페이지 제거(포털 + `@media print` 격리).
- 급여 산식과 무관한 출력 레이아웃. 인쇄/PDF는 화면 표시값 기반.
- 앱 본문은 인쇄에서 제외, 급여명세서만 출력. (브라우저 머리글/바닥글은 코드 제어 불가)

---

## 6. 검증 기준값 (2026-04, 사용자 제공 기준)

> 주의: 아래는 **금액을 맞추기 위한 하드코딩 기준이 아니라**, 회사 급여 정책이 올바르게 반영됐는지 확인하는 **회귀 검증값**이다. 동일 산식으로 다음 달에도 재현 가능해야 하며, 특정 직원/팀/월 예외처리는 금지. 본 값들은 사용자 검증 화면 기준이며, 코드 실행으로 재확인된 값은 아님(미확인).

### LM 9명 회귀 가드 (각 154h)
| 직원 | 시간 | 금액 |
|---|---|---|
| 이태호 | 154h | 2,598,960원 |
| 안소라 | 154h | 2,275,000원 |
| 허지윤 | 154h | 2,184,000원 |
| 함유진 | 154h | 2,184,000원 |
| 최휘강 | 154h | 2,184,000원 |
| 이희정 | 154h | 2,184,000원 |
| 박태언 | 154h | 2,184,000원 |
| 안정미 | 154h | 2,184,000원 |
| 이윤정 | 154h | 2,184,000원 |

### QC/본사 검증값
| 직원 | 시간 | 금액 |
|---|---|---|
| 김아영 | 175h + OT 6h | 2,592,000원 |
| 김소은 | 176h + OT 6h | 2,604,000원 |
| 박세희 | 176h + OT 6h | 2,387,000원 |
| 권기덕 | 176h + OT 6h | 2,278,500원 |
| 송명욱 | 88h + OT 6h | 1,243,000원 |
| 최홍석 | 110h | 1,430,000원 |
| 전지영 | 154h | 1,911,000원 |

---

## 7. 수정 금지 및 주의 영역

- 직원명/팀명/월 기준 예외처리 금지
- 특정 금액에 맞추기 위한 역산 금지
- 화면만 맞추고 다운로드가 틀어지는 수정 금지 / 그 반대도 금지
- 주휴와 야근을 섞어 계산 금지
- 야근을 정규근무에서 차감 금지(additive 유지)
- `totalActualHours`와 `totalRegularHours` 혼동 금지
- `actualBasePayOnly`(base+OT)를 순수 기본급으로 표시 금지 — `baseOnlyPay` 사용
- 연차/반차를 출퇴근 원천시간으로 억지 계산 금지(reason 기반 유지)
- Firestore 데이터 직접 write 금지
- `functions/index.js`, `firestore.rules`, `AuthContext.jsx` 임의 수정 금지
- 서비스 계정 키 / `backups/` / `.env` 커밋 금지(.gitignore 보호됨, PR #134)
- 회사 GitHub 이전 전 백업 없이 데이터 이전 금지

---

## 8. 향후 작업 체크리스트

1. **downloadInsuredCSV 야근수당 컬럼 추가 검토** — 양식 구조 변경. 별도 정책 판단 + 노무사/4대보험 양식 합의 필요.
2. **주휴 발생 판단 정밀화** — 현재 D안(15h↑ + 결근 없음). 소정근로일 개근, 중도입사/퇴사, 부분주차는 노무사 확인 후 정밀화.
3. **Firestore 완전 백업** — client SDK 백업은 partial(notifications 등 permission-denied). `leave_requests`/`approvals` 0건 운영 정상 여부 **미확인**. 데이터 이전 전 Cloud Firestore Export 또는 Admin SDK 백업 필요.
4. **회사 GitHub 이전 준비** — 급여 보호 문서(본 문서), `.gitignore` 보호(PR #134) 완료. 백업 완료 / untracked(`.firebaserc`,`docs/payroll-recognition-design.md`,`scripts/`) 정리 여부 결정 / 민감정보·키·백업 미포함 확인 필요.
5. **FMJ-worklog 업로드 연동** — 보류된 후속. 직원별 계약 근무시간 기준 유지 필요.

---

## 9. PR/작업 전 필수 회귀 체크

급여 관련 PR 전 반드시 확인:
- [ ] `npm run build` 성공
- [ ] 변경 파일 목록 확인 (의도 범위만)
- [ ] App.jsx 산식 변경 여부 확인
- [ ] PayrollView 표시 영향 확인
- [ ] PayrollDetailModal 화면/출력 영향 확인
- [ ] downloadLaborSubmission 영향 확인
- [ ] downloadInsuredCSV 영향 확인
- [ ] LM 9명 금액 유지
- [ ] 김아영/김소은/박세희/권기덕/송명욱 금액 유지
- [ ] 최홍석/전지영 금액 유지
- [ ] 화면 금액 = 다운로드 금액
- [ ] 노무사 제출 양식 항목합계 = 총급여(`actual`)
- [ ] 급여 상세 출력 PDF 1/1 여부
- [ ] Firestore write 없음
- [ ] functions/rules 변경 여부 확인
- [ ] 직원명/팀명/월 하드코딩 없음 확인

---

## 10. 작업자용 경고문

> 이 프로젝트의 급여 계산은 특정 월 금액을 맞추기 위한 예외처리가 아니라, 회사 운영 정책을 일반 산식으로 구현한 것입니다. 급여 금액이 예상과 다를 경우 먼저 출퇴근 데이터, 직원별 계약 근무시간, 연차/반차 상태, 야근 입력, 주휴 조건을 read-only로 감사해야 하며, 직원명/팀명/월 기준으로 산식을 우회하거나 하드코딩해서는 안 됩니다.
