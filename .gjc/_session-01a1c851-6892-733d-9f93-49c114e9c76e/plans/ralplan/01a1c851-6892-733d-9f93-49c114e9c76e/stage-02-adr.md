# ADR: R1 최소 격자 이동 골격

Status: pending approval. 단일 goal: 맵 위에서 캐릭터가 한 칸씩 움직인다.

## Decision
검토 승인된 stage-02-revision.md S01~S14를 유지한다. 디자인 선행조건 확정 뒤 작은 logic/main/data 모듈로 이동 골격만 구현하는 방향이다. 지금 제품 파일을 바꾸지 않는다.

## Drivers
1. 현재 기획서의 규칙과 수치를 그대로 유지.
2. 입력 즉시 논리 이동·120ms 시각 이동·한 번 누름 한 칸·입력 폐기의 정확성.
3. 의존성 없는 최소 구현과 사람의 브라우저 검증.

## Alternatives considered
- A: 승인된 디자인을 사용하는 최소 이동 골격. 채택.
- B: 임시 맵·색·사각형 캐릭터로 바로 시제품. 빠른 조작 관찰은 가능하지만 미승인 디자인과 현재 무편집 계약을 위반하므로 기각.
- 모든 상태를 main에 집중하는 반론: 최초 줄 수는 줄지만 AGENTS의 순수 logic.js 규칙을 위반하거나 판정을 이중화하므로 기각. Architect가 제시한 반론이며 선택 A의 범위를 바꾸지 않는다.

## Why chosen
A는 기획 선행과 사용자 디자인 권한을 보존하고 Canvas 없는 상태 전환으로 입력·시간 경계를 검증할 수 있다. 기능이나 임시 디자인을 추가하지 않고 단일 목표에 충분하다.

## Consequences
- 논리 위치는 즉시 변경하며 시각 보간은 120ms 렌더링 책임이다. 별도 엔진·이벤트 버스·미래 기능 추상화 없음.
- 실제 맵·8색·스프라이트·막힘 처리는 아직 미정이라 즉시 코드를 실행할 수 없는 계획이다. 이는 승인 경계다.
- R1 최소 번호 기준을 9장에 먼저 반영하는 문서 계획을 포함하며 R2의 20항목 확장을 유지한다. AGENTS 예외 없음.

## Follow-ups
별도 문서 보완 승인과 사용자 디자인 검토 → 갱신된 기획과 수용 번호 확인 → 별도 R1 구현 착수 승인 → 집중 자동 검증 → 사람이 실제 브라우저에서 번호별 확인. 현재는 어느 제품 변경도 실행하지 않는다.

## Provenance
- revision stage_n2 sha25600a386da0333dc8b43ebc7fd8c18fb06f6e1964c8f54617755274869b747e256.
- Architect CLEAR/APPROVE: stage-02-architect.md sha2569012d96cb664021122563cd41619d8dcc0d6f273e860767367d4bca6d9adf8db.
- Critic OKAY: stage-02-critic.md sha256a8db747a054e3c6c30fe40c0c166f321db483582a28c23b789a4e8820ceb6d51.
- 양쪽 동일 revision 검토, findings 없음. post-interview reconciled-clean.
