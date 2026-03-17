/**
 * Plugin Discovery
 *
 * Scans node_modules for packages with the "webloom-plugin" keyword
 * and local directories for plugin modules.
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/** Discovered plugin descriptor */
export interface DiscoveredPlugin {
  /** Module path or package name to import */
  resolve: string;
  /** Source of discovery */
  source: 'npm' | 'local';
  /** Package name (if npm) or file path (if local) */
  name: string;
}

/**
 * Discover npm packages that declare "webloom-plugin" in their keywords.
 * Scans the given node_modules directory.
 */
export async function discoverNpmPlugins(
  nodeModulesPath: string,
): Promise<DiscoveredPlugin[]> {
  const results: DiscoveredPlugin[] = [];

  let entries: string[];
  try {
    entries = await readdir(nodeModulesPath);
  } catch {
    return results;
  }

  for (const entry of entries) {
    // Handle scoped packages (@scope/pkg)
    if (entry.startsWith('@')) {
      const scopePath = join(nodeModulesPath, entry);
      let scopedEntries: string[];
      try {
        scopedEntries = await readdir(scopePath);
      } catch {
        continue;
      }
      for (const scopedEntry of scopedEntries) {
        const pkgName = `${entry}/${scopedEntry}`;
        const pkgJsonPath = join(scopePath, scopedEntry, 'package.json');
        if (await _isWebloomPlugin(pkgJsonPath)) {
          results.push({ resolve: pkgName, source: 'npm', name: pkgName });
        }
      }
    } else {
      const pkgJsonPath = join(nodeModulesPath, entry, 'package.json');
      if (await _isWebloomPlugin(pkgJsonPath)) {
        results.push({ resolve: entry, source: 'npm', name: entry });
      }
    }
  }

  return results;
}


/**
 * Discover local plugin files/directories from the given paths.
 * Each path should point to a directory containing plugin modules
 * (files exporting a Plugin object).
 */
export async function discoverLocalPlugins(
  dirs: string[],
): Promise<DiscoveredPlugin[]> {
  const results: DiscoveredPlugin[] = [];

  for (const dir of dirs) {
    const absDir = resolve(dir);
    let entries: string[];
    try {
      entries = await readdir(absDir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = join(absDir, entry);
      const info = await stat(fullPath).catch(() => undefined);
      if (!info) continue;

      if (info.isFile() && /\.(ts|js|mjs|cjs)$/.test(entry)) {
        results.push({ resolve: fullPath, source: 'local', name: entry });
      } else if (info.isDirectory()) {
        // Look for index file inside directory
        const indexPath = await _findIndex(fullPath);
        if (indexPath) {
          results.push({ resolve: indexPath, source: 'local', name: entry });
        }
      }
    }
  }

  return results;
}

// -- Helpers ------------------------------------------------------------

async function _isWebloomPlugin(pkgJsonPath: string): Promise<boolean> {
  try {
    const raw = await readFile(pkgJsonPath, 'utf-8');
    const pkg = JSON.parse(raw) as { keywords?: string[] };
    return Array.isArray(pkg.keywords) && pkg.keywords.includes('webloom-plugin');
  } catch {
    return false;
  }
}

async function _findIndex(dir: string): Promise<string | undefined> {
  const candidates = ['index.ts', 'index.js', 'index.mjs', 'index.cjs'];
  for (const candidate of candidates) {
    const p = join(dir, candidate);
    try {
      const info = await stat(p);
      if (info.isFile()) return p;
    } catch {
      // continue
    }
  }
  return undefined;
}
