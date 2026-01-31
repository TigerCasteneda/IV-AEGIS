const express = require('express');
const router = express.Router();
const { db, logRequest } = require('../database.js');

// 获取客户端IP地址
function getClientIp(req) {
    return req.headers['x-forwarded-for'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null);
}

// 提交联系表单
router.post('/submit', (req, res) => {
    const { name, email, message } = req.body;
    
    // 验证必填字段
    if (!name || !email || !message) {
        logRequest('/contact/submit', 'POST', 400, 'Missing required fields');
        return res.status(400).json({
            success: false,
            message: 'Please provide all required fields: name, email, message'
        });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        logRequest('/contact/submit', 'POST', 400, 'Invalid email format');
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
        });
    }

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    // 插入数据到数据库
    const sql = `INSERT INTO contacts (name, email, message, ip_address, user_agent) 
                 VALUES (?, ?, ?, ?, ?)`;
    
    db.run(sql, [name, email, message, ipAddress, userAgent], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            logRequest('/contact/submit', 'POST', 500, `Database error: ${err.message}`);
            return res.status(500).json({
                success: false,
                message: 'Failed to save contact information'
            });
        }

        logRequest('/contact/submit', 'POST', 200, 'Contact form submitted successfully');
        res.status(201).json({
            success: true,
            message: 'Thank you for your message! We will get back to you soon.',
            contactId: this.lastID
        });
    });
});

// 获取所有联系信息（仅供管理使用，可以添加认证）
router.get('/list', (req, res) => {
    // 在生产环境中，这里应该添加认证中间件
    const sql = `SELECT id, name, email, message, created_at, status 
                 FROM contacts 
                 ORDER BY created_at DESC 
                 LIMIT 100`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to fetch contacts'
            });
        }

        res.json({
            success: true,
            data: rows,
            count: rows.length
        });
    });
});

// 更新联系状态
router.put('/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'contacted', 'resolved', 'spam'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid status value'
        });
    }

    const sql = `UPDATE contacts SET status = ? WHERE id = ?`;
    db.run(sql, [status, id], function(err) {
        if (err) {
            console.error('Database error:', err.message);
            return res.status(500).json({
                success: false,
                message: 'Failed to update contact status'
            });
        }

        if (this.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }

        res.json({
            success: true,
            message: 'Contact status updated successfully'
        });
    });
});

module.exports = router;