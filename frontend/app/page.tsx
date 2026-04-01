import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50">
      <main className="flex flex-col items-center gap-8 p-10 bg-white rounded-xl shadow-md">
        
        <h1 className="text-3xl font-bold">
          🎤 Sound-Learn
        </h1>

        <p className="text-gray-600 text-center">
          노래를 업로드하거나 녹음하여 음정과 박자를 분석해보세요.
        </p>

        <input 
          type="file" 
          accept="audio/*"
          className="border p-2 rounded"
        />

        <button className="px-6 py-2 bg-black text-white rounded">
          분석 시작
        </button>

      </main>
    </div>
  );
}
