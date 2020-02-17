import {ModelConfigureInit, AppDataInit, GetListData, GetOneData, InsertData} from '@core/types';
import { Schema, defaultModelView } from '@core/Model/Schema';
import { mongoListRequest } from './decorators';
import API from '@core/API';
import * as plural from 'plural';

import {createError} from "@core/API/API/errorHandler";
import {ObjectId} from "bson";

const modelOptions = {
    polimorphic: false,
    polimorphed: false,
    vairtual: false,
};

const defaultAccess = {
    get_list: true,
    get_one: true,
    insert: 'auth',
    update: 'auth',
    delete: 'auth',
};

const performIds = (id: string | ObjectId) => {
    if (typeof id === 'object') {
        return id;
    }
    try {
        return id && id.length !== 12 ? new ObjectId(id) : id ? id : new ObjectId();
    } catch (e) {
        return id;
    }
};

class DataController {
    readonly _app: any;
    readonly app: any;
    readonly _initData: any;
    readonly _fields: any = {};
    readonly _methods: any = {};
    readonly modelName: string;
    readonly modelNameInit: string;
    readonly modelSchema: any;
    readonly defaultModelView: any;
    readonly collection: any;
    readonly includeBehavior: any;
    public _id: any;
    readonly hooks: any;

    constructor(data, { app, methods, modelName, modelNameInit, modelSchema, defaultModelView, collection, hooks, includeBehavior }) {
        this._app = app;
        this.app = app;
        this._initData = data;
        this.modelName = modelName;
        this.modelNameInit = modelNameInit;
        this.modelSchema = modelSchema;
        this.defaultModelView = defaultModelView;
        this.collection = collection;
        this.hooks = hooks;
        this.includeBehavior = includeBehavior;
        if (!data) {
            return
        }
        this._fields._id = performIds(data._id);
        this._id = performIds(data._id);
        Object.keys(this.defaultModelView).forEach((key) => {
            this._fields[key] = data[key] || this.defaultModelView[key];
            this[key] = data[key] || this.defaultModelView[key]
        });

        methods = this.initAddtionalsMehods(methods);
        Object.keys(methods).forEach((method) => {
            this._methods[method] = methods[method].bind(this);
            this[method] = this._methods[method]
        })
    }

    private initAddtionalsMehods(methods) {
        methods.insert = async (options?) => {
            let recursionExit = false;
            const modifiedData = await this.initHook('beforeInsert', this._fields, options);

            if(!modifiedData || modifiedData._error) {
                throw {
                    _id: this._fields._id,
                    error: modifiedData._error
                }
            }

            Object.keys(modifiedData).forEach((key) => {
                this._fields[key] = modifiedData[key];
                this[key] = modifiedData[key]
            });

            if (typeof modifiedData._search !== 'undefined') {
                modifiedData._search = Object.keys(this.modelSchema).filter((key) => {
                    return this.modelSchema[key].searchable
                }).map((key) => {
                    return modifiedData[key]
                });

                modifiedData._search = modifiedData._search.join(' ')
            }

            // TODO refactor this
            const autoIncrementInsert = async (err?, counter = 0) => {
                if (err && err.code !== 11000) {
                    return {
                        result: {
                            ok: false
                        }
                    }
                }

                if (err) {
                    const key = err.errmsg.match(/[a-zA-Z0-9]+\/unique/g)[0].split('/')[0];
                    let result = `${this._fields[key]}_${counter}`;
                    result = result.replace(`_${counter - 1}`, '');
                    if (this.modelSchema[key].uniqueFix) {
                        this._fields[key] = result;
                        this[key] = result;
                    } else {
                        recursionExit = true
                    }

                }

                return this.collection.insertOne(this._fields)
            };

            let counter = 0;
            const recursion = async (e?, counterToUse?) => await autoIncrementInsert(e, counterToUse)
                .then(res => res)
                .catch(async (err) => {
                    if (!recursionExit) {
                        counter++;
                        return recursion(err, counter)
                    }

                    let error:any = {
                        detail: {}
                    };
                    if (err && err.code !== 11000) {
                        return {
                            result: {
                                ok: false
                            },
                            error
                        }
                    }

                    if (err) {
                        const key = err.errmsg.match(/[a-zA-Z0-9]+\/unique/g)[0].split('/')[0];
                        error.detail.title = `Not unique`;
                        error.detail.field = key;
                        error.detail.description = `This field is not unique: ${key}`;
                        error.code = 'NOT_UNIQUE'
                    }

                    return {
                        result: {
                            ok: 0
                        },
                        error,
                    }
                });

            const result = await recursion();
            if (result.result.ok) {
                this._id = result.insertedId;

                await this.initHook('onInsert', {
                    _id: this._id,
                    ...this._fields
                }, options);

                return this._id;
            }

            throw {
                _id: this._fields._id,
                error:result.error,
            }
        };

        methods.update = async (updateData, options?) => {
            // TODO here validate + access + updatedTime
            const currState = await this.collection.findOne({ _id: this._id});

            if (currState) {
                updateData = await this.initHook('beforeUpdate', {
                    _id: this._id,
                    ...currState,
                    ...updateData
                }, options, currState);
                delete updateData._id;

                if (typeof updateData._search !== 'undefined') {
                    updateData._search = Object.keys(this.modelSchema).filter((key) => {
                        return this.modelSchema[key].searchable
                    }).map((key) => {
                        return updateData[key]
                    });

                    updateData._search = updateData._search.join(' ')
                }

                const result = await this.collection.updateOne({_id: this._id,}, {$set: updateData});

                if (result.result.ok) {
                    // TODO refactor to not duplicate code in constructor
                    this.changeFields(updateData);

                    if (result.result.ok) {
                        // TODO - handle errors somehow
                        await this.initHook('onUpdate', {
                            _id: this._id,
                            ...updateData
                        }, options, currState);
                        return this._id;
                    }

                    return this._id;
                }
            }

            throw {
                _id: this._fields._id
            }
        };

        methods.delete = async (options) => {
            await this.initHook('beforeDelete', this._fields, options);
            const result = await this.collection.deleteOne({ _id: this._id, }, true);
            if (result.result.ok) {
                // TODO - handle errors somehow
                if (options.await) {
                    await this.initHook('onDelete', this._fields);
                } else {
                    this.initHook('onDelete', this._fields);
                }
                return this._id;
            }

            throw {
                _id: this._fields._id
            }
        };

        return methods
    }

    public changeFields(changes) {
        Object.keys(changes).forEach((key) => {
            if (typeof this._fields[key] === 'undefined') {
                return
            }
            this._fields[key] = changes[key];
            this[key] = changes[key]
        });
    }

    public clearData(included = {}, data) {
        Object.keys(data).forEach((schemaKey) => {
            if (schemaKey !== '_id' && this.modelSchema[schemaKey].onlyInclude && !included[schemaKey]) {
                delete data[schemaKey]
            }
        });

        return data
    }

    public async initHook(hookName, data, additionals = {}, oldDoc?) {
        if (!this.hooks[hookName] || this.includeBehavior) {
            return data
        }

        try {
            return await this.hooks[hookName].call(this, data, additionals, oldDoc)
        } catch (e) {
            console.log(e)
            return data
        }
    }
}

export class Model extends Schema {
    public app: any;
    public api: API;
    public modelNameSingle: string;
    public modelName: string;
    public modelNameInit: string;
    public modelSchema: any;
    public modelOptions: any;
    public defaultModelView: any;
    public collection: any;
    public methods: any = {};
    public routes: any = {};
    public hooks: any = {};
    public includeBehavior: any = null;
    readonly access = defaultAccess;

    constructor({ app, db, api }: AppDataInit, { modelName, modelSchema, options, methods = {}, routes = {}, hooks = {}, access = {}, includeBehavior = null}: ModelConfigureInit) {
        super();

        options = {
            ...modelOptions,
            ...options,
        };
        this.modelName = plural(modelName);
        this.modelNameInit = modelName;
        this.modelSchema = modelSchema;
        this.modelOptions = options;

        const isWithSearchable = Object.keys(this.modelSchema).filter((key) => {
            return this.modelSchema[key].searchable
        });

        if (isWithSearchable.length) {
            this.modelSchema._search = Model.attr('string')
        }

        this.defaultModelView = defaultModelView(modelSchema, this);
        this.collection = db.collection(this.modelName);
        this.methods = methods || {};
        this.routes = routes || {};
        this.hooks = hooks || {};
        this.access = {
            ...this.access,
            ...access
        };
        this.includeBehavior = includeBehavior;

        this.app = app;
        this.api = api;

        this.createIndexes(this.modelSchema, this.collection);
        this.api.initModelRoutes(this);
    }

    private async createIndexes(schema, collection) {
        let indexes = await collection.stats().catch(e => false);
        if (!indexes) {
            return
        }
        Object.keys(schema).forEach((schemaKey) => {
            const indexName = `${schemaKey}/unique`;
            if (schema[schemaKey].unique && !indexes.indexDetails[indexName]) {
                collection.createIndex({[schemaKey]: 1}, {unique: true, name: indexName})
                    .catch(e => {
                        createError(null, {
                            model: this.modelName,
                            method: 'createIndex',
                            status: 422,
                            detail: e.errmsg,
                            code: e.errmsg ? e.errmsg.split(' ')[0] : 'UNDEFINED'
                        });
                    })
            }
        })
    }

    public clearData(included = {}, data) {
        Object.keys(data).forEach((schemaKey) => {
            if (schemaKey === '_id') {
                return
            }
            if (!this.modelSchema[schemaKey] || this.modelSchema[schemaKey].onlyInclude && !included[schemaKey]) {
                delete data[schemaKey]
            }
        });

        return data
    }

    public createDataController(data) {
        if (!data) {
            return null
        }
        if (!Array.isArray(data)) {
            return new DataController(data, {
                    app: this.app,
                    methods: this.methods,
                    modelName: this.modelName,
                    modelNameInit: this.modelNameInit,
                    modelSchema: this.modelSchema,
                    defaultModelView: this.defaultModelView,
                    collection: this.collection,
                    hooks: this.hooks,
                    includeBehavior: this.includeBehavior,
                }
            )
        } else {
            return data.reduce((obj, item) => {
                obj[item._id] = new DataController(item, {
                        app: this.app,
                        methods: this.methods,
                        modelName: this.modelName,
                        modelNameInit: this.modelNameInit,
                        modelSchema: this.modelSchema,
                        defaultModelView: this.defaultModelView,
                        collection: this.collection,
                        hooks: this.hooks,
                        includeBehavior: this.includeBehavior,
                    }
                );
                return obj;
            }, {})
        }
    }

    @mongoListRequest
    public async get_list(data: GetListData, options?) {
        return await this.collection.find(data.query, { fields: data.projection })
            .limit(data.meta.limit || 0)
            .skip(data.meta.skip || 0)
            .sort(data.sort)
            .toArray();
    }

    @mongoListRequest
    public async get_one(data: GetOneData, options?) {
        return await this.collection.findOne(data.query, { fields: data.projection })
    }

    // TODO improve this method
    // TODO refactor with createdDate
    // TODO handle database error
    public async insert(data: InsertData, options?) {
        data.data = await this.initHook('beforeGlobalInsert', data.data);
        const promiseArray = data.data.map(item => {
            return new Promise(async (resolve, reject) => {
                const dataModel = this.createDataController(item.fields);
                const result = await dataModel.insert(options).catch(e => e)

                if (!result.error) {
                    resolve(result)
                }
                reject(result)
            }).catch((e) => {
                createError(options ? options.request : null, {
                    model: this.modelName,
                    method: 'insert',
                    status: 422,
                    detail: e.error.detail,
                    code: e.error.code || 'UNDEFINED'
                });

                return null
            });
        });
        const insertedResult:Array<string> = await Promise.all(promiseArray);
        if (options && options.request) {
            return this.get_list({
                ids: insertedResult
            }, options)
        }
        return insertedResult
    }

    // TODO refactor with updatedDate
    public async update(data: InsertData, options) {
        const dataIds = data.data.map(item => {
            return item.fields._id
        });
        const itemsToUpdate = await this.get_list({ ids: dataIds });
        const promiseArray = data.data.map(item => {
            return new Promise(async (resolve, reject) => {
                const result = await itemsToUpdate[item.fields._id].update(item.fields, options);
                if (result) {
                    resolve(result)
                } else {
                    reject(item.fields._id)
                }
            }).catch(e => {
                console.log(e)
                // TODO handle error here
                return null
            })
        });
        const updatedResult:Array<string> = await Promise.all(promiseArray);
        if (options && options.request) {
            return this.get_list({
                ids: updatedResult,
                included: options.request.query.include || null
            }, options);
        }
        return updatedResult
    }

    public async delete(data, options) {
        const itemsToDelete = await this.get_list({ ids: data });
        const promiseArray = Object.keys(itemsToDelete).map(item => {
            const itemModel = itemsToDelete[item];
            return new Promise(async (resolve, reject) => {
                const result = await itemsToDelete[itemModel._fields._id].delete(options);
                if (result) {
                    resolve(result)
                } else {
                    reject(item)
                }
            }).catch(e => {
                // TODO handle error here
                return ''
            })
        });
        return await Promise.all(promiseArray);
    }

    public async initHook(hookName, data, additionals = {}) {
        if (!this.hooks[hookName] || this.includeBehavior) {
            return data
        }

        try {
            return await this.hooks[hookName].call(this, data, additionals)
        } catch (e) {
            console.log(e)
            return data
        }
    }
}
