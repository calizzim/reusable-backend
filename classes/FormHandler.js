const fs = require('fs')
const path = require('path')
const db = require('./Database')
const Form = require('./Form')
const bcrypt = require('bcrypt')

class FormHandler {
    
    constructor() {
      this.forms = {}
      let formPaths = ['../templates', '../../native/templates']
      formPaths.forEach(formPath => {
        formPath = path.join(__dirname, formPath)
        let formNames = fs
          .readdirSync(formPath)
          .filter(ele => ele.split('.').length > 1 && ele.split('.')[1] == 'js')
          .map(ele => ele.split('.')[0])

        for(let formName of formNames) {
          let form = require(path.join(formPath,formName))
          this.forms[formName] = new Form(formName, form, db, this)
        }
      })

      Object.values(this.forms).forEach(form => form.initDependencies())
    }

    //formnames
    formNames() {
      return Object.keys(this.forms)
    }
    hasForm(formName) {
      return this.formNames().includes(formName)
    }

    //computed data
    async getComputedForDepencencies(form, token) {
      if(!form.hasDependencies()) return []
      let allComputedData = form.hardDependencies().map(d => this.forms[d].getComputedData(token))
      return await Promise.all(allComputedData)
    }

    async newUser(data) {
      let userForm = this.forms.user
      const error = await userForm.validate(data, null);
      if(error) return error
      const salt = await bcrypt.genSalt();
      data.password = await bcrypt.hash(data.password, salt);
      let newUser = userForm.model(data)
      await newUser.save()
    }

    async authenticateLogin(data) {
      const model = this.forms.user.model;
      let user = await model.findOne({ email: data.email });
      if (!user) return null;
      if (await bcrypt.compare(data.password, user.password)) return user._id;
      return null;
    }
  
    async getCompleted(token) {
      let data = await Promise.all(
        Object.values(this.forms).map(form => {
          return form.model.findById(token.id);
        })
      );
      return data.reduce((a, c, i) =>
        Object.assign(a, { [Object.keys(this.forms)[i]]: Boolean(c) })
      ,{});
    }

    async ready(token) {
      return (await Promise.all(
        Object.values(this.forms).map(f => f.dependenciesFulfilled(token))
      )).reduce((a,c,i) => 
      Object.assign(a, { [Object.keys(this.forms)[i]]: Boolean(c) }),{})
    }
}

module.exports = new FormHandler()