import { ServerModels } from '@core/types';
import { MongoClient } from 'mongodb';
import * as express from 'express';

interface ServerInit {
    beforeInitAfter?: any
    port?: number;
    models: ServerModels;
    config: ServerConfig;
    db: MongoClient;
}

interface ServerConfig {
    APIDefaultPath?: string;
    SERVER_SOCKET_PORT?: number;
    DB_URI?: string;
    DB_NAME?: string;
    AUTH_SECRET: string;
    AUTH_EXPIRE_TIME: number;
}

interface HookendApplication extends express.Application {
    models?: any;
    config?: any;
    api?: any;
    db?: any;
    auth?: any;
    defaultAuth?: any;
}

interface HookendRequest extends express.Request {
    requestResults: any;
    requestIncluded: any;
    requestErrors: any;
    requestSuccess: any;
    requestedModel: string;
    requestedMeta: any;
    responseDataType: string;
    models: any;
    auth: any;
}

export {
    ServerInit,
    ServerConfig,
    HookendApplication,
    HookendRequest,
};

