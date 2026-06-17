#!/usr/bin/env node

// admin-cli/index.js
const { spawn, exec } = require('child_process');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs');

const PORT = process.env.PORT || 3001;
const SERVER_SCRIPT = path.join(__dirname, 'server.js');

console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║     CHEMSTOCK ADMIN CLI v2.0                                ║
║     Web UI Dashboard                                        ║
╚══════════════════════════════════════════════════════════════╝
`));

console.log(chalk.white('📡 Starting Admin Web UI...\n'));

function isServerRunning() {
  try {
    const result = require('child_process').execSync(
      `netstat -ano | findstr :${PORT} | findstr LISTENING`
    );
    return result.toString().trim().length > 0;
  } catch {
    return false;
  }
}

function openBrowser(url) {
  console.log(chalk.gray(`🌐 Opening browser at: ${url}`));
  
  let command;
  if (process.platform === 'win32') {
    command = `start "" "${url}"`;
  } else if (process.platform === 'darwin') {
    command = `open "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  console.log(chalk.gray(`📋 Running: ${command}`));
  
  exec(command, (error) => {
    if (error) {
      console.log(chalk.yellow(`⚠️  Could not open browser automatically`));
      console.log(chalk.gray(`   Please open: ${url} manually`));
    } else {
      console.log(chalk.green(`✅ Browser opened successfully`));
    }
  });
}

function killProcessOnPort() {
  try {
    console.log(chalk.gray(`🔍 Checking for process on port ${PORT}...`));
    const result = require('child_process').execSync(
      `netstat -ano | findstr :${PORT} | findstr LISTENING`
    );
    const lines = result.toString().trim().split('\n');
    if (lines.length > 0) {
      const parts = lines[0].trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid) {
        console.log(chalk.yellow(`   Found process PID: ${pid}`));
        require('child_process').execSync(`taskkill /F /PID ${pid}`);
        console.log(chalk.green(`   ✅ Process killed`));
      }
    }
  } catch {
    console.log(chalk.gray(`   No process found on port ${PORT}`));
  }
}

function startServer() {
  if (isServerRunning()) {
    console.log(chalk.yellow(`⚠️  Server is already running on port ${PORT}`));
    console.log(chalk.green(`🌐 Opening browser at: http://localhost:${PORT}\n`));
    openBrowser(`http://localhost:${PORT}`);
    setTimeout(() => {
      console.log(chalk.gray('\n💡 Server is running in background.\n'));
      process.exit(0);
    }, 2000);
    return;
  }

  if (!fs.existsSync(SERVER_SCRIPT)) {
    console.error(chalk.red(`❌ Server script not found: ${SERVER_SCRIPT}`));
    process.exit(1);
  }

  console.log(chalk.gray('⏳ Starting server...'));
  
  const server = spawn('node', [SERVER_SCRIPT], {
    stdio: 'inherit',
    detached: false
  });

  let serverStarted = false;

  server.stdout?.on('data', (data) => {
    const output = data.toString();
    if (output.includes('Admin Web UI running') && !serverStarted) {
      serverStarted = true;
      console.log(chalk.green(`\n✅ Server started on port ${PORT}`));
      console.log(chalk.green(`🌐 Opening browser at: http://localhost:${PORT}\n`));
      setTimeout(() => {
        openBrowser(`http://localhost:${PORT}`);
      }, 500);
      console.log(chalk.gray('💡 Press Ctrl+C to stop the server\n'));
    }
  });

  server.on('error', (err) => {
    console.error(chalk.red('❌ Server error:'), err.message);
    process.exit(1);
  });

  server.on('close', (code) => {
    if (code !== 0 && !serverStarted) {
      console.error(chalk.red(`❌ Server stopped with code: ${code}`));
      console.log(chalk.yellow('\n📋 Possible issues:'));
      console.log(chalk.gray('   1. Missing dependencies - Run: npm install'));
      console.log(chalk.gray('   2. Missing web-ui folder - Create it'));
      console.log(chalk.gray('   3. Port 3001 in use - Run: node index.js --kill'));
      console.log(chalk.gray('   4. Check server.js for errors\n'));
    } else if (code !== 0) {
      console.log(chalk.red(`❌ Server stopped with code: ${code}`));
    } else {
      console.log(chalk.gray('✅ Server stopped gracefully'));
    }
    process.exit(code || 0);
  });

  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n\n🛑 Shutting down server...'));
    server.kill('SIGINT');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });

  setTimeout(() => {
    if (!serverStarted) {
      console.log(chalk.yellow('\n⚠️  Server is taking longer than expected to start...'));
      console.log(chalk.gray('   Check the output above for errors.\n'));
    }
  }, 10000);
}

function main() {
  if (process.argv.includes('--kill')) {
    console.log(chalk.yellow('🗑️  Killing process on port 3001...'));
    killProcessOnPort();
    console.log(chalk.green('✅ Done.'));
    process.exit(0);
    return;
  }

  if (process.argv.includes('--restart')) {
    console.log(chalk.yellow('🔄 Restarting server...'));
    killProcessOnPort();
    setTimeout(() => {
      startServer();
    }, 1000);
    return;
  }

  startServer();
}

main();