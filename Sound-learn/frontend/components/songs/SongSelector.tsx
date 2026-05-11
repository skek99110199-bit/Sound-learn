'use client';

import { useRef, useState } from 'react';
import type { SongMeta, SongSelectorProps } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

type Tab = 'file' | 'youtube';

const ACCEPTED = '.wav,.mp3,.m4a,.flac,.ogg';

export default function SongSelector({ onSelect }: SongSelectorProps) {
  const [tab, setTab] = useState<Tab>('file');

  // ── 파일 업로드 탭 ────────────────────────────────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileError, setFileError] = useState('');
  const [fileTitle, setFileTitle] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFileLoading(true);
    setFileError('');
    setFileTitle('');

    const form = new FormData();
    form.append('file', file, file.name);

    try {
      const res = await fetch(`${API_URL}/api/songs/upload-reference`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? '업로드 실패');

      setFileTitle(data.title);
      const song: SongMeta = { id: 'upload', title: data.title, artist: '업로드 파일' };
      onSelect(song, data.frames);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : '업로드 실패');
    } finally {
      setFileLoading(false);
    }
  };

  // ── YouTube 탭 ────────────────────────────────────────────────────────────────
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState('');
  const [ytTitle, setYtTitle] = useState('');

  const handleYoutubeLoad = async () => {
    const url = youtubeUrl.trim();
    if (!url) return;
    setYtLoading(true);
    setYtError('');
    setYtTitle('');

    try {
      const res = await fetch(`${API_URL}/api/songs/youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? '불러오기 실패');

      setYtTitle(data.title);
      onSelect({ id: 'youtube', title: data.title, artist: 'YouTube' }, data.frames);
    } catch (e) {
      setYtError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setYtLoading(false);
    }
  };

  const isLoading = fileLoading || ytLoading;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* 탭 */}
      <div className="flex border-b border-zinc-200">
        {(['file', 'youtube'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            disabled={isLoading}
            className={[
              'px-4 py-2 text-sm font-medium transition-colors',
              tab === t
                ? 'border-b-2 border-indigo-500 text-indigo-600'
                : 'text-zinc-500 hover:text-zinc-700',
            ].join(' ')}
          >
            {t === 'file' ? '📂 파일 업로드' : '🎬 YouTube'}
          </button>
        ))}
      </div>

      {/* ── 파일 업로드 탭 ── */}
      {tab === 'file' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">
            기준으로 사용할 오디오 파일을 업로드하세요.
            <span className="ml-1 text-xs text-zinc-400">(WAV · MP3 · M4A · FLAC · OGG)</span>
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={fileLoading}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-8 text-sm text-zinc-500 transition-colors hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:opacity-50"
          >
            {fileLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                Pitch 분석 중...
              </>
            ) : (
              <>
                <span className="text-xl">📂</span>
                클릭해서 파일 선택
              </>
            )}
          </button>

          {fileError && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{fileError}</p>
          )}
          {fileTitle && !fileLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm">
              <span className="text-emerald-500">✓</span>
              <span className="font-medium text-emerald-700">{fileTitle}</span>
              <span className="text-emerald-400">— pitch 분석 완료</span>
            </div>
          )}
        </div>
      )}

      {/* ── YouTube 탭 ── */}
      {tab === 'youtube' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-500">
            YouTube 영상 URL을 입력하면 오디오를 분석해 기준 melody로 사용합니다.
            <br />
            <span className="text-xs text-zinc-400">* 10분 이하 영상만 지원 · 처리에 30초~1분 소요</span>
          </p>

          <div className="flex gap-2">
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleYoutubeLoad()}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={ytLoading}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleYoutubeLoad}
              disabled={ytLoading || !youtubeUrl.trim()}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:opacity-50"
            >
              {ytLoading ? '분석 중...' : '불러오기'}
            </button>
          </div>

          {ytLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-600">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              YouTube 오디오 다운로드 및 pitch 분석 중...
            </div>
          )}
          {ytError && (
            <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{ytError}</p>
          )}
          {ytTitle && !ytLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm">
              <span className="text-emerald-500">✓</span>
              <span className="font-medium text-emerald-700">{ytTitle}</span>
              <span className="text-emerald-400">— pitch 분석 완료</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
