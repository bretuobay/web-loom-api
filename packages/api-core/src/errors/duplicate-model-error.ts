export class DuplicateModelError extends Error {
  readonly code = 'DUPLICATE_MODEL' as const;
  readonly modelName: string;

  constructor(modelName: string) {
    super(
      `Model "${modelName}" has already been registered. ` +
        'Call modelRegistry.clear() between tests or ensure defineModel() is only called once per model.'
    );
    this.name = 'DuplicateModelError';
    this.modelName = modelName;
    Object.setPrototypeOf(this, DuplicateModelError.prototype);
  }
}
