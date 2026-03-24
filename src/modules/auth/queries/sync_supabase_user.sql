with existing_supabase as (
  select id, email, display_name, supabase_user_id
  from app_users
  where supabase_user_id = $1
  limit 1
),
email_match as (
  select id, email, display_name, supabase_user_id
  from app_users
  where email = $2
  limit 1
),
conflict as (
  select id
  from email_match
  where (
      exists (select 1 from existing_supabase)
      and id <> (select id from existing_supabase)
    )
    or (
      not exists (select 1 from existing_supabase)
      and supabase_user_id is not null
      and supabase_user_id <> $1
    )
),
updated_existing as (
  update app_users
  set email = $2,
      display_name = $3,
      updated_at = now()
  where id in (select id from existing_supabase)
    and not exists (select 1 from conflict)
  returning id, email, display_name, supabase_user_id
),
attached_existing as (
  update app_users
  set supabase_user_id = $1,
      email = $2,
      display_name = $3,
      updated_at = now()
  where id in (
      select id
      from email_match
      where supabase_user_id is null
        or supabase_user_id = $1
    )
    and not exists (select 1 from existing_supabase)
    and not exists (select 1 from conflict)
  returning id, email, display_name, supabase_user_id
),
inserted_user as (
  insert into app_users (supabase_user_id, email, password_hash, display_name)
  select $1, $2, null, $3
  where not exists (select 1 from existing_supabase)
    and not exists (select 1 from email_match)
    and not exists (select 1 from conflict)
  returning id, email, display_name, supabase_user_id
),
resolved_user as (
  select * from updated_existing
  union all
  select * from attached_existing
  union all
  select * from inserted_user
),
moved_chats as (
  update chats
  set owner_type = 'user',
      owner_id = ru.id
  from resolved_user ru
  where $4::uuid is not null
    and chats.owner_type = 'guest'
    and chats.owner_id = $4
  returning chats.id
),
moved_attachments as (
  update attachments
  set owner_type = 'user',
      owner_id = ru.id
  from resolved_user ru
  where $4::uuid is not null
    and attachments.owner_type = 'guest'
    and attachments.owner_id = $4
  returning attachments.id
),
moved_document_chunks as (
  update document_chunks
  set owner_type = 'user',
      owner_id = ru.id
  from resolved_user ru
  where $4::uuid is not null
    and document_chunks.owner_type = 'guest'
    and document_chunks.owner_id = $4
  returning document_chunks.id
)
select
  exists(select 1 from conflict) as email_conflict,
  (
    select row_to_json(ru)
    from resolved_user ru
    limit 1
  ) as user_row;
