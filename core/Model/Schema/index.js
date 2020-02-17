"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb = require("mongodb");
const defaultRelations = {
    ref: null,
    async: false
};
class Schema {
    static belongsTo(ref, options) {
        return {
            type: mongodb.ObjectId,
            ref,
            ...options,
        };
    }
    static hasMany(ref, options) {
        return {
            type: Array,
            ref,
            ...options,
        };
    }
    static attr(type, options) {
        if (type === 'string') {
            return {
                type: String,
                ...defaultRelations,
                ...options
            };
        }
        if (type === 'number') {
            return {
                type: Number,
                ...defaultRelations,
                ...options
            };
        }
        if (type === 'boolean') {
            return {
                type: Boolean,
                ...defaultRelations,
                ...options
            };
        }
        if (type === 'array') {
            return {
                type: Array,
                ...defaultRelations,
                ...options
            };
        }
        if (type === 'object') {
            return {
                type: Object,
                ...defaultRelations,
                ...options
            };
        }
        return {
            type: Date,
            ...defaultRelations,
            ...options
        };
    }
}
exports.Schema = Schema;
const defaultModelView = (schema, Model) => {
    const result = {};
    if (Model.modelOptions.polymorphed) {
        result._model = Model.modelName;
    }
    Object.keys(schema).forEach(key => {
        if (schema[key].type.ObjectId) {
            result[key] = null;
        }
        else if (schema[key].type.prototype.getDate) {
            result[key] = new schema[key].type();
        }
        else {
            result[key] = schema[key].type();
        }
    });
    return result;
};
exports.defaultModelView = defaultModelView;
