"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bson_1 = require("bson");
const plural = require("plural");
const polymorphicCheck = (Model, models, fields) => {
    if (fields) {
        if (Model.modelOptions.polymorphic && fields._model) {
            Model = models[fields._model];
        }
        else if (fields._model) {
        }
    }
    return {
        Model,
        fields
    };
};
const performFormat = (Model, fields, models, included, isIncluded, req) => {
    let attributes = {};
    const relationships = {};
    const check = polymorphicCheck(Model, models, fields);
    Model = check.Model;
    fields = check.fields;
    Object.keys(fields).forEach((key) => {
        if (key === '_id' || key === '_model') {
            return;
        }
        if (Model.modelSchema[key] && Model.modelSchema[key].ref && !models[Model.modelSchema[key].ref].includeBehavior) {
            let relationCheck = polymorphicCheck(models[Model.modelSchema[key].ref], models, fields[key]);
            let relationModal = relationCheck.Model;
            let relationFields = relationCheck.fields;
            relationships[key] = {
                data: !Array.isArray(Model.modelSchema[key].type())
                    ? fields[key]
                        && included[Model.modelSchema[key].ref] && included[Model.modelSchema[key].ref][relationFields._id] ? {
                        id: typeof fields[key] === 'object' ? relationFields._id : relationFields,
                        type: relationModal.modelName,
                    } : null
                    : relationFields.filter(item => {
                        return included[Model.modelSchema[key].ref] && included[Model.modelSchema[key].ref][item._id];
                    })
                        .map((item) => ({
                        id: typeof item === 'object' ? item._id : item,
                        type: polymorphicCheck(relationModal, models, item).Model.modelName,
                    }))
            };
        }
        else if (Model.modelSchema[key] && Model.modelSchema[key].ref && models[Model.modelSchema[key].ref].includeBehavior && !(fields[key] instanceof bson_1.ObjectID)) {
            attributes = models[Model.modelSchema[key].ref].includeBehavior(req, key, fields[key], attributes);
        }
        else {
            attributes[key] = fields[key];
        }
    });
    const result = {
        type: isIncluded ? Model.modelNameInit : Model.modelName,
        id: fields._id,
        attributes,
    };
    if (Object.keys(relationships).length) {
        result.relationships = relationships;
    }
    return result;
};
exports.default = (req, res) => {
    if (req.cache && !req.cache.failed) {
        return;
    }
    let Model = req.models[req.requestedModel];
    const data = req.requestResults;
    const included = req.requestIncluded;
    let meta = {
        ...req.requestMeta,
        success: req.requestSuccess
    };
    let isArray = true;
    if (req.responseDataType) {
        isArray = Array.isArray(req.responseDataType);
    }
    const resultData = [];
    data.forEach(item => {
        resultData.push({
            ...performFormat(Model, item, req.models, req.requestIncluded, !isArray, req),
        });
    });
    let resultIncluded = [];
    Object.keys(included).forEach((modelName) => {
        const includedModel = req.models[modelName];
        const items = included[modelName];
        if (!req.models[modelName].includeBehavior) {
            Object.keys(items).forEach((itemId) => {
                const item = items[itemId];
                const formated = performFormat(includedModel, item, req.models, req.requestIncluded, true, req);
                resultIncluded.push(formated);
            });
        }
    });
    const result = {
        data: resultData,
    };
    const toDeleteSelfInclude = [];
    resultIncluded.forEach((include) => {
        const type = plural(include.type);
        if (type === req.requestedModel && resultData.find(x => x.id === include.id)) {
            toDeleteSelfInclude.push(include.id);
        }
    });
    if (resultIncluded.length) {
        resultIncluded = resultIncluded.filter(x => {
            return !toDeleteSelfInclude.find(f => f === x.id);
        });
        result.included = resultIncluded;
    }
    result.meta = {};
    if (meta) {
        result.meta = meta;
    }
    if (!isArray) {
        result.data = result.data[0];
    }
    if (req.cache && req.cache.failed) {
        req.cache.cacheClient.set(`vvlen-api:external:${req.cache.key}`, JSON.stringify(result));
        req.cache.cacheClient.quit();
    }
    res.append('Response-time', new Date().getTime() - req.time);
    res.json(result);
};
