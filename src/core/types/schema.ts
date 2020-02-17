interface SchemaTypeOptions {
    async?: boolean;
    fullData?: boolean;
    secure?: boolean;
    noShowRelation?: boolean;
    onlyInclude?: boolean;
}

interface SchemaType extends SchemaTypeOptions {
    type: any;
    ref?: string|null;
}

interface SchemaModel {
    [s: string]: SchemaType;
}

type AttrParams = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';

interface AttrSettings {
    secure?: boolean,
    unique?: boolean,
    uniqueFix?: boolean,
    onlyInclude?: boolean,
    text?: true,
    searchable?: true,
}

export {
    SchemaTypeOptions,
    SchemaType,
    SchemaModel,
    AttrParams,
    AttrSettings,
}
