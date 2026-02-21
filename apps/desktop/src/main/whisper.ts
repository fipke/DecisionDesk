import { spawn } from 'child_process';
import { existsSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

export interface WhisperConfig {
  whisperPath: string;
  modelsPath: string;
  diarizePath?: string; // Path to pyannote diarize.py script
  diarizeVenvPython?: string; // Path to venv Python binary for diarization
  huggingfaceToken?: string; // Token to download gated pyannote weights (inference stays local)
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
    return !!this.config.diarizePath && existsSync(this.config.diarizePath)
      && !!this.getDiarizePython();
  }

  /** Returns the Python binary to use for diarization (venv preferred, fallback to system). */
  private getDiarizePython(): string | null {
    if (this.config.diarizeVenvPython && existsSync(this.config.diarizeVenvPython)) {
      return this.config.diarizeVenvPython;
    }
    return null;
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

    // whisper-cli only accepts WAV — convert if needed
    let inputPath = audioPath;
    if (!audioPath.endsWith('.wav')) {
      inputPath = await this.convertToWav(audioPath);
    }

    const startTime = Date.now();
    const modelPath = this.getModelPath(options.model);

    const args = [
      '-m', modelPath,
      '-f', inputPath,
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

  private convertToWav(inputPath: string): Promise<string> {
    const wavPath = inputPath.replace(/\.[^.]+$/, '.wav');
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',            // overwrite
        '-i', inputPath,
        '-ar', '16000',  // 16 kHz (whisper expects this)
        '-ac', '1',      // mono
        '-c:a', 'pcm_s16le',
        wavPath
      ]);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => { stderr += data.toString(); });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg conversion failed (code ${code}): ${stderr.slice(-200)}`));
          return;
        }
        resolve(wavPath);
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`Failed to start ffmpeg: ${err.message}. Install via: brew install ffmpeg`));
      });
    });
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

  /** Update the HuggingFace token at runtime (e.g. when saved from Settings). */
  setHuggingfaceToken(token: string): void {
    this.config.huggingfaceToken = token;
  }

  /** Run standalone diarization on an audio file (without transcription). */
  async diarize(audioPath: string): Promise<{ segments: Array<{ start: number; end: number; speaker: string }> }> {
    if (!this.isDiarizeAvailable()) {
      throw new Error('Diarization not available — check pyannote venv and diarize.py');
    }
    if (!existsSync(audioPath)) {
      throw new Error(`Audio file not found: ${audioPath}`);
    }
    return this.runDiarization(audioPath);
  }

  /** Merge diarization speaker labels into existing transcript segments (public for re-diarization flow). */
  mergeSegmentsWithDiarization(
    transcriptSegments: Segment[],
    diarization: { segments: Array<{ start: number; end: number; speaker: string }> }
  ): Segment[] {
    return this.mergeWithDiarization([...transcriptSegments], diarization);
  }

  private async runDiarization(audioPath: string): Promise<{ segments: Array<{ start: number; end: number; speaker: string }> }> {
    return new Promise((resolve, reject) => {
      const pythonBin = this.getDiarizePython()!;
      const env = { ...process.env };
      if (this.config.huggingfaceToken) {
        env['HUGGINGFACE_TOKEN'] = this.config.huggingfaceToken;
      }
      const diarize = spawn(pythonBin, [this.config.diarizePath!, audioPath], { env });
      
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
      // Fallback: parse whisper-cli text output
      // Format: [HH:MM:SS.mmm --> HH:MM:SS.mmm]   text
      const TIMESTAMP_RE = /^\[(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})\]\s*(.+)$/;
      const segments: Segment[] = [];
      const plainLines: string[] = [];

      for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = TIMESTAMP_RE.exec(trimmed);
        if (match) {
          segments.push({
            start: this.parseTimestamp(match[1]),
            end: this.parseTimestamp(match[2]),
            text: match[3].trim(),
          });
        } else if (
          !trimmed.startsWith('whisper_') &&
          !trimmed.startsWith('main:') &&
          !trimmed.startsWith('ggml_')
        ) {
          plainLines.push(trimmed);
        }
      }

      const text = segments.length > 0
        ? segments.map(s => s.text).join(' ').trim()
        : plainLines.join(' ').trim();

      const durationSeconds = segments.length > 0
        ? segments[segments.length - 1].end
        : 0;

      return {
        text,
        language,
        durationSeconds,
        processingTimeMs,
        segments: segments.length > 0 ? segments : undefined,
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
