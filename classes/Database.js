const config = require('config');
const db = require('mongoose');
const bcrypt = require('bcrypt');

const nativeAsyncValidators = require('../../native/functions/asyncValidators')
const reusableAsyncValidators = require('../functions/asyncValidators')

module.exports = class {
  constructor(formHandler) {
    this.asyncValidatorFunctions = { ...nativeAsyncValidators, ...reusableAsyncValidators }

    this.templates = formHandler.serverTemplates

    //create schema from templates
    this.models = {}
    for (let templateName in this.templates) {
      let template = this.templates[templateName]
      let schema = new db.Schema({})
      for (let key in template) {
        let temp = {}
        temp[key] = template[key].dType
        schema.add(temp)
      }
      if (templateName != 'user') schema.add({ _id: db.Types.ObjectId })
      this.models[templateName] = db.model(templateName, schema)
    }

    //connect to the database
    const databaseURL = config.get('databaseURL')
    db.connect(databaseURL, { useUnifiedTopology: true, useNewUrlParser: true })
      .then(() => console.log('connected to database successfully'))
      .catch(error => console.log(error));
  }

  async upload(templateName, data, token) {
    const Model = this.models[templateName]
    let result = await Model.findByIdAndUpdate(token.id, data, { useFindAndModify: false })
    if (result) return
    const newEntry = new Model(data, Object.assign(data, { _id: token.id }))
    result = await newEntry.save()
    return result
  }

  async newUser(data) {
    const User = this.models.user
    const newUser = new User(data)
    const result = await newUser.save()
    return result
  }

  async authenticateLogin(data) {
    const Model = this.models.user
    let user = await Model.findOne({ email: data.email })
    if (!user) return null
    if (await bcrypt.compare(data.password, user.password)) return user._id
    return null
  }

  async getCompleted(token) {
    let modelKeys = Object.keys(this.models)
    let data = await Promise.all(modelKeys.map(k => {
      let Model = this.models[k]
      return Model.findById(token.id)
    }))
    let completed = data.reduce((a,c,i) => {
      a[modelKeys[i]] = Boolean(c)
      return a
    },{})
    return completed
  }

  async getFormData(templateName, token) {
    const Model = this.models[templateName]
    if (!Model || !token.id) return null
    let formData = await Model.findById(token.id)
    return formData
  }

  async verify(templateName, name, value, token) {
    const validators = this.templates[templateName][name].asyncValidators
    if (!validators || !value) return null
    for (let validator of validators) {
      let result = await this.asyncValidatorFunctions[validator](templateName, name, value, token)
      if (result) return result
    }
    return null
  }
}