with owned_chat as (
  select id, title
  from chats
  where id = $1
    and owner_type = $2
    and owner_id = $3
),
prior_user_messages as (
  select exists(
    select 1
    from messages m
    join owned_chat oc on oc.id = m.chat_id
    where m.role = 'user'
  ) as has_user_messages
),
inserted_user as (
  insert into messages (chat_id, role, content, status)
  select id, 'user', $4, 'completed'
  from owned_chat
  returning
    id,
    chat_id,
    role,
    content,
    status,
    model,
    error_text,
    created_at,
    updated_at
),
inserted_assistant as (
  insert into messages (chat_id, role, content, status, model)
  select id, 'assistant', '', 'streaming', $5
  from owned_chat
  returning
    id,
    chat_id,
    role,
    content,
    status,
    model,
    error_text,
    created_at,
    updated_at
),
updated_chat as (
  update chats c
  set title = case
        when not coalesce((select has_user_messages from prior_user_messages), true)
          and c.title = 'New chat'
          then $6
        else c.title
      end,
      model = $5,
      last_message_at = now(),
      updated_at = now()
  where c.id in (select id from owned_chat)
  returning c.id
)
select
  exists(select 1 from owned_chat) as chat_found,
  (
    select row_to_json(u)
    from inserted_user u
    limit 1
  ) as user_message,
  (
    select row_to_json(a)
    from inserted_assistant a
    limit 1
  ) as assistant_message;
