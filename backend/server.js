const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// ========== DDOS防护中间件 ==========

// 1. 请求频率限制器
const requestStore = new Map(); // 存储IP和请求时间戳
const MAX_REQUESTS_PER_WINDOW = 100; // 每窗口期最大请求数
const WINDOW_MS = 15 * 60 * 1000; // 15分钟窗口期
const IP_BLOCK_TIME = 30 * 60 * 1000; // IP封锁30分钟

// 清理过期请求记录
setInterval(() => {
    const now = Date.now();
    for (const [ip, records] of requestStore.entries()) {
        const validRecords = records.filter(time => now - time < WINDOW_MS);
        if (validRecords.length === 0) {
            requestStore.delete(ip);
        } else {
            requestStore.set(ip, validRecords);
        }
    }
}, 60 * 1000); // 每分钟清理一次

// DDOS防护中间件
function ddosProtection(req, res, next) {
    const clientIP = req.headers['x-forwarded-for'] || 
                     req.connection.remoteAddress || 
                     req.socket.remoteAddress ||
                     (req.connection.socket ? req.connection.socket.remoteAddress : 'unknown');
    
    // 获取该IP的请求记录
    const now = Date.now();
    const requests = requestStore.get(clientIP) || [];
    
    // 清理过期的请求记录
    const recentRequests = requests.filter(time => now - time < WINDOW_MS);
    
    // 检查是否超过限制
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        console.warn(`🚨 DDOS防护: IP ${clientIP} 请求过于频繁，已被暂时限制`);
        
        // 记录封锁
        const blockUntil = now + IP_BLOCK_TIME;
        requestStore.set(clientIP + '_blocked', blockUntil);
        
        return res.status(429).json({
            success: false,
            message: '请求过于频繁，请稍后再试',
            retryAfter: Math.ceil(IP_BLOCK_TIME / 1000)
        });
    }
    
    // 检查是否在封锁期内
    const blockedUntil = requestStore.get(clientIP + '_blocked');
    if (blockedUntil && now < blockedUntil) {
        const remainingTime = Math.ceil((blockedUntil - now) / 1000);
        return res.status(429).json({
            success: false,
            message: `IP已被临时限制，请在${remainingTime}秒后重试`,
            retryAfter: remainingTime
        });
    }
    
    // 添加当前请求记录
    recentRequests.push(now);
    requestStore.set(clientIP, recentRequests);
    
    // 添加响应头，显示剩余请求次数
    res.set('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
    res.set('X-RateLimit-Remaining', MAX_REQUESTS_PER_WINDOW - recentRequests.length);
    res.set('X-RateLimit-Reset', Math.ceil((now + WINDOW_MS) / 1000));
    
    next();
}

// 2. 请求体大小限制（防止大数据包攻击）
app.use(bodyParser.json({
    limit: '1mb', // 限制请求体大小为1MB
    verify: (req, res, buf) => {
        // 验证请求体格式
        try {
            JSON.parse(buf.toString());
        } catch (e) {
            throw new Error('无效的JSON格式');
        }
    }
}));

app.use(bodyParser.urlencoded({
    limit: '1mb',
    extended: true,
    parameterLimit: 50 // 限制参数数量
}));

// 3. 请求超时设置
app.use((req, res, next) => {
    req.setTimeout(10000, () => { // 10秒超时
        console.warn(`⏰ 请求超时: ${req.method} ${req.url}`);
        res.status(408).json({
            success: false,
            message: '请求超时，请稍后重试'
        });
    });
    
    res.setTimeout(10000, () => {
        console.warn(`⏰ 响应超时: ${req.method} ${req.url}`);
        if (!res.headersSent) {
            res.status(504).json({
                success: false,
                message: '服务器响应超时'
            });
        }
    });
    
    next();
});

// 4. 请求速率限制（更细粒度的）
const rateLimit = require('express-rate-limit');

// 全局速率限制
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100, // 每个IP限制100次请求
    message: {
        success: false,
        message: '请求过于频繁，请15分钟后再试'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
        return req.headers['x-forwarded-for'] || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : 'unknown');
    }
});

// 联系表单提交的严格限制
const contactFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1小时
    max: 5, // 每个IP每小时只能提交5次
    message: {
        success: false,
        message: '联系表单提交过于频繁，请1小时后再试'
    },
    skipFailedRequests: true // 失败的请求不计入限制
});

// 中间件配置
// 允许的源列表（根据环境动态配置）
const allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL, // 生产环境前端URL
    'https://iv-aegis.vercel.app', // Vercel默认域名
    'https://www.iv-aegis.com' // 如果有自定义域名
].filter(Boolean); // 过滤掉 undefined

app.use(cors({
    origin: function(origin, callback) {
        // 允许没有 origin 的请求（比如移动应用或 Postman）
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
            callback(null, true);
        } else {
            callback(null, true); // 开发阶段先允许所有源，生产环境可以改为 false
        }
    },
    credentials: true,
    methods: ['GET', 'POST'], // 只允许GET和POST方法
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 应用DDOS防护中间件
app.use(ddosProtection);

// 应用全局速率限制（排除健康检查）
app.use((req, res, next) => {
    if (req.path === '/health' || req.path === '/favicon.ico') {
        return next();
    }
    globalLimiter(req, res, next);
});

// 静态文件服务
app.use(express.static(path.join(__dirname, '../frontend'), {
    maxAge: '1h', // 缓存1小时
    setHeaders: (res, path) => {
        // 对HTML文件不缓存
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// 路由
const contactRoutes = require('./routes/contact');
app.use('/api/contact', contactFormLimiter, contactRoutes);

// 健康检查端点（不限制频率）
app.get('/health', (req, res) => {
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'aeshield-backend',
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
        memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
        },
        requestStats: {
            totalIPs: requestStore.size,
            window: `${WINDOW_MS / 60000}分钟`,
            maxRequests: MAX_REQUESTS_PER_WINDOW
        }
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `路由 ${req.originalUrl} 不存在`,
        suggestion: '请检查URL是否正确'
    });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('🚨 服务器错误:', {
        method: req.method,
        url: req.url,
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        error: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        timestamp: new Date().toISOString()
    });
    
    // 根据错误类型返回不同的状态码
    let statusCode = 500;
    let message = '服务器内部错误';
    
    if (err.message.includes('JSON格式')) {
        statusCode = 400;
        message = '请求数据格式错误';
    } else if (err.message.includes('请求体过大')) {
        statusCode = 413;
        message = '请求数据过大';
    }
    
    res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 进程退出时的清理工作
process.on('SIGINT', () => {
    console.log('🔒 正在清理DDOS防护记录...');
    requestStore.clear();
    console.log('👋 服务器优雅退出');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🔒 正在清理DDOS防护记录...');
    requestStore.clear();
    console.log('👋 服务器被终止');
    process.exit(0);
});

// 启动服务器
const server = app.listen(PORT, () => {
    console.log(`✅ AEShield 后端服务器已启动`);
    console.log(`📡 端口: ${PORT}`);
    console.log(`🌐 地址: http://localhost:${PORT}`);
    console.log(`📊 健康检查: http://localhost:${PORT}/health`);
    console.log(`💌 联系接口: http://localhost:${PORT}/api/contact/submit`);
    console.log(`🛡️ DDOS防护已启用: ${MAX_REQUESTS_PER_WINDOW}次请求/${WINDOW_MS/60000}分钟`);
});

// 服务器连接限制（防止连接耗尽）
server.maxConnections = 100; // 最大连接数
server.keepAliveTimeout = 5000; // 5秒keep-alive超时
server.headersTimeout = 10000; // 10秒头超时

// 监控连接数
setInterval(() => {
    server.getConnections((err, count) => {
        if (!err && count > 50) {
            console.log(`⚠️  当前连接数: ${count}，接近限制`);
        }
    });
}, 30000); // 每30秒检查一次