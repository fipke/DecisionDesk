# API Surface (MVP)
GET  /api/v1/health

# Meetings
POST /api/v1/meetings                 -> { id }
POST /api/v1/meetings/{id}/audio      -> upload único (limit MB), **backend dispara Whisper** (síncrono)
GET  /api/v1/meetings/{id}            -> { status, transcript?, cost:{whisper,gpt,total} }

# Summaries (PR 04)
POST /api/v1/meetings/{id}/summarize  -> **backend chama GPT** (prompt default), atualiza custos

# Regras
- Nenhum endpoint expõe chaves da OpenAI.
- Clientes **nunca** chamam OpenAI; apenas backend.
