const _ = require('lodash')
const fs = require('fs')
const path = require('path')

options = {
    states: JSON.parse(fs.readFileSync(path.join(__dirname,'../files/states.json'))).map(state => state.name)
}

module.exports = (option) => {
    return _.cloneDeep(options[option])
}