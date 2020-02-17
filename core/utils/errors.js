"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("./logger");
exports.default = (data, log = true) => {
    if (log) {
        logger_1.default.error(data.title, {
            service: null,
            code: data.code,
            status: data.status,
        });
    }
    return {
        title: data.title || 'undefined title',
        detail: data.detail || 'undefined detail',
        code: data.code ? data.code.toUpperCase() : 'undefined'.toUpperCase(),
        status: data.status,
        success: data.success,
    };
};
