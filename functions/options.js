const _ = require('lodash')
const fs = require('fs')

options = {
    states: JSON.parse(fs.readFileSync('app/reusable-backend/files/states.json')).map(state => state.name)
}

module.exports = (option) => {
    return _.cloneDeep(options[option])
}