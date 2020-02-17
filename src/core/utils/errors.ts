import { Error } from '@core/types';
import logger from './logger';

export default (data: Error, log: boolean = true) => {
    if (log) {
        logger.error(data.title, {
            service: null,
            code: data.code,
            status: data.status,
        });
    }

    return {
        title: data.title || 'undefined title',
        detail: data.detail || 'undefined detail',
        code: data.code ? data.code.toUpperCase() : 'undefined'.toUpperCase(),
        status: data.status,
        success: data.success,
    };
};
