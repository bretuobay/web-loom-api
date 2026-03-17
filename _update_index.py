#!/usr/bin/env python3
import os

path = "/home/bretuobay/prjts/web-loom-api/packages/api-testing/src/index.ts"
with open(path, "r") as f:
    content = f.read()

insert_text = """// Model Serializer
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

"""

marker = "// Contract Testing"
content = content.replace(marker, insert_text + marker)

with open(path, "w") as f:
    f.write(content)

print("INDEX_UPDATED")
