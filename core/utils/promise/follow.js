"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const follow = (tasks) => {
    return tasks.reduce((promiseChain, currentTask) => {
        return promiseChain.then(chainResults => currentTask.then(currentResult => {
            return [...chainResults, currentResult];
        }));
    }, Promise.resolve([]));
};
exports.follow = follow;
