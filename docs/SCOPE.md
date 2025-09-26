# DecisionDesk — Scope (MVP-first)
**Fluxo alvo**: iOS grava → upload simples → **backend chama Whisper** (pt-BR) → salva transcript → mostra **custos**. Depois macOS, depois Web.

**Regra de segurança fundamental**: Apps (iOS/macOS/Web) **NÃO** chamam OpenAI. **Somente o backend** acessa Whisper/GPT, guarda chaves e calcula custos.

**MVP (não-negociáveis)**
- iOS RN: AAC LC 48 kHz mono ~96 kbps; upload único (limit MB); Wi‑Fi por padrão.
- Backend Spring Boot 4 / Spring 7 com API versioning; endpoints p/ criar reunião, subir áudio, transcrever, consultar.
- **Custos visíveis** no MVP (Whisper). GPT só quando resumo entrar (PR 04).
- Sem multitenancy, sem fila, sem WS, sem chunked. **Polling** via GET.
