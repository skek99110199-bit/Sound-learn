'use client';

import { useCallback, useRef, useState } from 'react';
import WaveformVisualizer from './WaveformVisualizer';
import type { RecordingState, UploadResponse, VoiceRecorderProps } from './types';

const UPLOAD_URL = 'http://localhost:8000/api/upload';

export default function VoiceRecorder({ onUploadSuccess, onUploadError }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const uploadAudio = useCallback(
    async (blob: Blob) => {
      setStatusMessage('업로드 중...');
      const form = new FormData();
      form.append('file', blob, 'recording.webm');

      try {
        const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: '알 수 없는 오류' }));
          throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
        const data: UploadResponse = await res.json();
        setStatusMessage(`업로드 완료 (${data.duration_sec.toFixed(1)}초)`);
        onUploadSuccess?.(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '업로드 실패';
        setStatusMessage(`오류: ${msg}`);
        onUploadError?.(msg);
      }
    },
    [onUploadSuccess, onUploadError],
  );

  const startRecording = useCallback(async () => {
    setStatusMessage('');
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatusMessage('마이크 접근 권한이 필요합니다.');
      return;
    }

    streamRef.current = stream;

    // Web Audio API — 파형 시각화용
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    setAnalyserNode(analyser);

    // MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      uploadAudio(blob);

      // 스트림 트랙 해제
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    recorder.start();
    setRecordingState('recording');
    setStatusMessage('녹음 중...');
  }, [uploadAudio]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setAnalyserNode(null);
    setRecordingState('stopped');
  }, []);

  const isRecording = recordingState === 'recording';

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <WaveformVisualizer analyserNode={analyserNode} isRecording={isRecording} />

      <div className="flex justify-center">
        {!isRecording ? (
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
          >
            <span className="w-3 h-3 rounded-full bg-white" />
            녹음 시작
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
          >
            <span className="w-3 h-3 rounded bg-white" />
            녹음 중지
          </button>
        )}
      </div>

      {statusMessage && (
        <p className="text-center text-sm text-gray-500">{statusMessage}</p>
      )}
    </div>
  );
}
