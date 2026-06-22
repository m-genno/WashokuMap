"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminHeaders, adminTokenHeader } from "@/lib/adminClient";

export interface GenreOption {
  code: string;
  label: string;
}

/** 編集フォームの初期値(GET /api/admin/restaurants/[id] のレスポンス形)。 */
interface Initial {
  name: string;
  name_en: string | null;
  description: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  website_url: string | null;
  reservation_mode: string;
  reservation_url: string | null;
  price_range: number | null;
  status: string;
  genres: string[];
  photos?: {
    url: string;
    thumb_url: string | null;
    caption: string | null;
    is_primary: boolean;
  }[];
  hours?: {
    day_of_week: number;
    open_time: string;
    close_time: string;
    note: string | null;
  }[];
}

interface PhotoRow {
  url: string;
  thumbUrl: string | null;
  caption: string;
  isPrimary: boolean;
}
interface HoursRow {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  note: string;
}

const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

const EMPTY: Initial = {
  name: "",
  name_en: null,
  description: null,
  address: null,
  lat: null,
  lng: null,
  phone: null,
  website_url: null,
  reservation_mode: "request",
  reservation_url: null,
  price_range: null,
  status: "draft",
  genres: [],
  photos: [],
  hours: [],
};

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; id: string; lat: number | null; lng: number | null; geocoded: boolean }
  | { kind: "error"; message: string };

const label = "block text-sm font-medium text-stone-700";
const input =
  "mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400";

const ERROR_LABELS: Record<string, string> = {
  name_required: "店名は必須です",
  invalid_reservation_mode: "予約方式が不正です",
  invalid_price_range: "価格帯が不正です",
  invalid_status: "公開状態が不正です",
  no_location_for_publish:
    "位置情報がないため公開できません。住所を入力するか緯度経度を設定してください。",
  invalid_photo_url: "写真URLは http(s):// で始まる必要があります",
  photos_too_many: "写真が多すぎます(最大20枚)",
  invalid_hours_day: "営業時間の曜日が不正です",
  invalid_hours_time: "営業時間は HH:MM 形式で入力してください",
  hours_too_many: "営業時間の行が多すぎます",
  not_found: "店舗が見つかりません",
  unauthorized: "認証が必要です。上のトークンを入力してください。",
  network_error: "通信エラー",
};

/**
 * 店舗の登録/編集フォーム。
 * restaurantId を渡すと編集モード(GET で読み込み → PUT で更新)、
 * 省略すると新規登録モード(POST)。
 */
export default function RestaurantForm({
  genres,
  restaurantId,
}: {
  genres: GenreOption[];
  restaurantId?: string;
}) {
  const editing = !!restaurantId;
  const [initial, setInitial] = useState<Initial | null>(
    editing ? null : EMPTY
  );
  const [loadError, setLoadError] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [mode, setMode] = useState("request");
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [hours, setHours] = useState<HoursRow[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // 編集モードは既存データを読み込んでから初期値に反映する。
  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/admin/restaurants/${restaurantId}`, {
          headers: adminHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(ERROR_LABELS[data.error] ?? "読み込みに失敗しました");
          return;
        }
        setInitial(data.restaurant);
        setMode(data.restaurant.reservation_mode ?? "request");
        setPhotos(
          (data.restaurant.photos ?? []).map(
            (p: {
              url: string;
              thumb_url: string | null;
              caption: string | null;
              is_primary: boolean;
            }) => ({
              url: p.url,
              thumbUrl: p.thumb_url ?? null,
              caption: p.caption ?? "",
              isPrimary: p.is_primary,
            })
          )
        );
        setHours(
          (data.restaurant.hours ?? []).map(
            (h: {
              day_of_week: number;
              open_time: string;
              close_time: string;
              note: string | null;
            }) => ({
              dayOfWeek: h.day_of_week,
              openTime: h.open_time,
              closeTime: h.close_time,
              note: h.note ?? "",
            })
          )
        );
      } catch {
        if (!cancelled) setLoadError("通信エラー");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "submitting" });
    const fd = new FormData(e.currentTarget);

    const numOrNull = (v: FormDataEntryValue | null) => {
      const s = String(v ?? "").trim();
      if (!s) return null;
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    };

    const payload = {
      name: String(fd.get("name") || "").trim(),
      nameEn: String(fd.get("nameEn") || "").trim() || null,
      description: String(fd.get("description") || "").trim() || null,
      address: String(fd.get("address") || "").trim() || null,
      lat: numOrNull(fd.get("lat")),
      lng: numOrNull(fd.get("lng")),
      phone: String(fd.get("phone") || "").trim() || null,
      websiteUrl: String(fd.get("websiteUrl") || "").trim() || null,
      reservationMode: String(fd.get("reservationMode") || "request"),
      reservationUrl: String(fd.get("reservationUrl") || "").trim() || null,
      priceRange: fd.get("priceRange") ? Number(fd.get("priceRange")) : null,
      status: String(fd.get("status") || "draft"),
      genres: fd.getAll("genres").map(String),
      photos: photos
        .filter((p) => p.url.trim())
        .map((p) => ({
          url: p.url.trim(),
          thumbUrl: p.thumbUrl,
          caption: p.caption.trim() || null,
          isPrimary: p.isPrimary,
        })),
      hours: hours
        .filter((h) => h.openTime && h.closeTime)
        .map((h) => ({
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          note: h.note.trim() || null,
        })),
    };

    try {
      const res = await fetch(
        editing ? `/api/admin/restaurants/${restaurantId}` : "/api/admin/restaurants",
        {
          method: editing ? "PUT" : "POST",
          headers: adminHeaders(),
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({
          kind: "error",
          message: ERROR_LABELS[data.error] ?? data.error ?? "failed",
        });
        return;
      }
      setState({ kind: "success", ...data.restaurant });
    } catch {
      setState({ kind: "error", message: ERROR_LABELS.network_error });
    }
  }

  if (loadError) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {loadError}
      </p>
    );
  }
  if (!initial) {
    return <p className="text-sm text-stone-500">読み込み中…</p>;
  }

  if (state.kind === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">
        <h2 className="mb-1 font-semibold text-emerald-900">
          {editing ? "更新しました" : "登録しました"}
        </h2>
        <p className="text-emerald-800">
          ID: <span className="font-mono">{state.id}</span>
        </p>
        <p className="text-emerald-800">
          位置:{" "}
          {state.lat != null && state.lng != null
            ? `${state.lat.toFixed(5)}, ${state.lng.toFixed(5)} ${
                state.geocoded ? "(住所からジオコーディング)" : ""
              }`
            : "未取得(住所から特定できませんでした。緯度経度を手動設定してください)"}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href={`/restaurants/${state.id}`} className="text-emerald-900 underline">
            店舗ページを見る
          </Link>
          <Link href="/admin/restaurants" className="text-emerald-900 underline">
            一覧へ戻る
          </Link>
          {!editing && (
            <button
              type="button"
              onClick={() => setState({ kind: "idle" })}
              className="text-emerald-900 underline"
            >
              続けて登録
            </button>
          )}
        </div>
      </div>
    );
  }

  const submitting = state.kind === "submitting";
  const cell =
    "rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-orange-400";

  // 写真の操作
  const addPhoto = () =>
    setPhotos((ps) => [
      ...ps,
      { url: "", thumbUrl: null, caption: "", isPrimary: ps.length === 0 },
    ]);
  const removePhoto = (i: number) =>
    setPhotos((ps) => ps.filter((_, j) => j !== i));
  const setPhotoField = (i: number, field: "url" | "caption", val: string) =>
    setPhotos((ps) =>
      ps.map((p, j) =>
        j === i
          ? // URL を手入力したら(自前アップロードでない)サムネは無効化。
            field === "url"
            ? { ...p, url: val, thumbUrl: null }
            : { ...p, [field]: val }
          : p
      )
    );
  const setPrimary = (i: number) =>
    setPhotos((ps) => ps.map((p, j) => ({ ...p, isPrimary: j === i })));

  // 画像アップロード(sharp で軽量化+サムネ生成)。管理トークンで認可。
  const onUploadPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingPhoto(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/uploads", {
          method: "POST",
          headers: adminTokenHeader(),
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setState({
            kind: "error",
            message:
              data.error === "too_large"
                ? "画像が大きすぎます(最大5MB)"
                : "画像のアップロードに失敗しました",
          });
          continue;
        }
        setPhotos((ps) => [
          ...ps,
          {
            url: data.url,
            thumbUrl: data.thumbUrl ?? null,
            caption: "",
            isPrimary: ps.length === 0,
          },
        ]);
      }
    } finally {
      setUploadingPhoto(false);
    }
  };

  // 営業時間の操作
  const addHours = () =>
    setHours((hs) => [
      ...hs,
      { dayOfWeek: 1, openTime: "", closeTime: "", note: "" },
    ]);
  const removeHours = (i: number) =>
    setHours((hs) => hs.filter((_, j) => j !== i));
  const setHoursField = (
    i: number,
    field: keyof HoursRow,
    val: string | number
  ) => setHours((hs) => hs.map((h, j) => (j === i ? { ...h, [field]: val } : h)));

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label>
        <span className={label}>店名 *</span>
        <input name="name" required defaultValue={initial.name} className={input} />
      </label>
      <label>
        <span className={label}>店名(英語)</span>
        <input
          name="nameEn"
          defaultValue={initial.name_en ?? ""}
          className={input}
          placeholder="Sushi Tanaka"
        />
      </label>
      <label>
        <span className={label}>住所(ジオコーディングで地図表示)</span>
        <input
          name="address"
          defaultValue={initial.address ?? ""}
          className={input}
          placeholder="東京都渋谷区道玄坂1-2-3"
        />
      </label>

      <fieldset className="rounded-lg border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium text-stone-700">
          緯度・経度(任意)
        </legend>
        <p className="mb-2 text-xs text-stone-500">
          入力すると住所より優先します。空欄にすると住所から再取得します。
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="text-xs text-stone-600">緯度 (lat)</span>
            <input
              name="lat"
              type="number"
              step="any"
              defaultValue={initial.lat ?? ""}
              className={input}
              placeholder="35.65858"
            />
          </label>
          <label>
            <span className="text-xs text-stone-600">経度 (lng)</span>
            <input
              name="lng"
              type="number"
              step="any"
              defaultValue={initial.lng ?? ""}
              className={input}
              placeholder="139.70125"
            />
          </label>
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={label}>電話</span>
          <input name="phone" defaultValue={initial.phone ?? ""} className={input} />
        </label>
        <label>
          <span className={label}>Webサイト</span>
          <input
            name="websiteUrl"
            defaultValue={initial.website_url ?? ""}
            className={input}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className={label}>予約方式</span>
          <select
            name="reservationMode"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className={input}
          >
            <option value="request">リクエスト予約(アプリ内)</option>
            <option value="external">外部サイト</option>
            <option value="phone_only">電話のみ</option>
          </select>
        </label>
        <label>
          <span className={label}>価格帯</span>
          <select
            name="priceRange"
            className={input}
            defaultValue={initial.price_range ? String(initial.price_range) : ""}
          >
            <option value="">(未設定)</option>
            <option value="1">¥</option>
            <option value="2">¥¥</option>
            <option value="3">¥¥¥</option>
            <option value="4">¥¥¥¥</option>
          </select>
        </label>
      </div>

      {mode === "external" && (
        <label>
          <span className={label}>外部予約URL</span>
          <input
            name="reservationUrl"
            defaultValue={initial.reservation_url ?? ""}
            className={input}
            placeholder="https://..."
          />
        </label>
      )}

      <fieldset className="rounded-lg border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium text-stone-700">ジャンル</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {genres.map((g) => (
            <label key={g.code} className="flex items-center gap-1">
              <input
                type="checkbox"
                name="genres"
                value={g.code}
                defaultChecked={initial.genres.includes(g.code)}
              />{" "}
              {g.label}
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        <span className={label}>紹介文</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={initial.description ?? ""}
          className={input}
        />
      </label>

      {/* 写真 */}
      <fieldset className="rounded-lg border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium text-stone-700">写真</legend>
        {photos.length === 0 ? (
          <p className="text-xs text-stone-400">写真は未登録です。</p>
        ) : (
          <div className="flex flex-col gap-2">
            {photos.map((p, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                {p.url.trim() && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.thumbUrl ?? p.url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded object-cover"
                  />
                )}
                <input
                  value={p.url}
                  onChange={(e) => setPhotoField(i, "url", e.target.value)}
                  placeholder="https://...(画像URL)"
                  className={`${cell} min-w-[12rem] flex-1`}
                />
                {p.thumbUrl && (
                  <span className="text-xs text-emerald-700">軽量化済</span>
                )}
                <input
                  value={p.caption}
                  onChange={(e) => setPhotoField(i, "caption", e.target.value)}
                  placeholder="キャプション"
                  className={`${cell} min-w-[8rem] flex-1`}
                />
                <label className="flex items-center gap-1 text-xs text-stone-600">
                  <input
                    type="radio"
                    name="primaryPhoto"
                    checked={p.isPrimary}
                    onChange={() => setPrimary(i)}
                  />{" "}
                  メイン
                </label>
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <label className="cursor-pointer text-sm font-medium text-orange-800 hover:text-orange-900">
            {uploadingPhoto ? "アップロード中…" : "画像をアップロード"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={onUploadPhotos}
              disabled={uploadingPhoto}
              className="hidden"
            />
          </label>
          <button
            type="button"
            onClick={addPhoto}
            className="text-sm font-medium text-stone-600 hover:text-stone-900"
          >
            + URLで追加
          </button>
        </div>
        <p className="mt-1 text-xs text-stone-400">
          アップロードした画像は自動で軽量化され、サムネイルを生成します。
        </p>
      </fieldset>

      {/* 営業時間 */}
      <fieldset className="rounded-lg border border-stone-200 p-3">
        <legend className="px-1 text-sm font-medium text-stone-700">
          営業時間
        </legend>
        {hours.length === 0 ? (
          <p className="text-xs text-stone-400">
            営業時間は未登録です(昼/夜で行を分けられます)。
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {hours.map((h, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <select
                  value={h.dayOfWeek}
                  onChange={(e) =>
                    setHoursField(i, "dayOfWeek", Number(e.target.value))
                  }
                  className={cell}
                >
                  {DAY_LABELS.map((d, di) => (
                    <option key={di} value={di}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  value={h.openTime}
                  onChange={(e) => setHoursField(i, "openTime", e.target.value)}
                  className={cell}
                />
                <span className="text-stone-400">–</span>
                <input
                  type="time"
                  value={h.closeTime}
                  onChange={(e) => setHoursField(i, "closeTime", e.target.value)}
                  className={cell}
                />
                <input
                  value={h.note}
                  onChange={(e) => setHoursField(i, "note", e.target.value)}
                  placeholder="備考(L.O. 等)"
                  className={`${cell} min-w-[6rem] flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeHours(i)}
                  className="text-xs text-red-600 hover:underline"
                >
                  削除
                </button>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={addHours}
          className="mt-2 text-sm font-medium text-orange-800 hover:text-orange-900"
        >
          + 営業時間を追加
        </button>
      </fieldset>

      <label>
        <span className={label}>公開状態</span>
        <select name="status" className={input} defaultValue={initial.status}>
          <option value="draft">下書き(非公開)</option>
          <option value="published">公開</option>
          <option value="closed">休止</option>
        </select>
      </label>

      {state.kind === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {editing ? "更新" : "登録"}に失敗しました（{state.message}）
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-orange-800 px-6 py-3 font-medium text-orange-50 hover:bg-orange-900 disabled:opacity-60"
      >
        {submitting
          ? editing
            ? "更新中…"
            : "登録中…"
          : editing
            ? "更新する"
            : "登録する"}
      </button>
    </form>
  );
}
