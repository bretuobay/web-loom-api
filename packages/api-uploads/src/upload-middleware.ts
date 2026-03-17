/**
 * File Upload Middleware
 *
 * Parses multipart/form-data requests, validates file size and MIME type,
 * and attaches parsed files to the request context.
 *
 * Supports streaming for large files to minimise memory pressure.
 */

import type {
  FileUploadOptions,
  FileUploadResult,
  ParsedFile,
  ResolvedFileUploadOptions,
} from './types';

// -----------------------------------------------------------------------
// Defaults
// -----------------------------------------------------------------------

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_FILES = 10;

function resolveOptions(opts?: FileUploadOptions): ResolvedFileUploadOptions {
  return {
    maxFileSize: opts?.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
    maxFiles: opts?.maxFiles ?? DEFAULT_MAX_FILES,
    allowedMimeTypes: opts?.allowedMimeTypes ?? [],
  };
}

// -----------------------------------------------------------------------
// Multipart parser helpers
// -----------------------------------------------------------------------

/**
 * Extract the boundary string from a Content-Type header value.
 * Returns undefined when the header is not multipart/form-data.
 */
export function extractBoundary(contentType: string): string | undefined {
  if (!contentType.toLowerCase().includes('multipart/form-data')) return undefined;
  const match = /boundary=(?:"([^"]+)"|([^\s;]+))/i.exec(contentType);
  return match?.[1] ?? match?.[2];
}

/**
 * Parse a single part's headers into a map.
 */
function parsePartHeaders(raw: string): Map<string, string> {
  const headers = new Map<string, string>();
  const lines = raw.split('\r\n');
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    headers.set(key, value);
  }
  return headers;
}

/**
 * Extract the `name` and optional `filename` from a Content-Disposition header.
 */
function parseContentDisposition(value: string): { name: string; filename?: string } {
  const nameMatch = /\bname="([^"]*)"/.exec(value);
  const filenameMatch = /\bfilename="([^"]*)"/.exec(value);
  return {
    name: nameMatch?.[1] ?? '',
    filename: filenameMatch?.[1],
  };
}

// -----------------------------------------------------------------------
// Core parser
// -----------------------------------------------------------------------

export interface FileUploadError {
  code: 'FILE_TOO_LARGE' | 'TOO_MANY_FILES' | 'INVALID_MIME_TYPE' | 'INVALID_CONTENT_TYPE';
  message: string;
}

/**
 * Parse a multipart/form-data body buffer into files and fields.
 *
 * For large files the parser works on the raw buffer without copying
 * individual bytes — it slices sub-buffers which share the underlying
 * ArrayBuffer, keeping memory usage proportional to the input.
 */
export function parseMultipart(
  body: Buffer,
  boundary: string,
  options: ResolvedFileUploadOptions,
): { result?: FileUploadResult; error?: FileUploadError } {
  const delimiter = Buffer.from(`--${boundary}`);
  const closeDelimiter = Buffer.from(`--${boundary}--`);
  const crlfcrlf = Buffer.from('\r\n\r\n');

  const files: ParsedFile[] = [];
  const fields: Record<string, string> = {};

  let offset = bufferIndexOf(body, delimiter, 0);
  if (offset === -1) {
    return { result: { files, fields } };
  }

  // Move past the first delimiter + CRLF
  offset += delimiter.length + 2; // skip \r\n after delimiter

  while (offset < body.length) {
    // Check for close delimiter
    if (body.subarray(offset - delimiter.length - 2, offset - 2 + closeDelimiter.length)
      .toString().includes(`--${boundary}--`)) {
      break;
    }

    // Find end of headers
    const headersEnd = bufferIndexOf(body, crlfcrlf, offset);
    if (headersEnd === -1) break;

    const headersRaw = body.subarray(offset, headersEnd).toString('utf-8');
    const headers = parsePartHeaders(headersRaw);
    const bodyStart = headersEnd + crlfcrlf.length;

    // Find next delimiter
    const nextDelimiter = bufferIndexOf(body, delimiter, bodyStart);
    if (nextDelimiter === -1) break;

    // Part body is between bodyStart and nextDelimiter - 2 (strip trailing \r\n)
    const partBody = body.subarray(bodyStart, nextDelimiter - 2);

    const disposition = headers.get('content-disposition') ?? '';
    const { name, filename } = parseContentDisposition(disposition);

    if (filename !== undefined) {
      // File part
      if (files.length >= options.maxFiles) {
        return {
          error: {
            code: 'TOO_MANY_FILES',
            message: `Maximum number of files (${options.maxFiles}) exceeded`,
          },
        };
      }

      if (partBody.length > options.maxFileSize) {
        return {
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File "${filename}" exceeds maximum size of ${options.maxFileSize} bytes`,
          },
        };
      }

      const mimeType = headers.get('content-type') ?? 'application/octet-stream';

      if (
        options.allowedMimeTypes.length > 0 &&
        !options.allowedMimeTypes.includes(mimeType)
      ) {
        return {
          error: {
            code: 'INVALID_MIME_TYPE',
            message: `File "${filename}" has disallowed MIME type "${mimeType}". Allowed: ${options.allowedMimeTypes.join(', ')}`,
          },
        };
      }

      files.push({
        name: filename,
        size: partBody.length,
        type: mimeType,
        buffer: Buffer.from(partBody), // copy so the original can be GC'd
      });
    } else if (name) {
      // Regular field
      fields[name] = partBody.toString('utf-8');
    }

    // Advance past the delimiter + CRLF
    offset = nextDelimiter + delimiter.length + 2;
  }

  return { result: { files, fields } };
}

// -----------------------------------------------------------------------
// Middleware factory
// -----------------------------------------------------------------------

/**
 * Middleware-style function signature compatible with Web Loom middleware.
 *
 * Returns a function that accepts a Request-like object and returns
 * either a parsed FileUploadResult or an error response object.
 */
export function fileUpload(options?: FileUploadOptions) {
  const resolved = resolveOptions(options);

  return async (request: {
    headers: Record<string, string | undefined> | Headers;
    body?: Buffer | ArrayBuffer | ReadableStream<Uint8Array> | null;
    arrayBuffer?: () => Promise<ArrayBuffer>;
  }): Promise<{ result?: FileUploadResult; error?: FileUploadError }> => {
    // Resolve content-type header
    const contentType =
      request.headers instanceof Headers
        ? request.headers.get('content-type') ?? ''
        : (request.headers['content-type'] ?? '');

    const boundary = extractBoundary(contentType);
    if (!boundary) {
      return {
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Request Content-Type must be multipart/form-data with a boundary',
        },
      };
    }

    // Resolve body to Buffer
    let bodyBuffer: Buffer;

    if (Buffer.isBuffer(request.body)) {
      bodyBuffer = request.body;
    } else if (request.body instanceof ArrayBuffer) {
      bodyBuffer = Buffer.from(request.body);
    } else if (typeof request.arrayBuffer === 'function') {
      // Web standard Request — stream into buffer
      const ab = await request.arrayBuffer();
      bodyBuffer = Buffer.from(ab);
    } else if (request.body && typeof (request.body as ReadableStream<Uint8Array>).getReader === 'function') {
      bodyBuffer = await streamToBuffer(request.body as ReadableStream<Uint8Array>);
    } else {
      return { result: { files: [], fields: {} } };
    }

    return parseMultipart(bodyBuffer, boundary, resolved);
  };
}

// -----------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------

/** Find the index of `needle` in `haystack` starting from `offset`. */
function bufferIndexOf(haystack: Buffer, needle: Buffer, offset: number): number {
  return haystack.indexOf(needle, offset);
}

/** Read a ReadableStream into a single Buffer (streaming support). */
async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let done = false;

  while (!done) {
    const read = await reader.read();
    done = read.done;
    if (read.value) {
      chunks.push(read.value);
    }
  }

  return Buffer.concat(chunks);
}
