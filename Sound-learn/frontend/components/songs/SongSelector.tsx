'use client';

import { useEffect, useState } from 'react';
import type { SongMeta, SongSelectorProps } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function SongSelector({ onSelect }: SongSelectorProps) {
  const [songs, setSongs] = useState<SongMeta[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchingRef, setFetchingRef] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_URL}/api/songs`)
      .then((r) => r.json())
      .then((data) => {
        setSongs(data.songs ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('곡 목록을 불러오지 못했습니다.');
        setLoading(false);
      });
  }, []);

  const handleSelect = async (song: SongMeta) => {
    setSelectedId(song.id);
    setFetchingRef(true);
    try {
      const res = await fetch(`${API_URL}/api/songs/${song.id}/reference`);
      if (!res.ok) throw new Error('reference 조회 실패');
      const data = await res.json();
      onSelect(song, data.frames);
    } catch {
      setError('기준 데이터를 불러오지 못했습니다.');
      setSelectedId(null);
    } finally {
      setFetchingRef(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
        곡 목록 불러오는 중...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm font-medium text-zinc-700">기준곡 선택</p>
      <div className="grid grid-cols-3 gap-2">
        {songs.map((song) => {
          const isSelected = selectedId === song.id;
          return (
            <button
              key={song.id}
              onClick={() => handleSelect(song)}
              disabled={fetchingRef}
              className={[
                'flex flex-col items-center rounded-xl border p-4 text-center transition-all',
                isSelected
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-700'
                  : 'border-zinc-200 bg-white text-zinc-700 hover:border-indigo-300 hover:bg-indigo-50',
                fetchingRef ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
              ].join(' ')}
            >
              <span className="text-2xl">🎵</span>
              <span className="mt-1 text-sm font-semibold">{song.title}</span>
              <span className="text-xs text-zinc-400">{song.artist}</span>
              {isSelected && fetchingRef && (
                <span className="mt-1 text-xs text-indigo-500">불러오는 중...</span>
              )}
              {isSelected && !fetchingRef && (
                <span className="mt-1 text-xs text-indigo-500">✓ 선택됨</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
