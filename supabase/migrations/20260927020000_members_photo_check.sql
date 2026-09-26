-- Member photos are stored as small JPEG data URLs (see src/lib/image.ts compressAvatar).
-- Rejects the old blob: URLs, which only lived in one browser tab and broke after a reload.
alter table public.members add constraint members_photo_url_check
  check (photo_url is null or (photo_url like 'data:image/jpeg;base64,%' and char_length(photo_url) <= 100000));
