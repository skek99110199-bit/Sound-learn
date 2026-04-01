'use client';

import { VoiceRecorder } from '@/components/recorder';
import type { UploadResponse } from '@/components/recorder';

export default function Home() {
  const handleSuccess = (res: UploadResponse) => {
    console.log('업로드 결과:', res);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <main className="flex flex-col items-center gap-8 p-10 bg-white rounded-xl shadow-md">

        <h1 className="text-3xl font-bold">
          Sound-Learn
        </h1>

        <p className="text-gray-600 text-center">
          노래를 녹음하여 음정과 박자를 분석해보세요.
        </p>

        <VoiceRecorder onUploadSuccess={handleSuccess} />

      </main>
    </div>
  );
}
