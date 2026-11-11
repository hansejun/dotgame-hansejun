# R1 Pre-consensus Intent Reconciliation

## Evidence inspected
- GAME_DESIGN.md v0: 2장 확정 이동 수치, 4·5·6장 R1 보완, 9장 R2 유예, 미정 목록, 10장 범위 밖.
- AGENTS.md: 기획서 유일 기준, 순수 로직, 문자 격자·8색·인덱스 배열, 9장 번호 수용 기준 및 사람의 브라우저 완료 확인.
- deep-interview-lighthouse-r0.md: 단계별 별도 승인, 미승인 참고 맵, R1~R3 보류. 과거 문서는 현재 기획서를 덮어쓰지 않음.
- stage-01-planner.md sha256 [REDACTED], S01~S14.

## Resolved material decisions
- 단일 goal: 맵 위에서 캐릭터가 한 칸씩 움직인다.
- M03: 사용자 선택 ‘R1 최소 기준만 9장에 선행 추가’. R1 이동용 최소 번호 수용 기준을 나중에 별도 승인받아 9장에 추가하는 계획을 포함한다. R2의 20항목 확장은 유지한다. AGENTS.md 예외나 규칙 완화는 하지 않는다.
- 이번 요청은 계획만. 현재 기획서·AGENTS.md·코드 수정 및 커밋 금지. 실행 허가 없음.
- M01과 M02는 기획서의 명시적 R1 미정 항목이다. 실제 도트·맵·8색·막힘 규칙을 지금 고르지 않고, 향후 기획 보완→사용자 검토→별도 구현 승인이라는 선행 게이트로 남긴다. 최종 계획을 실행 가능한 디자인의 일괄 승인으로 간주하지 않는다.

## Retained non-goals
- 타이머·점수·등불·유령·게임 HUD 값·화면 흐름·Enter 기능·효과음·저장·레벨2·3 없음.
- 미승인 임시 맵·색·스프라이트로 우회하지 않음. 현재 문서의 숫자 변경 없음.
- AGENTS.md 및 기획서10장 금지 기능 모두 유지.

## Open items
material-open-items: none (계획 계약 기준)
향후 실행 선행조건: 4·5·6장 디자인, 벽·경계 막힘 처리, 9장 최소 기준의 구체 문안은 아직 미정/미승인. 이 보류는 실행을 차단하며 확정된 게임 규칙을 늘리지 않는다.

## Required Planner revision
M03 미해결·예외 선택지를 제거하고 사용자 선택을 반영한 revision을 먼저 영속화한다. Architect/Critic은 그 revision과 이 intent만 검토한다.
