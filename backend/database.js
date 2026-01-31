const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 创建数据库连接
const db = new sqlite3.Database(path.join(__dirname, 'db', 'contacts.db'), (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        createTables();
    }
});

// 创建表格
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
            console.error('Error creating contacts table:', err.message);
        } else {
            console.log('Contacts table created or already exists.');
        }
    });

    // 可选：创建日志表
    db.run(`CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT,
        method TEXT,
        status_code INTEGER,
        message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating logs table:', err.message);
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