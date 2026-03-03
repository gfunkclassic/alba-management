---
description: 빌드 후 Firebase 배포 및 GitHub 커밋/푸시
---

// turbo-all

## 배포 및 커밋 워크플로우

코드 수정 후 아래 순서로 실행합니다.

### 1. 프로덕션 빌드
```
cmd /c "npm run build"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

빌드 성공 확인 후 다음 단계로 진행합니다.

### 2. Firebase Hosting 배포
```
cmd /c "npx firebase-tools deploy --only hosting"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

배포 URL: https://alba-3b27d.web.app

### 3. 변경사항 스테이징
```
cmd /c "git add -A"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

### 4. 커밋 메시지 파일 생성 및 커밋 + 푸시
커밋 메시지를 `commit_msg.txt`에 작성한 뒤 아래 명령어를 실행합니다:
```
cmd /c "git commit -F commit_msg.txt && git push && del commit_msg.txt"
```
실행 디렉토리: `c:\Users\김기해\Desktop\알바`

> 참고: PowerShell에서 한글 커밋 메시지 사용 시 파싱 오류가 발생할 수 있으므로,
> 항상 `commit_msg.txt` 파일을 통해 커밋 메시지를 전달합니다.
