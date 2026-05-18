'use client';

/**
 * VoiceRecorder — 마이크 녹음 및 파일 업로드 컴포넌트
 *
 * 주요 기능:
 *  1. MediaRecorder API로 브라우저에서 마이크 녹음 (WebM/Opus)
 *  2. 녹음된 WebM을 Web Audio API로 WAV 변환 후 서버 업로드
 *     (서버가 WAV만 받기 때문에 변환 필요)
 *  3. 파일 선택 모드: 기존 오디오 파일 직접 업로드
 *  4. onAudioReady 콜백으로 Blob URL 전달 → 소절 재생에 활용
 *  5. WaveformVisualizer에 AnalyserNode 전달 → 실시간 파형 표시
 */

import { useCallback, useRef, useState } from 'react';
import WaveformVisualizer from './WaveformVisualizer';
import type { RecordingState, UploadResponse, VoiceRecorderProps } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const UPLOAD_URL = `${API_URL}/api/upload`;
const FFT_SIZE = 2048;                   // Web Audio AnalyserNode FFT 크기 (파형 시각화 해상도)
const RECORDING_SAMPLE_RATE = 22050;    // WAV 변환 목표 샘플레이트 (22.05kHz — librosa 권장)
const SUCCESS_MESSAGE_DELAY_MS = 900;   // "분석 완료" 메시지를 잠깐 보여주는 시간 (ms)

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export default function VoiceRecorder({ onUploadSuccess, onUploadError, onAudioReady }: VoiceRecorderProps) {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  // analyserNode: WaveformVisualizer에 전달해 실시간 파형을 그림
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  // ── ref 관리 ──────────────────────────────────────────────────────────────
  // ref를 사용하는 이유: 재렌더 없이 값을 유지해야 하거나,
  //                      비동기 콜백(ondataavailable, onstop)에서 접근해야 하기 때문
  const mediaRecorderRef = useRef<MediaRecorder | null>(null); // 녹음 제어
  const audioContextRef  = useRef<AudioContext | null>(null);  // 파형 시각화용 AudioContext
  const chunksRef        = useRef<BlobPart[]>([]);             // 녹음 데이터 청크 누적
  const streamRef        = useRef<MediaStream | null>(null);   // 마이크 스트림 (정지 시 해제)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null); // 녹음 시간 타이머
  const fileInputRef     = useRef<HTMLInputElement | null>(null); // 숨김 파일 입력

  /**
   * 오디오 Blob을 서버에 업로드하고 분석 결과를 받아온다.
   *
   * WebM 포맷인 경우 convertToWav()로 변환 후 전송한다.
   * (서버의 librosa는 WAV를 직접 처리하므로 변환 필요)
   */
  const uploadAudio = useCallback(
    async (blob: Blob, filename = 'recording.wav') => {
      setIsUploading(true);

      try {
        let uploadBlob: Blob;
        let uploadName: string;

        // MediaRecorder가 생성한 WebM은 브라우저에서 WAV로 변환
        // 파일 선택으로 업로드한 WAV/MP3는 그대로 전송
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
        // 완료 메시지를 잠깐 보여준 후 콜백 호출
        await delay(SUCCESS_MESSAGE_DELAY_MS);
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

  /** 마이크 녹음 시작 */
  const startRecording = useCallback(async () => {
    setStatusMessage('');
    chunksRef.current = [];  // 이전 녹음 데이터 초기화

    let stream: MediaStream;
    try {
      // 브라우저에 마이크 권한 요청
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setStatusMessage('마이크 접근 권한이 필요합니다.');
      return;
    }

    streamRef.current = stream;

    // Web Audio API 설정 — AnalyserNode로 실시간 파형 데이터 추출
    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;  // 클수록 주파수 해상도 높아짐
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    setAnalyserNode(analyser);  // WaveformVisualizer에 전달

    // MediaRecorder 설정 — Opus 코덱 지원 여부에 따라 mimeType 결정
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';
    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    // 데이터 청크를 배열에 누적 (recorder.stop() 호출 전까지 계속 쌓임)
    recorder.ondataavailable = (e: BlobEvent) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    // 녹음 중지 시: 청크를 Blob으로 합치고 업로드
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      // Blob URL 생성: 소절 재생 시 이 URL의 특정 구간을 재생함
      // (실제 업로드는 WAV로 변환 후 전송하지만, 재생은 원본 WebM 사용)
      onAudioReady?.(URL.createObjectURL(blob));
      uploadAudio(blob);

      // 마이크 스트림 해제 (브라우저 녹음 표시 아이콘 사라짐)
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    recorder.start();
    setRecordingState('recording');
    setStatusMessage('녹음 중... (0:00)');

    // 1초마다 경과 시간 표시 갱신
    timerRef.current = setInterval(() => {
      setStatusMessage((prev) => {
        // "녹음 중... (M:SS)" 패턴에서 현재 초 파싱
        const current = Number(prev.match(/\((\d+):(\d{2})\)/)?.[1] ?? 0) * 60
          + Number(prev.match(/\((\d+):(\d{2})\)/)?.[2] ?? 0);
        const next = current + 1;
        return `녹음 중... (${formatElapsed(next)})`;
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

      // 브라우저 재생용 URL 생성
      onAudioReady?.(URL.createObjectURL(file));
      uploadAudio(file, file.name);
    },
    [uploadAudio, onAudioReady],
  );

  const handleRetry = useCallback(() => {
    setRecordingState('idle');
    setStatusMessage('');
    setIsUploading(false);
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
