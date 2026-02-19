# Backend Connection - Mobile App

## Como Funciona

O app mobile agora detecta automaticamente o backend usando múltiplas estratégias:

### 1. **iOS Simulator** (sua situação atual)
   - ✅ Tenta `http://localhost:8087` primeiro
   - ✅ O simulador compartilha a rede com o Mac

### 2. **Dispositivo Físico** (iPhone/iPad real)
   - ✅ Tenta `http://Djeimis-MacBook-Pro-3.local:8087` via Bonjour
   - ✅ Funciona em **qualquer rede** onde o Mac e iPhone estejam conectados
   - ✅ Funciona em casa, trabalho, cafeteria, etc.

### 3. **Logs de Detecção**
O app mostra logs no console do Expo:
```
[API] ✓ Backend detectado em: http://localhost:8087/api/v1
```

## Testando a Sincronização

### No Simulador iOS:

1. **Inicie o backend:**
   ```bash
   cd apps/backend
   mvn spring-boot:run
   ```
   
2. **Inicie o mobile:**
   ```bash
   cd apps/mobile
   npm start
   # Pressione 'i' para iOS Simulator
   ```

3. **Faça pull-to-refresh** na lista de reuniões
   - Arraste a lista para baixo
   - Veja os logs no terminal do Expo:
     ```
     [Sync] Iniciando sincronização de 1 operação(ões)
     [Sync] Sincronizando reunião abc-123...
     [Sync] ✓ Reunião abc-123 sincronizada com sucesso (remoteId: xyz-789)
     [Sync] Sincronização finalizada
     ```

4. **Verifique no Web/Desktop** - a reunião deve aparecer!

### Em um iPhone Físico:

1. Conecte Mac e iPhone na **mesma rede WiFi**
2. O app detecta automaticamente via `Djeimis-MacBook-Pro-3.local`
3. Funciona em qualquer rede (não precisa configurar nada!)

## Problemas?

### Erro: "Backend não encontrado"
- ✅ Backend está rodando? `curl http://localhost:8087/api/v1/health`
- ✅ Mac e iPhone na mesma rede?
- ✅ Firewall bloqueando porta 8087?

### Ver logs detalhados:
Abra o terminal do Expo e procure por linhas começando com `[API]` ou `[Sync]`.
