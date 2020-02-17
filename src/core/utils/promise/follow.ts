const follow = (tasks) => {
    return tasks.reduce((promiseChain, currentTask) => {
        return promiseChain.then(chainResults =>
            currentTask.then(currentResult => {
                return [ ...chainResults, currentResult ]
            })
        );
    }, Promise.resolve([]));
};

export {
    follow
}
