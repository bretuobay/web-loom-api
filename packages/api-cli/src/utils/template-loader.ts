/**
 * Template Loader
 * 
 * Utilities for loading and processing project templates.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Template type
 */
export type TemplateType = 'minimal' | 'serverless' | 'full-stack';

/**
 * Template variables for substitution
 */
export interface TemplateVariables {
  PROJECT_NAME: string;
  INSTALL_CMD: string;
  RUN_CMD: string;
}

/**
 * Template file definition
 */
interface TemplateFile {
  sourcePath: string;
  targetPath: string;
  processContent: boolean;
}

/**
 * Get template directory path
 */
function getTemplateDir(template: TemplateType): string {
  return path.join(__dirname, '..', 'templates', template);
}

/**
 * Get shared template directory path
 */
function getSharedTemplateDir(): string {
  return path.join(__dirname, '..', 'templates', 'shared');
}

/**
 * Replace template variables in content
 */
function replaceVariables(content: string, variables: TemplateVariables): string {
  let result = content;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }
  
  return result;
}

/**
 * Get list of template files for a given template type
 */
export async function getTemplateFiles(template: TemplateType): Promise<TemplateFile[]> {
  const templateDir = getTemplateDir(template);
  const sharedDir = getSharedTemplateDir();
  const files: TemplateFile[] = [];

  // Helper to recursively scan directory
  async function scanDirectory(dir: string, baseDir: string, isShared = false) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        await scanDirectory(fullPath, baseDir, isShared);
      } else if (entry.isFile()) {
        // Remove .template extension from target path
        const targetPath = relativePath.replace(/\.template$/, '');
        
        files.push({
          sourcePath: fullPath,
          targetPath,
          processContent: entry.name.endsWith('.template'),
        });
      }
    }
  }

  // Scan template-specific files
  try {
    await scanDirectory(templateDir, templateDir);
  } catch (err) {
    // Template directory might not exist yet
    console.warn(`Template directory not found: ${templateDir}`);
  }

  // Scan shared files
  try {
    await scanDirectory(sharedDir, sharedDir, true);
  } catch (err) {
    // Shared directory might not exist yet
    console.warn(`Shared template directory not found: ${sharedDir}`);
  }

  return files;
}

/**
 * Load and process a template file
 */
export async function loadTemplateFile(
  filePath: string,
  variables: TemplateVariables,
  processContent: boolean
): Promise<string> {
  const content = await fs.readFile(filePath, 'utf-8');
  
  if (processContent) {
    return replaceVariables(content, variables);
  }
  
  return content;
}

/**
 * Copy template files to target directory
 */
export async function copyTemplate(
  template: TemplateType,
  targetDir: string,
  variables: TemplateVariables
): Promise<void> {
  const files = await getTemplateFiles(template);

  for (const file of files) {
    const targetPath = path.join(targetDir, file.targetPath);
    const targetDirPath = path.dirname(targetPath);

    // Ensure target directory exists
    await fs.mkdir(targetDirPath, { recursive: true });

    // Load and process file content
    const content = await loadTemplateFile(
      file.sourcePath,
      variables,
      file.processContent
    );

    // Write file
    await fs.writeFile(targetPath, content);
  }
}
