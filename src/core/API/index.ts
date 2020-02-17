import { json, urlencoded } from 'body-parser';

import { HookendApplication, HookendRequest } from '@core/types';
import { createError } from '@core/API/API/errorHandler';
import responseHandler from './API/responseHandler';

import { getRelations } from '@core/Model/helpers/relations';

// TODO replace redis in framework in cachemodule
import { createClient } from 'redis'
import {ObjectId} from "bson";

const dasherialize = (text => text.replace(/([A-Z])+/g, function(value) { return `-${value.toLowerCase()}`;}));

const performIds = (id: string | ObjectId) => {
    if (typeof id === 'object') {
        return id;
    }
    try {
        return id.length !== 12 ? new ObjectId(id) : id;
    } catch (e) {
        return id;
    }
};

export default class API {
    private app: HookendApplication;

    constructor(app) {
        this.app = app;
    }

    public initBefore() {
        // TODO move this middlewares to some another way
        this.app.use(json());
        this.app.use(json({ type: 'application/vnd.api+json' }));
        this.app.use(urlencoded({ extended: true }));

        this.app.use((req: HookendRequest, res, next) => {
            req.models = this.app.models;
            req.requestResults = [];
            req.requestIncluded = {};
            req.requestErrors = [];
            req.requestSuccess = [];

            // TODO refactor this and add jsonapi TYPE errors
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
                                   : performIds(field.id)
                           }
                       })
                    }
                    if (item.id) {
                        fields._id = item.id;
                    }
                    result.push({
                        type: item.type,
                        fields: fields
                    })
                });
                const meta = req.body.meta;
                req.body = {
                    data: result,
                    meta
                }
            }
            next();
        });
    }

    public initAfter() {
        this.app.use(responseHandler);
    }

    private async crearteController({ req, res, next, model, method, todo, Model }) {
        try {
            req.time = new Date().getTime();
            const access = await this.app.auth.checkAccess.call(Model, req, Model.access[method], {
                method,
                model: Model.modelName,
            });

            const todoPromise = () => {
                return todo({req, res}, {
                    body: req.body,
                    query: req.query,
                    headers: req.headers,
                });
            };

            if (access) {

                // TODO replace redis in framework in cachemodule
                const cachePromise = new Promise<string|boolean>((resolve) => {
                    const cacheKey = req.headers['cache-key'];
                    if (cacheKey) {
                        const redisClient = createClient({
                            db: 5,
                            password: process.env.REDIS_PASSWORD
                        });
                        req.cache = {
                            key: cacheKey,
                            cacheClient: redisClient
                        };
                        redisClient.get(`vvlen-api:external:${cacheKey}`, function(err, reply) {
                            if (!err && reply) {
                                req.cache.failed = false;
                                resolve(reply)
                            } else {
                                req.cache.failed = true;
                                resolve(false)
                            }
                        })
                    } else {
                        resolve(false)
                    }
                });

                const cacheResult:string|boolean = await Promise.resolve(cachePromise);

                if (cacheResult) {
                    res.append('Response-time', new Date().getTime() - req.time);
                    res.end(cacheResult)
                } else {
                    await todoPromise()
                }
            }

            next();
        } catch (e) {
            createError(req, {
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

    public createRoute(routeMethod, path, todo, {
        model,
        method,
        Model,
    }) {
        this.app[routeMethod](`${this.app.config.APIDefaultPath}/${path}`, async (req, res, next) => {
            this.crearteController({ req, res, next, model, method, todo, Model })
        });
    }

    public initModelRoutes(Model) {
        Object.keys(Model.routes).forEach(async (method) => {
            Object.keys(Model.routes[method]).forEach((fnName) => {
                this.createRoute(method,`models/${dasherialize(Model.modelName)}/methods/${dasherialize(fnName)}`, async ({req, res}) => {
                    await Model.routes[method][fnName].call(Model,{req, res})
                }, {
                    method: fnName,
                    model: Model.modelName,
                    Model
                })
            });
        });

        this.createRoute('get',`models/${dasherialize(Model.modelName)}`, async ({req}) => {
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

        this.createRoute('get',`models/${dasherialize(Model.modelName)}/:id`, async ({req}) => {
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
            req.responseDataType = {}
        }, {
            model: Model.modelNameInit,
            method: 'get_one',
            Model
        });

        this.createRoute('post',`models/${dasherialize(Model.modelName)}`, async ({req, res}) => {
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

        this.createRoute('patch',`models/${dasherialize(Model.modelName)}/:id`, async ({req, res}) => {
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

        this.createRoute('delete',`models/${dasherialize(Model.modelName)}/:id`, async ({req, res}) => {
            const result = await Model.delete([req.params.id], {
                models: req.models,
                request: req,
                auth: req.auth
            });

            // TODO move insede delete method
            if (result.length) {
                res.status(204);
                res.end();
            } else {
                res.status(404);
                res.end();
            }
        }, {
            model: Model.modelNameInit,
            method: 'delete',
            Model
        });
    }

    public mergeIncluded(included, toMerge) {
        Object.keys(toMerge).forEach((key) => {
            if (!included[key]) {
                included[key] = toMerge[key]
            } else {
                included[key] = {
                    ...included[key],
                    ...toMerge[key]
                }
            }
        });

        return included
    }

    // TODO reffactor this. Problem with many and one models
    public async sendModelData(DataModel, options, included = '') {
        if (options.request || options.doNotSend) {
            if (options.request) {
                options.auth = options.request.auth
            }

            const include = included ? included : options.request ? options.request.query.include : null;

            const {
                data: result,
                resolvingClass,
            } = await getRelations(DataModel._fields ? DataModel : DataModel[Object.keys(DataModel)[0]], {
                data: DataModel._fields ? DataModel._fields : Object.keys(DataModel).reduce((arr, key) => {
                    arr.push(DataModel[key]._fields);
                    return arr
                }, []),
                options,
                included: include,
                meta_options: options.request ? options.request.query.meta_options || {} : {},
            });

            if (!options.doNotSend) {
                if (!options.rawJson) {
                    options.request.requestedModel = DataModel.modelName
                }
                options.request.requestResults = options.request.requestResults.concat(result);
                options.request.requestIncluded = options.request.requestIncluded = this.mergeIncluded(options.request.requestIncluded,resolvingClass.included)
            } else {
                return {
                    data: result,
                    included: resolvingClass.included
                }
            }
        }
    }

    public async validateBody({ fields, model, method }, request) {
        const invalid = [];
        fields.forEach((field) => {
            if (!request.body[field]) {
                invalid.push(field);
                createError(request, {
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
