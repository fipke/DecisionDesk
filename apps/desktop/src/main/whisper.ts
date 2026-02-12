import { spawn } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface WhisperConfig {
  whisperPath: string;
  modelsPath: string;
  diarizePath?: string; // Path to pyannote diarize.py script
}

export interface TranscribeOptions {
  model: string;
  language: string;
  enableDiarization: boolean;
}

export interface TranscribeResult {
  text: string;
  language: string;
  durationSeconds: number;
  processingTimeMs: number;
  segments?: Segment[];
}

export interface Segment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

export class WhisperService {
  private config: WhisperConfig;

  constructor(config: WhisperConfig) {
    this.config = config;
  }

  isAvailable(): boolean {
    return existsSync(this.config.whisperPath);
  }

  isDiarizeAvailable(): boolean {
    return !!this.config.diarizePath && existsSync(this.config.diarizePath);
  }

  getAvailableModels(): string[] {
    if (!existsSync(this.config.modelsPath)) {
      return [];
    }

    const models: string[] = [];
    const files = readdirSync(this.config.modelsPath);
    
    for (const file of files) {
      if (file.startsWith('ggml-') && file.endsWith('.bin')) {
        // Extract model name from filename like "ggml-large-v3.bin"
        const modelName = file.replace('ggml-', '').replace('.bin', '');
        models.push(modelName);
      }
    }

    return models;
  }

  getModelPath(model: string): string {
    return join(this.config.modelsPath, `ggml-${model}.bin`);
  }

  hasModel(model: string): boolean {
    return existsSync(this.getModelPath(model));
  }

  async transcribe(audioPath: string, options: TranscribeOptions): Promise<TranscribeResult> {
    if (!this.isAvailable()) {
      throw new Error('Whisper executable not found');
    }

    if (!this.hasModel(options.model)) {
      throw new Error(`Model not found: ${options.model}`);
    }

    if (!existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }

    const startTime = Date.now();
    const modelPath = this.getModelPath(options.model);

    const args = [
      '-m', modelPath,
      '-f', audioPath,
      '-l', options.language,
      '-oj', // Output JSON
      '-pp', // Print progress
    ];

    // Run whisper transcription
    const whisperResult = await this.runWhisper(args);
    let result = this.parseOutput(whisperResult, options.language, Date.now() - startTime);

    // Run pyannote diarization if enabled
    if (options.enableDiarization && this.isDiarizeAvailable() && result.segments) {
      try {
        const diarizationResult = await this.runDiarization(audioPath);
        result.segments = this.mergeWithDiarization(result.segments, diarizationResult);
      } catch (err) {
        console.error('Diarization failed, continuing without speaker labels:', err);
        // Continue without diarization
      }
    }

    result.processingTimeMs = Date.now() - startTime;
    return result;
  }

  private runWhisper(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const whisper = spawn(this.config.whisperPath, args);
      
      let stdout = '';
      let stderr = '';

      whisper.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      whisper.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      whisper.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Whisper exited with code ${code}: ${stderr}`));
          return;
        }
        resolve(stdout);
      });

      whisper.on('error', (err) => {
        reject(new Error(`Failed to start whisper: ${err.message}`));
      });
    });
  }

  private async runDiarization(audioPath: string): Promise<{ segments: Array<{ start: number; end: number; speaker: string }> }> {
    return new Promise((resolve, reject) => {
      const diarize = spawn('python3', [this.config.diarizePath!, audioPath]);
      
      let stdout = '';
      let stderr = '';

      diarize.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      diarize.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      diarize.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Diarization failed: ${stderr}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout));
        } catch (err) {
          reject(new Error(`Failed to parse diarization output: ${err}`));
        }
      });

      diarize.on('error', (err) => {
        reject(new Error(`Failed to start diarization: ${err.message}`));
      });
    });
  }

  private mergeWithDiarization(
    transcriptSegments: Segment[], 
    diarization: { segments: Array<{ start: number; end: number; speaker: string }> }
  ): Segment[] {
    for (const seg of transcriptSegments) {
      const midpoint = (seg.start + seg.end) / 2;
      
      // Find overlapping speaker segment
      for (const spk of diarization.segments) {
        if (spk.start <= midpoint && midpoint <= spk.end) {
          seg.speaker = spk.speaker;
          break;
        }
      }
      
      if (!seg.speaker) {
        seg.speaker = 'UNKNOWN';
      }
    }
    
    return transcriptSegments;
  }

  private parseOutput(output: string, language: string, processingTimeMs: number): TranscribeResult {
    // Try to parse JSON output first
    try {
      const json = JSON.parse(output);
      
      const segments: Segment[] = json.transcription?.map((seg: {
        timestamps: { from: string; to: string };
        text: string;
        speaker?: string;
      }) => ({
        start: this.parseTimestamp(seg.timestamps.from),
        end: this.parseTimestamp(seg.timestamps.to),
        text: seg.text,
        speaker: seg.speaker
      })) || [];

      const text = segments.map(s => s.text).join(' ').trim();
      const durationSeconds = segments.length > 0 
        ? segments[segments.length - 1].end 
        : 0;

      return {
        text,
        language: json.language || language,
        durationSeconds,
        processingTimeMs,
        segments
      };
    } catch {
      // Fallback: parse plain text output
      const lines = output.split('\n').filter(line => 
        !line.startsWith('whisper_') && 
        !line.startsWith('[') && 
        !line.startsWith('main:') &&
        line.trim().length > 0
      );

      return {
        text: lines.join(' ').trim(),
        language,
        durationSeconds: 0,
        processingTimeMs,
        segments: undefined
      };
    }
  }

  private parseTimestamp(timestamp: string): number {
    // Parse timestamp like "00:00:00,000" to seconds
    const parts = timestamp.replace(',', '.').split(':');
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]);
      const minutes = parseFloat(parts[1]);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    }
    return parseFloat(timestamp);
  }
}
