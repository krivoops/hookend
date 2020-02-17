import { ObjectId } from 'mongodb';

import { getRelations } from '@core/Model/helpers/relations';
import { createQuery, createMeta, createSort } from '@core/Model/helpers/query';
import createIncludeKeys from "@utils/included/createIncludeKeys";

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

const mongoListRequest = (
    target: object,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<any>,
) => {
    const method = descriptor.value;
    descriptor.value = async function(data, options) {
        options = options || {};

        if (!options.auth) {
            options.auth = options.request ? options.request.auth : null
        }

        let resultData = {
            ...data,
            ids: data.ids || [],
            no_ids: data.no_ids || [],
            query: {},
            meta: data.meta || {},
            sort: {},
        };

        resultData.ids = resultData.ids.reduce((arr, value) => {
            arr.push(performIds(value));
            return arr;
        }, []);

        resultData.no_ids = resultData.no_ids.reduce((arr, value) => {
            arr.push(performIds(value));
            return arr;
        }, []);

        if (resultData.ids.length || resultData.no_ids.length) {
            resultData.query = {
                _id: {
                    $in: resultData.ids,
                    $nin: resultData.no_ids,
                },
            };
        }

        resultData.query = createQuery(this, data.query, resultData.query);
        resultData.sort = createSort(this, data.sort);

        resultData.projection = data.projection || Object.keys(this.modelSchema).reduce((obj, key) => {
            const item = this.modelSchema[key];
            // TODO think about this exeptions. it's not okay and not cleat why. И вообще похоже на костыль ебаный
            if (item.secure || options.secure) {
                obj[key] = 0
            }
            return obj
        }, {});

        // TODO bad that we can change default meta; Shoudld refactor
        resultData = await this.initHook('modifyGetListResultData', resultData, {
            ...options,
        });

        if (!options.rawJson) {
            const totalCount = await this.collection.count(resultData.query);
            const meta = createMeta(data.meta, totalCount);

            // гавнецо лютое
            resultData.meta.meta = {
                ...meta.meta,
                ...resultData.meta
            };

            delete meta.meta;

            resultData.meta = {
                ...resultData.meta,
                ...meta,
            }
        }

        let returnedOne = false;
        let methodResult = await method.apply(this, [resultData]);
        if (!Array.isArray(methodResult)) {
            methodResult = [methodResult];
            returnedOne = true;
        }

        methodResult = await this.initHook('preSerialize', methodResult, {
            options,
            included: data.included,
            meta_options: data.meta_options,
        });

        const {
            data: result,
            resolvingClass,
        } = await getRelations(this, {
            data: methodResult,
            options,
            included: createIncludeKeys(data.included),
            meta_options: data.meta_options,
        });

        if (options.request) {
            if (!options.rawJson) {
                options.request.requestedModel = this.modelName
            }
            options.request.requestResults = options.request.requestResults.concat(result);
            options.request.requestMeta = resultData.meta.meta;
            options.request.requestIncluded = this.api.mergeIncluded(options.request.requestIncluded,resolvingClass.included)
        }

        const formattedResult = returnedOne ? result[0] : result;
        return options.rawJson ? formattedResult : this.createDataController(formattedResult) ;
    };

    return descriptor;
};

export {
    mongoListRequest
};

