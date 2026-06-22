-- お客様がWebの予約状況ページから代替案へ回答(承諾/お断り)できるようにしたため、
-- reservation_event.channel に 'web'(お客様のWeb操作)を許可する。
alter table reservation_event
  drop constraint if exists reservation_event_channel_check;

alter table reservation_event
  add constraint reservation_event_channel_check
  check (channel in ('email', 'sms', 'phone', 'fax', 'desk', 'web'));
