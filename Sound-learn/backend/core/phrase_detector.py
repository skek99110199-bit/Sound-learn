"""
레퍼런스 pitch frame에서 소절(phrase) 경계를 자동 감지한다.

감지 방법:
- voiced frame 간 시간 간격이 min_gap_sec 이상이면 소절 경계로 간주
- MIDI note-on 기반 레퍼런스(간격 데이터) 및 오디오 pitch 모두 지원
- 너무 짧은 소절은 다음 소절과 합치고, 너무 긴 소절은 균등 분할
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
        min_phrase_sec: 이보다 짧은 소절은 다음 소절과 합침
        max_phrase_sec: 이보다 긴 소절은 균등하게 나눔

    Returns:
        [{'index': int, 'start_time': float, 'end_time': float}, ...]
    """
    # voiced 프레임만 추출 (시간 기반 gap 계산에 사용)
    voiced = [f for f in frames if f.get("midi_note") is not None]
    if not voiced:
        return []

    total_start = voiced[0]["time"]
    total_end = voiced[-1]["time"]

    # 전체가 짧으면 단일 소절
    if total_end - total_start <= min_phrase_sec:
        return [{"index": 0, "start_time": round(total_start, 2), "end_time": round(total_end, 2)}]

    # ── 1) gap 기반 경계 탐색 ─────────────────────────────────────────────────
    split_points: list[float] = []
    for i in range(1, len(voiced)):
        gap = voiced[i]["time"] - voiced[i - 1]["time"]
        if gap >= min_gap_sec:
            # 갭 중간을 경계로 사용
            split_points.append((voiced[i - 1]["time"] + voiced[i]["time"]) / 2)

    boundaries = [total_start] + split_points + [total_end]

    # ── 2) 소절 후보 생성 (경계 사이 구간) ───────────────────────────────────
    raw_phrases: list[tuple[float, float]] = []
    for i in range(len(boundaries) - 1):
        raw_phrases.append((boundaries[i], boundaries[i + 1]))

    # ── 3) 너무 짧은 소절 합치기 ─────────────────────────────────────────────
    merged: list[tuple[float, float]] = []
    buf_start, buf_end = raw_phrases[0]

    for start, end in raw_phrases[1:]:
        buf_dur = buf_end - buf_start
        if buf_dur < min_phrase_sec:
            buf_end = end  # 다음 구간으로 연장
        else:
            merged.append((buf_start, buf_end))
            buf_start, buf_end = start, end

    # 마지막 버퍼 처리
    if merged and buf_end - buf_start < min_phrase_sec:
        # 마지막 소절이 너무 짧으면 직전 소절에 붙임
        prev_start, _ = merged[-1]
        merged[-1] = (prev_start, buf_end)
    else:
        merged.append((buf_start, buf_end))

    # ── 4) 너무 긴 소절 균등 분할 ────────────────────────────────────────────
    final: list[tuple[float, float]] = []
    for start, end in merged:
        dur = end - start
        if dur > max_phrase_sec:
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
    alignment: list,          # list[AlignmentFrame]
    phrases: list[dict],
    good_threshold: float = 70.0,
) -> list[dict]:
    """
    alignment 결과를 소절 단위로 집계한다.

    phrases의 start_time/end_time과 alignment의 reference_time은
    모두 레퍼런스 절대 시간 기준이므로 offset 보정 없이 직접 비교한다.

    Args:
        alignment:      AlignmentFrame 리스트
        phrases:        detect_phrases() 반환 값
        good_threshold: 이 정확도 이상이면 '잘함' 판정 (%)

    Returns:
        소절별 결과 딕셔너리 리스트
    """
    results = []

    for phrase in phrases:
        ref_s = phrase["start_time"]
        ref_e = phrase["end_time"]

        # 해당 소절에 속하는 alignment frame 추출 (절대 시간 비교)
        frames_in = [
            f for f in alignment
            if ref_s <= f.reference_time <= ref_e
        ]
        if not frames_in:
            continue

        cent_errors = [f.cent_error for f in frames_in]
        correct = sum(1 for f in frames_in if f.is_correct)
        total = len(frames_in)
        accuracy = round(correct / total * 100, 1) if total else 0.0
        avg_cent = round(sum(cent_errors) / len(cent_errors), 1) if cent_errors else None

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
            "user_start_time": round(frames_in[0].user_time, 2),
            "user_end_time": round(frames_in[-1].user_time, 2),
            "accuracy_percent": accuracy,
            "avg_cent_error": avg_cent,
            "direction": direction,
            "frame_count": total,
            "is_good": accuracy >= good_threshold,
        })

    return results
