import math


def find_best_offset(
    user_notes: list[float],
    ref_notes: list[float],
    stride: int = 5,
) -> tuple[int, int]:
    """
    Subsequence DTW로 레퍼런스에서 사용자 시퀀스와 가장 잘 매칭되는 구간을 찾는다.

    레퍼런스의 첫 행을 0으로 초기화해 시작 위치를 자유롭게 허용한다.
    속도를 위해 stride 간격으로 다운샘플링 후 검색한다.

    Args:
        user_notes:  사용자의 voiced MIDI 시퀀스
        ref_notes:   레퍼런스의 voiced MIDI 시퀀스
        stride:      다운샘플링 간격 (프레임 단위)

    Returns:
        (start_idx, end_idx): ref_notes 기준 0-indexed 슬라이스 범위
    """
    if not user_notes or not ref_notes:
        return 0, len(ref_notes)

    # 다운샘플링으로 행렬 크기 축소
    u = user_notes[::stride]
    r = ref_notes[::stride]
    n, m = len(u), len(r)

    INF = float("inf")

    # DTW 행렬 (n+1) × (m+1), 첫 행 = 0 (어디서든 시작 가능)
    dtw = [[INF] * (m + 1) for _ in range(n + 1)]
    parent: list[list[int]] = [[-1] * (m + 1) for _ in range(n + 1)]
    for j in range(m + 1):
        dtw[0][j] = 0.0

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            local = abs(u[i - 1] - r[j - 1])
            diag  = dtw[i - 1][j - 1]
            vert  = dtw[i - 1][j]
            horiz = dtw[i][j - 1]
            best  = min(diag, vert, horiz)
            dtw[i][j] = local + best
            parent[i][j] = 0 if best == diag else (1 if best == vert else 2)

    # 마지막 행의 최솟값 → 최적 종료 인덱스 (다운샘플 기준)
    best_end_ds = min(range(1, m + 1), key=lambda j: dtw[n][j])

    # 역추적으로 시작 인덱스 찾기
    i, j = n, best_end_ds
    while i > 0 and j > 0:
        d = parent[i][j]
        if d == 0:
            i -= 1; j -= 1
        elif d == 1:
            i -= 1
        else:
            j -= 1

    best_start_ds = max(0, j)

    # 다운샘플 인덱스 → 원본 인덱스로 변환
    start = best_start_ds * stride
    end   = min(len(ref_notes), best_end_ds * stride + stride)
    return start, end


def midi_to_hz(midi_note: float) -> float:
    """Convert a MIDI note number to frequency in Hz."""
    return 440.0 * (2 ** ((midi_note - 69.0) / 12.0))


def calculate_cent_error(user_freq: float, reference_freq: float) -> float:
    """Return the signed cent difference between two positive frequencies."""
    if user_freq <= 0 or reference_freq <= 0:
        raise ValueError("Frequencies must be positive to calculate cent error.")
    return 1200.0 * math.log2(user_freq / reference_freq)


def align_midi_sequences(
    user_notes: list[float],
    reference_notes: list[float],
) -> list[tuple[int, int]]:
    """Align two MIDI sequences with Dynamic Time Warping."""
    if not user_notes or not reference_notes:
        return []

    rows = len(user_notes)
    cols = len(reference_notes)
    inf = float("inf")

    cost = [[inf] * (cols + 1) for _ in range(rows + 1)]
    parent: list[list[tuple[int, int] | None]] = [[None] * (cols + 1) for _ in range(rows + 1)]
    cost[0][0] = 0.0

    for i in range(1, rows + 1):
        for j in range(1, cols + 1):
            local_cost = abs(user_notes[i - 1] - reference_notes[j - 1])
            candidates = [
                (cost[i - 1][j], (i - 1, j)),
                (cost[i][j - 1], (i, j - 1)),
                (cost[i - 1][j - 1], (i - 1, j - 1)),
            ]
            prev_cost, prev_cell = min(candidates, key=lambda item: item[0])
            cost[i][j] = local_cost + prev_cost
            parent[i][j] = prev_cell

    path: list[tuple[int, int]] = []
    i, j = rows, cols

    while i > 0 and j > 0:
        prev = parent[i][j]
        if prev is None:
            break

        path.append((i - 1, j - 1))
        i, j = prev

    path.reverse()
    return path
