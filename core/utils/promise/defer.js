"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const defer = () => {
    const deferred = {};
    deferred.promise = new Promise(function (resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject = reject;
    });
    return deferred;
};
exports.defer = defer;
