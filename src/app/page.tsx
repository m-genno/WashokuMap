export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-orange-50 font-sans text-stone-900">
      <header className="border-b border-orange-100 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-800 font-serif text-lg font-bold text-orange-50">
            和
          </span>
          <span className="text-lg font-semibold tracking-tight">WashokuMap</span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-14">
        <section className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            隠れた和食の名店を、
            <br className="hidden sm:block" />
            登録不要で見つけて予約。
          </h1>
          <p className="max-w-xl text-stone-600">
            食べログ・一休などに載っていないお店も。店名やジャンルで検索して、地図と一覧から探せます。
            <span className="block text-sm text-stone-500">
              Find and reserve hidden washoku restaurants — no app, no sign-up
              required.
            </span>
          </p>

          {/* 検索バー(MVPではUIプレースホルダ。検索APIは後続フェーズで接続) */}
          <form
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            action="/search"
          >
            <input
              type="search"
              name="q"
              placeholder="店名・ジャンル・エリアで検索(例: 寿司 渋谷)"
              aria-label="和食店を検索"
              className="flex-1 rounded-full border border-orange-200 bg-white px-5 py-3 text-base shadow-sm outline-none placeholder:text-stone-400 focus:border-orange-400"
            />
            <button
              type="submit"
              className="rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 transition-colors hover:bg-orange-900"
            >
              検索
            </button>
          </form>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "インストール不要",
              body: "ブラウザでそのまま使えるWebアプリ(PWA)。ホーム画面への追加も可能。",
            },
            {
              title: "登録不要で予約",
              body: "氏名や連絡先はこの端末に保存して次回自動入力。希望者だけログインで同期。",
            },
            {
              title: "言葉の壁を越える",
              body: "予約内容を自動翻訳＋原文も併記して店舗へ。アレルギーも定型項目で伝達。",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm"
            >
              <h2 className="mb-1 font-semibold">{f.title}</h2>
              <p className="text-sm text-stone-600">{f.body}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-dashed border-orange-300 bg-white/60 p-5 text-sm text-stone-600">
          <p className="font-medium text-stone-800">開発メモ</p>
          <p>
            これは雛形です。設計の詳細は{" "}
            <code className="rounded bg-orange-100 px-1">docs/</code>{" "}
            (architecture / data-model / cost-estimate) を参照してください。
            検索・地図・予約・口コミは後続フェーズで実装します。
          </p>
        </section>
      </main>

      <footer className="border-t border-orange-100 bg-white/70 py-6 text-center text-xs text-stone-500">
        WashokuMap — 和食店に特化したインバウンド向けWebアプリ
      </footer>
    </div>
  );
}
