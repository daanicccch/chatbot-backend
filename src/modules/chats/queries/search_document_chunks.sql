select content
from document_chunks
where owner_type = $1
  and owner_id = $2
  and chat_id = $3
  and content_tsv @@ websearch_to_tsquery('simple', $4)
order by ts_rank(content_tsv, websearch_to_tsquery('simple', $4)) desc, created_at desc
limit $5;
