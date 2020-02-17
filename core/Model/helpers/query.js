"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bson_1 = require("bson");
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
const createQuery = (context, defaultFilter, toMergeWith = {}) => {
    if (!defaultFilter) {
        return toMergeWith;
    }
    const schema = context.modelSchema;
    const resultQuery = {};
    Object.keys(defaultFilter).forEach((filterKey) => {
        if (defaultFilter[filterKey] === 'true') {
            defaultFilter[filterKey] = {
                $ne: null
            };
        }
        else if (defaultFilter[filterKey] === 'false') {
            defaultFilter[filterKey] = {
                $eq: null
            };
        }
        else if (filterKey === 'ids' && defaultFilter[filterKey]) {
            resultQuery['_id'] = {
                $in: defaultFilter[filterKey].split(',').map(x => performIds(x))
            };
            delete defaultFilter[filterKey];
        }
        else if (defaultFilter[filterKey] && typeof defaultFilter[filterKey].regex === 'string') {
            defaultFilter[filterKey] = {
                $regex: new RegExp(defaultFilter[filterKey].regex, 'i')
            };
        }
        if (defaultFilter[filterKey]) {
            resultQuery[filterKey] = defaultFilter[filterKey];
        }
    });
    return Object.assign({}, toMergeWith, resultQuery);
};
exports.createQuery = createQuery;
const createSort = (context, toMergeWith = {}) => {
    if (!toMergeWith || typeof toMergeWith !== 'object') {
        return {};
    }
    const schema = context.modelSchema;
    Object.keys(toMergeWith).forEach((sortKey) => {
        const schemaKey = schema[sortKey] || null;
        if (!schemaKey || schemaKey.ref) {
            delete toMergeWith[sortKey];
        }
        if (!(toMergeWith[sortKey] === 'desc' || toMergeWith[sortKey] === 'asc')) {
            delete toMergeWith[sortKey];
        }
        toMergeWith[sortKey] = toMergeWith[sortKey] === 'desc' ? -1 : 1;
    });
    return toMergeWith;
};
exports.createSort = createSort;
const createMeta = (metaData, count) => {
    metaData = metaData === null || metaData ? metaData ? metaData : {} : false;
    const result = {
        meta: {
            pagination: {},
        },
        db: {}
    };
    if (metaData) {
        result.meta.pagination.page = +metaData.page || 1;
        result.meta.pagination.perPage = +metaData.perPage || 24;
        result.meta.pagination.totalCount = count;
        result.meta.pagination.totalPageCount = Math.round(+result.meta.pagination.totalCount / +result.meta.pagination.perPage);
        delete metaData.page;
        delete metaData.perPage;
        Object.keys(metaData).forEach((key) => {
            result.meta[key] = metaData[key];
        });
        result.limit = +result.meta.pagination.perPage;
        result.skip = +result.meta.pagination.perPage * (result.meta.pagination.page - 1);
    }
    else {
        result.limit = 0;
        result.skip = 0;
    }
    return result;
};
exports.createMeta = createMeta;
