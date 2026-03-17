/**
 * @web-loom/api-uploads
 *
 * File upload handling for Web Loom API Framework.
 * Provides multipart/form-data parsing middleware with file size and
 * MIME type validation, plus pluggable storage backends for local
 * filesystem, AWS S3, and Cloudflare R2.
 */

export { fileUpload, extractBoundary, parseMultipart } from './upload-middleware';
export type { FileUploadError } from './upload-middleware';
export { LocalFileStore } from './stores/local-file-store';
export type { LocalFileStoreOptions } from './stores/local-file-store';
export { S3FileStore } from './stores/s3-file-store';
export type { S3Client, S3FileStoreOptions } from './stores/s3-file-store';
export { R2FileStore } from './stores/r2-file-store';
export type { R2Client, R2FileStoreOptions } from './stores/r2-file-store';
export type {
  ParsedFile,
  FileUploadOptions,
  ResolvedFileUploadOptions,
  FileUploadResult,
  StoredFile,
  SignedUrlOptions,
  FileStore,
} from './types';
