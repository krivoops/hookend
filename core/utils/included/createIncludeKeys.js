"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const object_path_1 = require("object-path");
exports.default = (income) => {
    if (typeof income === 'undefined') {
        return {};
    }
    if (typeof income === 'object' && !Array.isArray(income)) {
        return income;
    }
    income = typeof income === 'string'
        ? income.split(',')
        : income;
    return income.reduce((obj, item) => {
        object_path_1.set(obj, item, {});
        return obj;
    }, {});
};
