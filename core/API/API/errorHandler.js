"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../../utils/logger");
const errors_1 = require("../../utils/errors");
const createError = (req, data, next) => {
    const message = `${data.model}/${data.method} errored`;
    const code = 'UNDEFINED_ERROR';
    if (!data.error) {
        data.error = {};
    }
    if (!data.code) {
        data.code = code;
    }
    logger_1.default.error(message, {
        service: data.service || 'Model',
        model: data.model,
        method: data.method,
        detail: data.detail,
        status: data.status,
        code: data.code,
        error: {
            message: data.error.message,
            line: data.error.lineNumber,
            file: data.error.fileName,
        },
    });
    try {
        console.log(data.error);
    }
    catch (e) {
        console.log(data.error);
    }
    const result = errors_1.default({
        title: message,
        detail: data.detail,
        status: data.status,
        success: false,
        code: data.code,
    }, false);
    if (req) {
        req.requestErrors.push(result);
        if (next) {
            next();
        }
    }
    return result;
};
exports.createError = createError;
