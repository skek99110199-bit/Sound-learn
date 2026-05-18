"""
MIDI 시퀀스 정렬(alignment) 관련 알고리즘 모음.

주요 함수:
  find_best_offset     — Subsequence DTW로 사용자가 곡 중간부터 불렀을 때
                         레퍼런스에서 가장 잘 맞는 구간을 자동으로 찾는다.
  align_midi_sequences — 일반 DTW로 두 MIDI 시퀀스를 1:1 프레임 매칭한다.
  calculate_cent_error — 두 주파수 사이의 cent 오차를 계산한다.
  midi_to_hz           — MIDI 번호를 Hz 주파수로 변환한다.

DTW(Dynamic Time Warping)란?
  두 시퀀스의 길이가 달라도 유사도를 비교할 수 있게 해주는 알고리즘.
  음악에서는 박자가 조금씩 다른 노래를 비교할 때 사용한다.
"""

import math


def find_best_offset(
    user_notes: list[float],
    ref_notes: list[float],
    stride: int = 5,
) -> tuple[int, int]:
    """
    Subsequence DTW로 레퍼런스에서 사용자 시퀀스와 가장 잘 매칭되는 구간을 찾는다.

    일반 DTW와의 차이:
      - 일반 DTW: 두 시퀀스를 처음부터 끝까지 전부 비교
      - Subsequence DTW: 레퍼런스 어디서든 시작 가능 → 사용자가 곡 중간부터
        불렀을 때도 자동으로 해당 구간을 찾아낸다.

    구현 핵심: DTW 행렬의 첫 행(dtw[0][j])을 모두 0으로 초기화
               → 레퍼런스의 어떤 위치에서 시작해도 초기 비용이 0이 됨

    성능 최적화: stride 간격으로 다운샘플링해 행렬 크기를 1/stride²으로 줄임
                 (stride=5이면 행렬이 25배 작아짐)

    Args:
        user_notes:  사용자의 voiced MIDI 시퀀스 (무성음 제거 후)
        ref_notes:   레퍼런스의 voiced MIDI 시퀀스
        stride:      다운샘플링 간격 — 클수록 빠르지만 덜 정확

    Returns:
        (start_idx, end_idx): ref_notes 기준 0-indexed 슬라이스 범위
    """
    if not user_notes or not ref_notes:
        # 빈 시퀀스면 레퍼런스 전체를 사용
        return 0, len(ref_notes)

    # 다운샘플링: 매 stride번째 프레임만 추출
    u = user_notes[::stride]
    r = ref_notes[::stride]
    n, m = len(u), len(r)

    INF = float("inf")

    # ── DTW 행렬 초기화 ────────────────────────────────────────────────────────
    # dtw[i][j] = 사용자 0~i와 레퍼런스 어딘가~j를 맞췄을 때 누적 비용
    # parent[i][j] = 역추적에 사용 (0=대각선, 1=위, 2=왼쪽)
    dtw = [[INF] * (m + 1) for _ in range(n + 1)]
    parent: list[list[int]] = [[-1] * (m + 1) for _ in range(n + 1)]

    # 핵심: 첫 행을 0으로 → 레퍼런스 어디서든 시작 비용 없이 출발 가능
    for j in range(m + 1):
        dtw[0][j] = 0.0

    # ── 행렬 채우기 ────────────────────────────────────────────────────────────
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            # 현재 프레임 간 MIDI 거리 (반음 단위)
            local = abs(u[i - 1] - r[j - 1])
            # 세 방향 중 누적 비용이 가장 작은 경로 선택
            diag  = dtw[i - 1][j - 1]  # 사용자·레퍼런스 모두 한 칸 전진
            vert  = dtw[i - 1][j]      # 사용자만 전진 (레퍼런스 반복)
            horiz = dtw[i][j - 1]      # 레퍼런스만 전진 (사용자 반복)
            best  = min(diag, vert, horiz)
            dtw[i][j] = local + best
            parent[i][j] = 0 if best == diag else (1 if best == vert else 2)

    # ── 최적 종료 위치 탐색 ────────────────────────────────────────────────────
    # 마지막 행(사용자 시퀀스 끝)에서 가장 낮은 비용의 레퍼런스 위치를 찾음
    best_end_ds = min(range(1, m + 1), key=lambda j: dtw[n][j])

    # ── 역추적으로 시작 인덱스 찾기 ────────────────────────────────────────────
    i, j = n, best_end_ds
    while i > 0 and j > 0:
        d = parent[i][j]
        if d == 0:
            i -= 1; j -= 1  # 대각선
        elif d == 1:
            i -= 1           # 위
        else:
            j -= 1           # 왼쪽
    # 역추적이 끝난 j = 레퍼런스 시작 위치 (다운샘플 기준)
    best_start_ds = max(0, j)

    # 다운샘플 인덱스 → 원본 인덱스로 변환 (stride 곱하기)
    start = best_start_ds * stride
    end   = min(len(ref_notes), best_end_ds * stride + stride)
    return start, end


def midi_to_hz(midi_note: float) -> float:
    """MIDI 번호(0~127)를 Hz 주파수로 변환한다.

    공식: A4(MIDI 69) = 440Hz 기준, 반음마다 2^(1/12) 배율
    예:  60(C4) → 261.63Hz,  69(A4) → 440Hz
    """
    return 440.0 * (2 ** ((midi_note - 69.0) / 12.0))


def calculate_cent_error(user_freq: float, reference_freq: float) -> float:
    """두 주파수 사이의 부호 있는 cent 오차를 반환한다.

    cent란?
      반음(semitone)을 100등분한 음정 단위.
      ±100 cent = 반음 1개, ±1200 cent = 옥타브 1개

    양수 = 사용자가 더 높게 부름 (sharp)
    음수 = 사용자가 더 낮게 부름 (flat)

    공식: 1200 × log₂(user / reference)
    """
    if user_freq <= 0 or reference_freq <= 0:
        raise ValueError("Frequencies must be positive to calculate cent error.")
    return 1200.0 * math.log2(user_freq / reference_freq)


def align_midi_sequences(
    user_notes: list[float],
    reference_notes: list[float],
) -> list[tuple[int, int]]:
    """일반 DTW로 두 MIDI 시퀀스를 프레임 단위로 정렬한다.

    find_best_offset이 '어느 구간'을 비교할지 찾아주면,
    이 함수가 그 구간의 각 프레임을 1:1로 대응시킨다.

    반환 형식: [(user_idx, ref_idx), ...] — 경로상의 (사용자, 레퍼런스) 인덱스 쌍
    """
    if not user_notes or not reference_notes:
        return []

    rows = len(user_notes)
    cols = len(reference_notes)
    inf = float("inf")

    # cost[i][j] = user[0:i]와 ref[0:j]를 맞췄을 때 최소 누적 비용
    cost = [[inf] * (cols + 1) for _ in range(rows + 1)]
    # parent[i][j] = 역추적용 — 어디서 왔는지 이전 셀 좌표 저장
    parent: list[list[tuple[int, int] | None]] = [[None] * (cols + 1) for _ in range(rows + 1)]
    cost[0][0] = 0.0  # 양쪽 모두 처음부터 시작 (일반 DTW)

    for i in range(1, rows + 1):
        for j in range(1, cols + 1):
            local_cost = abs(user_notes[i - 1] - reference_notes[j - 1])
            # 대각선·위·왼쪽 중 이전 비용이 가장 작은 경로 선택
            candidates = [
                (cost[i - 1][j],     (i - 1, j)),      # 사용자만 전진
                (cost[i][j - 1],     (i, j - 1)),      # 레퍼런스만 전진
                (cost[i - 1][j - 1], (i - 1, j - 1)), # 둘 다 전진
            ]
            prev_cost, prev_cell = min(candidates, key=lambda item: item[0])
            cost[i][j] = local_cost + prev_cost
            parent[i][j] = prev_cell

    # ── 역추적으로 최적 경로 복원 ───────────────────────────────────────────────
    path: list[tuple[int, int]] = []
    i, j = rows, cols  # 끝에서 시작해 거슬러 올라감

    while i > 0 and j > 0:
        prev = parent[i][j]
        if prev is None:
            break
        # 1-indexed 행렬 → 0-indexed 리스트 변환 (i-1, j-1)
        path.append((i - 1, j - 1))
        i, j = prev

    path.reverse()  # 역추적이므로 뒤집어서 시간 순으로 정렬
    return path
