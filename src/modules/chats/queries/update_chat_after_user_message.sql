update chats
set title = case when $2 and title = 'New chat' then $3 else title end,
    model = $4,
    last_message_at = now(),
    updated_at = now()
where id = $1;
