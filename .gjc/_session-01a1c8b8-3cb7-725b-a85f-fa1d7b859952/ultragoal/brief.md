승인 계획 .gjc/_session-01a1c8b8-3cb7-725b-a85f-fa1d7b859952/plans/ralplan/01a1c8b8-3cb7-725b-a85f-fa1d7b859952/pending-approval.md 및 필수 부속 revision4 준수. 먼저 GAME_DESIGN 2/3/4/5/9장을 갱신해 사람에게 보여주고 명시 검토 전 코드 수정 금지. goal-2 사람 브라우저 확인 전 goal-3 착수 금지. 확정숫자·범위 불변. 커밋/푸시 금지.
@goal: goal-2 목표물·위협·타이머·HUD
문서 선행 갱신·사람 검토 후 L5·유령1·400ms 왕복·60초·100점·보너스floor초*10·같은칸/맞교환 충돌·실패우선·HUDceil·terminal 구현. test/logic.test.js 숫자기반 회귀 추가와 node --test test/ 통과. 실제 사람이 AC8-23과 이동회귀를 확인해야 완료.
@goal: goal-3 승패·화면 전환
goal-2 사람 확인 후 타이틀/플레이/클리어/실패·최소문구 strings.js·Enter/reset 구현. R2클리어Enter무동작, 다음레벨R3goal4. 실패Enter타이틀점수0, 반복/동일누름재사용방지. test/logic.test.js 숫자기반 테스트와 node --test test/ 통과. 실제 사람이 AC24-32와 core회귀 확인해야 완료.
