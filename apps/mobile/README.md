# DecisionDesk Mobile (PR03 — iOS v1)

## Funcionalidades
- Interface em **modo escuro** com strings em PT-BR.
- Gravação em AAC (48 kHz, mono, ~96 kbps) usando o microfone do iPhone.
- Upload **store-only** (sem transcrição automática) e botão “Transcrever agora”.
- Exibição da transcrição e dos custos retornados pelo backend.
- Armazenamento local com SQLite + fila de sincronização.
- Preferência por Wi‑Fi (uso de dados celulares opcional nas configurações).
## Stack (Feb 2026)
- **Expo SDK 54** (React Native 0.81, React 19.1) — Latest stable
- **React Navigation 7** (native stack navigator)
- **NativeWind 4.1** (Tailwind CSS for React Native)
- **expo-av 15** (audio recording API)
- **expo-sqlite 15** (async database API)
- **TypeScript 5.9**
- **New Architecture enabled** (required for future SDKs)
## Requisitos
- Node 20.19.4+
- Expo CLI (`npm install -g expo-cli`)
- Xcode (para rodar no simulador iOS)
- Backend rodando em `http://localhost:8087` ou defina `EXPO_PUBLIC_API_BASE_URL`

## Como rodar
```bash
cd apps/mobile
npm install
npx expo start --ios
```

Variáveis:
- `EXPO_PUBLIC_API_BASE_URL` (ex.: `http://localhost:8087/api/v1`)

Use o app para gravar, sincronizar e transcrever reuniões manualmente.
