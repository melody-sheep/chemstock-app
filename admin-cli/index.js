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

// Quick guide for whoever runs the admin tool on this computer.
require('dotenv').config({ path: path.join(__dirname, '.env') });
const hasAdminPassword = Boolean(process.env.ADMIN_PASSWORD_HASH) && Boolean(String(process.env.ADMIN_NAME || '').trim());

console.log(chalk.cyan('📘 ADMIN GUIDE'));
console.log(chalk.white(`   • Log in at http://localhost:${PORT} with the admin password set on THIS computer.`));
console.log(chalk.white('   • Set or change the password:   ') + chalk.yellow('npm run set-password'));
console.log(chalk.white('   • Forgot the password?          ') + chalk.yellow('npm run set-password') + chalk.gray('  (replaces the old one)'));
console.log(chalk.white('   • Stop the admin tool:          ') + chalk.yellow('Ctrl + C'));
console.log(chalk.white('   • "Port already in use"?        ') + chalk.yellow('node index.js --kill') + chalk.gray('  then npm start'));
console.log('');
console.log(chalk.yellow('⚠️  WARNINGS'));
console.log(chalk.yellow('   • NEVER commit admin-cli/.env — it holds the database master key and the admin password hash.'));
console.log(chalk.yellow('     Check "git status" before "git add ." and leave .env out.'));
console.log(chalk.yellow('   • Never share the admin password in group chats or screenshots.'));
console.log(chalk.yellow('   • 5 wrong passwords lock the login for 15 minutes (restart the tool to reset).'));
console.log(chalk.yellow('   • Everything you do here is recorded with your name (Admin Activity tab) — it cannot be edited or deleted.'));
console.log(chalk.yellow('   • Log out and stop the tool when you are done.'));
console.log('');
if (!hasAdminPassword) {
  console.log(chalk.red.bold('❌ No admin name and password are set on this computer yet.'));
  console.log(chalk.red('   Run ') + chalk.yellow('npm run set-password') + chalk.red(' first, then ') + chalk.yellow('npm start') + chalk.red(' again.'));
  console.log('');
}

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

  // The server prints to this same window (stdio inherit), so it is ready
  // when its health URL answers — checked every half second for 15 s.
  const startedAt = Date.now();
  const waitForServer = setInterval(() => {
    require('http')
      .get(`http://127.0.0.1:${PORT}/api/health`, (res) => {
        res.resume();
        if (res.statusCode !== 200 || serverStarted) return;
        serverStarted = true;
        clearInterval(waitForServer);
        console.log(chalk.green(`\n✅ Server started on port ${PORT}`));
        console.log(chalk.green(`🌐 Opening browser at: http://localhost:${PORT}\n`));
        openBrowser(`http://localhost:${PORT}`);
        console.log(chalk.gray('💡 Press Ctrl+C to stop the server\n'));
      })
      .on('error', () => {});
    if (!serverStarted && Date.now() - startedAt > 15000) {
      clearInterval(waitForServer);
      console.log(chalk.yellow('\n⚠️  Server did not answer within 15 seconds.'));
      console.log(chalk.gray('   Check the output above for errors.\n'));
    }
  }, 500);

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