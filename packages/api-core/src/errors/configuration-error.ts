/**
 * ConfigurationError
 *
 * Thrown when `defineConfig()` detects a missing or invalid configuration value,
 * or when framework internals are accessed without the required configuration
 * (e.g. accessing `c.var.email` when no email adapter is configured).
 */
export class ConfigurationError extends Error {
  readonly code = 'CONFIGURATION_ERROR' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
    // Ensure correct instanceof checks in transpiled code
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}
