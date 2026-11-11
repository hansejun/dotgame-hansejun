# Independent Critic — review pass 1

## Reviewed Target Receipt
- path: .gjc/_session-01a1c8b8-3cb7-725b-a85f-fa1d7b859952/plans/ralplan/01a1c8b8-3cb7-725b-a85f-fa1d7b859952/stage-03-revision.md
- sha256 (assignment receipt): [REDACTED]
- stage_n: 3
- intent: .gjc/_session-01a1c8b8-3cb7-725b-a85f-fa1d7b859952/plans/ralplan/01a1c8b8-3cb7-725b-a85f-fa1d7b859952/stage-03-intent.md
- intent sha256 (assignment receipt): [REDACTED]
- Review pass: 1. Independent review; Architect output not read.

## Verdict
**ITERATE**

한 가지 검증 계약을 좁혀 정정해야 한다. 제품 범위나 사용자 확정 결정을 다시 논의할 필요는 없다.

## Claim Checks
- AGENTS.md, GAME_DESIGN.md, 원 deep-interview의 확정 규칙/라운드 경계, revision3와 intent3를 읽었다. 구현 근거로 지정된 src/logic.js, src/main.js, src/levels.js, src/sprites.js, index.html, test/logic.test.js, test/index.js도 확인했다. 누락된 기존 참조 파일은 없다. src/strings.js는 계획대로 신규 파일이다.
- 현재 logic은 .과 P만 통행시키고 120ms 표시 보간/키 수명을 관리한다. main은 방향키만 전달하며 RAF는 그리기만 한다. 현재 테스트의 #.P whitelist와 일반 Enter 무시 기대를 새 계약으로 교체하면서 기존 이동 회귀를 보존한다는 계획은 실제 코드에 맞는다.
- goal-2 AC-8~23은 실제 맵의 등불·유령·시간·점수·남은 수와 동결 상태를 관찰 대상으로 적었다. goal-3 AC-24~32는 네 화면, 원인별 문구, Enter, 초기화의 브라우저 관찰문장이다. 단, AC-19/21의 동시 경계 재현은 아래 결함이 있다.
- 두 goal 모두 test/logic.test.js의 문서 수치 기반 테스트와 node --test test/를 유지한다. 399/400ms, 59999/60000ms, 12999ms 잔여 보너스120 및 합계620, 실패 갱신 신규점수 배제, 중복 지급 방지, reset과 기존 입력 회귀가 명시되어 있다.
- 후보 맵은 15×11, P/벽 보존, L5와 직선 a5를 제안하며 문서 2/3/4/5/9장 선행 변경·사람 검토 후에만 제품에 복사하도록 제한한다. 팔레트·크기·순수 logic·좌표 단일 원천을 보존한다.
- R2 클리어 Enter no-op, 다음 레벨 R3 goal-4, 최소 문구 R2 3장/strings.js, 7장 전체 정리 R3라는 확정 경계는 일관된다. 이전 7장 보류와의 충돌을 결함으로 삼지 않았다.
- 대표 경로를 정적으로 시뮬레이션했다: (1) L 첫 접촉→100점/남은 수 감소→재접촉 무점수→terminal 동결; (2) 실패→새 Enter→점수0 타이틀→새 게임의 등불/시간/유령/입력 초기화; (3) 후보 격자의 L/a 위치와 마지막 점등 동시 충돌 수용 기준. 앞의 두 경로는 기존 파일의 책임 분리로 구현 가능하며, 세 번째에서 검증 불가능한 요구를 발견했다.
- 시간순 순수 전이와 RAF 입력 묶음의 비교는 즉시 논리 이동이라는 결정 요인에 연결된다. 추가 아키텍처나 기능 대안 확대는 필요 없다.

## Missing Evidence
AC-19의 정확히 같은 시각 맞교환 및 AC-21의 마지막 점등+실패를 실제 세션에서 어떻게 재현하고 관찰할지 실행 가능한 절차가 없다. 특히 후보 맵에서 마지막 점등+유령 충돌은 단순히 미검증인 것이 아니라 해당 배치로 불가능하다. 테스트·게이트·포매터·브라우저·서버는 지시대로 실행하지 않았으며 실행 결과를 주장하지 않는다.

## Approval Boundary
goal 분리, 확정 수치, 화면/Enter 정책, 문서 선행, 파일 책임, 수치 회귀 및 범위 제외는 승인 가능한 수준이다. AC-19/21의 증거 분리를 정정한 계획에 대한 재검토가 필요하다. 이 검토는 제품/문서 편집이나 구현 착수를 승인하지 않는다. 사용자 확정 정책의 재심, R3 기능 선행, 맵 재설계, 테스트용 제품 훅 도입은 요구하지 않는다.

## Summary
- Clarity: 대체로 명확; 정확한 동시 경계의 사람 확인 절차만 불명확.
- Verifiability: 일반 플레이/화면/수치 테스트는 충분; AC-19/21 실제 맵 재현 요구 정정 필요.
- Completeness: 파일·goal·문서·테스트·회귀 범위 충족.
- Big Picture: 작은 core loop→화면 shell 순서와 사람 확인 경계 적절.
- Principle/Option Consistency: 즉시 논리 이동·순수 전이·문서 우선·R3 경계 일관.
- Alternatives Depth: 현재 결정에 충분; 추가 대안 요구 없음.
- Risk/Verification Rigor: 경계값 테스트는 강함; 불가능/정밀 동시성 브라우저 증거를 수치 증거와 혼동하지 않아야 함.

## Required Changes
1. AC-19/21 및 대응 Verification Plan에서 실제 브라우저로 재현 가능한 충돌/시간소진/점등/최종 HUD 확인과 정확한 동시 갱신 분기의 수치 증명을 구분하라. 후보 맵의 유령은 a 칸만 방문하고 모든 L은 a 밖이므로 마지막 L 접촉과 유령 충돌은 같은 갱신에 발생할 수 없다. 마지막 L 칸은 유령의 이전/이후 칸 어느 쪽도 될 수 없어 동일 칸 및 맞교환 모두 성립하지 않는다.
2. 동시 맞교환·마지막 점등+충돌·정확히 60000ms 점등의 계약 자체와 기존 수치 테스트는 유지하라. 이를 현재 실제 맵의 필수 사람 재현 항목으로 남기려면 fixture/상태 조작/제품 훅 없이 가능한 구체 절차를 제시해야 한다. 가장 작은 정정은 정밀 동시성은 이미 계획한 순수 함수 수치 테스트로 증명하고, 사람 확인 항목은 실제 플레이에서 가능한 실패·최종 점수·동결 관찰로 기술하는 것이다. 맵 변경이나 새 기능 추가는 요구하지 않는다.

## Findings
```json
[
  {
    "findingId": "C1-VERIFICATION-01",
    "targetId": "goal-2.AC-19/AC-21; Verification Plan goal-2",
    "action": "change",
    "severity": "medium",
    "evidence": "revision3 후보 격자에서 a는 행5 열5~9(0기준)이고 모든 L은 해당 행/경로 밖이다. 유령은 a 안에서만 왕복하므로 마지막 L 도착과 같은 갱신의 동일칸/맞교환 충돌은 불가능하다. 그럼에도 AC-21은 이 사건을 실제 맵/HUD와 실제 세션 상태로 확인하고 fixture로 대체하지 않도록 요구한다. AC-19는 performance.now 입력과 400ms 기한의 정확한 동률을 실제 입력으로 재현하도록 하지만 절차가 없으며 수치 테스트는 보조로만 규정된다. 실제 플레이 관찰과 결정적 경계 수치 증거를 분리하면 제품 범위를 늘리지 않고 해결된다.",
    "sourceRole": "critic"
  }
]
```
