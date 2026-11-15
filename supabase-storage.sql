-- ─────────────────────────────────────────────────────────────
-- Supabase SQL Editor 에서 실행
-- 전제: Authentication → Sign In / Providers → Third-Party Auth 에서
--       Firebase Auth (프로젝트 ID: atlas-f52d2) 를 추가해 둘 것.
--       → js/supabase.js 의 accessToken 옵션으로 Firebase ID 토큰이 전달되고,
--         auth.jwt() 로 그 토큰의 내용(sub = Firebase uid)을 읽을 수 있다.
-- ─────────────────────────────────────────────────────────────

-- 1) 공개 버킷 (이미지는 공개 URL 로 읽음 → 읽기에 DB 요청 없음), 이미지 2MB 제한
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 2) 본인 폴더(avatars/{firebase uid}/...)에만 업로드/덮어쓰기 허용
--    Firebase 토큰에는 role 클레임이 없어서 anon 역할로 들어오므로 anon, authenticated 둘 다 지정하고
--    토큰 발급자(iss)로 Firebase 토큰인지 확인한다.
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_select_own" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'avatars'
    and (auth.jwt() ->> 'iss') = 'https://securetoken.google.com/atlas-f52d2'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

create policy "avatars_insert_own" on storage.objects
  for insert to anon, authenticated
  with check (
    bucket_id = 'avatars'
    and (auth.jwt() ->> 'iss') = 'https://securetoken.google.com/atlas-f52d2'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

create policy "avatars_update_own" on storage.objects
  for update to anon, authenticated
  using (
    bucket_id = 'avatars'
    and (auth.jwt() ->> 'iss') = 'https://securetoken.google.com/atlas-f52d2'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );

create policy "avatars_delete_own" on storage.objects
  for delete to anon, authenticated
  using (
    bucket_id = 'avatars'
    and (auth.jwt() ->> 'iss') = 'https://securetoken.google.com/atlas-f52d2'
    and (storage.foldername(name))[1] = (auth.jwt() ->> 'sub')
  );
