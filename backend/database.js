const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs'); // 引入文件系统模块

// ========== 新增：确保数据库目录存在 ==========
const dbDir = path.join(__dirname, 'db');
const dbPath = path.join(dbDir, 'contacts.db');

// 如果 db 文件夹不存在，则创建它
if (!fs.existsSync(dbDir)) {
    console.log(`📁 创建数据库目录: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
}

// ========== 创建数据库连接 ==========
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ 无法打开数据库:', err.message);
    } else {
        console.log(`✅ 已连接到数据库: ${dbPath}`);
        createTables();
    }
});

// ========== 创建数据表（原有逻辑保持不变）==========
function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        status TEXT DEFAULT 'new'
    )`, (err) => {
        if (err) {
            console.error('❌ 创建contacts表失败:', err.message);
        } else {
            console.log('✅ 数据表 `contacts` 就绪');
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT,
        method TEXT,
        status_code INTEGER,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('❌ 创建logs表失败:', err.message);
        }
    });
}

// 日志函数
function logRequest(endpoint, method, statusCode, message) {
    db.run(`INSERT INTO logs (endpoint, method, status_code, message) VALUES (?, ?, ?, ?)`,
        [endpoint, method, statusCode, message]);
}

module.exports = {
    db,
    logRequest
};