import { ServerInit, HookendApplication } from '@core/types';
import * as express from 'express';
import API from '@core/API';
import Auth from '@core/Auth';

import logger from '@core/utils/logger';

class Hookend {
    public app: HookendApplication;
    private api: API;
    private port: number = 1337;

    // TODO make sure that db is okay db.db(...) in parametrs of model
    constructor(data: ServerInit) {
        this.port = data.port || this.port;
        this.app = express();
        this.app.models = {};
        this.app.config = data.config;

        this.api = new API(this.app);

        this.api.initBefore();

        this.app.auth = new Auth(this.app, this.api, 'users');
        Object.keys(data.models).forEach((model) => {
            this.app.models[model] = new data.models[model]({
                app: this.app,
                db: data.db.db(data.config.DB_NAME),
                api: this.api,
            });
        });
        this.app.auth.method.toGenerateDependencies();

        if (data.beforeInitAfter) {
            data.beforeInitAfter.call(this)
        }

        this.api.initAfter();

        this.listen();

        return this
    }

    private listen() {
        this.app.listen(this.port, () => {
            logger.info(`Hookend meets you on ${this.port} port`, {
                service: 'Server',
            });
        });
    }
}

export {
    Hookend,
};

