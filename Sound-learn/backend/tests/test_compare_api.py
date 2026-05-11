import unittest

from fastapi.testclient import TestClient

from main import app


client = TestClient(app)


def _frame(time: float, midi_note: float | None, frequency: float | None = None) -> dict:
    return {
        "time": time,
        "midi_note": midi_note,
        "frequency": frequency,
    }


class CompareApiTest(unittest.TestCase):
    def test_exact_match_returns_full_accuracy(self) -> None:
        response = client.post(
            "/api/compare",
            json={
                "user_pitch": [
                    _frame(0.0, 69.0, 440.0),
                    _frame(0.5, 71.0, 493.88),
                ],
                "reference_pitch": [
                    _frame(0.0, 69.0),
                    _frame(0.5, 71.0),
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["judgement"]["accuracy_percent"], 100.0)
        self.assertEqual(body["judgement"]["correct_frames"], 2)
        self.assertEqual(body["judgement"]["avg_abs_timing_error_sec"], 0.0)
        self.assertEqual(body["error_segments"], [])

    def test_pitch_error_builds_error_segment(self) -> None:
        response = client.post(
            "/api/compare",
            json={
                "user_pitch": [
                    _frame(0.0, 71.0),
                    _frame(0.1, 72.0),
                ],
                "reference_pitch": [
                    _frame(0.0, 69.0),
                    _frame(0.1, 69.0),
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["judgement"]["accuracy_percent"], 0.0)
        self.assertEqual(len(body["error_segments"]), 1)
        self.assertEqual(body["error_segments"][0]["direction"], "sharp")
        self.assertEqual(body["error_segments"][0]["frame_count"], 2)

    def test_unvoiced_frames_are_ignored(self) -> None:
        response = client.post(
            "/api/compare",
            json={
                "user_pitch": [
                    _frame(0.0, None),
                    _frame(0.1, 69.0, 440.0),
                ],
                "reference_pitch": [
                    _frame(0.0, None),
                    _frame(0.1, 69.0),
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["judgement"]["total_compared_frames"], 1)
        self.assertEqual(body["judgement"]["accuracy_percent"], 100.0)

    def test_timing_error_is_reported(self) -> None:
        response = client.post(
            "/api/compare",
            json={
                "user_pitch": [
                    _frame(0.2, 69.0, 440.0),
                    _frame(0.7, 71.0, 493.88),
                ],
                "reference_pitch": [
                    _frame(0.0, 69.0),
                    _frame(0.5, 71.0),
                ],
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["alignment"][0]["timing_error_sec"], 0.2)
        self.assertEqual(body["judgement"]["avg_abs_timing_error_sec"], 0.2)
        self.assertEqual(body["judgement"]["max_abs_timing_error_sec"], 0.2)

    def test_all_unvoiced_user_frames_return_422(self) -> None:
        response = client.post(
            "/api/compare",
            json={
                "user_pitch": [_frame(0.0, None)],
                "reference_pitch": [_frame(0.0, 69.0)],
            },
        )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "No voiced user_pitch frames are available.")

    def test_invalid_frequency_returns_422(self) -> None:
        response = client.post(
            "/api/compare",
            json={
                "user_pitch": [_frame(0.0, 69.0, 0.0)],
                "reference_pitch": [_frame(0.0, 69.0)],
            },
        )

        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
