import fs from 'fs';
import path from 'path';

/**
 * Script to clean up old log files, keeping only the 5 most recent ones
 * This can be run manually or as part of the startup process
 */

const cleanupOldLogs = () => {
  const logsDir = path.join(process.cwd(), 'logs');
  
  console.log('Starting log cleanup process...');
  console.log(`Logs directory: ${logsDir}`);
  
  try {
    // Check if logs directory exists
    if (!fs.existsSync(logsDir)) {
      console.log('Logs directory does not exist. Nothing to clean up.');
      return;
    }

    // Get all log files (including .gz files and audit files)
    const files = fs.readdirSync(logsDir)
      .filter(file => file.endsWith('.log') || file.endsWith('.log.gz') || file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(logsDir, file),
        stats: fs.statSync(path.join(logsDir, file))
      }))
      .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime()); // Sort by modification time, newest first

    console.log(`Found ${files.length} log files:`);
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.name} (${file.stats.mtime.toISOString()})`);
    });

    // Keep only the 5 most recent files
    if (files.length > 5) {
      const filesToDelete = files.slice(5);
      
      console.log(`\nDeleting ${filesToDelete.length} old log files:`);
      filesToDelete.forEach(file => {
        try {
          fs.unlinkSync(file.path);
          console.log(`  ✓ Deleted: ${file.name}`);
        } catch (error) {
          console.error(`  ✗ Failed to delete ${file.name}:`, error);
        }
      });
      
      console.log(`\nCleanup completed. Kept ${files.length - filesToDelete.length} most recent files.`);
    } else {
      console.log(`\nNo cleanup needed. Found ${files.length} log files (keeping all).`);
    }
  } catch (error) {
    console.error('Error during log cleanup:', error);
    process.exit(1);
  }
};

// Run cleanup if this script is executed directly
if (require.main === module) {
  cleanupOldLogs();
}

export default cleanupOldLogs;
