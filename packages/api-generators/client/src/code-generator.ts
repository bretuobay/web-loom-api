/**
 * Code Generation Utilities
 */

/**
 * Convert field type to TypeScript type
 */
export function fieldTypeToTS(fieldType: string): string {
  switch (fieldType) {
    case 'string':
    case 'uuid':
    case 'enum':
      return 'string';

    case 'number':
    case 'decimal':
      return 'number';

    case 'boolean':
      return 'boolean';

    case 'date':
      return 'Date | string';

    case 'json':
      return 'Record<string, unknown>';

    case 'array':
      return 'unknown[]';

    default:
      return 'unknown';
  }
}

/**
 * Convert model name to interface name
 */
export function modelToInterfaceName(modelName: string): string {
  return modelName;
}

/**
 * Convert path to method name
 * Examples:
 *   /users -> getUsers
 *   /users/:id -> getUserById
 *   /posts/:postId/comments -> getPostComments
 */
export function pathToMethodName(path: string, method: string): string {
  const methodPrefix = method.toLowerCase();

  // Remove leading slash and split by /
  const parts = path.replace(/^\//, '').split('/');

  // Filter out parameter segments and convert to camelCase
  const nameParts: string[] = [];
  let hasParam = false;

  for (const part of parts) {
    if (part.startsWith(':')) {
      hasParam = true;
      // Convert :id to ById, :postId to ByPostId
      const paramName = part.substring(1);
      nameParts.push('By' + capitalize(paramName));
    } else {
      nameParts.push(capitalize(part));
    }
  }

  let methodName = methodPrefix + nameParts.join('');

  // Handle special cases
  if (methodPrefix === 'get' && !hasParam && nameParts.length > 0) {
    // getUsers, getPosts (already plural)
  } else if (methodPrefix === 'post' && nameParts.length > 0) {
    // createUser, createPost
    methodName = 'create' + nameParts.join('');
  } else if (methodPrefix === 'put' && hasParam) {
    // updateUserById
    methodName = 'update' + nameParts.join('');
  } else if (methodPrefix === 'patch' && hasParam) {
    // patchUserById
    methodName = 'patch' + nameParts.join('');
  } else if (methodPrefix === 'delete' && hasParam) {
    // deleteUserById
    methodName = 'delete' + nameParts.join('');
  }

  return methodName;
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Convert path parameters to function parameters
 * Examples:
 *   /users/:id -> id: string
 *   /posts/:postId/comments/:commentId -> postId: string, commentId: string
 */
export function extractPathParams(path: string): Array<{ name: string; type: string }> {
  const params: Array<{ name: string; type: string }> = [];
  const matches = path.match(/:([a-zA-Z0-9_]+)/g);

  if (matches) {
    for (const match of matches) {
      const paramName = match.substring(1);
      params.push({ name: paramName, type: 'string' });
    }
  }

  return params;
}

/**
 * Generate JSDoc comment
 */
export function generateJSDoc(
  description?: string,
  params?: Array<{ name: string; description?: string }>,
  returns?: string
): string {
  const lines: string[] = ['/**'];

  if (description) {
    lines.push(` * ${description}`);
    if (params && params.length > 0) {
      lines.push(' *');
    }
  }

  if (params) {
    for (const param of params) {
      lines.push(` * @param ${param.name}${param.description ? ' - ' + param.description : ''}`);
    }
  }

  if (returns) {
    if (params && params.length > 0) {
      lines.push(' *');
    }
    lines.push(` * @returns ${returns}`);
  }

  lines.push(' */');

  return lines.join('\n');
}

/**
 * Indent code
 */
export function indent(code: string, level: number): string {
  const spaces = '  '.repeat(level);
  return code
    .split('\n')
    .map((line) => (line ? spaces + line : line))
    .join('\n');
}

/**
 * Generate type-safe query parameter builder
 */
export function generateQueryParams(_params: Record<string, unknown>): string {
  return `new URLSearchParams(
    Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => [key, String(value)])
  ).toString()`;
}
