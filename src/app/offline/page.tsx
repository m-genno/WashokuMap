import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "オフライン",
};

export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-orange-50 px-6 text-center text-stone-700">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-800 font-serif text-2xl font-bold text-orange-50">
        和
      </span>
      <h1 className="text-xl font-semibold">オフラインです</h1>
      <p className="max-w-sm text-sm text-stone-500">
        ネットワークに接続できませんでした。接続が回復してから、もう一度お試しください。
        <span className="mt-1 block">You are offline. Please reconnect and try again.</span>
      </p>
    </div>
  );
}
