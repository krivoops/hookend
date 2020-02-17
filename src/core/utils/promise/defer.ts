const defer = () => {
    const deferred: any = {};
    deferred.promise = new Promise(function(resolve, reject) {
        deferred.resolve = resolve;
        deferred.reject  = reject;
    });
    return deferred;
};

export {
    defer
}
