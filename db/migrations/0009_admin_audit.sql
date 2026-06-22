-- 管理操作の監査ログ。
-- 誰が(actor: トークンのハッシュ / dev-open)、いつ、どの対象に、何をしたかを記録する。
-- 操作本体を妨げないよう、記録失敗はアプリ側で握りつぶす(ベストエフォート)。
create table if not exists admin_audit_log (
  id           uuid primary key default gen_random_uuid(),
  action       text not null,                 -- 例: restaurant.update / reservation.status
  target_type  text,                          -- restaurant / reservation / review / import
  target_id    text,                          -- 対象ID(UUID や バッチID)。任意
  summary      text,                          -- 人が読む短い説明
  detail       jsonb not null default '{}'::jsonb,  -- 変更内容など構造化データ
  actor        text not null default 'admin', -- 操作者(トークンのハッシュ等)
  ip           text,                          -- クライアントIP(取得できれば)
  created_at   timestamptz not null default now()
);

create index if not exists idx_admin_audit_created
  on admin_audit_log (created_at desc);
create index if not exists idx_admin_audit_target
  on admin_audit_log (target_type, target_id);
create index if not exists idx_admin_audit_action
  on admin_audit_log (action);
