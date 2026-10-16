-- v2 arrangement (ADR-0028, ADR-0030) + album art + mobile sessions (ADR-0034)
alter table mixes add column manual_order text[] null;
alter table mixes add column bench text[] not null default '{}';
alter table mixes add column arrangement_version int not null default 0;
alter table mix_rules add column removed_plays int not null default 0 check (removed_plays >= 0);
alter table mix_rules add column deleted_copies int[] not null default '{}';
alter table track_cache add column image_url text null;
alter table sessions add column kind text not null default 'web' check (kind in ('web','mobile'));
