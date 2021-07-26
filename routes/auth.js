const express = require('express')
const route = express.Router()
const authenticator = require('../middleware/authenticator')

route.get('/',authenticator,async (req,res) => {
    return res.status(200).send({data: true})
})

module.exports = route