import {set} from "object-path";

export default (income) => {
    if (typeof income === 'undefined') {
        return {}
    }
    if (typeof income === 'object' && !Array.isArray(income)) {
        return income
    }
    income = typeof income === 'string'
        ? income.split(',')
        : income;

    return income.reduce((obj, item) => {
        set(obj, item, {});
        return obj
    }, {})
}
