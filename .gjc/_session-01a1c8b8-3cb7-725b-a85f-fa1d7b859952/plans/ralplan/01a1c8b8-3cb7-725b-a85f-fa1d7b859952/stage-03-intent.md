# R2 Intent Reconciliation
Evidence: GAME_DESIGN.md v1 §§2–10; AGENTS.md; v0 deep-interview-lighthouse-r0.md 확정 규칙/Deferrals/Rounds4–13; prior R1 pending-approval; current logic/main/levels/sprites/tests; stage-01-planner.md 및 stage-02-planner.md(AC-6 오탈자 정정, 리뷰 전 superseded).
## 사용자 결정
1. 다음 레벨 진입은 R3 goal-4 완료 조건으로 분리. R2 goal-3은 레벨1 클리어 화면과 획득 점수 표시까지 완료. R2 클리어 Enter는 아무 동작 없음(사용자가 명시한 현재 정식 동작이며 임시 fallback 아님). 실패 Enter→타이틀 및 점수0 포함.
2. 입력/시간 처리1회를 동일 갱신으로 정의. 현재 입력보다 이전의 400ms 기한은 시간순 개별 처리, 정확히 같은 시각의 유령 이동과 입력은 함께 처리. 이미 처리된 기한 소급 병합 없음. performance.now 실제 경과시간, blur/백그라운드에서도 일시정지 없음.
3. HUD ceil(remainingMs/1000), 보너스 floor(remainingMs/1000)*10. 시작60, 60000ms에서0/실패.
4. 실패 갱신 점등은 반영하되 신규100점·보너스 지급 없음. 이전 점수 유지, 실패 Enter에서0.
5. 타이틀 새 Enter→레벨1, 플레이 Enter 무시. repeat 및 같은 누름 화면간 재사용 금지.
6. 최소 문구를 R2 3장에 명시하고 src/strings.js 한곳 관리: 타이틀 폭풍 전의 등불 / ENTER로 시작; 클리어 등불을 모두 켰다 / 점수; 실패 시간초과 폭풍이 왔다, 충돌 유령에게 잡혔다 / 점수 / ENTER로 타이틀. 7장 전체 정리는 R3. 문구 다듬기 가능하지만 현재 지정안을 우선.
## Retained non-goals
레벨2/3 실제 맵·사운드·저장·최종 화면은 R3. 확정 수치 불변. 기획서와 제품/테스트는 현재 수정 금지. 계획 승인 후 별도 문서 선행 변경·사람 검토가 구현 전제. L5와 a경로 후보 격자 사람 검토, 새 색/조명/추적/일시정지/추가조작 없음.
material-open-items: none
문서 선행 단계에서 맵/도트 제안은 사람에게 제시 후 채택; 이번 결정은 구현 승인 아님. Planner는 위 결정/최소문구를 반영한 revision3을 저장한 뒤 두 리뷰에 전달한다.
