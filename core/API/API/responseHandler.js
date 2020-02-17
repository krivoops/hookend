"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Hookend_1 = require("./Hookend");
const JSONAPI_1 = require("./JSONAPI");
const errorHandler_1 = require("./errorHandler");
exports.default = (req, res, next) => {
    try {
        let contentType = req.headers['content-type'];
        let accept = req.headers['accept'];
        const mediaMapping = {
            'application/json': {
                request: Hookend_1.response,
                error: Hookend_1.error,
            },
            'application/vnd.api+json': {
                request: JSONAPI_1.response,
                error: JSONAPI_1.error,
            },
            'multipart/form-data': {
                request: Hookend_1.response,
                error: Hookend_1.error,
            }
        };
        let type = '';
        if (req.method === 'GET') {
            if (mediaMapping[accept]) {
                type = accept;
            }
            else {
                type = 'application/json';
            }
        }
        else {
            if (mediaMapping[contentType]) {
                type = contentType;
            }
            else if (process.env.NODE_ENV === 'production') {
                type = 'application/json';
            }
        }
        if (!mediaMapping[type]) {
            mediaMapping[type] = {
                request: Hookend_1.response,
                error: Hookend_1.error,
            };
        }
        const currentHandler = mediaMapping[type];
        if (currentHandler.error(req, res)) {
            currentHandler.request(req, res);
        }
    }
    catch (e) {
        const error = errorHandler_1.createError(null, {
            model: 'ResponseHandler',
            method: 'contentTypes',
            status: 500,
            error: e,
        });
        res.status(500);
        res.json(error);
    }
};
