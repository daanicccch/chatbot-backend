select content
from document_chunks
where owner_type = $1
  and owner_id = $2
  and chat_id = $3
order by created_at desc
limit $4;
