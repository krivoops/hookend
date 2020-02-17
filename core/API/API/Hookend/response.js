"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (req, res) => {
    res.json({
        success: true,
        data: req.requestResults,
    });
};
