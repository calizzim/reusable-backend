const express = require('express')
const route = express.Router()
const authenticator = require('../middleware/authenticator')
const fh = require('../classes/FormHandler')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const config = require('config')

route.get('/', authenticator, async (req,res) => {
    return res.status(200).send({data: true})
})

route.get('/signup', (req,res) => {
  let data = { template: fh.forms.user.template, data: null }
  return res.status(200).send({ data })
})

route.get('/login', (req,res) => {
  let data = { template: fh.forms.login.template, data: null }
  return res.status(200).send({ data })
})

//a new user is created
route.post("/signup", async (req, res) => {
  let error = await fh.newUser(req.body)
  if(error) return res.status(400).send({ error })
  res.status(200).send({ data: null })
});

//login attempt
route.post("/login", async (req, res) => {
  let login = req.body;
  let _id = await fh.authenticateLogin(login);
  if (!_id) return res.status(400).send({ error: "invalid username or password" });
  let data = jwt.sign({ id: _id }, config.get("privateKey"));
  return res.status(200).send({ data });
});

//asynchrounous verification of user
route.post("/verify", async (req, res) => {
  let data = await fh.forms.user.validateField(req.body.name, req.body.value, null);
  return res.status(200).send({ data });
});

module.exports = route