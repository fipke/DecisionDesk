// ───────────────────────────────────────────────────────────────
// OllamaService — Direct HTTP client for local Ollama instance
// Enables offline summarization without going through the backend
// ───────────────────────────────────────────────────────────────

import axios, { AxiosInstance } from 'axios';

export interface OllamaSummaryParams {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  temperature?: number;
  think?: boolean;
}

export interface OllamaSummaryResult {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export class OllamaService {
  private client: AxiosInstance;

  constructor(baseUrl = 'http://localhost:11434') {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 300_000, // 5 min for generation
    });
  }

  /** Quick ping — returns true if Ollama is responding. */
  async isAvailable(): Promise<boolean> {
    try {
      await this.client.get('/api/tags', { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /** List locally available model names. */
  async listModels(): Promise<string[]> {
    try {
      const response = await this.client.get('/api/tags', { timeout: 5000 });
      const models = response.data?.models ?? [];
      return models.map((m: any) => m.name as string);
    } catch {
      return [];
    }
  }

  /** Generate a summary via POST /api/chat (non-streaming). */
  async generateSummary(params: OllamaSummaryParams): Promise<OllamaSummaryResult> {
    const response = await this.client.post('/api/chat', {
      model: params.model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      stream: false,
      think: params.think ?? true,
      options: {
        num_predict: params.maxTokens ?? 2000,
        temperature: params.temperature ?? 0.3,
      },
    });

    const data = response.data;
    return {
      content: data.message?.content ?? '',
      model: data.model ?? params.model,
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
    };
  }
}
