import { error as hookendError, response as hookendResponse } from './Hookend';
import { error as jsonApiError, response as jsonApiResponse } from './JSONAPI';
import { createError } from './errorHandler';

export default (req, res, next) => {
    // TODO create configurable handlers also with needed middlewares and else
    try {
        let contentType = req.headers['content-type'];
        let accept = req.headers['accept'];

        const mediaMapping = {
            'application/json': {
                request: hookendResponse,
                error: hookendError,
            },
            'application/vnd.api+json': {
                request: jsonApiResponse,
                error: jsonApiError,
            },
            'multipart/form-data': {
                request: hookendResponse,
                error: hookendError,
            }
        };

        let type = '';
        if (req.method === 'GET') {
            if (mediaMapping[accept]) {
                type = accept
            } else {
                type = 'application/json';
            }
        } else {
            if (mediaMapping[contentType]) {
                type = contentType
            } else if (process.env.NODE_ENV === 'production') {
                type = 'application/json'
            }
        }

        if (!mediaMapping[type]) {
            // res.status(415);
            // res.end('415 | Unsupported Media Type');
            mediaMapping[type] = {
                request: hookendResponse,
                error: hookendError,
            }
        }

        const currentHandler = mediaMapping[type];
        if (currentHandler.error(req, res)) {
            currentHandler.request(req, res);
        }

    } catch (e) {
        const error = createError(null, {
            model: 'ResponseHandler',
            method: 'contentTypes',
            status: 500,
            error: e,
        });
        res.status(500);
        res.json(error);
    }
};
