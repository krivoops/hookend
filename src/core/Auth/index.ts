import {HookendApplication, HookendRequest} from "@core/types/server";
import Jwt from './methods/jwt'
import {createError} from "@core/API/API/errorHandler";
import getPermissions from "@utils/auth/getPermissions";

export default class Auth {
    private app: HookendApplication;
    private api: any;
    public method: Jwt;

    constructor(app, api, usersModelStings) {
        this.app = app;
        this.api = api;

        this.method = new Jwt(this.app, this.api, usersModelStings, this.app.config.AUTH_SECRET);
        this.init();
    }

    private init() {
        this.app.use(async (req: HookendRequest, res, next) => {
            req.auth = await this.method.toAuthenticate({ request: req, secret: this.app.config.AUTH_SECRET });
            req.auth = await this.generateAuthFn(req);

            next();
        })
    }

    public async generateAuthFn(req:any = {}, defaultUser?) {
        let auth = req.auth;
        if (!auth) {
            const user = defaultUser || {
                _app: this.app,
                groups: {
                    1: 32
                }
            };
            auth = {
                permissions: await getPermissions(user),
                default: user
            };
        }

        auth.getUser = function () {
            return auth.default || auth.user
        };

        return auth
    }

    public async checkAccess(req, condition, additionals?) {
        let access = false;
        if (typeof condition === 'boolean') {
            access = condition
        } else if (typeof condition === 'function' && req.auth && req.auth.user) {
            try {
                access = await condition.call(this, req.auth.permissions, req);
            } catch (e) {
                console.log(e)
            }
        } else if (typeof condition === 'string') {
            if (condition === 'auth') {
                access = !!req.auth.user;
            }
        }

        if (access) {
            return access
        } else {
            createError(req, {
                code: `PERMISSION_DENIED_${additionals.model.toUpperCase()}_${additionals.method.toUpperCase()}`,
                status: 403,
                model: additionals.model,
                method: additionals.method,
                detail: {
                    title: 'Permission denied',
                    description: `You are not having access to ${additionals.model}/${additionals.method}`
                }
            });
        }
        return false
    }
}
