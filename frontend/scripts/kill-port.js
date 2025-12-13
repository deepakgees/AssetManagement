#!/usr/bin/env node

/**
 * Script to kill processes running on a specific port
 * Cross-platform solution for Windows, Linux, and macOS
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const execAsync = promisify(exec);

// Load environment variables from .env file if it exists
// Use dotenv if available, otherwise fall back to manual parsing
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // dotenv not available, will use process.env or default
}

// Default to port 7000 for frontend, but allow override via PORT env var or command line arg
const PORT = process.argv[2] || process.env.PORT || 7000;

async function killPort(port) {
  const isWindows = process.platform === 'win32';
  
  try {
    if (isWindows) {
      // Windows: Find and kill processes using the port
      console.log(`Checking for processes on port ${port} (Windows)...`);
      
      // Find PIDs using the port
      const { stdout } = await execAsync(`netstat -ano | findstr ":${port} "`);
      
      if (!stdout.trim()) {
        console.log(`No processes found on port ${port}`);
        return;
      }
      
      // Extract PIDs from netstat output
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0' && !isNaN(pid)) {
          pids.add(pid);
        }
      }
      
      if (pids.size === 0) {
        console.log(`No valid processes found on port ${port}`);
        return;
      }
      
      // Kill each process
      for (const pid of pids) {
        try {
          console.log(`Killing process ${pid} on port ${port}...`);
          await execAsync(`taskkill /PID ${pid} /F`);
          console.log(`✓ Successfully killed process ${pid}`);
        } catch (error) {
          // Process might already be terminated or we don't have permissions
          if (!error.message.includes('not found') && !error.message.includes('not running')) {
            console.warn(`⚠ Could not kill process ${pid}: ${error.message}`);
          }
        }
      }
      
      // Verify port is free
      await new Promise(resolve => setTimeout(resolve, 500));
      const { stdout: checkStdout } = await execAsync(`netstat -ano | findstr ":${port} "`).catch(() => ({ stdout: '' }));
      if (!checkStdout.trim()) {
        console.log(`✓ Port ${port} is now free`);
      } else {
        console.warn(`⚠ Port ${port} may still be in use`);
      }
    } else {
      // Unix/Linux/macOS: Find and kill processes using the port
      console.log(`Checking for processes on port ${port} (Unix)...`);
      
      // Find PIDs using lsof
      const { stdout } = await execAsync(`lsof -ti:${port}`);
      
      if (!stdout.trim()) {
        console.log(`No processes found on port ${port}`);
        return;
      }
      
      const pids = stdout.trim().split('\n').filter(pid => pid);
      
      // Kill each process
      for (const pid of pids) {
        try {
          console.log(`Killing process ${pid} on port ${port}...`);
          await execAsync(`kill -9 ${pid}`);
          console.log(`✓ Successfully killed process ${pid}`);
        } catch (error) {
          console.warn(`⚠ Could not kill process ${pid}: ${error.message}`);
        }
      }
      
      // Verify port is free
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        await execAsync(`lsof -ti:${port}`);
        console.warn(`⚠ Port ${port} may still be in use`);
      } catch {
        console.log(`✓ Port ${port} is now free`);
      }
    }
  } catch (error) {
    // If netstat/lsof fails, it usually means no process is using the port
    if (error.message.includes('findstr') || error.message.includes('lsof')) {
      console.log(`No processes found on port ${port}`);
    } else {
      console.error(`Error checking port ${port}:`, error.message);
      process.exit(1);
    }
  }
}

// Run the script
killPort(PORT).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

