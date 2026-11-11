# REPORT — 폭풍 전의 등불 (dotgame-hansejun)

> 작성 주체 안내: 이 과제에서 "사람" 역할(인터뷰 답변·플랜 승인/반려·브라우저 확인·스크린샷·이 보고서)은 학생(hansejun)의 지시에 따라 **Claude Code가 대행**했다. 기획서 9장의 확인 표시에 "사용자 대행 Claude Code"라고 적은 이유다. gjc(gajae-code 0.20.0, gpt-6.1-sol · thinking medium)는 Paseo 터미널 탭에서 사람이 보는 가운데 조작했다.

## 1. 기획서가 어떻게 자랐는가

| 버전 | 커밋 | 추가된 것 | 왜 그 라운드였나 |
|---|---|---|---|
| v0 | `666d3c2` | 1장 콘셉트, 2장 이동 규칙(120ms·16px·15×11·240×192→720×576), 10장 범위 밖 | 인터뷰(모호성 1.5%)에서 확정된 것만. 맵은 인터뷰가 3개를 제안했지만 "라운드마다 키운다"는 원칙으로 R1·R3로 미룸 |
| v1 | `f131993` | 2장 벽 입력 무시, 4장 오브젝트, 5장 레벨 1 맵(`# . P`), 6장 8색, 9장 AC-1~7 | R1 첫 ralplan이 M01(맵·도트·색)·M02(벽 입력)를 실행 차단 요소로 짚어 **코드보다 먼저** 채움 |
| v2 | `be0243b` | 2장 등불·유령·시간·점수·갱신 순서, 3장 화면 흐름, 5장 레벨 1에 `L`·`a`, 9장 AC-8~32 | goal-2/3(core loop)이 필요로 하는 규칙만. 레벨 2 진입은 R3로 분리 |
| v3 | `8d13a65` | 5장 레벨 2·3, 7장 사운드·UI 텍스트, 8장 기술 스펙, 9장 AC-33~48, 10장 갱신 | goal-4/5(shell). 10장 전부 채움 |

## 2. 막힌 goal 1개의 원인 분석 — goal-1(G001) 완료 처리 차단

- 기록: `.gjc/_session-01a1c888-b7d4-7698-a496-0d61e2135616/ultragoal/ledger.jsonl` 9줄(`review_blocked`), 10줄(`blocker_classified: human_blocked` — "native GJC verifier cannot produce a stable frozen digest while it includes generated .gjc runtime files"), 14~15줄(사람 승인 후에도 `blocked`). 커밋 `debba12`.
- 경과: 사람 확인 AC-1~7 통과 → `ultragoal checkpoint --status complete` 시 네이티브 검증기가 스스로 갱신하는 `.gjc` 런타임 파일까지 해시해 source hash가 매번 어긋남 → `record-critic-gate-override`도 "critic hard-stop 기록 필요"로 거부.
- 판정: **기획서 쪽도 에이전트 쪽도 아닌 harness(도구·운영) 쪽**. 제품 결함은 없었고(critic OKAY, 16줄) 에이전트는 완료를 허위 기록하지 않았다. 이후 goal-2~5도 같은 이유로 `blocked`에 머물렀다(R2 ledger 21·31줄, R3 ledger 10줄).
- 실제 원인(제출 직전에 확인): ① 원격 저장소가 없어 완료 검증의 integration base(`origin/main`)를 해석하지 못했다. ② source hash가 gjc 자신이 실행 중 계속 갱신하는 `.gjc` 런타임 파일(`runtime/`, `state/`, `.session-activity.json`, `token-logs/`)까지 포함해 리뷰 시점과 체크포인트 시점의 해시가 어긋났다. ③ 스크린샷 비균일 검사가 "압축 해제 바이트 고유값 16개 이상"을 요구해, 8색 규칙을 지킨 무손실 PNG는 실제 화면도 거부됐다(7~15개).
- 조치: push로 `origin/main` 생성 → 런타임 파일만 `.gitignore`(`d057565`, `.gjc` 자체와 plans·specs·goals·ledger는 추적 유지) → 같은 실제 프레임의 JPEG 사본을 증거로 추가(`0594c11`, 원본 PNG 보존) → 고정 스냅샷에서 cleaner·architect·QA·terminal-critic을 goal마다 다시 실행. 첫 재리뷰는 게이트 초안의 서술(세대 해시 혼재, JPEG를 원본처럼 기술)을 이유로 반려됐고, 사실대로 고친 뒤 통과했다.
- 결과: 5개 goal 모두 정식 `complete` — R1 ledger 24줄(G001), R2 ledger 47·49줄(G001·G002), R3 ledger 27·29줄(G001·G002). 기록 커밋 `a51cc8f`·`a5c0c1c`·`f82960a`.
- replan이 없었던 이유: 명세 5.2의 신호가 한 번도 충족되지 않았다. nudge는 R2 ledger 6줄의 1회(`attempt 1, budget 6`)뿐으로 예산을 소진한 goal이 없고, 사람 확인 X는 4건 모두 1회 지적으로 해결돼 "같은 항목 2회 연속 X"가 없었으며, 범위 밖 기능도 0개였다. 대신 **실행 전 replan**이 한 번 있었다: R1 첫 플랜(`.gjc/_session-01a1c851-…/plans/ralplan/01a1c851-…/pending-approval.md` S02 M01/M02)을 중단 → 기획서 보완(`f131993`) → R1 재계획(`.gjc/_session-01a1c888-…/plans/ralplan/…/pending-approval.md`) 순서다.

## 3. harness가 막은 것과 못 막은 것

막은 것
- **AGENTS.md "기획서가 애매하면 기획서를 먼저 고친다"** + ralplan planner: R1에서 맵·색·벽 처리 공백을 코드 전에 잡았다(위 S02). R2에서는 "레벨 2 없이 클리어 Enter를 확인할 수 없다", "UI 문구 미정이면 화면 확인 불가"를 질문으로 올려 3장에 반영됐다.
- **critic 반복**: R2 플랜 4회·R3 플랜 3회 revision 후 OKAY. 시간 경계(59999/60000ms), 실패 우선, 보너스 중복 지급 금지가 테스트(43개)로 들어갔다.
- **"테스트 통과는 완료가 아니다"**: 브라우저 확인에서 테스트로는 안 보이는 결함 4건을 잡았다 — favicon 404 콘솔 에러, 테스트 파일명(`test/index.js` → H5 위반), 클리어 순간 등대지기가 한 칸 아래에 그려짐(AC-20), HUD 숫자 4 판독 불가(AC-16).
- **금지 목록**: package.json·외부 에셋·BGM·추적 AI·일시정지 등 범위 밖 기능 0개.

못 막은 것
- **에이전트가 AGENTS.md를 두 번 수정**(goal-1 테스트 명령 줄, goal-4 실행 줄). 템플릿 "게임 이름만 채운다" 규칙이 금지 사항에 없었다 → 되돌리고 금지 사항에 한 줄 추가(`2400a60`).
- **file:// 더블클릭 실행 불가**: AGENTS.md의 "ES modules"와 명세 4.2의 "서버 없이 더블클릭"이 충돌한다(Chrome이 `origin null` 모듈을 CORS 차단). 8장에 "정적 서버/Pages로 연다"를 명시했다. 템플릿 단계에서 실행 방식을 하나로 정했어야 막혔다.
- **goal 완료 처리가 제출 직전까지 막힘**(2절). 저장소 준비 단계에서 원격을 먼저 만들고 `.gjc` 런타임 파일을 `.gitignore`에 넣어 두었다면 각 goal을 끝낸 시점에 바로 complete가 됐을 것이다. 8색 픽셀아트와 스크린샷 비균일 검사의 충돌은 harness 쪽 기준 조정이 필요하다.
- gjc가 응답 없이 30분 멈춘 1회(goal-4 마무리) — Esc 후 재지시로 해소. 시간 상한이 없었다.

## 4. 사람이 개입한 횟수와 이유

| 종류 | 횟수 | 내용 |
|---|---|---|
| 승인 | 6 | 플랜 실행 승인 3(R1 재계획·R2·R3, 런타임의 형식 승인 재확인은 별도로 세지 않음), 기획서 검토 승인 3(v0·v1·v2) |
| 반려 | 1 | R1 첫 플랜: 실행 대신 중단하고 기획서 보완 |
| 확인 X | 4 | goal-1 2건(favicon, 테스트 파일명), goal-2 2건(AC-20, AC-16). 모두 1회 지적으로 해결 |
| 범위 밖 삭제 | 0 | 범위 밖 기능 없음. 대신 AGENTS.md 수정 되돌림 2회 |
| 기타 | deep-interview 응답 약 25회(확정 확인 포함), 플랜 중 질문 답변 6회(R1 1·R2 5), 무응답 해소 1회 |

## 5. harness 비교 (선택 과제)

같은 출발점 `be0243b`(design-v2)에서 goal-2를 다시 진행했다. 비교본 브랜치는 `compare/claude-code`(커밋 `6efb693`)이고 제출본은 gjc 쪽 main이다.

| harness | 맡긴 goal | 사람 개입 | 좋았던 점 | 문제 | 범위 밖 기능 |
|---|---|---|---|---|---|
| gjc ralplan → ultragoal | goal-2 | 플랜 질문 5 + 승인 2 + 확인 X 2 | 4회 revision으로 시간 경계·실패 우선이 기획서와 테스트에 먼저 고정됨 | 약 1시간 이상 소요, 정식 complete까지 원격·런타임 파일 설정과 재리뷰가 추가로 필요 | 0 |
| Claude Code 단독 (AGENTS.md만, 워크플로 없음) | goal-2 | 1 (첫 지시) | 약 5분, 19개 테스트로 2장 수치를 그대로 옮김 | 기획서에 없는 "충돌·시간 소진 동시 실패 원인"을 임의로 정하고 보고만 함(기획서 선행 수정 규칙 위반 소지) | 0 |
