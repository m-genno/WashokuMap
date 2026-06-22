// 軽量な多言語UI(依存なし)。
// - UI文言は locale ごとの辞書(下記 dictionaries)。
// - 店舗名・ジャンル名・口コミ訳などのデータは name_translations 等の
//   jsonb から pickTranslation で言語を選ぶ。
// - locale は cookie(wm.locale)で保持。サーバは next/headers の cookies()
//   で読み、クライアントは LocaleSwitcher が document.cookie に書いて再描画。

export const LOCALES = ["ja", "en", "zh-Hans", "zh-Hant", "ko"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ja";
export const LOCALE_COOKIE = "wm.locale";

/** 言語切替メニューの表示名(その言語自身の名前)。 */
export const LOCALE_LABELS: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "繁體中文",
  ko: "한국어",
};

export function resolveLocale(value: string | null | undefined): Locale {
  return LOCALES.includes(value as Locale) ? (value as Locale) : DEFAULT_LOCALE;
}

/** html lang 属性用(zh-Hans/zh-Hant はそのまま BCP47 として有効)。 */
export function htmlLang(locale: Locale): string {
  return locale;
}

/**
 * 多言語データ(jsonb の {ja,en,...})から locale に最も合う訳を選ぶ。
 * locale → en → ja の順でフォールバックし、無ければ fallback(原文)を返す。
 */
export function pickTranslation(
  translations: Record<string, string> | null | undefined,
  locale: Locale,
  fallback: string
): string {
  if (!translations) return fallback;
  return (
    translations[locale] ||
    translations.en ||
    translations.ja ||
    fallback
  );
}

type Dict = Record<string, string>;

const ja: Dict = {
  "nav.favorites": "♥ お気に入り",
  "nav.back": "← 検索に戻る",
  "nav.search": "検索する →",

  "fav.title": "お気に入り",
  "fav.empty":
    "お気に入りはまだありません。店舗カードや詳細ページの ♡ から追加できます(この端末に保存されます)。",
  "fav.remove": "削除",

  "offline.title": "オフラインです",
  "offline.message":
    "ネットワークに接続できませんでした。接続が回復してから、もう一度お試しください。",

  "home.heroTitle": "隠れた和食の名店を、登録不要で見つけて予約。",
  "home.heroLead":
    "食べログ・一休などに載っていないお店も。店名やジャンルで検索して、地図と一覧から探せます。",
  "home.feature1Title": "インストール不要",
  "home.feature1Body":
    "ブラウザでそのまま使えるWebアプリ(PWA)。ホーム画面への追加も可能。",
  "home.feature2Title": "登録不要で予約",
  "home.feature2Body":
    "氏名や連絡先はこの端末に保存して次回自動入力。希望者だけログインで同期。",
  "home.feature3Title": "言葉の壁を越える",
  "home.feature3Body":
    "予約内容を自動翻訳＋原文も併記して店舗へ。アレルギーも定型項目で伝達。",
  "home.footer": "和食店に特化したインバウンド向けWebアプリ",

  "searchBar.placeholder": "店名・ジャンル・エリアで検索(例: 寿司 渋谷)",
  "searchBar.aria": "和食店を検索",
  "searchBar.button": "検索",
  "recent.title": "最近の検索",
  "recent.clear": "クリア",

  "search.headingWithQuery": "「{q}」の検索結果: ",
  "search.heading": "検索結果: ",
  "search.count": "{count} 件",
  "filters.useLocation": "📍 現在地から探す",
  "filters.locating": "📍 現在地を取得中…",
  "filters.nearby": "📍 現在地周辺（半径{radius}km）",
  "filters.clearLocation": "現在地を解除",
  "filters.errUnsupported": "この端末では現在地を取得できません。",
  "filters.errDenied": "位置情報の利用が許可されませんでした。",
  "filters.errGeneric": "現在地を取得できませんでした。",

  "results.empty":
    "該当する和食店が見つかりませんでした。別のキーワードでお試しください。",
  "results.detail": "詳細・予約 →",
  "results.reservationLabel": "予約",

  "resv.request": "リクエスト予約",
  "resv.external": "公式サイト予約",
  "resv.phone_only": "電話予約",

  "detail.reserveRequest": "予約をリクエスト",
  "detail.reserveExternal": "公式サイトで予約",
  "detail.reservePhone": "電話で予約 {phone}",
  "detail.phoneInquiry": "電話で問い合わせ",
  "detail.phoneOnlyNoPhone":
    "このお店は電話予約のみですが、電話番号が未登録です。",
  "detail.sectionIntro": "紹介",
  "detail.sectionHours": "営業時間",
  "detail.sectionAccess": "アクセス",
  "detail.sectionReviews": "口コミ",
  "detail.noLocation": "位置情報は未登録です。",
  "detail.noReviews": "まだ口コミがありません。予約・来店された方が投稿できます。",
  "detail.translated": "和訳: ",

  "review.checking": "投稿資格を確認中…",
  "review.done": "口コミを投稿しました。ありがとうございます。",
  "review.notEligible":
    "口コミは、このお店で予約・来店された方のみ投稿できます。",
  "review.titleNew": "口コミを投稿",
  "review.titleEdit": "口コミを編集",
  "review.comment": "コメント(任意)",
  "review.commentHint": "日本語以外で書くと、お店向けに日本語訳も保存します。",
  "review.lang": "投稿言語",
  "review.submit": "投稿する",
  "review.update": "更新する",
  "review.submitting": "送信中…",
  "review.failed": "投稿に失敗しました（{error}）。",

  "report.button": "通報",
  "report.submit": "通報する",
  "report.cancel": "やめる",
  "report.sending": "送信中…",
  "report.done": "通報を受け付けました",
  "report.failed": "送信に失敗しました",
  "report.reason1": "不適切な内容・誹謗中傷",
  "report.reason2": "スパム・宣伝",
  "report.reason3": "事実と異なる",
  "report.reason4": "その他",

  "reserve.date": "来店希望日 *",
  "reserve.time": "時間 *",
  "reserve.partySize": "人数 *",
  "reserve.name": "お名前 *",
  "reserve.email": "メール",
  "reserve.phone": "電話",
  "reserve.lang": "ご利用言語",
  "reserve.dietary": "食事の制限",
  "reserve.vegetarian": "ベジタリアン",
  "reserve.halal": "ハラル",
  "reserve.allergies": "アレルギー(カンマ区切り)",
  "reserve.budget": "予算(1人あたり・円)",
  "reserve.requests": "ご要望(自由記入)",
  "reserve.requestsPlaceholder": "窓際の席を希望、記念日です、など",
  "reserve.requestsHint": "入力内容は原文のままお店へ伝え、日本語訳を併記します。",
  "reserve.submit": "予約をリクエスト",
  "reserve.submitting": "送信中…",
  "reserve.failed": "送信に失敗しました（{error}）。入力内容をご確認ください。",
  "reserve.successTitle": "予約リクエストを送信しました",
  "reserve.successBody":
    "お店からの返答をお待ちください。確定または代替案をご連絡します。",
  "reserve.refNo": "受付番号:",
  "reserve.status": "状態:",
  "reserve.back": "← 店舗詳細に戻る",
  "reservePage.title": "{name} を予約",
  "reservePage.notSupported":
    "このお店はオンラインのリクエスト予約に対応していません。",
  "reservePage.seeMethods": "店舗詳細の予約方法を見る →",
};

const en: Dict = {
  "nav.favorites": "♥ Favorites",
  "nav.back": "← Back to search",
  "nav.search": "Search →",

  "fav.title": "Favorites",
  "fav.empty":
    "No favorites yet. Add them with the ♡ on restaurant cards or detail pages (saved on this device).",
  "fav.remove": "Remove",

  "offline.title": "You’re offline",
  "offline.message":
    "Couldn’t connect to the network. Please reconnect and try again.",

  "home.heroTitle": "Find and reserve hidden washoku gems — no sign-up needed.",
  "home.heroLead":
    "Including places not listed on Tabelog or Ikkyu. Search by name or genre and browse on a map and list.",
  "home.feature1Title": "No install",
  "home.feature1Body":
    "A web app (PWA) that works right in your browser. Add it to your home screen if you like.",
  "home.feature2Title": "Reserve without sign-up",
  "home.feature2Body":
    "Your name and contact are saved on this device for next time. Sign in only if you want to sync.",
  "home.feature3Title": "Beat the language barrier",
  "home.feature3Body":
    "Requests are auto-translated and sent with the original text. Allergies are passed via set fields.",
  "home.footer": "An inbound-focused web app dedicated to washoku restaurants",

  "searchBar.placeholder": "Search by name, genre, or area (e.g. sushi Shibuya)",
  "searchBar.aria": "Search washoku restaurants",
  "searchBar.button": "Search",
  "recent.title": "Recent searches",
  "recent.clear": "Clear",

  "search.headingWithQuery": "Results for “{q}”: ",
  "search.heading": "Search results: ",
  "search.count": "{count} results",
  "filters.useLocation": "📍 Search near me",
  "filters.locating": "📍 Getting your location…",
  "filters.nearby": "📍 Near you (within {radius}km)",
  "filters.clearLocation": "Clear location",
  "filters.errUnsupported": "This device can’t provide your location.",
  "filters.errDenied": "Location access was not granted.",
  "filters.errGeneric": "Couldn’t get your location.",

  "results.empty":
    "No matching washoku restaurants found. Try a different keyword.",
  "results.detail": "Details & reserve →",
  "results.reservationLabel": "Reservation",

  "resv.request": "Request booking",
  "resv.external": "Official site",
  "resv.phone_only": "Phone booking",

  "detail.reserveRequest": "Request a reservation",
  "detail.reserveExternal": "Reserve on official site",
  "detail.reservePhone": "Call to reserve {phone}",
  "detail.phoneInquiry": "Call to inquire",
  "detail.phoneOnlyNoPhone":
    "This restaurant takes phone reservations only, but no number is registered.",
  "detail.sectionIntro": "About",
  "detail.sectionHours": "Hours",
  "detail.sectionAccess": "Access",
  "detail.sectionReviews": "Reviews",
  "detail.noLocation": "Location not registered.",
  "detail.noReviews":
    "No reviews yet. Guests who reserved or visited can post one.",
  "detail.translated": "JA: ",

  "review.checking": "Checking eligibility…",
  "review.done": "Your review was posted. Thank you!",
  "review.notEligible":
    "Only guests who reserved or visited this restaurant can post a review.",
  "review.titleNew": "Post a review",
  "review.titleEdit": "Edit your review",
  "review.comment": "Comment (optional)",
  "review.commentHint":
    "If you write in a language other than Japanese, a Japanese translation is also saved for the restaurant.",
  "review.lang": "Language",
  "review.submit": "Post",
  "review.update": "Update",
  "review.submitting": "Sending…",
  "review.failed": "Failed to post ({error}).",

  "report.button": "Report",
  "report.submit": "Report",
  "report.cancel": "Cancel",
  "report.sending": "Sending…",
  "report.done": "Report received",
  "report.failed": "Failed to send",
  "report.reason1": "Inappropriate / abusive",
  "report.reason2": "Spam / advertising",
  "report.reason3": "Factually wrong",
  "report.reason4": "Other",

  "reserve.date": "Preferred date *",
  "reserve.time": "Time *",
  "reserve.partySize": "Party size *",
  "reserve.name": "Name *",
  "reserve.email": "Email",
  "reserve.phone": "Phone",
  "reserve.lang": "Your language",
  "reserve.dietary": "Dietary needs",
  "reserve.vegetarian": "Vegetarian",
  "reserve.halal": "Halal",
  "reserve.allergies": "Allergies (comma-separated)",
  "reserve.budget": "Budget (per person, JPY)",
  "reserve.requests": "Requests (free text)",
  "reserve.requestsPlaceholder": "Window seat, it’s an anniversary, etc.",
  "reserve.requestsHint":
    "Your text is sent to the restaurant as-is, with a Japanese translation.",
  "reserve.submit": "Request reservation",
  "reserve.submitting": "Sending…",
  "reserve.failed": "Failed to send ({error}). Please check your input.",
  "reserve.successTitle": "Your reservation request was sent",
  "reserve.successBody":
    "Please wait for the restaurant’s reply. They’ll confirm or suggest an alternative.",
  "reserve.refNo": "Reference no.:",
  "reserve.status": "Status:",
  "reserve.back": "← Back to restaurant",
  "reservePage.title": "Reserve {name}",
  "reservePage.notSupported":
    "This restaurant doesn’t support online request reservations.",
  "reservePage.seeMethods": "See reservation options on the detail page →",
};

const zhHans: Dict = {
  "nav.favorites": "♥ 收藏",
  "nav.back": "← 返回搜索",
  "nav.search": "搜索 →",

  "fav.title": "收藏",
  "fav.empty":
    "还没有收藏。可在店铺卡片或详情页的 ♡ 添加(保存在本设备)。",
  "fav.remove": "删除",

  "offline.title": "已离线",
  "offline.message": "无法连接网络。请在恢复连接后重试。",

  "home.heroTitle": "发现并预订隐藏的和食名店——无需注册。",
  "home.heroLead":
    "包含未在食べログ・一休等收录的店铺。可按店名或种类搜索，在地图和列表中查找。",
  "home.feature1Title": "无需安装",
  "home.feature1Body": "在浏览器中直接使用的网页应用(PWA)，也可添加到主屏幕。",
  "home.feature2Title": "无需注册即可预订",
  "home.feature2Body":
    "姓名和联系方式保存在本设备，下次自动填写。需要时再登录同步。",
  "home.feature3Title": "跨越语言障碍",
  "home.feature3Body":
    "预订内容自动翻译并附原文发送给店家。过敏信息以固定项目传达。",
  "home.footer": "专注于和食餐厅的入境游网页应用",

  "searchBar.placeholder": "按店名、种类或地区搜索(例: 寿司 涩谷)",
  "searchBar.aria": "搜索和食餐厅",
  "searchBar.button": "搜索",
  "recent.title": "最近搜索",
  "recent.clear": "清除",

  "search.headingWithQuery": "“{q}”的搜索结果: ",
  "search.heading": "搜索结果: ",
  "search.count": "{count} 家",
  "filters.useLocation": "📍 搜索附近",
  "filters.locating": "📍 正在获取位置…",
  "filters.nearby": "📍 附近（半径{radius}km）",
  "filters.clearLocation": "取消当前位置",
  "filters.errUnsupported": "此设备无法获取位置。",
  "filters.errDenied": "未获得位置权限。",
  "filters.errGeneric": "无法获取当前位置。",

  "results.empty": "未找到符合的和食餐厅。请尝试其他关键词。",
  "results.detail": "详情・预订 →",
  "results.reservationLabel": "预订",

  "resv.request": "申请预订",
  "resv.external": "官方网站",
  "resv.phone_only": "电话预订",

  "detail.reserveRequest": "申请预订",
  "detail.reserveExternal": "在官方网站预订",
  "detail.reservePhone": "致电预订 {phone}",
  "detail.phoneInquiry": "致电咨询",
  "detail.phoneOnlyNoPhone": "本店仅接受电话预订，但未登记电话号码。",
  "detail.sectionIntro": "介绍",
  "detail.sectionHours": "营业时间",
  "detail.sectionAccess": "交通",
  "detail.sectionReviews": "评价",
  "detail.noLocation": "未登记位置信息。",
  "detail.noReviews": "暂无评价。预订或到店的客人可以发表。",
  "detail.translated": "日译: ",

  "review.checking": "正在确认资格…",
  "review.done": "评价已发布，谢谢！",
  "review.notEligible": "只有在本店预订或到店的客人才能发表评价。",
  "review.titleNew": "发表评价",
  "review.titleEdit": "编辑评价",
  "review.comment": "评论(可选)",
  "review.commentHint": "若以日语以外的语言书写，将同时为店家保存日语译文。",
  "review.lang": "发布语言",
  "review.submit": "发布",
  "review.update": "更新",
  "review.submitting": "发送中…",
  "review.failed": "发布失败（{error}）。",

  "report.button": "举报",
  "report.submit": "举报",
  "report.cancel": "取消",
  "report.sending": "发送中…",
  "report.done": "已收到举报",
  "report.failed": "发送失败",
  "report.reason1": "内容不当・人身攻击",
  "report.reason2": "垃圾信息・广告",
  "report.reason3": "与事实不符",
  "report.reason4": "其他",

  "reserve.date": "到店日期 *",
  "reserve.time": "时间 *",
  "reserve.partySize": "人数 *",
  "reserve.name": "姓名 *",
  "reserve.email": "邮箱",
  "reserve.phone": "电话",
  "reserve.lang": "您的语言",
  "reserve.dietary": "饮食限制",
  "reserve.vegetarian": "素食",
  "reserve.halal": "清真",
  "reserve.allergies": "过敏(逗号分隔)",
  "reserve.budget": "预算(每人・日元)",
  "reserve.requests": "需求(自由填写)",
  "reserve.requestsPlaceholder": "希望靠窗座位、纪念日 等",
  "reserve.requestsHint": "您的内容将原文连同日语译文一并发送给店家。",
  "reserve.submit": "申请预订",
  "reserve.submitting": "发送中…",
  "reserve.failed": "发送失败（{error}）。请检查输入内容。",
  "reserve.successTitle": "已发送预订申请",
  "reserve.successBody": "请等待店家回复。将告知确认或替代方案。",
  "reserve.refNo": "受理编号:",
  "reserve.status": "状态:",
  "reserve.back": "← 返回店铺详情",
  "reservePage.title": "预订 {name}",
  "reservePage.notSupported": "本店不支持在线申请预订。",
  "reservePage.seeMethods": "查看店铺详情的预订方式 →",
};

const zhHant: Dict = {
  "nav.favorites": "♥ 收藏",
  "nav.back": "← 返回搜尋",
  "nav.search": "搜尋 →",

  "fav.title": "收藏",
  "fav.empty":
    "尚無收藏。可在店家卡片或詳情頁的 ♡ 加入(儲存在本裝置)。",
  "fav.remove": "刪除",

  "offline.title": "已離線",
  "offline.message": "無法連線網路。請在恢復連線後重試。",

  "home.heroTitle": "發現並預訂隱藏的和食名店——免註冊。",
  "home.heroLead":
    "包含未於食べログ・一休等收錄的店家。可依店名或種類搜尋，在地圖與列表中尋找。",
  "home.feature1Title": "免安裝",
  "home.feature1Body": "在瀏覽器中直接使用的網頁應用(PWA)，亦可加入主畫面。",
  "home.feature2Title": "免註冊即可預訂",
  "home.feature2Body":
    "姓名與聯絡方式儲存在本裝置，下次自動填入。需要時再登入同步。",
  "home.feature3Title": "跨越語言隔閡",
  "home.feature3Body":
    "預訂內容自動翻譯並附原文傳送給店家。過敏資訊以固定項目傳達。",
  "home.footer": "專注於和食餐廳的入境旅遊網頁應用",

  "searchBar.placeholder": "依店名、種類或地區搜尋(例: 壽司 澀谷)",
  "searchBar.aria": "搜尋和食餐廳",
  "searchBar.button": "搜尋",
  "recent.title": "最近搜尋",
  "recent.clear": "清除",

  "search.headingWithQuery": "「{q}」的搜尋結果: ",
  "search.heading": "搜尋結果: ",
  "search.count": "{count} 家",
  "filters.useLocation": "📍 搜尋附近",
  "filters.locating": "📍 正在取得位置…",
  "filters.nearby": "📍 附近（半徑{radius}km）",
  "filters.clearLocation": "取消目前位置",
  "filters.errUnsupported": "此裝置無法取得位置。",
  "filters.errDenied": "未取得位置權限。",
  "filters.errGeneric": "無法取得目前位置。",

  "results.empty": "找不到符合的和食餐廳。請嘗試其他關鍵字。",
  "results.detail": "詳情・預訂 →",
  "results.reservationLabel": "預訂",

  "resv.request": "申請預訂",
  "resv.external": "官方網站",
  "resv.phone_only": "電話預訂",

  "detail.reserveRequest": "申請預訂",
  "detail.reserveExternal": "在官方網站預訂",
  "detail.reservePhone": "致電預訂 {phone}",
  "detail.phoneInquiry": "致電諮詢",
  "detail.phoneOnlyNoPhone": "本店僅接受電話預訂，但未登記電話號碼。",
  "detail.sectionIntro": "介紹",
  "detail.sectionHours": "營業時間",
  "detail.sectionAccess": "交通",
  "detail.sectionReviews": "評價",
  "detail.noLocation": "未登記位置資訊。",
  "detail.noReviews": "尚無評價。預訂或到店的客人可以發表。",
  "detail.translated": "日譯: ",

  "review.checking": "正在確認資格…",
  "review.done": "評價已發布，謝謝！",
  "review.notEligible": "只有在本店預訂或到店的客人才能發表評價。",
  "review.titleNew": "發表評價",
  "review.titleEdit": "編輯評價",
  "review.comment": "評論(可選)",
  "review.commentHint": "若以日語以外的語言書寫，將同時為店家儲存日語譯文。",
  "review.lang": "發布語言",
  "review.submit": "發布",
  "review.update": "更新",
  "review.submitting": "傳送中…",
  "review.failed": "發布失敗（{error}）。",

  "report.button": "檢舉",
  "report.submit": "檢舉",
  "report.cancel": "取消",
  "report.sending": "傳送中…",
  "report.done": "已收到檢舉",
  "report.failed": "傳送失敗",
  "report.reason1": "內容不當・人身攻擊",
  "report.reason2": "垃圾訊息・廣告",
  "report.reason3": "與事實不符",
  "report.reason4": "其他",

  "reserve.date": "到店日期 *",
  "reserve.time": "時間 *",
  "reserve.partySize": "人數 *",
  "reserve.name": "姓名 *",
  "reserve.email": "電子郵件",
  "reserve.phone": "電話",
  "reserve.lang": "您的語言",
  "reserve.dietary": "飲食限制",
  "reserve.vegetarian": "素食",
  "reserve.halal": "清真",
  "reserve.allergies": "過敏(逗號分隔)",
  "reserve.budget": "預算(每人・日圓)",
  "reserve.requests": "需求(自由填寫)",
  "reserve.requestsPlaceholder": "希望靠窗座位、紀念日 等",
  "reserve.requestsHint": "您的內容將原文連同日語譯文一併傳送給店家。",
  "reserve.submit": "申請預訂",
  "reserve.submitting": "傳送中…",
  "reserve.failed": "傳送失敗（{error}）。請檢查輸入內容。",
  "reserve.successTitle": "已傳送預訂申請",
  "reserve.successBody": "請等待店家回覆。將告知確認或替代方案。",
  "reserve.refNo": "受理編號:",
  "reserve.status": "狀態:",
  "reserve.back": "← 返回店家詳情",
  "reservePage.title": "預訂 {name}",
  "reservePage.notSupported": "本店不支援線上申請預訂。",
  "reservePage.seeMethods": "查看店家詳情的預訂方式 →",
};

const ko: Dict = {
  "nav.favorites": "♥ 즐겨찾기",
  "nav.back": "← 검색으로 돌아가기",
  "nav.search": "검색하기 →",

  "fav.title": "즐겨찾기",
  "fav.empty":
    "아직 즐겨찾기가 없습니다. 가게 카드나 상세 페이지의 ♡ 로 추가할 수 있습니다(이 기기에 저장됩니다).",
  "fav.remove": "삭제",

  "offline.title": "오프라인입니다",
  "offline.message":
    "네트워크에 연결할 수 없습니다. 연결이 회복된 후 다시 시도해 주세요.",

  "home.heroTitle": "숨은 일식 명점을 회원가입 없이 찾고 예약하세요.",
  "home.heroLead":
    "타베로그・잇큐 등에 없는 가게도. 가게명이나 장르로 검색해 지도와 목록에서 찾을 수 있습니다.",
  "home.feature1Title": "설치 불필요",
  "home.feature1Body":
    "브라우저에서 바로 쓰는 웹앱(PWA). 홈 화면에 추가할 수도 있습니다.",
  "home.feature2Title": "가입 없이 예약",
  "home.feature2Body":
    "이름과 연락처는 이 기기에 저장해 다음에 자동 입력. 원하면 로그인해 동기화.",
  "home.feature3Title": "언어 장벽을 넘어",
  "home.feature3Body":
    "예약 내용을 자동 번역하고 원문도 함께 가게에 전달. 알레르기도 정형 항목으로 전달.",
  "home.footer": "일식당에 특화된 인바운드용 웹앱",

  "searchBar.placeholder": "가게명・장르・지역으로 검색(예: 스시 시부야)",
  "searchBar.aria": "일식당 검색",
  "searchBar.button": "검색",
  "recent.title": "최근 검색",
  "recent.clear": "지우기",

  "search.headingWithQuery": "“{q}” 검색 결과: ",
  "search.heading": "검색 결과: ",
  "search.count": "{count}곳",
  "filters.useLocation": "📍 내 주변 검색",
  "filters.locating": "📍 위치 가져오는 중…",
  "filters.nearby": "📍 내 주변（반경 {radius}km）",
  "filters.clearLocation": "현재 위치 해제",
  "filters.errUnsupported": "이 기기에서는 위치를 가져올 수 없습니다.",
  "filters.errDenied": "위치 사용이 허용되지 않았습니다.",
  "filters.errGeneric": "현재 위치를 가져오지 못했습니다.",

  "results.empty": "해당하는 일식당을 찾지 못했습니다. 다른 키워드로 시도해 보세요.",
  "results.detail": "상세・예약 →",
  "results.reservationLabel": "예약",

  "resv.request": "요청 예약",
  "resv.external": "공식 사이트",
  "resv.phone_only": "전화 예약",

  "detail.reserveRequest": "예약 요청",
  "detail.reserveExternal": "공식 사이트에서 예약",
  "detail.reservePhone": "전화로 예약 {phone}",
  "detail.phoneInquiry": "전화로 문의",
  "detail.phoneOnlyNoPhone":
    "이 가게는 전화 예약만 가능하지만 전화번호가 등록되지 않았습니다.",
  "detail.sectionIntro": "소개",
  "detail.sectionHours": "영업시간",
  "detail.sectionAccess": "오시는 길",
  "detail.sectionReviews": "리뷰",
  "detail.noLocation": "위치 정보가 등록되지 않았습니다.",
  "detail.noReviews": "아직 리뷰가 없습니다. 예약・방문하신 분이 작성할 수 있습니다.",
  "detail.translated": "일역: ",

  "review.checking": "작성 자격 확인 중…",
  "review.done": "리뷰를 등록했습니다. 감사합니다!",
  "review.notEligible": "이 가게를 예약・방문하신 분만 리뷰를 작성할 수 있습니다.",
  "review.titleNew": "리뷰 작성",
  "review.titleEdit": "리뷰 수정",
  "review.comment": "코멘트(선택)",
  "review.commentHint": "일본어 외 언어로 작성하면 가게용 일본어 번역도 저장됩니다.",
  "review.lang": "작성 언어",
  "review.submit": "등록",
  "review.update": "수정",
  "review.submitting": "전송 중…",
  "review.failed": "등록에 실패했습니다（{error}）.",

  "report.button": "신고",
  "report.submit": "신고",
  "report.cancel": "취소",
  "report.sending": "전송 중…",
  "report.done": "신고가 접수되었습니다",
  "report.failed": "전송에 실패했습니다",
  "report.reason1": "부적절한 내용・비방",
  "report.reason2": "스팸・광고",
  "report.reason3": "사실과 다름",
  "report.reason4": "기타",

  "reserve.date": "방문 희망일 *",
  "reserve.time": "시간 *",
  "reserve.partySize": "인원 *",
  "reserve.name": "성함 *",
  "reserve.email": "이메일",
  "reserve.phone": "전화",
  "reserve.lang": "사용 언어",
  "reserve.dietary": "식사 제한",
  "reserve.vegetarian": "채식",
  "reserve.halal": "할랄",
  "reserve.allergies": "알레르기(쉼표로 구분)",
  "reserve.budget": "예산(1인당・엔)",
  "reserve.requests": "요청(자유 기입)",
  "reserve.requestsPlaceholder": "창가 자리 희망, 기념일 등",
  "reserve.requestsHint": "입력 내용은 원문 그대로 일본어 번역과 함께 가게에 전달됩니다.",
  "reserve.submit": "예약 요청",
  "reserve.submitting": "전송 중…",
  "reserve.failed": "전송에 실패했습니다（{error}）. 입력 내용을 확인해 주세요.",
  "reserve.successTitle": "예약 요청을 보냈습니다",
  "reserve.successBody": "가게의 답변을 기다려 주세요. 확정 또는 대체안을 안내합니다.",
  "reserve.refNo": "접수 번호:",
  "reserve.status": "상태:",
  "reserve.back": "← 가게 상세로 돌아가기",
  "reservePage.title": "{name} 예약",
  "reservePage.notSupported": "이 가게는 온라인 요청 예약을 지원하지 않습니다.",
  "reservePage.seeMethods": "상세 페이지에서 예약 방법 보기 →",
};

const dictionaries: Record<Locale, Dict> = {
  ja,
  en,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  ko,
};

/** 翻訳関数。{var} を vars で置換。欠落時は en → ja → key の順でフォールバック。 */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>
): string {
  const template =
    dictionaries[locale]?.[key] ?? en[key] ?? ja[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name) =>
    name in vars ? String(vars[name]) : `{${name}}`
  );
}

/** locale を束ねた t() を返すヘルパー(コンポーネントで使う)。 */
export function translator(locale: Locale) {
  return (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
}
export type TFn = ReturnType<typeof translator>;
