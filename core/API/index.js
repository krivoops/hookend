"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const body_parser_1 = require("body-parser");
const errorHandler_1 = require("@core/API/API/errorHandler");
const responseHandler_1 = require("./API/responseHandler");
const relations_1 = require("@core/Model/helpers/relations");
const bson_1 = require("bson");
const dasherialize = (text => text.replace(/([A-Z])+/g, function (value) { return `-${value.toLowerCase()}`; }));
const performIds = (id) => {
    if (typeof id === 'object') {
        return id;
    }
    try {
        return id.length !== 12 ? new bson_1.ObjectId(id) : id;
    }
    catch (e) {
        return id;
    }
};
class API {
    constructor(app) {
        this.app = app;
    }
    initBefore() {
        this.app.use(body_parser_1.json());
        this.app.use(body_parser_1.json({ type: 'application/vnd.api+json' }));
        this.app.use(body_parser_1.urlencoded({ extended: true }));
        this.app.use((req, res, next) => {
            req.models = this.app.models;
            req.requestResults = [];
            req.requestIncluded = {};
            req.requestErrors = [];
            req.requestSuccess = [];
            if (req.headers['content-type'] === 'application/vnd.api+json'
                && (req.method === 'POST' || req.method === 'PATCH')) {
                if (!req.body.data) {
                    res.end('net =)');
                }
                req.responseDataType = req.body.data.constructor();
                const initData = Array.isArray(req.body.data) ? req.body.data : [req.body.data];
                const result = [];
                initData.forEach(item => {
                    const fields = item.attributes || {};
                    if (item.relationships) {
                        Object.keys(item.relationships).forEach((relationship) => {
                            const field = item.relationships[relationship].data;
                            if (field) {
                                fields[relationship] = Array.isArray(field)
                                    ? field.map((relationItem) => performIds(relationItem.id))
                                    : performIds(field.id);
                            }
                        });
                    }
                    if (item.id) {
                        fields._id = item.id;
                    }
                    result.push({
                        type: item.type,
                        fields: fields
                    });
                });
                const meta = req.body.meta;
                req.body = {
                    data: result,
                    meta
                };
            }
            next();
        });
    }
    initAfter() {
        this.app.use(responseHandler_1.default);
    }
    async crearteController({ req, res, next, model, method, todo, Model }) {
        try {
            req.time = new Date().getTime();
            await todo({ req, res }, {
                body: req.body,
                query: req.query,
                headers: req.headers,
            });
            next();
        }
        catch (e) {
            errorHandler_1.createError(req, {
                model: model,
                method: method,
                status: 500,
                detail: {
                    title: 'Internal Server Error',
                    description: 'Something is unexpected'
                },
                code: 'INTERNAL_SERVER_ERROR',
                error: e,
            });
            next();
        }
    }
    createRoute(routeMethod, path, todo, { model, method, Model, }) {
        this.app[routeMethod](`${this.app.config.APIDefaultPath}/${path}`, async (req, res, next) => {
            this.crearteController({ req, res, next, model, method, todo, Model });
        });
    }
    initModelRoutes(Model) {
        Object.keys(Model.routes).forEach(async (method) => {
            Object.keys(Model.routes[method]).forEach((fnName) => {
                this.createRoute(method, `models/${dasherialize(Model.modelName)}/methods/${dasherialize(fnName)}`, async ({ req, res }) => {
                    await Model.routes[method][fnName].call(Model, { req, res });
                }, {
                    method: fnName,
                    model: Model.modelName,
                    Model
                });
            });
        });
        this.createRoute('get', `models/${dasherialize(Model.modelName)}`, async ({ req }) => {
            await Model.get_list({
                ids: [],
                query: req.query.filter || null,
                included: req.query.include || null,
                meta: req.query.meta || null,
                sort: req.query.sort || null,
                meta_options: req.query.meta_options || null,
            }, {
                models: req.models,
                request: req,
                auth: req.auth
            });
        }, {
            model: Model.modelNameInit,
            method: 'get_list',
            Model
        });
        this.createRoute('get', `models/${dasherialize(Model.modelName)}/:id`, async ({ req }) => {
            await Model.get_list({
                ids: [req.params.id],
                included: req.query.include || null,
                meta_options: req.query.meta_options || null,
                query: null,
            }, {
                models: req.models,
                request: req,
                auth: req.auth
            });
            req.responseDataType = {};
        }, {
            model: Model.modelNameInit,
            method: 'get_one',
            Model
        });
        this.createRoute('post', `models/${dasherialize(Model.modelName)}`, async ({ req, res }) => {
            await Model.insert(req.body, {
                models: req.models,
                request: req,
                auth: req.auth
            });
            res.status(201);
        }, {
            model: Model.modelNameInit,
            method: 'insert',
            Model
        });
        this.createRoute('patch', `models/${dasherialize(Model.modelName)}/:id`, async ({ req, res }) => {
            await Model.update(req.body, {
                models: req.models,
                request: req,
                auth: req.auth
            });
        }, {
            model: Model.modelNameInit,
            method: 'update',
            Model
        });
        this.createRoute('delete', `models/${dasherialize(Model.modelName)}/:id`, async ({ req, res }) => {
            const result = await Model.delete([req.params.id], {
                models: req.models,
                request: req,
                auth: req.auth
            });
            if (result.length) {
                res.status(204);
                res.end();
            }
            else {
                res.status(404);
                res.end();
            }
        }, {
            model: Model.modelNameInit,
            method: 'delete',
            Model
        });
    }
    mergeIncluded(included, toMerge) {
        Object.keys(toMerge).forEach((key) => {
            if (!included[key]) {
                included[key] = toMerge[key];
            }
            else {
                included[key] = {
                    ...included[key],
                    ...toMerge[key]
                };
            }
        });
        return included;
    }
    async sendModelData(DataModel, options, included = '') {
        if (options.request || options.doNotSend) {
            if (options.request) {
                options.auth = options.request.auth;
            }
            const include = included ? included : options.request ? options.request.query.include : null;
            const { data: result, resolvingClass, } = await relations_1.getRelations(DataModel._fields ? DataModel : DataModel[Object.keys(DataModel)[0]], {
                data: DataModel._fields ? DataModel._fields : Object.keys(DataModel).reduce((arr, key) => {
                    arr.push(DataModel[key]._fields);
                    return arr;
                }, []),
                options,
                included: include,
                meta_options: options.request ? options.request.query.meta_options || {} : {},
            });
            if (!options.doNotSend) {
                if (!options.rawJson) {
                    options.request.requestedModel = DataModel.modelName;
                }
                options.request.requestResults = options.request.requestResults.concat(result);
                options.request.requestIncluded = options.request.requestIncluded = this.mergeIncluded(options.request.requestIncluded, resolvingClass.included);
            }
            else {
                return {
                    data: result,
                    included: resolvingClass.included
                };
            }
        }
    }
    async validateBody({ fields, model, method }, request) {
        const invalid = [];
        fields.forEach((field) => {
            if (!request.body[field]) {
                invalid.push(field);
                errorHandler_1.createError(request, {
                    model: model,
                    method: method,
                    detail: {
                        field: field,
                        description: `Missing ${field} field`
                    },
                    code: `AUTH_FAIL_MISSING_${field.toUpperCase()}`,
                    status: 422,
                });
            }
        });
        return invalid;
    }
}
exports.default = API;
