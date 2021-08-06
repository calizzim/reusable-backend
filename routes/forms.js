const express = require("express");
const route = express.Router();

const fh = require("../classes/FormHandler");
const formNameValid = require('../middleware/formNameValid')

//get a form and its data, if !dependencies return null
//if !template no template if !data no data
route.get('/ready', async (req,res) => {
  let data = await fh.ready(req.token)
  res.status(200).send({data})
})

route.get("/:formName", formNameValid, async (req, res) => {
  let data = null
  if(!(await req.form.dependenciesFulfilled(req.token))) return res.status(200).send({ data })
  data = { template: req.form.template, data: (await req.form.data(req.token)) }
  res.status(200).send({ data })
})

//upload a form, return error if invalid otherwise null
route.post("/:formName", formNameValid, async (req, res) => {
  let data = await req.form.upload(req.body, req.token)
  if(typeof(data)=="string") return res.status(400).send({ error: data })
  res.status(200).send({ data })
});

//asynchronously verify a given field
route.post("/verify/:formName", formNameValid, async (req, res) => {
  let data = req.form.validateField(req.body.name, req.body.value, req.token)
  return res.status(200).send({ data });
});


module.exports = route;
