---
description: 빌드 → 오류 확인 → Firebase 배포 → 브라우저 검증 → GitHub 커밋/푸시
---

// turbo-all

## 배포 및 커밋 워크플로우

코드 수정 후 아래 순서로 실행합니다.

> **중요**: 배포 전 반드시 1~2단계 검증을 완료한 후 진행합니다.

### 1. 프로덕션 빌드 (오류 감지)
```
cmd /c "npm run build 2>&1"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

- 빌드 **성공** (Exit code: 0) 시 다음 단계로 진행
- 빌드 **실패** 시 에러 메시지 분석 후 코드 수정 → 1단계 재실행

### 2. 배포 전 브라우저 검증
빌드 완료 후, `browser_subagent` 도구로 배포 전 확인할 핵심 동작을 테스트합니다:
- 이번 수정으로 변경된 기능이 정상 동작하는지 확인
- 콘솔 에러 없는지 확인 (DevTools > Console)
- 눈에 띄는 UI 깨짐 없는지 스크린샷으로 확인

> **판단 기준**: 수정 범위가 작은 단순 버그픽스도 브라우저 검증을 진행합니다.  
> 오류 발견 시 코드 수정 후 1단계부터 다시 시작합니다.

### 3. Firebase Hosting + Firestore Rules 배포
```
cmd /c "npx firebase-tools deploy --only hosting,firestore:rules"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

배포 URL: https://alba-3b27d.web.app

> firestore.rules를 수정하지 않은 경우 `--only hosting`만 사용해도 됩니다.

### 4. 변경사항 스테이징
```
cmd /c "git add -A"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

### 5. 커밋 메시지 파일 생성 및 커밋 + 푸시
커밋 메시지를 `commit_msg.txt`에 작성한 뒤 아래 명령어를 실행합니다:
```
cmd /c "git commit -F commit_msg.txt && git push && del commit_msg.txt"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

> 참고: PowerShell에서 한글 커밋 메시지 사용 시 파싱 오류가 발생할 수 있으므로,
> 항상 `commit_msg.txt` 파일을 통해 커밋 메시지를 전달합니다.
