import math


def midi_to_hz(midi_note: float) -> float:
    """MIDI note number를 Hz로 변환한다."""
    return 440.0 * (2 ** ((midi_note - 69.0) / 12.0))


def calculate_cent_error(user_freq: float, reference_freq: float) -> float:
    """두 주파수 간 cent 오차를 계산한다."""
    return 1200.0 * math.log2(user_freq / reference_freq)


def align_midi_sequences(
    user_notes: list[float],
    reference_notes: list[float],
) -> list[tuple[int, int]]:
    """
    두 MIDI 시퀀스를 DTW로 정렬한다.

    Returns:
        (user_index, reference_index) 쌍의 경로 리스트
    """
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

        pi, pj = prev
        if pi == i - 1 and pj == j - 1:
            path.append((i - 1, j - 1))
        i, j = pi, pj

    path.reverse()
    return path
