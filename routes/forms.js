const express = require("express");
const route = express.Router();
const FormHandler = require("../classes/FormHandler");
const formHandler = new FormHandler();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const config = require("config");
const authenticator = require("../middleware/authenticator");

const templateName = (req,res,next) => {
  const result = formHandler.checkName(req.params.templateName)
  if(!result) return res.status(404).send({ error: 'invalid template name' })
  next()
}

//get a list of forms that the user has completed
route.get("/completed", authenticator, async(req,res) => {
  let completed = await formHandler.database.getCompleted(req.token)
  return res.status(200).send({ data: completed })
})

//get the computed properties of a form
route.get("/computed/:templateName", authenticator, templateName, async (req,res) => {
  let computed = await formHandler.getComputed(req.params.templateName, req.token)
  if(!computed) return res.status(404).send({ error: 'data not found' })
  return res.status(200).send({ data: computed })
});

//client requests a specific template object
route.get("/:templateName", templateName, (req, res) => {
  const templateName = req.params.templateName;
  const template = formHandler.getTemplateClient(templateName);
  if(!formHandler.hasDependencies(templateName)) res.status(200).send(template)
  authenticator(req,res,() => {
    if(formHandler.database.checkDependencies(templateName,req.token)) return res.status(200).send(template)
    return res.status(400).send({ error: "the template you have requested has dependencies which have not been fulfilled" })
  })
})

//client checks if they are allowed to access a template (if dependencies have been fulfilled)
route.get("/permission/:templateName", authenticator, templateName, (req, res) => {
  const templateName = req.params.templateName;
  if(!formHandler.hasDependencies(templateName)) res.status(200).send(true)
  if(formHandler.database.checkDependencies(templateName,req.token)) return res.status(200).send(true)
  return res.status(400).send(false)
})

//client requests a specific form object and form data
route.get("/formdata/:templateName", authenticator, templateName, async (req, res) => {
  const templateName = req.params.templateName;
  if (["user", "login"].includes(templateName))
    return res.status(400).send({ error: "user data cannot be requested" });
  const formData = await formHandler.database.getFormData(
    templateName,
    req.token
  );
  if (!formData)
    return res
      .status(404)
      .send({ error: "data under provided form name and id was not found" });
  return res.status(200).send({ data: formData });
});

//a new user is created
route.post("/user", async (req, res) => {
  const newUser = req.body;
  const error = await formHandler.verify(newUser, "user");
  if (error) return res.status(400).send({ error: error });
  const salt = await bcrypt.genSalt();
  newUser.password = await bcrypt.hash(newUser.password, salt);
  await formHandler.database.newUser(newUser);
  res.status(200).send({ data: "new user created" });
});

//login attempt
route.post("/login", async (req, res) => {
  const login = req.body;
  const error = await formHandler.verify(login, "login");
  if (error) return res.status(400).send({ error: error });
  const _id = await formHandler.database.authenticateLogin(login);
  if (!_id)
    return res
      .status(400)
      .send({ error: "invalid username and password combonation" });
  const token = jwt.sign({ id: _id }, config.get("privateKey"));
  return res.status(200).send({ data: token });
});

//client uploads a completed form to the server
route.post("/:templateName", authenticator, async (req, res) => {
  const templateName = req.params.templateName;
  if (!formHandler.checkName(templateName))
    return res
      .status(404)
      .send({ error: `${templateName} is not an available form` });
  const error = await formHandler.verify(req.body, templateName, req.token);
  if (error) return res.status(400).send({ error: error });
  formHandler.database.upload(templateName, req.body, req.token);
  let computed = await formHandler.getComputed(templateName, req.token, req.body);
  res.status(200).send({ data: computed });
});

//asynchronous verification (different for user and other forms)
route.post("/asyncVerify/user", async (req, res) => {
  const { name, value } = req.body;
  let result = await formHandler.database.verify('user', name, value, null);
  return res.status(200).send({ data: result });
});

route.post("/asyncVerify/:templateName", authenticator, templateName, async (req, res) => {
  const templateName = req.params.templateName;
  const { name, value } = req.body;
  let result = await formHandler.database.verify(
    templateName,
    name,
    value,
    req.token
  );
  return res.status(200).send({ data: result });
});

module.exports = route;
