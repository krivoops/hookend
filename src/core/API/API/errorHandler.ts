import { Error } from '../../types';
import logger from '../../utils/logger';
import error from '../../utils/errors';

interface CreateErrorData {
    status: number;
    model: string;
    method: string;
    detail?: any;
    service?: string;
    error?: any;
    code?: string;
}

const createError = (req, data: CreateErrorData, next?): Error => {
    const message = `${data.model}/${data.method} errored`;
    const code = 'UNDEFINED_ERROR';
    if (!data.error) {
        data.error = {}
    }
    if (!data.code) {
        data.code = code
    }
    logger.error(message, {
        service: data.service || 'Model',
        model: data.model,
        method: data.method,
        detail: data.detail,
        status: data.status,
        code: data.code,
        error: {
            message: data.error.message,
            line: data.error.lineNumber,
            file: data.error.fileName,
        },
    });

    try {
        console.log(data.error)
    } catch (e) {
        console.log(data.error)
    }

    const result = error({
        title: message,
        detail: data.detail,
        status: data.status,
        success: false,
        code: data.code,
    }, false);

    if (req) {
        req.requestErrors.push(result);
        if (next) {
            next();
        }
    }

    return result;
};

export {
    createError,
};

