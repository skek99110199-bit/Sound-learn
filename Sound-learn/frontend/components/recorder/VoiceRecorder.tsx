'use client';

import { useCallback, useRef, useState } from 'react';
import WaveformVisualizer from './WaveformVisualizer';
import type { RecordingState, UploadResponse, VoiceRecorderProps } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const UPLOAD_URL = `${API_URL}/api/upload`;
const FFT_SIZE = 2048;
const RECORDING_SAMPLE_RATE = 22050;

/**
 * WebM/Opus Blob을 WAV Blob으로 변환한다.
 * Web Audio API의 decodeAudioData를 사용하므로 FFmpeg가 필요 없다.
 */
async function convertToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: RECORDING_SAMPLE_RATE });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();

  // 모노 채널 추출
  const samples = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;

  // WAV 헤더 작성
  const wavBuffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(wavBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);          // PCM 포맷 크기
  view.setUint16(20, 1, true);           // PCM 포맷
  view.setUint16(22, 1, true);           // 모노
  view.setUint32(24, sampleRate, true);  // 샘플레이트
  view.setUint32(28, sampleRate * 2, true); // 바이트레이트
  view.setUint16(32, 2, true);           // 블록 정렬
  view.setUint16(34, 16, true);          // 비트 뎁스
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Float32 → Int16 변환
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([wavBuffer], { type: 'audio/wav' });
}

/** 초 단위 → "M:SS" 포맷 */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceRecorder({ onUploadSuccess, onUploadError }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const uploadAudio = useCallback(
    async (blob: Blob, filename = 'recording.wav') => {
      setIsUploading(true);

      try {
        let uploadBlob: Blob;
        let uploadName: string;

        // WebM이면 WAV 변환, 그 외(WAV/MP3)는 직접 전송
        if (blob.type.includes('webm')) {
          setStatusMessage('WAV 변환 중...');
          uploadBlob = await convertToWav(blob);
          uploadName = 'recording.wav';
        } else {
          uploadBlob = blob;
          uploadName = filename;
        }

        setStatusMessage('분석 중...');
        const form = new FormData();
        form.append('file', uploadBlob, uploadName);

        const res = await fetch(UPLOAD_URL, { method: 'POST', body: form });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: '알 수 없는 오류' }));
          throw new Error(err.detail ?? `HTTP ${res.status}`);
        }
        const data: UploadResponse = await res.json();
        setStatusMessage(`분석 완료 (${data.duration_sec.toFixed(1)}초)`);
        onUploadSuccess?.(data);
      } catch (e) {
        const msg = e instanceof Error ? e.message : '업로드 실패';
        setStatusMessage(`오류: ${msg}`);
        onUploadError?.(msg);
      } finally {
        setIsUploading(false);
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
    analyser.fftSize = FFT_SIZE;
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
    setElapsed(0);
    setStatusMessage('녹음 중... (0:00)');

    // 녹음 타이머
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 1;
        setStatusMessage(`녹음 중... (${formatElapsed(next)})`);
        return next;
      });
    }, 1000);
  }, [uploadAudio]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setAnalyserNode(null);
    setRecordingState('stopped');

    // 타이머 정리
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // 입력 초기화 (같은 파일 재선택 허용)
      e.target.value = '';

      uploadAudio(file, file.name);
    },
    [uploadAudio],
  );

  const handleRetry = useCallback(() => {
    setRecordingState('idle');
    setStatusMessage('');
    setIsUploading(false);
    setElapsed(0);
  }, []);

  const isRecording = recordingState === 'recording';
  const hasError = statusMessage.startsWith('오류:');

  return (
    <div className="flex flex-col gap-4 w-full max-w-md">
      <WaveformVisualizer analyserNode={analyserNode} isRecording={isRecording} />

      {/* 숨김 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".wav,.mp3,.webm"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex justify-center gap-3">
        {!isRecording && !isUploading ? (
          <>
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white font-medium rounded-lg transition-colors"
            >
              <span className="w-3 h-3 rounded-full bg-white" />
              녹음 시작
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-6 py-2 bg-zinc-500 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors"
            >
              <span className="text-base">📁</span>
              파일 선택
            </button>
          </>
        ) : isRecording ? (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
          >
            <span className="w-3 h-3 rounded bg-white" />
            녹음 중지
          </button>
        ) : null}

        {hasError && (
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-700 font-medium rounded-lg transition-colors text-sm"
          >
            재시도
          </button>
        )}
      </div>

      {statusMessage && (
        <div className="flex items-center justify-center gap-2">
          {isUploading && (
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          )}
          <p className={`text-center text-sm ${hasError ? 'text-red-500' : 'text-gray-500'}`}>
            {statusMessage}
          </p>
        </div>
      )}
    </div>
  );
}
