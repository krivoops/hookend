"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = require("winston");
const logger = winston_1.createLogger({
    level: 'info',
    format: winston_1.format.combine(winston_1.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
    }), winston_1.format.errors({ stack: true }), winston_1.format.splat(), winston_1.format.json()),
    defaultMeta: { service: 'your-service-name' },
    transports: [
        new winston_1.transports.File({ filename: 'hookend-errors.log', level: 'error' }),
        new winston_1.transports.File({ filename: 'hookend.log' }),
    ],
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.transports.Console({
        format: winston_1.format.combine(winston_1.format.colorize(), winston_1.format.simple()),
    }));
}
exports.default = logger;
