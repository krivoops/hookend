import { SchemaModel } from './schema';
import { ObjectId } from 'mongodb';
import { Request } from 'express';
import API from '@core/API';

interface ServerModels {
    [s: string]: any;
}

interface ModelConfigureInit {
    modelName: string;
    modelSchema: SchemaModel;
    options?: {
        polymorphic?: boolean,
        polymorphed?: boolean,
        virtual?: boolean,
    },
    methods?: any,
    routes?: any,
    hooks?: any,
    access?: any,
    includeBehavior?: any,
}

interface AppDataInit {
    app: any;
    db: any;
    api: API;
}

interface GetListData {
    ids?: Array<string | ObjectId>;
    sort?: any;
    query?: any; // TODO temporary until querybuilder methods will be realized
    projection?: any;
    included?: any;
    meta?: any;
    req?: Request;
}

interface GetOneData {
    id?: string | ObjectId;
    query?: any; // TODO temporary until querybuilder methods will be realized
    projection?: any;
    req?: Request;
}

interface InsertData {
    data: any
    projection?: any;
    req?: Request;
}

interface DeleteData {
    data: any
    req?: Request;
}

export {
    ServerModels,
    ModelConfigureInit,
    AppDataInit,
    GetListData,
    GetOneData,
    InsertData
};

