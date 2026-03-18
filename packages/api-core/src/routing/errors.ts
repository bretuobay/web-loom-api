export class RouteLoadError extends Error {
  readonly code = 'ROUTE_LOAD_ERROR' as const;
  readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to load route file "${filePath}": ${reason}`);
    this.name = 'RouteLoadError';
    this.filePath = filePath;
    Object.setPrototypeOf(this, RouteLoadError.prototype);
  }
}

export class RouteConflictError extends Error {
  readonly code = 'ROUTE_CONFLICT_ERROR' as const;
  readonly conflictPath: string;
  readonly files: [string, string];

  constructor(method: string, path: string, file1: string, file2: string) {
    super(
      `Route conflict: "${method} ${path}" is registered by both "${file1}" and "${file2}". ` +
        'Each method+path combination must be unique across route files.'
    );
    this.name = 'RouteConflictError';
    this.conflictPath = `${method} ${path}`;
    this.files = [file1, file2];
    Object.setPrototypeOf(this, RouteConflictError.prototype);
  }
}
