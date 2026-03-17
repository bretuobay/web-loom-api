import { readFileSync, writeFileSync } from 'fs';

const p = 'packages/api-testing/src/index.ts';
let c = readFileSync(p, 'utf8');

const ins = `// Model Serializer
export {
  serialize,
  deserialize,
  validateDeserialized,
} from './model-serializer';
export type {
  FieldType,
  FieldDef,
  ModelSchema,
  ValidationError as SerializationValidationError,
  ValidationResult as SerializationValidationResult,
} from './model-serializer';

`;

c = c.replace('// Contract Testing', ins + '// Contract Testing');
writeFileSync(p, c);
console.log('INDEX_UPDATED');
