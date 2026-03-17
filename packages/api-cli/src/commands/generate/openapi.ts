/**
 * Generate OpenAPI Command
 * 
 * Generates OpenAPI specification file from project routes and models
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';
import { generateOpenAPISpec } from '../../utils/spec-generator.js';

type OpenAPISpecDocument = {
  paths?: Record<string, Record<string, unknown>>;
} & Record<string, unknown>;

const normalizeSpecDocument = (spec: unknown): OpenAPISpecDocument => {
  if (typeof spec === 'string') {
    return JSON.parse(spec) as OpenAPISpecDocument;
  }

  return spec as OpenAPISpecDocument;
};

export const createGenerateOpenAPICommand = (): Command => {
  return new Command('openapi')
    .description('Generate OpenAPI specification file')
    .option('-o, --output <path>', 'Output file path', 'openapi.json')
    .option('-f, --format <format>', 'Output format (json or yaml)', 'json')
    .option('-t, --title <title>', 'API title', 'Web Loom API')
    .option('-v, --version <version>', 'API version', '1.0.0')
    .option('-d, --description <description>', 'API description', 'API documentation')
    .action(async (options: {
      output: string;
      format: string;
      title: string;
      version: string;
      description: string;
    }) => {
      try {
        console.log('Generating OpenAPI specification...');
        console.log('');

        if (options.format !== 'json' && options.format !== 'yaml') {
          console.error('Invalid format. Must be "json" or "yaml"');
          process.exit(1);
        }

        const spec = normalizeSpecDocument(
          generateOpenAPISpec({
            title: options.title,
            version: options.version,
            description: options.description,
            projectRoot: process.cwd(),
          })
        );

        let outputPath = options.output;
        if (!path.isAbsolute(outputPath)) {
          outputPath = path.join(process.cwd(), outputPath);
        }

        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        let content: string;
        if (options.format === 'yaml') {
          content = yaml.stringify(spec);
          if (!outputPath.endsWith('.yaml') && !outputPath.endsWith('.yml')) {
            outputPath = outputPath.replace(/\.[^.]+$/, '.yaml');
          }
        } else {
          content = JSON.stringify(spec, null, 2);
          if (!outputPath.endsWith('.json')) {
            outputPath = outputPath.replace(/\.[^.]+$/, '.json');
          }
        }

        fs.writeFileSync(outputPath, content, 'utf-8');

        console.log('OpenAPI specification generated successfully');
        console.log('');
        console.log(`File: ${path.relative(process.cwd(), outputPath)}`);
        console.log(`Format: ${options.format.toUpperCase()}`);
        console.log(`Title: ${options.title}`);
        console.log(`Version: ${options.version}`);

        const pathItems = Object.values(spec.paths ?? {});
        const pathCount = pathItems.length;
        let operationCount = 0;
        for (const pathItem of pathItems) {
          operationCount += Object.keys(pathItem).filter(
            key => ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'].includes(key)
          ).length;
        }

        console.log(`Paths: ${pathCount}`);
        console.log(`Operations: ${operationCount}`);
        console.log('');
        console.log('Tips:');
        console.log('   Use --format yaml to generate YAML format');
        console.log('   Use --output <path> to specify custom output path');
        console.log('   Import this file into API testing tools like Postman or Insomnia');
        console.log('   Use with Swagger UI or Scalar for interactive documentation');
      } catch (error) {
        console.error('Error generating OpenAPI specification:', error instanceof Error ? error.message : error);

        if (error instanceof Error && error.stack) {
          console.log('');
          console.log('Stack trace:');
          console.log(error.stack);
        }

        process.exit(1);
      }
    });
};
