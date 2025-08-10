#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

class LogAnalyzer {
  constructor() {
    this.logsDir = path.join(__dirname, '..', 'logs');
  }

  // Get all log files
  getLogFiles() {
    if (!fs.existsSync(this.logsDir)) {
      console.log('Logs directory not found. Make sure the server has been running.');
      return [];
    }

    const files = fs.readdirSync(this.logsDir);
    return files.filter(file => file.endsWith('.log'));
  }

  // Read and parse log file
  readLogFile(filename) {
    const filepath = path.join(this.logsDir, filename);
    const content = fs.readFileSync(filepath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    return lines.map(line => {
      // Parse the simple format: timestamp level message [optional JSON data]
      const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}:\d{3}) (\w+) (.+)$/);
      if (match) {
        const [, timestamp, level, rest] = match;
        const messageEnd = rest.lastIndexOf(' {');
        if (messageEnd > 0) {
          try {
            const message = rest.substring(0, messageEnd);
            const jsonData = JSON.parse(rest.substring(messageEnd));
            return { timestamp, level, message, ...jsonData };
          } catch (e) {
            return { timestamp, level, message: rest };
          }
        } else {
          return { timestamp, level, message: rest };
        }
      }
      return { raw: line };
    });
  }

  // Analyze errors
  analyzeErrors() {
    console.log('\nAnalyzing Errors...\n');
    
    const errorFiles = this.getLogFiles().filter(file => file.includes('error'));
    
    if (errorFiles.length === 0) {
              console.log('No error log files found');
      return;
    }

    errorFiles.forEach(file => {
      console.log(`${file}:`);
      const logs = this.readLogFile(file);
      
      const errorCounts = {};
      logs.forEach(log => {
        if (log.message) {
          const key = log.message.split(' ')[0]; // Get first word as error type
          errorCounts[key] = (errorCounts[key] || 0) + 1;
        }
      });

      Object.entries(errorCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([error, count]) => {
          console.log(`  ${error}: ${count} occurrences`);
        });
    });
  }

  // Analyze HTTP requests
  analyzeHttpRequests() {
    console.log('\nAnalyzing HTTP Requests...\n');
    
    const httpFiles = this.getLogFiles().filter(file => file.includes('http'));
    
    if (httpFiles.length === 0) {
              console.log('No HTTP log files found');
      return;
    }

    httpFiles.forEach(file => {
      console.log(`${file}:`);
      const logs = this.readLogFile(file);
      
      const statusCodes = {};
      const slowRequests = [];
      
      logs.forEach(log => {
        if (log.statusCode) {
          statusCodes[log.statusCode] = (statusCodes[log.statusCode] || 0) + 1;
        }
        
        if (log.duration) {
          const duration = parseInt(log.duration.replace('ms', ''));
          if (duration > 1000) {
            slowRequests.push({
              method: log.method,
              url: log.url,
              duration: duration,
              statusCode: log.statusCode
            });
          }
        }
      });

      console.log('  Status Codes:');
      Object.entries(statusCodes)
        .sort(([,a], [,b]) => b - a)
        .forEach(([code, count]) => {
          console.log(`    ${code}: ${count} requests`);
        });

      if (slowRequests.length > 0) {
        console.log('\n  Slow Requests (>1000ms):');
        slowRequests
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
          .forEach(req => {
            console.log(`    ${req.method} ${req.url} - ${req.statusCode} (${req.duration}ms)`);
          });
      }
    });
  }

  // Show recent logs
  showRecentLogs(lines = 20) {
    console.log(`\nRecent Logs (last ${lines} lines)...\n`);
    
    const combinedFiles = this.getLogFiles().filter(file => file.includes('combined'));
    
    if (combinedFiles.length === 0) {
              console.log('No combined log files found');
      return;
    }

    // Get the most recent combined log file
    const latestFile = combinedFiles.sort().pop();
    const logs = this.readLogFile(latestFile);
    
    logs.slice(-lines).forEach(log => {
      const timestamp = log.timestamp || 'Unknown';
      const level = log.level || 'INFO';
      const message = log.message || log.raw || 'No message';
      
      console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`);
    });
  }

  // Search logs
  searchLogs(query) {
    console.log(`\nSearching for: "${query}"\n`);
    
    const allFiles = this.getLogFiles();
    let found = false;
    
    allFiles.forEach(file => {
      const logs = this.readLogFile(file);
      const matches = logs.filter(log => {
        const logStr = JSON.stringify(log).toLowerCase();
        return logStr.includes(query.toLowerCase());
      });
      
      if (matches.length > 0) {
        console.log(`${file} (${matches.length} matches):`);
        matches.forEach(log => {
          const timestamp = log.timestamp || 'Unknown';
          const level = log.level || 'INFO';
          const message = log.message || log.raw || 'No message';
          
                     console.log(`  [${timestamp}] ${level.toUpperCase()}: ${message}`);
        });
        found = true;
      }
    });
    
    if (!found) {
              console.log('No matches found');
    }
  }

  // Show summary
  showSummary() {
    console.log('\nLog Summary\n');
    
    const files = this.getLogFiles();
    console.log(`Total log files: ${files.length}`);
    
    files.forEach(file => {
      const filepath = path.join(this.logsDir, file);
      const stats = fs.statSync(filepath);
      const size = (stats.size / 1024).toFixed(2);
      console.log(`  ${file}: ${size} KB`);
    });
  }
}

// CLI interface
function main() {
  const analyzer = new LogAnalyzer();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Log Analyzer - Available commands:');
    console.log('  node scripts/log-analyzer.js summary     - Show log summary');
    console.log('  node scripts/log-analyzer.js errors      - Analyze errors');
    console.log('  node scripts/log-analyzer.js http        - Analyze HTTP requests');
    console.log('  node scripts/log-analyzer.js recent      - Show recent logs');
    console.log('  node scripts/log-analyzer.js search <query> - Search logs');
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case 'summary':
      analyzer.showSummary();
      break;
    case 'errors':
      analyzer.analyzeErrors();
      break;
    case 'http':
      analyzer.analyzeHttpRequests();
      break;
    case 'recent':
      analyzer.showRecentLogs(args[1] ? parseInt(args[1]) : 20);
      break;
    case 'search':
      if (args[1]) {
        analyzer.searchLogs(args[1]);
      } else {
        console.log('Please provide a search query');
      }
      break;
    default:
              console.log('Unknown command. Use without arguments to see available commands.');
  }
}

if (require.main === module) {
  main();
}

module.exports = LogAnalyzer;
