"""
레퍼런스 pitch frame에서 소절(phrase) 경계를 자동 감지하고,
alignment 결과를 소절 단위로 집계한다.

── 소절 감지 원리 ────────────────────────────────────────────────────────────
  오디오 pitch 데이터에서 voiced frame(소리가 있는 프레임) 사이의 '무성 간격'을
  분석한다. 일정 시간 이상 소리가 없는 구간을 소절 경계로 판단한다.

  예) "반짝반짝♩" ─[0.5초 침묵]─ "작은별♩" 처럼 숨 쉬는 구간이 경계가 됨

── 감지 후 처리 ──────────────────────────────────────────────────────────────
  1. gap(무성 구간)으로 초기 경계 탐색
  2. 너무 짧은 소절(≤ min_phrase_sec)은 다음 소절과 합침
  3. 너무 긴 소절(> max_phrase_sec)은 균등하게 나눔
"""


def detect_phrases(
    frames: list[dict],
    min_gap_sec: float = 0.5,
    min_phrase_sec: float = 3.0,
    max_phrase_sec: float = 22.0,
) -> list[dict]:
    """
    pitch frame 리스트에서 소절 단위를 감지해 반환한다.

    Args:
        frames:         pitch frame 리스트 (각 dict에 'time', 'midi_note' 포함)
        min_gap_sec:    이 시간 이상의 무성 구간이 있으면 소절 경계로 처리
                        (기본 0.5초 — 짧은 숨도 경계로 인식)
        min_phrase_sec: 이보다 짧은 소절은 다음 소절과 합침
                        (너무 잘게 쪼개지는 것 방지)
        max_phrase_sec: 이보다 긴 소절은 균등하게 나눔
                        (너무 긴 소절은 재생/분석이 부담스러우므로 분할)

    Returns:
        [{'index': int, 'start_time': float, 'end_time': float}, ...]
        index는 0부터 시작하는 소절 번호
    """
    # voiced 프레임만 추출 — midi_note가 None이면 무성음
    voiced = [f for f in frames if f.get("midi_note") is not None]
    if not voiced:
        return []

    total_start = voiced[0]["time"]
    total_end = voiced[-1]["time"]

    # 전체 길이가 짧으면 통째로 하나의 소절로 처리
    if total_end - total_start <= min_phrase_sec:
        return [{"index": 0, "start_time": round(total_start, 2), "end_time": round(total_end, 2)}]

    # ── 1단계: gap 기반 경계 탐색 ────────────────────────────────────────────
    # voiced 프레임 사이 시간 차가 min_gap_sec 이상이면 → 소절 경계
    split_points: list[float] = []
    for i in range(1, len(voiced)):
        gap = voiced[i]["time"] - voiced[i - 1]["time"]
        if gap >= min_gap_sec:
            # 갭의 정중앙을 경계로 삼아 양쪽 소절이 자연스럽게 끊기도록 함
            split_points.append((voiced[i - 1]["time"] + voiced[i]["time"]) / 2)

    # 시작 시간 + 경계들 + 끝 시간 → 경계 구간 목록
    boundaries = [total_start] + split_points + [total_end]

    # ── 2단계: 경계 사이 구간을 소절 후보로 생성 ─────────────────────────────
    raw_phrases: list[tuple[float, float]] = []
    for i in range(len(boundaries) - 1):
        raw_phrases.append((boundaries[i], boundaries[i + 1]))

    # ── 3단계: 너무 짧은 소절 합치기 ─────────────────────────────────────────
    # buf_start ~ buf_end 버퍼에 소절을 쌓다가 충분히 길어지면 확정
    merged: list[tuple[float, float]] = []
    buf_start, buf_end = raw_phrases[0]

    for start, end in raw_phrases[1:]:
        buf_dur = buf_end - buf_start
        if buf_dur < min_phrase_sec:
            # 현재 버퍼가 너무 짧으면 다음 구간까지 포함시킴
            buf_end = end
        else:
            merged.append((buf_start, buf_end))
            buf_start, buf_end = start, end

    # 마지막 남은 버퍼 처리
    if merged and buf_end - buf_start < min_phrase_sec:
        # 마지막 소절이 너무 짧으면 직전 소절 끝에 붙임
        prev_start, _ = merged[-1]
        merged[-1] = (prev_start, buf_end)
    else:
        merged.append((buf_start, buf_end))

    # ── 4단계: 너무 긴 소절 균등 분할 ───────────────────────────────────────
    final: list[tuple[float, float]] = []
    for start, end in merged:
        dur = end - start
        if dur > max_phrase_sec:
            # 몇 개로 나눌지 계산 (예: 40초 → 2개, 각 20초)
            n = max(2, int(dur / max_phrase_sec) + 1)
            chunk = dur / n
            for k in range(n):
                final.append((start + k * chunk, start + (k + 1) * chunk))
        else:
            final.append((start, end))

    return [
        {"index": i, "start_time": round(s, 2), "end_time": round(e, 2)}
        for i, (s, e) in enumerate(final)
    ]


def compute_phrase_results(
    alignment: list,          # list[AlignmentFrame] — compare.py의 AlignmentFrame 모델
    phrases: list[dict],
    good_threshold: float = 70.0,
) -> list[dict]:
    """
    DTW alignment 결과를 소절 단위로 집계해 각 소절의 정확도·방향성을 반환한다.

    ── 중요: 시간 기준 통일 ────────────────────────────────────────────────────
      phrases의 start_time/end_time과 alignment의 reference_time은
      모두 '레퍼런스 오디오의 절대 시간' 기준이다.
      (Subsequence DTW로 구간을 슬라이스해도 레퍼런스 시간 자체는 바뀌지 않음)
      → offset 보정 없이 직접 비교해야 한다.

    Args:
        alignment:      DTW로 정렬된 AlignmentFrame 리스트
                        각 frame에 reference_time, user_time, cent_error, is_correct 포함
        phrases:        detect_phrases()가 반환한 소절 경계 목록
        good_threshold: 이 정확도(%) 이상이면 '잘했어요(is_good=True)' 판정

    Returns:
        소절별 결과 딕셔너리 리스트 (PhraseResult 모델과 매핑됨)
    """
    results = []

    for phrase in phrases:
        ref_s = phrase["start_time"]  # 소절 시작 (레퍼런스 절대 시간)
        ref_e = phrase["end_time"]    # 소절 종료 (레퍼런스 절대 시간)

        # 이 소절 구간에 속하는 alignment 프레임만 추출
        # reference_time이 [ref_s, ref_e] 범위 안에 있는 프레임
        frames_in = [
            f for f in alignment
            if ref_s <= f.reference_time <= ref_e
        ]
        if not frames_in:
            # 이 소절에 매칭된 프레임이 없으면 건너뜀
            continue

        # ── 소절 통계 계산 ──────────────────────────────────────────────────
        cent_errors = [f.cent_error for f in frames_in]
        correct = sum(1 for f in frames_in if f.is_correct)
        total = len(frames_in)

        accuracy = round(correct / total * 100, 1) if total else 0.0
        avg_cent = round(sum(cent_errors) / len(cent_errors), 1) if cent_errors else None

        # 음정 방향 판단: 평균 cent 오차 기준
        # sharp = 전반적으로 높게 부름, flat = 낮게 부름, mixed = 일정하지 않음
        if avg_cent is None or abs(avg_cent) <= 20:
            direction = "mixed"
        elif avg_cent > 20:
            direction = "sharp"
        else:
            direction = "flat"

        results.append({
            "index": phrase["index"],
            "ref_start_time": ref_s,
            "ref_end_time": ref_e,
            # 사용자 시간: 소절 내 첫/마지막 alignment 프레임의 user_time
            "user_start_time": round(frames_in[0].user_time, 2),
            "user_end_time": round(frames_in[-1].user_time, 2),
            "accuracy_percent": accuracy,
            "avg_cent_error": avg_cent,
            "direction": direction,
            "frame_count": total,
            "is_good": accuracy >= good_threshold,
        })

    return results
