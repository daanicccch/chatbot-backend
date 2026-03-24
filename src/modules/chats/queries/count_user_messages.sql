select count(*)::int as count
from messages
where chat_id = $1
  and role = 'user';
