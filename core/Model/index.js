"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const Schema_1 = require("@core/Model/Schema");
const decorators_1 = require("./decorators");
const plural = require("plural");
const errorHandler_1 = require("@core/API/API/errorHandler");
const bson_1 = require("bson");
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
const performIds = (id) => {
    if (typeof id === 'object') {
        return id;
    }
    try {
        return id && id.length !== 12 ? new bson_1.ObjectId(id) : id ? id : new bson_1.ObjectId();
    }
    catch (e) {
        return id;
    }
};
class DataController {
    constructor(data, { app, methods, modelName, modelNameInit, modelSchema, defaultModelView, collection, hooks, includeBehavior }) {
        this._fields = {};
        this._methods = {};
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
            return;
        }
        this._fields._id = performIds(data._id);
        this._id = performIds(data._id);
        Object.keys(this.defaultModelView).forEach((key) => {
            this._fields[key] = data[key] || this.defaultModelView[key];
            this[key] = data[key] || this.defaultModelView[key];
        });
        methods = this.initAddtionalsMehods(methods);
        Object.keys(methods).forEach((method) => {
            this._methods[method] = methods[method].bind(this);
            this[method] = this._methods[method];
        });
    }
    initAddtionalsMehods(methods) {
        methods.insert = async (options) => {
            let recursionExit = false;
            const modifiedData = await this.initHook('beforeInsert', this._fields, options);
            if (!modifiedData || modifiedData._error) {
                throw {
                    _id: this._fields._id,
                    error: modifiedData._error
                };
            }
            Object.keys(modifiedData).forEach((key) => {
                this._fields[key] = modifiedData[key];
                this[key] = modifiedData[key];
            });
            if (typeof modifiedData._search !== 'undefined') {
                modifiedData._search = Object.keys(this.modelSchema).filter((key) => {
                    return this.modelSchema[key].searchable;
                }).map((key) => {
                    return modifiedData[key];
                });
                modifiedData._search = modifiedData._search.join(' ');
            }
            const autoIncrementInsert = async (err, counter = 0) => {
                if (err && err.code !== 11000) {
                    return {
                        result: {
                            ok: false
                        }
                    };
                }
                if (err) {
                    const key = err.errmsg.match(/[a-zA-Z0-9]+\/unique/g)[0].split('/')[0];
                    let result = `${this._fields[key]}_${counter}`;
                    result = result.replace(`_${counter - 1}`, '');
                    if (this.modelSchema[key].uniqueFix) {
                        this._fields[key] = result;
                        this[key] = result;
                    }
                    else {
                        recursionExit = true;
                    }
                }
                return this.collection.insertOne(this._fields);
            };
            let counter = 0;
            const recursion = async (e, counterToUse) => await autoIncrementInsert(e, counterToUse)
                .then(res => res)
                .catch(async (err) => {
                if (!recursionExit) {
                    counter++;
                    return recursion(err, counter);
                }
                let error = {
                    detail: {}
                };
                if (err && err.code !== 11000) {
                    return {
                        result: {
                            ok: false
                        },
                        error
                    };
                }
                if (err) {
                    const key = err.errmsg.match(/[a-zA-Z0-9]+\/unique/g)[0].split('/')[0];
                    error.detail.title = `Not unique`;
                    error.detail.field = key;
                    error.detail.description = `This field is not unique: ${key}`;
                    error.code = 'NOT_UNIQUE';
                }
                return {
                    result: {
                        ok: 0
                    },
                    error,
                };
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
                error: result.error,
            };
        };
        methods.update = async (updateData, options) => {
            const currState = await this.collection.findOne({ _id: this._id });
            if (currState) {
                updateData = await this.initHook('beforeUpdate', {
                    _id: this._id,
                    ...currState,
                    ...updateData
                }, options, currState);
                delete updateData._id;
                if (typeof updateData._search !== 'undefined') {
                    updateData._search = Object.keys(this.modelSchema).filter((key) => {
                        return this.modelSchema[key].searchable;
                    }).map((key) => {
                        return updateData[key];
                    });
                    updateData._search = updateData._search.join(' ');
                }
                const result = await this.collection.updateOne({ _id: this._id, }, { $set: updateData });
                if (result.result.ok) {
                    this.changeFields(updateData);
                    if (result.result.ok) {
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
            };
        };
        methods.delete = async (options) => {
            await this.initHook('beforeDelete', this._fields, options);
            const result = await this.collection.deleteOne({ _id: this._id, }, true);
            if (result.result.ok) {
                if (options.await) {
                    await this.initHook('onDelete', this._fields);
                }
                else {
                    this.initHook('onDelete', this._fields);
                }
                return this._id;
            }
            throw {
                _id: this._fields._id
            };
        };
        return methods;
    }
    changeFields(changes) {
        Object.keys(changes).forEach((key) => {
            if (typeof this._fields[key] === 'undefined') {
                return;
            }
            this._fields[key] = changes[key];
            this[key] = changes[key];
        });
    }
    clearData(included = {}, data) {
        Object.keys(data).forEach((schemaKey) => {
            if (schemaKey !== '_id' && this.modelSchema[schemaKey].onlyInclude && !included[schemaKey]) {
                delete data[schemaKey];
            }
        });
        return data;
    }
    async initHook(hookName, data, additionals = {}, oldDoc) {
        if (!this.hooks[hookName] || this.includeBehavior) {
            return data;
        }
        try {
            return await this.hooks[hookName].call(this, data, additionals, oldDoc);
        }
        catch (e) {
            console.log(e);
            return data;
        }
    }
}
class Model extends Schema_1.Schema {
    constructor({ app, db, api }, { modelName, modelSchema, options, methods = {}, routes = {}, hooks = {}, access = {}, includeBehavior = null }) {
        super();
        this.methods = {};
        this.routes = {};
        this.hooks = {};
        this.includeBehavior = null;
        this.access = defaultAccess;
        options = {
            ...modelOptions,
            ...options,
        };
        this.modelName = plural(modelName);
        this.modelNameInit = modelName;
        this.modelSchema = modelSchema;
        this.modelOptions = options;
        const isWithSearchable = Object.keys(this.modelSchema).filter((key) => {
            return this.modelSchema[key].searchable;
        });
        if (isWithSearchable.length) {
            this.modelSchema._search = Model.attr('string');
        }
        this.defaultModelView = Schema_1.defaultModelView(modelSchema, this);
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
    async createIndexes(schema, collection) {
        let indexes = await collection.stats().catch(e => false);
        if (!indexes) {
            return;
        }
        Object.keys(schema).forEach((schemaKey) => {
            const indexName = `${schemaKey}/unique`;
            if (schema[schemaKey].unique && !indexes.indexDetails[indexName]) {
                collection.createIndex({ [schemaKey]: 1 }, { unique: true, name: indexName })
                    .catch(e => {
                    errorHandler_1.createError(null, {
                        model: this.modelName,
                        method: 'createIndex',
                        status: 422,
                        detail: e.errmsg,
                        code: e.errmsg ? e.errmsg.split(' ')[0] : 'UNDEFINED'
                    });
                });
            }
        });
    }
    clearData(included = {}, data) {
        Object.keys(data).forEach((schemaKey) => {
            if (schemaKey === '_id') {
                return;
            }
            if (!this.modelSchema[schemaKey] || this.modelSchema[schemaKey].onlyInclude && !included[schemaKey]) {
                delete data[schemaKey];
            }
        });
        return data;
    }
    createDataController(data) {
        if (!data) {
            return null;
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
            });
        }
        else {
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
                });
                return obj;
            }, {});
        }
    }
    async get_list(data, options) {
        return await this.collection.find(data.query, { fields: data.projection })
            .limit(data.meta.limit || 0)
            .skip(data.meta.skip || 0)
            .sort(data.sort)
            .toArray();
    }
    async get_one(data, options) {
        return await this.collection.findOne(data.query, { fields: data.projection });
    }
    async insert(data, options) {
        data.data = await this.initHook('beforeGlobalInsert', data.data);
        const promiseArray = data.data.map(item => {
            return new Promise(async (resolve, reject) => {
                const dataModel = this.createDataController(item.fields);
                const result = await dataModel.insert(options).catch(e => e);
                if (!result.error) {
                    resolve(result);
                }
                reject(result);
            }).catch((e) => {
                errorHandler_1.createError(options ? options.request : null, {
                    model: this.modelName,
                    method: 'insert',
                    status: 422,
                    detail: e.error.detail,
                    code: e.error.code || 'UNDEFINED'
                });
                return null;
            });
        });
        const insertedResult = await Promise.all(promiseArray);
        if (options && options.request) {
            return this.get_list({
                ids: insertedResult
            }, options);
        }
        return insertedResult;
    }
    async update(data, options) {
        const dataIds = data.data.map(item => {
            return item.fields._id;
        });
        const itemsToUpdate = await this.get_list({ ids: dataIds });
        const promiseArray = data.data.map(item => {
            return new Promise(async (resolve, reject) => {
                const result = await itemsToUpdate[item.fields._id].update(item.fields, options);
                if (result) {
                    resolve(result);
                }
                else {
                    reject(item.fields._id);
                }
            }).catch(e => {
                console.log(e);
                return null;
            });
        });
        const updatedResult = await Promise.all(promiseArray);
        if (options && options.request) {
            return this.get_list({
                ids: updatedResult,
                included: options.request.query.include || null
            }, options);
        }
        return updatedResult;
    }
    async delete(data, options) {
        const itemsToDelete = await this.get_list({ ids: data });
        const promiseArray = Object.keys(itemsToDelete).map(item => {
            const itemModel = itemsToDelete[item];
            return new Promise(async (resolve, reject) => {
                const result = await itemsToDelete[itemModel._fields._id].delete(options);
                if (result) {
                    resolve(result);
                }
                else {
                    reject(item);
                }
            }).catch(e => {
                return '';
            });
        });
        return await Promise.all(promiseArray);
    }
    async initHook(hookName, data, additionals = {}) {
        if (!this.hooks[hookName] || this.includeBehavior) {
            return data;
        }
        try {
            return await this.hooks[hookName].call(this, data, additionals);
        }
        catch (e) {
            console.log(e);
            return data;
        }
    }
}
__decorate([
    decorators_1.mongoListRequest,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Model.prototype, "get_list", null);
__decorate([
    decorators_1.mongoListRequest,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], Model.prototype, "get_one", null);
exports.Model = Model;
