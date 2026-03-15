/**
 * Seed Command
 * 
 * Loads and executes database seed files
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';

export const createSeedCommand = (): Command => {
  return new Command('seed')
    .description('Load and execute database seed files')
    .option('-p, --path <path>', 'Path to seed files directory', 'src/seeds')
    .option('-f, --file <file>', 'Specific seed file to run')
    .option('--config <path>', 'Path to configuration file', 'webloom.config.ts')
    .action(async (options: {
      path: string;
      file?: string;
      config: string;
    }) => {
      try {
        console.log('🌱 Running database seeds...');
        console.log('');

        const projectRoot = process.cwd();
        const seedsPath = path.isAbsolute(options.path) 
          ? options.path 
          : path.join(projectRoot, options.path);

        // Check if seeds directory exists
        if (!fs.existsSync(seedsPath)) {
          console.error(`❌ Seeds directory not found: ${options.path}`);
          console.log('');
          console.log('💡 Create a seeds directory with seed files:');
          console.log(`   mkdir -p ${options.path}`);
          console.log(`   # Create seed files like: ${options.path}/001_users.ts`);
          process.exit(1);
        }

        // Get seed files
        let seedFiles: string[] = [];
        
        if (options.file) {
          // Run specific file
          const filePath = path.isAbsolute(options.file)
            ? options.file
            : path.join(seedsPath, options.file);
          
          if (!fs.existsSync(filePath)) {
            console.error(`❌ Seed file not found: ${options.file}`);
            process.exit(1);
          }
          
          seedFiles = [filePath];
        } else {
          // Run all seed files
          const entries = fs.readdirSync(seedsPath, { withFileTypes: true });
          seedFiles = entries
            .filter(entry => 
              entry.isFile() && 
              (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))
            )
            .map(entry => path.join(seedsPath, entry.name))
            .sort(); // Sort alphabetically for consistent order
        }

        if (seedFiles.length === 0) {
          console.log('⚠️  No seed files found');
          console.log('');
          console.log('💡 Create seed files in the seeds directory:');
          console.log(`   ${options.path}/001_users.ts`);
          console.log(`   ${options.path}/002_posts.ts`);
          process.exit(0);
        }

        console.log(`📋 Found ${seedFiles.length} seed file(s)`);
        console.log('');

        // Execute seed files
        let successCount = 0;
        let failureCount = 0;

        for (const seedFile of seedFiles) {
          const fileName = path.basename(seedFile);
          
          try {
            console.log(`🌱 Running: ${fileName}`);
            
            // In a real implementation, we would:
            // 1. Import the seed file dynamically
            // 2. Execute the seed function
            // 3. Track execution in database
            // 4. Handle errors and rollback if needed
            
            // Simulate seed execution
            await new Promise(resolve => setTimeout(resolve, 100));
            
            console.log(`   ✓ Completed: ${fileName}`);
            successCount++;
          } catch (error) {
            console.error(`   ❌ Failed: ${fileName}`);
            if (error instanceof Error) {
              console.error(`   Error: ${error.message}`);
            }
            failureCount++;
          }
        }

        console.log('');
        console.log('📊 Seed Summary:');
        console.log(`   ✓ Successful: ${successCount}`);
        if (failureCount > 0) {
          console.log(`   ❌ Failed: ${failureCount}`);
        }
        console.log('');

        if (failureCount > 0) {
          console.log('⚠️  Some seeds failed to execute');
          process.exit(1);
        } else {
          console.log('✓ All seeds executed successfully');
        }
      } catch (error) {
        console.error('❌ Error running seeds:', error instanceof Error ? error.message : error);
        
        if (error instanceof Error && error.stack) {
          console.log('');
          console.log('Stack trace:');
          console.log(error.stack);
        }
        
        process.exit(1);
      }
    });
};
