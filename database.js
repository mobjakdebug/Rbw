const axios = require('axios');

const API_URL = process.env.PLUGIN_API_URL || 'http://localhost:8080/api/query';
const API_KEY = process.env.API_KEY;

// Input validation
const ALLOWED_TABLES = new Set(['stats', 'users', 'matches', 'bans']); // Add your actual table names
const ALLOWED_OPERATIONS = new Set(['find', 'findOne', 'updateOne', 'insertOne', 'deleteOne', 'deleteMany', 'raw']);

// Custom error classes
class DatabaseError extends Error {
    constructor(message, code = 'DB_ERROR') {
        super(message);
        this.name = 'DatabaseError';
        this.code = code;
    }
}

class ValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}

if (!API_KEY) {
    throw new DatabaseError('API_KEY environment variable is required', 'CONFIG_ERROR');
}

// Input validation functions
function validateTableName(table) {
    if (!ALLOWED_TABLES.has(table)) {
        throw new ValidationError(`Invalid table name: ${table}`);
    }
}

function validateOperation(operation) {
    if (!ALLOWED_OPERATIONS.has(operation)) {
        throw new ValidationError(`Invalid operation: ${operation}`);
    }
}

function sanitizeSQLValue(value) {
    if (typeof value === 'string') {
        // Basic SQL injection prevention
        return value.replace(/['";]/g, '');
    }
    return value;
}

async function executeQuery(sql, params = []) {
    try {
        // Sanitize parameters
        const sanitizedParams = params.map(sanitizeSQLValue);
        
        const response = await axios.post(API_URL, {
            sql,
            params: sanitizedParams
        }, {
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY
            },
            timeout: 5000 // Add timeout
        });

        return response.data;
  } catch (error) {
        if (error.response) {
            // Handle API errors
            throw new DatabaseError(
                'Database operation failed',
                'API_ERROR',
                { status: error.response.status, data: error.response.data }
            );
        } else if (error.request) {
            // Handle network errors
            throw new DatabaseError('Database connection failed', 'NETWORK_ERROR');
        } else {
            // Handle other errors
            throw new DatabaseError('Database operation failed', 'UNKNOWN_ERROR');
        }
    }
}

async function initializeDatabase() {
    try {
        console.log('Connected to remote database at:', API_URL);
        // Test connection
        await executeQuery('SELECT 1');
        return true;
  } catch (error) {
        throw new DatabaseError('Failed to initialize database', 'INIT_ERROR');
  }
}

async function initDatabase() {
    // Tables are managed by the plugin
    return Promise.resolve();
}

async function query(table, operation, ...args) {
    try {
        validateTableName(table);
        validateOperation(operation);

        switch (operation) {
        case 'find': {
            const where = args[0] ? Object.keys(args[0]).map(k => `${k} = ?`).join(' AND ') : '1=1';
            const values = args[0] ? Object.values(args[0]) : [];
            const result = await executeQuery(`SELECT * FROM ${table} WHERE ${where}`, values);
            return result.results || [];
        }
        case 'findOne': {
            const where = args[0] ? Object.keys(args[0]).map(k => `${k} = ?`).join(' AND ') : '1=1';
            const values = args[0] ? Object.values(args[0]) : [];
            const result = await executeQuery(`SELECT * FROM ${table} WHERE ${where} LIMIT 1`, values);
            return (result.results || [])[0];
        }
        case 'updateOne': {
            const set = Object.keys(args[1].$set).map(k => `${k} = ?`).join(', ');
            const setValues = Object.values(args[1].$set);
            const where = Object.keys(args[0]).map(k => `${k} = ?`).join(' AND ');
            const whereValues = Object.values(args[0]);
            const result = await executeQuery(
                `UPDATE ${table} SET ${set} WHERE ${where}`,
                [...setValues, ...whereValues]
            );
            return { modifiedCount: result.affectedRows };
        }
        case 'insertOne': {
            const keys = Object.keys(args[0]);
            const values = Object.values(args[0]);
            const placeholders = keys.map(() => '?').join(', ');
            const result = await executeQuery(
                `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
                values
            );
            return { insertId: result.lastInsertId };
        }
          case 'deleteOne':
        case 'deleteMany': {
            const where = Object.keys(args[0]).map(k => `${k} = ?`).join(' AND ');
            const values = Object.values(args[0]);
            const result = await executeQuery(
                `DELETE FROM ${table} WHERE ${where}`,
                values
            );
            return { deletedCount: result.affectedRows };
        }
        case 'raw': {
            const result = await executeQuery(args[0], args[1] || []);
            return result.results || [];
        }
          default:
            throw new ValidationError(`Unsupported operation: ${operation}`);
      }
    } catch (error) {
        if (error instanceof ValidationError) {
            throw error;
        }
        throw new DatabaseError(
            'Query execution failed',
            'QUERY_ERROR',
            { originalError: error.message }
        );
    }
}

module.exports = {
    query,
    initializeDatabase,
    initDatabase,
    DatabaseError,
    ValidationError
};