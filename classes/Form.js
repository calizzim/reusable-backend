const typesToValidators = require("../functions/typeToValidators");
const options = require("../functions/options");
const _ = require("lodash");
const getAsyncValidator = require("../functions/asyncValidators");

module.exports = class {
  constructor(name, form, database, forms) {
    this.form = form;
    this.name = name;
    this.db = database;
    this.forms = forms;
    this._initTemplate();
    this._initValidator();
    this._initModel();
  }

  //model
  _initModel() {
    let schema;
    if (this.hasTemplate()) {
      schema = Object.keys(this._validator).reduce(
        (schema, key) =>
          Object.assign(schema, { [key]: this._validator[key].dType }),
        {}
      );
    }
    if (this.hasComputed()) schema.computed = String;
    if (this.name != "user") schema._id = this.db.Types.ObjectId;
    schema = this.db.Schema(schema);
    this._model = this.db.model(this.name, schema);
  }
  hasModel() {
    return Boolean(this.model);
  }
  model() {
    return this._model
  }

  //database
  upload(data, token) {
    if(this._model.schema.obj._id) data._id = token.id;
    if(this.hasComputed()) data.computed = JSON.stringify(this.computeData(data, token))
    await this._model.findOneAndUpdate({ _id: token.id }, data, { upsert: true });
  }
  async getData(token) {
    return await this._model.findOne({ _id: token.id });
  }

  //computed data
  hasComputed() {
    return Boolean(this.form.computed);
  }
  async getComputedData(token) {
    if (!this.hasComputed()) throw new Error("no computed data for this form");
    let allData = await getData(token);
    if (!allData) throw new Error("this form has not been submitted yet");
    return JSON.parse(allData.computed);
  }
  async computeData(data, token) {
    let previous = this.forms.getComputedForDependencies(this, token);
    return this.form.computed.reduce((properties, current) => {
      properties[current.name] = current.compute(data, properties, previous);
      return properties;
    }, {});
  }

  //dependencies
  initDependencies() {
    let dependencies = this.dependencies();
    dependencies.forEach((dependency) => {
      if (!this.forms.formNames().includes(dependency))
        throw new Error(
          `${formName} has an invalid dependency`
        );
    });
    this.dependents = []
    Object.values(this.forms.forms).forEach(f => {
      if(f.dependencies.hard.includes(this.name)) this.dependents.push(f.name)
    })
  }
  updateDependent(current, visited) {
    if(current in visited)
  }
  _findDependent() {

  }
  hasDependencies() {
    return Boolean(this.form.dependencies);
  }
  dependencies() {
    if (!this.hasDependencies())
      throw new Error(
        `dependencies requested for template ${this.name} which has none`
      );
    return this.dependencies.hard.concat(this.dependencies.soft);
  }
  hardDependencies() {
    if (!this.hasDependencies())
      throw new Error(
        `dependencies requested for template ${this.name} which has none`
      );
    return this.dependencies.hard;
  }
  softDependencies() {
    if (!this.hasDependencies())
      throw new Error(
        `dependencies requested for template ${this.name} which has none`
      );
    return this.dependencies.soft;
  }
  async dependenciesFulfilled(token) {
    let completed = this.forms.getCompleted(token);
    return this.hardDependencies()
      .map((d) => completed[d])
      .reduce((a, v) => a && v, true);
  }

  //validator
  _initValidator() {
    this._validator = null;
    if (this.form.template) {
      this._validator = this._createValidator();
    }
  }
  _createValidator() {
    let validator = {};
    let template = this.form.template;
    template.groups.forEach((group) => {
      group.components.forEach((component) => {
        component = _.cloneDeep(component);
        component.validators = typesToValidators(component.validators, false);
        if (component.asyncValidators) {
          component.asyncValidators = component.asyncValidators.map(
            (validator) => {
              getAsyncValidator(validator);
            }
          );
        }
        if (typeof component.options == "string")
          component.options = options(component.options);
        validator[component.name] = component;
      });
    });
    return template;
  }
  _validateSync(data) {
    for (let key in _validator)
      if (!(key in data)) return "data is missing some keys in the template";
    if (Object.keys(_validator).length != Object.keys(data).length)
      return "data has additional keys not in the template";
    for (let key in _validator) {
      data[key] = _validator[key].dType(data[key]);
      for (let validator of _validator[key].validators) {
        if (!validator.expression.test(data[key]))
          return `field ${key} ${validator.message}`;
      }
      if (
        ["dropdown", "radio"].includes(_validator[key].type) &&
        !_validator[key].options.includes(data[key])
      ) {
        return `field ${key} must be one of the following options ${_validator[key].options}`;
      }
    }
    return null;
  }
  async _validateAsync(data, token) {
    allPromises = [];
    for (let key in _validator) {
      let asyncValidators = _validator[key].asyncValidators;
      let promises = asyncValidators.map((validator) =>
        validator(this, key, data[key], token)
      );
      allPromises.push(Promise.all(promises));
    }
    allPromises = await promise.all(allPromises);
    for (let error of allPromises.reduce((a, c) => a.concat(c), [])) {
      if (error) return error;
    }
  }
  async validate(data, token) {
    if (!(await this.dependenciesFulfilled(token)))
      return "the dependencies of this template have not been fulfilled";
    let error = this._validateSync(data);
    if (error) return error;
    error = await this._validateAsync(data, token);
    if (error) return error;
    return null;
  }

  //template
  _initTemplate() {
    this._template = null;
    if (this.form.template) {
      this._template = this._createTemplate();
    }
  }
  _createTemplate() {
    let template = _.cloneDeep(this.form.template);
    template.groups.forEach((group) => {
      group.components.forEach((component) => {
        component.validators = typesToValidators(component.validators, true);
        if (typeof component.options == "string")
          component.options = options(component.options);
      });
    });
    return template;
  }
  hasTemplate() {
    return Boolean(this._template);
  }
  template() {
    if (!this.hasTemplate())
      throw new Error(
        `template requested for form ${this.name} which has no template`
      );
    return this._template;
  }
};