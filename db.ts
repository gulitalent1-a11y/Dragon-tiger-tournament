import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

const db = new Database('dragon_tiger.db');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    mobile TEXT UNIQUE,
    password TEXT,
    wallet_balance DECIMAL(10, 2) DEFAULT 1000.00,
    bonus_balance DECIMAL(10, 2) DEFAULT 0.00,
    role TEXT DEFAULT 'user',
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    entry_fee DECIMAL(10, 2),
    prize_pool DECIMAL(10, 2),
    start_time DATETIME,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS game_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dragon_card TEXT,
    tiger_card TEXT,
    winner TEXT,
    total_bets DECIMAL(10, 2),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    round_id INTEGER,
    bet_side TEXT,
    amount DECIMAL(10, 2),
    payout DECIMAL(10, 2) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    amount DECIMAL(10, 2),
    status TEXT DEFAULT 'success',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Default settings
const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
insertSetting.run('profit_margin', '0.05');
insertSetting.run('admin_profit_mode', 'off'); // 'on' or 'off'
insertSetting.run('game_mode', 'auto'); // 'auto' or 'manual'

// Create default admin
const adminPassword = bcrypt.hashSync('admin123', 10);
db.prepare("INSERT OR IGNORE INTO users (username, mobile, password, role) VALUES (?, ?, ?, ?)").run('admin', '9999999999', adminPassword, 'admin');

export default db;
