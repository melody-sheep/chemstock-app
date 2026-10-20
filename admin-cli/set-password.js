#!/usr/bin/env node
// admin-cli/set-password.js
// Sets who the admin is on THIS computer and the admin password. Saves the
// name and a scrypt hash (never the password itself) in admin-cli/.env.
// Run: npm run set-password

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const { hashPassword } = require('./utils/passwordHash');

const ENV_PATH = path.join(__dirname, '.env');
const MIN_PASSWORD = 8;
const WIDTH = 64;
const NEWLINE = /\r?\n/;
const line = (char = '─') => char.repeat(WIDTH);

const COMMON = ['password', 'qwerty', 'admin', '12345678', 'chemstock', 'letmein', 'welcome'];

function strengthOf(password) {
  const checks = [
    { ok: password.length >= MIN_PASSWORD, label: `${MIN_PASSWORD}+ characters` },
    { ok: /[a-z]/.test(password) && /[A-Z]/.test(password), label: 'upper & lower case' },
    { ok: /[0-9]/.test(password), label: 'a number' },
    { ok: /[^A-Za-z0-9]/.test(password), label: 'a symbol' },
    { ok: !COMMON.some((w) => password.toLowerCase().includes(w)) || password.length >= 14, label: 'not an obvious word' },
  ];
  const score = checks.filter((c) => c.ok).length;
  const label = score <= 2 ? chalk.red('Weak') : score <= 3 ? chalk.yellow('Okay') : chalk.green('Strong');
  return { checks, label };
}

function header() {
  if (process.stdout.isTTY) console.clear();
  console.log(chalk.cyan(`╔${line('═')}╗`));
  console.log(chalk.cyan('║') + chalk.bold.white('  CHEMSTOCK ADMIN · Set up this computer'.padEnd(WIDTH)) + chalk.cyan('║'));
  console.log(chalk.cyan(`╚${line('═')}╝`));
  console.log(chalk.gray('  Sets who you are and the password for the admin tool on THIS'));
  console.log(chalk.gray('  computer only. Your password is saved as a hash, never as text.'));
  console.log(chalk.gray('  Press Ctrl+C at any time to cancel.\n'));
}

function step(n, title, hint, visible) {
  console.log(chalk.bold.cyan(`STEP ${n} of 3 · ${title}`) + '   ' + (visible ? chalk.bgYellow.black(' VISIBLE ') : chalk.bgGreen.black(' HIDDEN ')));
  console.log(chalk.gray(`  ${hint}`));
}

const cancel = () => {
  console.log(chalk.yellow('\n\nCancelled. Nothing was changed.'));
  process.exit(0);
};

// Without a keyboard (input piped in, e.g. in a test) every answer is one
// line of the piped text, read once.
let pipedLines = null;
const nextPipedLine = () => {
  if (pipedLines === null) pipedLines = fs.readFileSync(0, 'utf8').split(NEWLINE);
  return pipedLines.length ? pipedLines.shift() : '';
};

// Visible text input (the name).
function askVisible(prompt) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      process.stdout.write(chalk.bold.white(`  ${prompt} `));
      const answer = nextPipedLine().trim();
      process.stdout.write(`${answer}\n`);
      resolve(answer);
      return;
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('SIGINT', () => {
      rl.close();
      cancel();
    });
    rl.question(chalk.bold.white(`  ${prompt} `), (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Hidden input: a • for every character, backspace works, paste works.
function askHidden(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(chalk.bold.white(`  ${prompt} `));
    if (!process.stdin.isTTY) {
      process.stdout.write('\n');
      resolve(nextPipedLine());
      return;
    }
    let value = '';
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onKey = (chunk, key) => {
      if (key && key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKey);
        cancel();
        return;
      }
      if (key && (key.name === 'return' || key.name === 'enter')) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('keypress', onKey);
        process.stdout.write('\n');
        resolve(value);
        return;
      }
      if (key && key.name === 'backspace') {
        if (value.length) {
          value = value.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      if (chunk && !(key && (key.ctrl || key.meta)) && chunk >= ' ') {
        value += chunk;
        process.stdout.write(chalk.gray('•'.repeat(chunk.length)));
      }
    };
    process.stdin.on('keypress', onKey);
  });
}

// Pick one option: arrow keys + Enter, or press its number.
function askChoice(options) {
  return new Promise((resolve) => {
    const draw = (index, first) => {
      if (!first) process.stdout.write(`\x1b[${options.length}A`);
      options.forEach((text, i) => {
        const on = i === index;
        process.stdout.write(`\x1b[2K${on ? chalk.cyan('  ❯ ') : '    '}${chalk.gray(`${i + 1}.`)} ${on ? chalk.bold.white(text) : chalk.white(text)}\n`);
      });
    };
    if (!process.stdin.isTTY) {
      const answer = nextPipedLine().trim();
      const byNumber = Number(answer);
      const index = Number.isInteger(byNumber) && byNumber >= 1 && byNumber <= options.length
        ? byNumber - 1
        : options.findIndex((o) => o.toLowerCase() === answer.toLowerCase());
      options.forEach((text, i) => process.stdout.write(`    ${i + 1}. ${text}\n`));
      process.stdout.write(`  Chosen: ${index >= 0 ? options[index] : answer}\n`);
      resolve(index >= 0 ? index : options.length - 1);
      return;
    }
    let index = 0;
    draw(index, true);
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    const onKey = (chunk, key) => {
      if (key && key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKey);
        cancel();
        return;
      }
      if (key && key.name === 'up') index = (index + options.length - 1) % options.length;
      else if (key && key.name === 'down') index = (index + 1) % options.length;
      else if (chunk && /^[1-9]$/.test(chunk) && Number(chunk) <= options.length) index = Number(chunk) - 1;
      else if (key && (key.name === 'return' || key.name === 'enter')) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('keypress', onKey);
        resolve(index);
        return;
      }
      draw(index, false);
    };
    process.stdin.on('keypress', onKey);
  });
}

async function askName() {
  const team = require('./config/team');
  step(1, 'WHO ARE YOU?', 'Pick your name (↑ ↓ then Enter, or press its number). It is saved with everything you do.', true);
  const options = [...team, 'Someone else (type a name)'];
  const picked = await askChoice(options);
  if (picked < team.length) return team[picked];

  for (let tries = 0; tries < 3; tries += 1) {
    console.log('');
    const name = await askVisible('Your name ›');
    if (/[!@#$%^&*()+=<>{}[\]\\|~`]/.test(name)) {
      console.log(chalk.red('  ✖ That looks like a password, not a name. This field is VISIBLE — type your name only.\n'));
      continue;
    }
    if (name.length >= 2 && name.length <= 40) return name;
    console.log(chalk.red('  ✖ Use 2–40 characters (a name, not a password).\n'));
  }
  console.log(chalk.red('\nToo many tries. Run npm run set-password again.'));
  process.exit(1);
  return null;
}

async function askPassword(name) {
  for (let tries = 0; tries < 3; tries += 1) {
    console.log('');
    step(2, 'PASSWORD', `At least ${MIN_PASSWORD} characters. Typing is hidden (shows •). Don't reuse another password.`, false);
    const password = await askHidden('Password ›');
    if (password.length < MIN_PASSWORD) {
      console.log(chalk.red(`  ✖ Too short — use at least ${MIN_PASSWORD} characters.`));
      continue;
    }
    if (name.length >= 4 && password.toLowerCase().includes(name.toLowerCase())) {
      console.log(chalk.red('  ✖ The password must not contain your name.'));
      continue;
    }
    const { checks, label } = strengthOf(password);
    console.log(`  Strength: ${label}   ` + checks.map((c) => (c.ok ? chalk.green(`✔ ${c.label}`) : chalk.gray(`✖ ${c.label}`))).join('  '));

    console.log('');
    step(3, 'CONFIRM', 'Type the same password again.', false);
    const again = await askHidden('Confirm ›');
    if (again === password) return password;
    console.log(chalk.red('  ✖ The two passwords are different. Let’s try again.'));
  }
  console.log(chalk.red('\nToo many tries. Run npm run set-password again.'));
  process.exit(1);
  return null;
}

function save(name, password) {
  let env = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const put = (key, value, comment) => {
    const row = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    env = pattern.test(env) ? env.replace(pattern, () => row) : `${env.replace(/\s*$/, '')}\n\n# ${comment}\n${row}\n`;
  };
  put('ADMIN_NAME', name, 'Who this computer’s admin is (shown in the activity log)');
  put('ADMIN_PASSWORD_HASH', hashPassword(password), 'Admin login (hash only — set with: npm run set-password)');
  fs.writeFileSync(ENV_PATH, env);
}

(async () => {
  header();
  const name = await askName();
  const password = await askPassword(name);
  save(name, password);

  console.log('');
  console.log(chalk.green(`╔${line('═')}╗`));
  console.log(chalk.green('║') + chalk.bold.white(`  ✔ Saved for ${name}`.padEnd(WIDTH)) + chalk.green('║'));
  console.log(chalk.green(`╚${line('═')}╝`));
  console.log(chalk.white('  Next:  ') + chalk.yellow('npm start') + chalk.gray('   then log in with the password you just set.'));
  console.log(chalk.gray('  Forgot it later? Run npm run set-password again.\n'));
})();
