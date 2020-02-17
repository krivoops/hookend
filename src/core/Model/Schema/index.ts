import { SchemaModel, SchemaTypeOptions, SchemaType, AttrParams, AttrSettings } from '@core/types';
import * as mongodb from 'mongodb';

const defaultRelations = {
    ref: null,
    async: false
};

abstract class Schema {
    public static belongsTo(ref: string, options: SchemaTypeOptions|undefined) {
        return {
            type: mongodb.ObjectId,
            ref,
            ...options,
        };
    }

    public static hasMany(ref: string, options: SchemaTypeOptions|undefined) {
        return {
            type: Array,
            ref,
            ...options,
        };
    }

    public static attr(type: AttrParams, options?: AttrSettings): SchemaType {
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

    public abstract modelName: string;
    public abstract modelSchema: SchemaModel;
}

const defaultModelView = (schema: SchemaModel, Model) => {
    const result:any = {};
    if (Model.modelOptions.polymorphed) {
        result._model = Model.modelName
    }
    Object.keys(schema).forEach(key => {
        if (schema[key].type.ObjectId) {
            result[key] = null
        } else if (schema[key].type.prototype.getDate) {
            result[key] = new schema[key].type()
        } else {
            result[key] = schema[key].type()
        }
    });
    return result;
};

export {
    Schema,
    defaultModelView,
};
