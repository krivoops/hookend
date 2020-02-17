import error from '../../../utils/errors';

export default (req, res) => {
    try {
        if (req.requestErrors.length) {
            const errorResult = {
                success: false,
                errors: req.requestErrors,
                status: req.requestErrors.reduce(
                    (max, p) => p.status > max ? p.status : max,
                    req.requestErrors[0].status,
                ),
            };

            res.status(errorResult.status);
            res.json(errorResult);
        } else if (!req.requestResults.length) {
            res.status(404);
            res.json(error({
                status: 404,
                title: 'Unhandled Route',
                detail: 'This route is not described',
                code: 'UNHANDLED_ROUTE',
                success: false,
            }));
        } else {
            return true;
        }
    } catch (e) {
        res.status(500);
        res.end('500 | Internal Server Error');
    }
};
