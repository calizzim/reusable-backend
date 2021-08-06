const fh = require('../classes/FormHandler')

module.exports = (req,res,next) => {
  if(req.params.formName == 'user')
    return res.status(400).send('acess denied - cannot retreive user data')
  const form = fh.forms[req.params.formName]
  if(!form) return res.status(404).send({ error: 'invalid form name' })
  req.form = form
  next()
}