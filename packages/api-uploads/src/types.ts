/**
 * File Upload Types
 *
 * Type definitions for file upload middleware, parsed files,
 * storage backends, and configuration options.
 */

// -----------------------------------------------------------------------
// Parsed File
// -----------------------------------------------------------------------

/** Represents a single parsed file from a multipart/form-data request. */
export interface ParsedFile {
  /** Original filename from the upload */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type (e.g. "image/png") */
  type: string;
  /** File content as a Buffer */
  buffer: Buffer;
}

// -----------------------------------------------------------------------
// Upload Options
// -----------------------------------------------------------------------

export interface FileUploadOptions {
  /** Maximum file size in bytes. Default: 5 MB */
  maxFileSize?: number | undefined;
  /** Maximum number of files per request. Default: 10 */
  maxFiles?: number | undefined;
  /** Allowed MIME types. If empty/undefined, all types are allowed. */
  allowedMimeTypes?: string[] | undefined;
}

export interface ResolvedFileUploadOptions {
  maxFileSize: number;
  maxFiles: number;
  allowedMimeTypes: string[];
}

// -----------------------------------------------------------------------
// Upload Result
// -----------------------------------------------------------------------

/** Result attached to the request context after parsing. */
export interface FileUploadResult {
  files: ParsedFile[];
  fields: Record<string, string>;
}

// -----------------------------------------------------------------------
// File Store
// -----------------------------------------------------------------------

/** Metadata returned after a successful upload to a storage backend. */
export interface StoredFile {
  /** Unique identifier / key for the stored file */
  key: string;
  /** Original filename */
  name: string;
  /** File size in bytes */
  size: number;
  /** MIME type */
  type: string;
}

/** Options for generating a signed download URL. */
export interface SignedUrlOptions {
  /** Expiration time in seconds. Default: 3600 (1 hour) */
  expiresIn?: number | undefined;
}

/**
 * Storage backend interface for persisting uploaded files.
 */
export interface FileStore {
  /** Upload a file and return stored file metadata. */
  upload(file: ParsedFile): Promise<StoredFile>;

  /** Download a file by key. Returns the file buffer or undefined if not found. */
  download(key: string): Promise<Buffer | undefined>;

  /** Delete a file by key. */
  delete(key: string): Promise<void>;

  /** Generate a signed URL for downloading a file. */
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;
}
