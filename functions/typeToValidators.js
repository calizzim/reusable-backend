const validators = require('./validators')
const _ = require('lodash')
const types = {
    email: [
        validators.required,
        validators.email,
        validators.maxLength(255)
    ],
    name: [
        validators.required,
        validators.onlyLetters,
        validators.minLength(2),
        validators.maxLength(20),
    ],
    username: [
        validators.required,
        validators.minLength(5),
        validators.maxLength(20),
    ],
    password: [
        validators.required,
        validators.minLength(8)
    ],
    currency: [
        validators.required,
        validators.currency
    ],
    integer: [
        validators.required,
        validators.integer
    ],
    number: [
        validators.required,
        validators.number
    ],
    zipcode: [
        validators.required,
        validators.minLength(5),
        validators.maxLength(5)
    ],
    required: [
        validators.required
    ],
    dropdown: [
        validators.required
    ],
    radio: [
        validators.required
    ],
}

module.exports = (type,isClient) => {
        let validators = _.cloneDeep(types[type])
        if(!isClient) return validators 
        return validators.map(validator => {
            let expression = validator.expression
            validator.expression = JSON.stringify({ source: expression.source, flags: expression.flags })
            return validator
        })
}