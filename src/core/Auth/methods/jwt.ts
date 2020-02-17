import {HookendRequest, HookendApplication} from '@core/types';
import API from '@core/API';

import { createError } from "@core/API/API/errorHandler";

import * as jwt from 'jsonwebtoken';
import getPermissions from "@utils/auth/getPermissions";

function getTime (plus = 0) {
    return Math.round(new Date().getTime() / 1000) + plus
}

interface AuthAuthenticate {
    request: HookendRequest,
    secret: string,
    token?: string,
}

// TODO declare types
class JwtAuth {
    private app: HookendApplication;
    private api: API;
    private secret: string;
    private users: any;

    constructor (app, api, users, secret) {
        this.app = app;
        this.api = api;
        this.users = users;
        this.secret = secret;
    }

    public verify (token: string, secret: string, validateByTime = true) {
        return jwt.verify(token, secret, function (err, decoded) {
            return decoded || null
        })
    }

    public async generate ({
                user,
                additions = {},
                expire = this.app.config.AUTH_EXPIRE_TIME
              }, secret) {

        const permissions:any = await getPermissions(user);
        return jwt.sign(
            {
                _id: user._id,
                iat: getTime(),
                exp: getTime(expire),
                ...additions
            },
            secret
        )
    }

    public async toAuthenticate({request, secret}: AuthAuthenticate) {
        let currentToken;
        try {
            currentToken = this.clearToken(request.headers.authorization);
        } catch (e) {
            return false
        }

        if (currentToken) {
            const decoded = this.verify(currentToken, secret);
            if (decoded) {
                const user = await this.app.models[this.users].get_one({
                    ids: [decoded._id]
                });

                // TODO rework auth
                if (!user) {
                    return false
                }

                const permissions = await getPermissions(user);
                return {
                    ...decoded,
                    permissions: permissions,
                    user,
                    request: {
                        params: request.params,
                        query: request.query
                    }
                }
            } else {
                createError(request, {
                    model: 'Auth',
                    method: 'access',
                    detail: {
                        field: 'accessToken',
                        description: `Probably access is expired`
                    },
                    code: 'ACCESS_IS_EXPIRED',
                    status: 401,
                });
                return false
            }
        }
        return false
    }

    private clearToken(token) {
        return token.replace('Bearer ', '')
    }

    public async createAccessAndRefresh({ req }, user): Promise<any> {
        const accessToken = await this.generate({
            user
        }, this.app.config.AUTH_SECRET);
        const refreshToken = await this.generate({
            user,
            expire: this.app.config.AUTH_EXPIRE_REFRESH_TIME
        }, accessToken);
        const auth = await this.app.models.auths.createDataController({
            accessToken: accessToken,
            refreshToken: refreshToken,
            user: user._id
        });

        user.refreshTokens.push(refreshToken);
        const userUpdateResult = await user.update({
            refreshTokens: user.refreshTokens
        });
        if (!userUpdateResult) {
            throw 'Can not update refreshToken'
        }

        auth.changeFields({
            _id: 1
        });

        if (req) {
            await this.api.sendModelData(auth, {
                request: req,
                models: this.app.models,
                included: {}
            })
        } else {
            return auth
        }
    }

    private async decodeRefresh(refreshToken, accessToken) {
        const decoded = this.verify(accessToken, this.app.config.AUTH_SECRET);
        let user;
        let decodedRefresh;
        if (decoded){
            user = await this.app.models[this.users].get_one({
                ids: [decoded._id],
                projection: {
                    refreshTokens: 1
                }
            })
        }

        if (user.refreshTokens.find(x => x === refreshToken)) {
            decodedRefresh = this.verify(refreshToken, accessToken);
        }

        return { decodedRefresh, user };
    }

    public toGenerateDependencies() {
        this.api.createRoute('post','auth', async ({req, res}, { body }) => {
            const validateResult = await this.api.validateBody({
                fields: ['email', 'password'],
                model: 'Auth',
                method: 'auth'
            }, req);

            if (validateResult.length) {
                return
            }

            const user = await this.app.models[this.users].get_one({
                query: {
                    email: body.email
                },
                projection: {
                    cart: 1,
                    password: 1
                },
                included: ['cart']
            });
            let pass = false;
            if (user) {
                pass = await user.comparePassword(body.password);
            }

            if (pass && user) {
                await user.mergeCart(body.cart);
                await this.createAccessAndRefresh({ req }, user)
            } else {
                createError(req, {
                    model: 'Auth',
                    method: 'auth',
                    detail: {
                        field: user ? 'password' : 'email',
                        description: `Wrong ${user ? 'password' : 'email'}`
                    },
                    code: user ? 'AUTH_FAIL_WRONG_PASSWORD' : 'AUTH_FAIL_WRONG_EMAIL',
                    status: 422,
                });
            }
        }, {
            model: 'Auth',
            method: 'auth',
            Model: this.app.models.auths,
        });

        this.api.createRoute('post', 'auth/refresh', async ({req, res}, { body, headers }) => {
            const validateResult = await this.api.validateBody({
                fields: ['refreshToken'],
                model: 'Auth',
                method: 'refresh'
            }, req);

            if (validateResult.length) {
                return
            }

            if (!headers.authorization) {
                createError(req, {
                    model: 'Auth',
                    method: 'refresh',
                    detail: {
                        field: 'accessToken',
                        description: `Access token should be send in header`
                    },
                    code: 'AUTH_MISSING_ACCESS_TOKEN',
                    status: 422,
                });
            }

            const accessToken = this.clearToken(headers.authorization);
            const { decodedRefresh, user } = await this.decodeRefresh(body.refreshToken, accessToken);
            if (decodedRefresh) {
                await user.update({
                    refreshTokens: user.refreshTokens.filter(x => x !== body.refreshToken)
                });
                await this.createAccessAndRefresh({ req }, user);
            } else {
                createError(req, {
                    model: 'Auth',
                    method: 'refresh',
                    detail: {
                        field: 'refreshToken',
                        description: `Probably refresh is expired`
                    },
                    code: 'REFRESH_IS_EXPIRED',
                    status: 401,
                });
            }
        }, {
            model: 'Auth',
            method: 'refresh',
            Model: this.app.models.auths,
        });

        this.api.createRoute('post','auth/logout', async ({req, res}, { body, headers }) => {
            const validateResult = await this.api.validateBody({
                fields: ['refreshToken'],
                model: 'Auth',
                method: 'logout'
            }, req);

            if (validateResult.length) {
                return
            }

            if (!headers.authorization) {
                createError(req, {
                    model: 'Auth',
                    method: 'refresh',
                    detail: {
                        field: 'accessToken',
                        description: `Access token should be send in header`
                    },
                    code: 'AUTH_MISSING_ACCESS_TOKEN',
                    status: 422,
                });
            }

            const accessToken = this.clearToken(headers.authorization);
            const { decodedRefresh, user } = await this.decodeRefresh(body.refreshToken, accessToken);

            if (decodedRefresh) {
                await user.update({
                    refreshTokens: user.refreshTokens.filter(x => x !== body.refreshToken)
                });
                res.end()
            } else {
                createError(req, {
                    model: 'Auth',
                    method: 'logout',
                    detail: {
                        field: 'refreshToken',
                        description: `Probably refresh is expired`
                    },
                    code: 'REFRESH_IS_EXPIRED',
                    status: 401,
                });
            }
        }, {
            model: 'Auth',
            method: 'logout',
            Model: this.app.models.auths,
        })
    }
}

export default JwtAuth
