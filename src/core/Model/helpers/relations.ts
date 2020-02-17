import {follow} from "@utils/promise/follow";
import {defer} from "@utils/promise/defer";
import { set } from 'object-path';
import createIncludeKeys from "@utils/included/createIncludeKeys";
import {ObjectId} from "bson";

const getRelationFieldsFromSchema = (Model, data, includedKeys) => {
    const schema = Model.modelSchema;
    const relationKeys =  Object.keys(schema).filter(key => {
        return schema[key].ref
    });

    const hasMany = relationKeys.filter(key =>
        Array.isArray(schema[key].type())
        && includedKeys[key]
        && data[key]
        && (data[key].length || schema[key].fullData)
    );
    const belongsTo = relationKeys.filter(key =>
        !Array.isArray(schema[key].type())
        && includedKeys[key]
        && data[key]
    );

    return {
        hasMany,
        belongsTo,
        result: hasMany.concat(belongsTo),
        fullKeys: relationKeys,
    }
};

class RelationsResolver {
    public included = {};
    public Model = null;
    public Models = null;
    public auth = null;
    public clearData = true;
    public meta_options = null;
    public includedKeys: string|string[] = [];
    public includedKeysObj = {};

    constructor(Models, options) {
        this.Models = Models;

        if (!options) {
            return this
        }

        this.auth = options.auth;

        return this;
    }

    public createRightIncludedKeys() {
        this.includedKeysObj = createIncludeKeys(this.includedKeys);
    }

    public async resolveRequest(data) {
        data = Array.isArray(data) ? data : [data];

        this.createRightIncludedKeys();

        const requestGenerator = (array, data) => {
            if (!this.included[this.Model.modelName]) {
                this.included[this.Model.modelName] = {}
            }

            this.included[this.Model.modelName][data._id] = this.clearData ? this.Model.clearData(this.includedKeysObj, data) : data;
            const keysData = getRelationFieldsFromSchema(this.Model, data, this.includedKeysObj);

            if (this.Model.modelName === 'products') {
                // console.log(keysData, data.variants)
            }

            const hasManyPromises = keysData.hasMany.reduce(this.relationPromiseGenerator(data, true), []);
            const belongToPromises = keysData.belongsTo.reduce(this.relationPromiseGenerator(data, false), []);

            const toExecute = [];
            const executer = async (resolve, reject) => {
                try {
                    const keysWithHasMany = await follow(hasManyPromises);

                    keysData.hasMany.forEach((key, i) => {
                        const promise = defer();
                        toExecute.push(promise.resolve);
                        data[key] = keysWithHasMany[i]()
                    });

                    const keysWithBelongsTo = await follow(belongToPromises);

                    keysData.belongsTo.forEach((key, i) => {
                        const promise = defer();
                        toExecute.push(promise.resolve);
                        data[key] = keysWithBelongsTo[i]()
                    });

                    resolve(data)
                } catch (e) {
                    console.log(e);
                    reject(data)
                }
            };

            array.push(
                new Promise(executer)
            );

            return array
        };

        const promises = data.reduce(requestGenerator, []);
        await follow(promises);
    }

    private relationPromiseGenerator (data, hasMany) {
        return (array, key) => {
            const ids = hasMany ? data[key] : [data[key]];
            const promise = new Promise(this.createPromiseExecuter(key, ids, hasMany, this.Model ));

            array.push(promise);

            return array;
        }
    };

    private createPromiseExecuter (key, ids, hasMany, Model) {
        return async (resolve, reject) => {
            try {
                const modelSchema = Model.modelSchema[key];
                const schemaKey = modelSchema.ref;

                if (modelSchema && hasMany && !ids.length) {
                    ids = await this.Models[schemaKey].collection.distinct("_id", {});
                }

                if (!this.included[schemaKey]) {
                    this.included[schemaKey] = {}
                }

                const resultIds = ids.reduce((obj, id) => {
                    obj[id] = true;
                    return obj;
                }, {});

                const requestIds = ids.filter(id => !this.included[schemaKey][id]);
                const pendingIds = ids.filter(id => this.included[schemaKey][id]);

                const data = {
                    ids: requestIds,
                    included: this.includedKeysObj[key],
                    meta_options: this.meta_options,
                };

                const options = {
                    models: this.Models,
                    resolvingClass: this,
                    rawJson: true,
                    auth: this.auth,
                };

                requestIds.length
                    ? await this.Models[schemaKey].get_list(data, options)
                    : pendingIds;

                resolve(() => {
                    const neededIds = Object.keys(this.included[schemaKey]).filter(id => resultIds[id]);
                    let result = neededIds.map(id => this.included[schemaKey][id]);

                    return hasMany ? result : result[0]
                })
            } catch (e) {
                console.log(e);
                reject(() => hasMany ? ids : ids[0])
            }
        }
    }
}

const getRelations = async function (Model, { data, options, included, meta_options = {} }) {
    if (!options.models) {
        data = await Model.initHook('modifyRecievedData', data, {
            options,
            meta_options,
            included
        });

        return {
            data
        }
    }

    const ResolvingClass = !options.resolvingClass ?
        new RelationsResolver(options.models, options)
        : options.resolvingClass;

    if (typeof included === 'object' && !included) {
        included = {}
    }

    ResolvingClass.Model = Model;
    ResolvingClass.includedKeys = included;
    ResolvingClass.meta_options = meta_options;
    ResolvingClass.clearData = typeof options.clearData === 'undefined' ? true : options.clearData;

    await ResolvingClass.resolveRequest(data);

    if (!options.rawJson) {
        // TODO fix self included problem. Now it only works from root level.
        //  That mean that we can not solve problem when problem is not on root.
        //  example: product.variants - solved. menuItems.sections.item - not solved
        //  Ну и хуево
        let checkIncluded = false;
        if (included) {
            Object.keys(included).forEach((key) => {
                if (Model.modelSchema[key] && Model.modelSchema[key].ref === Model.modelName) {
                    checkIncluded = true
                }
            });
        }

        if (!checkIncluded) {
            // delete ResolvingClass.included[Model.modelName]
        }
    }

    data = Array.isArray(data) ? data : [data]
    data = await Model.initHook('modifyRecievedData', data, {
        options,
        resolvingClass: ResolvingClass,
        meta_options,
        included,
    });

    return {
        data,
        resolvingClass: ResolvingClass
    }
};

export {
    getRelations
}
