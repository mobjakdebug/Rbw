const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { query, DatabaseError, ValidationError } = require('./database');

const app = express();

// Security middleware
app.use(helmet()); // Add security headers
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'x-api-key']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests',
        message: 'Please try again later'
    }
});
app.use(limiter);

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
};
app.use(requestLogger);

app.use(express.json({
    limit: '1mb', // Limit payload size
    strict: true // Only accept arrays and objects
}));

// Authentication middleware
const authenticate = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Missing API key'
        });
    }
    if (apiKey !== process.env.API_KEY) {
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Invalid API key'
        });
    }
    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Server error:', err);

    if (err instanceof DatabaseError) {
        return res.status(500).json({
            error: 'Database Error',
            code: err.code,
            message: 'An error occurred while processing your request'
        });
    }

    if (err instanceof ValidationError) {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    }

    // Handle express validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message
        });
    }

    // Default error
    res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred'
    });
};

// Health check endpoint with metrics
app.get('/', (req, res) => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        database: {
            url: process.env.PLUGIN_API_URL || 'http://localhost:8080/api/query',
            status: 'connected'
        }
    };
    res.json(health);
});

// Database endpoints
app.get('/query', authenticate, (req, res) => {
    res.status(405).json({ 
        error: 'Method Not Allowed',
        message: 'This endpoint only accepts POST requests',
        example: {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'your-api-key'
            },
            body: {
                table: 'stats',
                operation: 'find',
                args: { discord_id: '123456789' }
            }
        }
    });
});

app.post('/query', authenticate, async (req, res, next) => {
    try {
        const { table, operation, ...args } = req.body;
        
        if (!table || !operation) {
            throw new ValidationError('Missing required parameters: table and operation');
        }

        const result = await query(table, operation, ...Object.values(args));
        res.json(result);
    } catch (error) {
        next(error); // Pass to error handler
    }
});

// Apply error handling middleware last
app.use(errorHandler);

// Graceful shutdown
const server = app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
    console.log(`Database server running on port ${process.env.PORT || 3000}`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Starting graceful shutdown...');
    server.close(() => {
        console.log('Server closed. Exiting process...');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Starting graceful shutdown...');
    server.close(() => {
        console.log('Server closed. Exiting process...');
        process.exit(0);
    });
});

module.exports = app; 