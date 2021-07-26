const jwt = require('jsonwebtoken')
const config = require('config')

module.exports = (req,res,next) => {
    const token = req.headers.token
    if(!token) return res.status(400).send({error: 'no token submitted'})
    try {
        req.token = jwt.verify(token, config.get('privateKey'))
        next()
    }
    catch(e) { res.status(400).send({ error: 'invalid token'}) }
}