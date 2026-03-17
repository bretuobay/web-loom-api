import {
  SpanStatusCode,
  type SpanStatus,
  type SpanEvent,
  type SpanAttributeValue,
  type SpanOptions,
  type SpanData,
  type SpanMethods,
} from './types';

/**
 * Generate a random hex string of the specified byte length.
 */
function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a 32-hex-char trace ID (16 bytes).
 */
export function generateTraceId(): string {
  return randomHex(16);
}

/**
 * Generate a 16-hex-char span ID (8 bytes).
 */
export function generateSpanId(): string {
  return randomHex(8);
}

/**
 * Represents a single unit of work in a distributed trace.
 */
export class Span implements SpanData, SpanMethods {
  public readonly spanId: string;
  public readonly traceId: string;
  public readonly parentSpanId?: string;
  public readonly name: string;
  public readonly startTime: number;
  public endTime?: number;
  public status: SpanStatus;
  public attributes: Record<string, SpanAttributeValue>;
  public events: SpanEvent[];


  private ended = false;
  private readonly onEnd?: (span: SpanData) => void;

  constructor(name: string, options?: SpanOptions & { onEnd?: (span: SpanData) => void }) {
    this.spanId = generateSpanId();
    this.traceId = options?.traceId ?? generateTraceId();
    this.parentSpanId = options?.parentSpanId;
    this.name = name;
    this.startTime = Date.now();
    this.status = { code: SpanStatusCode.UNSET };
    this.attributes = { ...options?.attributes };
    this.events = [];
    this.onEnd = options?.onEnd;
  }

  setAttribute(key: string, value: SpanAttributeValue): void {
    if (this.ended) return;
    this.attributes[key] = value;
  }

  addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): void {
    if (this.ended) return;
    this.events.push({ name, timestamp: Date.now(), attributes });
  }

  setStatus(code: SpanStatusCode, message?: string): void {
    if (this.ended) return;
    this.status = { code, message };
  }

  end(): void {
    if (this.ended) return;
    this.ended = true;
    this.endTime = Date.now();
    this.onEnd?.(this);
  }

  get duration(): number | undefined {
    if (this.endTime === undefined) return undefined;
    return this.endTime - this.startTime;
  }

  toJSON(): SpanData {
    return {
      spanId: this.spanId,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      startTime: this.startTime,
      endTime: this.endTime,
      status: this.status,
      attributes: { ...this.attributes },
      events: [...this.events],
    };
  }
}
