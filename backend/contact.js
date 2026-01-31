const express = require('express');
const router = express.Router();
const { db, logRequest } = require('../database.js');

// 垃圾内容检测关键词
const SPAM_KEYWORDS = [
    'buy now', 'click here', 'make money', 'get rich', 'viagra',
    'cialis', 'casino', 'lottery', 'credit score', 'debt relief',
    'work from home', 'get paid', 'investment', 'bitcoin', 'crypto'
];

// 邮箱域名黑名单
const EMAIL_BLACKLIST = [
    'tempmail.com', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'yopmail.com', 'trashmail.com'
];

// 验证函数
function validateContactForm(data, req) {
    const errors = [];
    
    // 1. 基础验证
    if (!data.name || data.name.trim().length < 2) {
        errors.push('姓名至少需要2个字符');
    }
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
        errors.push('请输入有效的邮箱地址');
    }
    if (!data.message || data.message.trim().length < 10) {
        errors.push('消息内容至少需要10个字符');
    }
    if (data.message && data.message.length > 5000) {
        errors.push('消息内容不能超过5000字符');
    }
    
    // 2. 垃圾内容检测
    if (data.message) {
        const lowerMessage = data.message.toLowerCase();
        const spamCount = SPAM_KEYWORDS.filter(keyword => 
            lowerMessage.includes(keyword.toLowerCase())
        ).length;
        
        if (spamCount > 2) {
            errors.push('消息内容疑似垃圾信息');
        }
    }
    
    // 3. 邮箱黑名单检查
    if (data.email) {
        const emailDomain = data.email.split('@')[1];
        if (EMAIL_BLACKLIST.includes(emailDomain.toLowerCase())) {
            errors.push('临时邮箱地址不被接受');
        }
    }
    
    // 4. 检查提交频率（同一IP）
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    
    return {
        isValid: errors.length === 0,
        errors,
        ipAddress
    };
}

// 提交联系表单
router.post('/submit', async (req, res) => {
    const { name, email, message } = req.body;
    
    // 验证输入
    const validation = validateContactForm({ name, email, message }, req);
    
    if (!validation.isValid) {
        logRequest('/contact/submit', 'POST', 400, `Validation failed: ${validation.errors.join(', ')}`);
        return res.status(400).json({
            success: false,
            message: '表单验证失败',
            errors: validation.errors
        });
    }
    
    const userAgent = req.headers['user-agent'];
    
    try {
        // 检查是否最近已提交过（防止重复提交）
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        
        db.get(
            `SELECT COUNT(*) as count FROM contacts 
             WHERE email = ? AND created_at > ?`,
            [email, oneHourAgo],
            (err, row) => {
                if (err) {
                    console.error('Database error:', err.message);
                    logRequest('/contact/submit', 'POST', 500, `Database error: ${err.message}`);
                    return res.status(500).json({
                        success: false,
                        message: '服务器内部错误'
                    });
                }
                
                if (row.count > 0) {
                    logRequest('/contact/submit', 'POST', 429, `Too frequent submission from email: ${email}`);
                    return res.status(429).json({
                        success: false,
                        message: '您最近已经提交过表单，请稍后再试'
                    });
                }
                
                // 插入数据
                const sql = `INSERT INTO contacts (name, email, message, ip_address, user_agent, status) 
                             VALUES (?, ?, ?, ?, ?, ?)`;
                
                db.run(sql, [name.trim(), email.trim(), message.trim(), validation.ipAddress, userAgent, 'new'], function(err) {
                    if (err) {
                        console.error('Database insert error:', err.message);
                        logRequest('/contact/submit', 'POST', 500, `Insert error: ${err.message}`);
                        return res.status(500).json({
                            success: false,
                            message: '提交失败，请稍后重试'
                        });
                    }
                    
                    logRequest('/contact/submit', 'POST', 201, `Contact form submitted successfully - ID: ${this.lastID}`);
                    
                    // 记录成功提交（用于频率限制统计）
                    req.rateLimitKey = validation.ipAddress;
                    
                    res.status(201).json({
                        success: true,
                        message: '感谢您的留言！我们会尽快回复您。',
                        contactId: this.lastID,
                        timestamp: new Date().toISOString()
                    });
                });
            }
        );
    } catch (error) {
        console.error('Contact form submission error:', error);
        logRequest('/contact/submit', 'POST', 500, `Server error: ${error.message}`);
        res.status(500).json({
            success: false,
            message: '服务器内部错误'
        });
    }
});

// 获取统计数据（需要认证，这里简化处理）
router.get('/stats', (req, res) => {
    // 简单的API密钥验证
    const apiKey = req.headers['x-api-key'];
    if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
        return res.status(401).json({
            success: false,
            message: '未授权访问'
        });
    }
    
    db.get(
        `SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN status = 'new' THEN 1 END) as pending,
            COUNT(CASE WHEN created_at > datetime('now', '-1 day') THEN 1 END) as last24h,
            COUNT(DISTINCT ip_address) as unique_ips
         FROM contacts`,
        [],
        (err, row) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: '获取统计失败'
                });
            }
            
            res.json({
                success: true,
                data: row
            });
        }
    );
});

module.exports = router;