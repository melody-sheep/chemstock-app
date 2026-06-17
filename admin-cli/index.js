#!/usr/bin/env node

// admin-cli/index.js
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');
const chalk = require('chalk');
const Table = require('cli-table3');
const { generateSecureActivationCode, generateSecurePassword } = require('./utils/crypto');

// ============================================
// SUPABASE CONFIG
// ============================================
const supabase = createClient(
  'https://nxxsjbmuetgamcvfajhl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54eHNqYm11ZXRnYW1jdmZhamhsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTEwNDU2NCwiZXhwIjoyMDk2NjgwNTY0fQ.HGR2OWl3YboCgk2LrGMCHw0xi3C4RDJrMIaQf-Anmek'
);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

// ============================================
// UI FUNCTIONS
// ============================================
function clearScreen() {
  console.clear();
}

function showHeader() {
  console.log(chalk.cyan(`
╔══════════════════════════════════════════════════════════════╗
║     CHEＭSTOCK ADMIN CLI v2.0                                ║
║     Secure Activation Key Management                        ║
╚══════════════════════════════════════════════════════════════╝
`));
}

function showMenu() {
  console.log(chalk.white(`
┌────────────────────────────────────────────────────────────┐
│  📋 MAIN MENU                                             │
├────────────────────────────────────────────────────────────┤
│  ${chalk.green('1.')} 🔑 Generate New Activation Key                        │
│  ${chalk.green('2.')} 📋 List All Activation Keys                           │
│  ${chalk.green('3.')} 🔒 Revoke Activation Key                              │
│  ${chalk.green('4.')} 📊 Show Database Stats                                │
│  ${chalk.red('0.')} ❌ Exit                                               │
└────────────────────────────────────────────────────────────┘
`));
}

function showSubMenu() {
  console.log(chalk.white(`
┌────────────────────────────────────────────────────────────┐
│  📋 ACTIVATION KEY OPTIONS                                │
├────────────────────────────────────────────────────────────┤
│  ${chalk.green('1.')} 🎲 Auto-generate secure key (recommended)            │
│  ${chalk.green('2.')} ✏️  Manually enter custom key                         │
│  ${chalk.red('0.')} 🔙 Back to main menu                                  │
└────────────────────────────────────────────────────────────┘
`));
}

// ============================================
// CORE FUNCTIONS - FIXED to use 'activation_keys'
// ============================================

async function generateActivationKey() {
  clearScreen();
  showHeader();
  showSubMenu();

  const choice = await question(chalk.cyan('\n📌 Select option: '));

  let activationCode = '';

  if (choice === '1') {
    activationCode = generateSecureActivationCode(16);
    console.log(chalk.green(`\n✅ Auto-generated secure key: ${chalk.yellow(activationCode)}`));
  } else if (choice === '2') {
    activationCode = await question(chalk.cyan('\n✏️  Enter custom activation key: '));
    if (!activationCode.trim() || activationCode.trim().length < 4) {
      console.log(chalk.red('❌ Key must be at least 4 characters.'));
      await question(chalk.gray('\nPress Enter to continue...'));
      return;
    }
    activationCode = activationCode.trim();
  } else {
    return;
  }

  console.log(chalk.cyan('\n📋 Enter manager details:\n'));

  const managerName = await question(chalk.white('   👤 Manager full name: '));
  if (!managerName.trim()) {
    console.log(chalk.red('❌ Manager name is required.'));
    await question(chalk.gray('\nPress Enter to continue...'));
    return;
  }

  const managerEmail = await question(chalk.white('   📧 Manager email: '));
  if (!managerEmail.trim() || !managerEmail.includes('@')) {
    console.log(chalk.red('❌ Valid email is required.'));
    await question(chalk.gray('\nPress Enter to continue...'));
    return;
  }

  const branchNamesInput = await question(chalk.white('   🏢 Branch names (comma separated, e.g., "Cagayan de Oro, Butuan"): '));
  const branchNames = branchNamesInput.split(',').map(s => s.trim()).filter(Boolean);
  if (branchNames.length === 0) {
    console.log(chalk.red('❌ At least one branch is required.'));
    await question(chalk.gray('\nPress Enter to continue...'));
    return;
  }

  const branchLocationsInput = await question(chalk.white('   📍 Branch locations (comma separated, matching order): '));
  const branchLocations = branchLocationsInput.split(',').map(s => s.trim()).filter(Boolean);

  while (branchLocations.length < branchNames.length) {
    branchLocations.push('');
  }

  const daysValid = await question(chalk.white('   📅 Days until expiration (default 30): '));
  const days = parseInt(daysValid) || 30;

  const includePassword = await question(chalk.white('   🔐 Generate secure manager password? (y/n): '));
  const generatePassword = includePassword.toLowerCase() === 'y' || includePassword.toLowerCase() === 'yes';

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  console.log(chalk.cyan('\n⏳ Saving to database...'));

  try {
    let password = null;
    if (generatePassword) {
      password = generateSecurePassword(8);
    }

    // ✅ FIXED: Using 'activation_keys' (not activation_keys_table)
    const { data, error } = await supabase
      .from('activation_keys')
      .insert([{
        code: activationCode,
        manager_email: managerEmail.trim(),
        manager_name: managerName.trim(),
        branch_names: branchNames,
        branch_locations: branchLocations,
        expires_at: expiresAt.toISOString(),
        is_used: false
      }])
      .select()
      .single();

    if (error) {
      console.log(chalk.red('❌ Database error:'), error.message);
      await question(chalk.gray('\nPress Enter to continue...'));
      return;
    }

    console.log(chalk.green('\n✅ ACTIVATION KEY CREATED SUCCESSFULLY!\n'));
    console.log(chalk.white('┌────────────────────────────────────────────────────────┐'));
    console.log(chalk.white('│  📋 KEY DETAILS                                       │'));
    console.log(chalk.white('├────────────────────────────────────────────────────────┤'));
    console.log(chalk.yellow(`│  🔑 Code:     ${activationCode.padEnd(30)}│`));
    console.log(chalk.yellow(`│  👤 Manager:  ${managerName.padEnd(30)}│`));
    console.log(chalk.yellow(`│  📧 Email:    ${managerEmail.padEnd(30)}│`));
    console.log(chalk.yellow(`│  🏢 Branches: ${branchNames.join(', ').padEnd(30)}│`));
    console.log(chalk.yellow(`│  📅 Expires:  ${expiresAt.toISOString().split('T')[0].padEnd(30)}│`));
    console.log(chalk.white('├────────────────────────────────────────────────────────┤'));
    if (password) {
      console.log(chalk.green(`│  🔐 PASSWORD: ${password.padEnd(30)}│`));
      console.log(chalk.white('├────────────────────────────────────────────────────────┤'));
      console.log(chalk.gray('│  ⚠️  Save this password securely! It will not be   │'));
      console.log(chalk.gray('│     shown again.                                    │'));
    }
    console.log(chalk.white('└────────────────────────────────────────────────────────┘'));

    console.log(chalk.gray('\n📤 Send this code to the manager:'));
    console.log(chalk.green(`\n   ${activationCode}\n`));

  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }

  await question(chalk.gray('\nPress Enter to continue...'));
}

async function listActivationKeys() {
  clearScreen();
  showHeader();

  console.log(chalk.cyan('📋 LISTING ACTIVATION KEYS\n'));

  const showAll = await question(chalk.white('   Show used keys too? (y/n): '));
  const includeUsed = showAll.toLowerCase() === 'y' || showAll.toLowerCase() === 'yes';

  try {
    // ✅ FIXED: Using 'activation_keys' (not activation_keys_table)
    let query = supabase
      .from('activation_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (!includeUsed) {
      query = query.eq('is_used', false);
    }

    const { data: keys, error } = await query;

    if (error) {
      console.log(chalk.red('❌ Database error:'), error.message);
      await question(chalk.gray('\nPress Enter to continue...'));
      return;
    }

    if (keys.length === 0) {
      console.log(chalk.gray('\n   No activation keys found.'));
      console.log(chalk.gray('   Generate one using option 1.\n'));
      await question(chalk.gray('\nPress Enter to continue...'));
      return;
    }

    const table = new Table({
      head: [
        chalk.cyan('#'),
        chalk.cyan('Code'),
        chalk.cyan('Branches'),
        chalk.cyan('Manager'),
        chalk.cyan('Status'),
        chalk.cyan('Expires')
      ],
      colWidths: [4, 22, 25, 20, 10, 14],
      style: { head: ['cyan'] }
    });

    keys.forEach((key, index) => {
      const status = key.is_used ? chalk.red('USED') : chalk.green('AVAIL');
      const code = key.code.length > 20 ? key.code.substring(0, 17) + '...' : key.code;
      const branches = key.branch_names.join(', ');
      const manager = key.manager_name.length > 18 ? key.manager_name.substring(0, 15) + '...' : key.manager_name;
      const expires = key.expires_at ? new Date(key.expires_at).toISOString().split('T')[0] : 'N/A';

      table.push([
        chalk.gray(index + 1),
        chalk.yellow(code),
        chalk.white(branches),
        chalk.white(manager),
        status,
        chalk.gray(expires)
      ]);
    });

    console.log(table.toString());
    
    const available = keys.filter(k => !k.is_used).length;
    const used = keys.filter(k => k.is_used).length;
    console.log(chalk.gray(`\n   📊 Total: ${keys.length} keys (${chalk.green(available)} available, ${chalk.red(used)} used)`));

  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }

  await question(chalk.gray('\nPress Enter to continue...'));
}

async function revokeActivationKey() {
  clearScreen();
  showHeader();

  console.log(chalk.cyan('🔒 REVOKE ACTIVATION KEY\n'));

  const code = await question(chalk.white('   Enter activation code to revoke: '));

  if (!code.trim() || code.trim().length < 4) {
    console.log(chalk.red('❌ Invalid activation code.'));
    await question(chalk.gray('\nPress Enter to continue...'));
    return;
  }

  try {
    // ✅ FIXED: Using 'activation_keys' (not activation_keys_table)
    const { data, error } = await supabase
      .from('activation_keys')
      .update({ is_used: true, used_at: new Date().toISOString() })
      .eq('code', code.trim())
      .eq('is_used', false)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        console.log(chalk.red('❌ Key not found or already revoked.'));
      } else {
        console.log(chalk.red('❌ Error:'), error.message);
      }
      await question(chalk.gray('\nPress Enter to continue...'));
      return;
    }

    console.log(chalk.green('\n✅ KEY REVOKED SUCCESSFULLY!\n'));
    console.log(chalk.white(`   👤 Manager:  ${data.manager_name}`));
    console.log(chalk.white(`   🏢 Branches: ${data.branch_names.join(', ')}`));

  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }

  await question(chalk.gray('\nPress Enter to continue...'));
}

async function showStats() {
  clearScreen();
  showHeader();

  console.log(chalk.cyan('📊 DATABASE STATISTICS\n'));

  try {
    // ✅ FIXED: Using 'activation_keys' (not activation_keys_table)
    const { data: allKeys, error } = await supabase
      .from('activation_keys')
      .select('*');

    if (error) {
      console.log(chalk.red('❌ Database error:'), error.message);
      await question(chalk.gray('\nPress Enter to continue...'));
      return;
    }

    const total = allKeys.length;
    const available = allKeys.filter(k => !k.is_used).length;
    const used = allKeys.filter(k => k.is_used).length;
    const expired = allKeys.filter(k => k.expires_at && new Date(k.expires_at) < new Date()).length;

    const table = new Table({
      style: { head: ['cyan'] },
      colWidths: [20, 10]
    });

    table.push(
      [chalk.white('📊 Total Keys'), chalk.yellow(total)],
      [chalk.green('✅ Available'), chalk.green(available)],
      [chalk.red('🔒 Used'), chalk.red(used)],
      [chalk.gray('⏰ Expired'), chalk.gray(expired)]
    );

    console.log(table.toString());

    if (allKeys.length > 0) {
      console.log(chalk.cyan('\n📋 RECENT ACTIVITY:'));
      const recent = allKeys.slice(0, 5);
      recent.forEach((key, i) => {
        const status = key.is_used ? chalk.red('USED') : chalk.green('AVAIL');
        console.log(`   ${chalk.gray(i + 1)}. ${chalk.yellow(key.code.substring(0, 12) + '...')} ${status} - ${key.manager_name}`);
      });
    }

  } catch (error) {
    console.log(chalk.red('❌ Error:'), error.message);
  }

  await question(chalk.gray('\nPress Enter to continue...'));
}

// ============================================
// MAIN MENU LOOP
// ============================================
async function main() {
  let running = true;

  while (running) {
    clearScreen();
    showHeader();
    showMenu();

    const choice = await question(chalk.cyan('📌 Select option: '));

    switch (choice) {
      case '1':
        await generateActivationKey();
        break;
      case '2':
        await listActivationKeys();
        break;
      case '3':
        await revokeActivationKey();
        break;
      case '4':
        await showStats();
        break;
      case '0':
        console.log(chalk.green('\n👋 Goodbye!\n'));
        running = false;
        break;
      default:
        console.log(chalk.red('\n❌ Invalid option. Try again.'));
        await question(chalk.gray('\nPress Enter to continue...'));
    }
  }

  rl.close();
}

// ============================================
// START
// ============================================
console.log(chalk.cyan('\n🚀 Starting ChemStock Admin CLI...\n'));
main().catch(console.error);