"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const API_1 = require("@core/API");
const logger_1 = require("@core/utils/logger");
class Hookend {
    constructor(data) {
        this.port = 1337;
        this.port = data.port || this.port;
        this.app = express();
        this.app.models = {};
        this.app.config = data.config;
        this.api = new API_1.default(this.app);
        this.api.initBefore();
        Object.keys(data.models).forEach((model) => {
            this.app.models[model] = new data.models[model]({
                app: this.app,
                db: data.db.db(data.config.DB_NAME),
                api: this.api,
            });
        });
        this.app.auth.method.toGenerateDependencies();
        if (data.beforeInitAfter) {
            data.beforeInitAfter.call(this);
        }
        this.api.initAfter();
        this.listen();
        return this;
    }
    listen() {
        this.app.listen(this.port, () => {
            logger_1.default.info(`Hookend meets you on ${this.port} port`, {
                service: 'Server',
            });
        });
    }
}
exports.Hookend = Hookend;
