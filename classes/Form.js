const typesToValidators = require("../functions/typeToValidators");
const options = require("../functions/options");
const _ = require("lodash");
const getAsyncValidator = require("../functions/asyncValidators");
const { object } = require("joi");

module.exports = class {
  constructor(name, form, database, fh) {
    this.form = form;
    this.name = name;
    this.db = database;
    this.fh = fh;
    this._initTemplate();
    this._initValidator();
    this._initModel();
  }

  //model
  _initModel() {
    let schema = {};
    if (this.hasTemplate()) {
      schema = Object.keys(this._validator).reduce(
        (schema, key) =>
          Object.assign(schema, { [key]: this._validator[key].dType }),
        {}
      );
    }
    schema.computed = String;
    if (this.name != "user") schema._id = this.db.Types.ObjectId;
    schema = new this.db.Schema(schema);
    this.model = this.db.model(this.name, schema);
  }

  //get form data
  async data(token) {
    let native = await this.model.findOne({ _id: token.id });
    let computed = null
    if(native && native.computed) {
      native = native._doc
      computed = JSON.parse(native.computed)
      delete native.computed
    }
    return { computed, native }
  }

  //computed data
  computeData(data, previous) {
    if(!this.form.computed) return null
    return this.form.computed.reduce((properties, current) => {
      properties[current.name] = current.compute(data, properties, previous);
      return properties;
    }, {});
  }

  //dependents
  async upload(data, token) {
    let error = await this.validate(data, token)
    if(error) return error
    return await this._uploadAndUpdate(data, token)
  }

  async _uploadAndUpdate(data, token) {
    let dependents = await this._findSortedDependents(token)
    let dependencies = this._getDependentsDependencies(dependents)
    let dependenciesData = Promise.all(dependencies.map(d => this.fh.forms[d].data(token)))
    let dependentsData = Promise.all(dependents.map(d => d == this.name ? null : this.fh.forms[d].data(token)))
    dependenciesData = await dependenciesData
    dependentsData = (await dependentsData).map(d => d?d.native:d)
    let previous = dependencies.reduce((a,c,i) => Object.assign(a, { [c]: dependenciesData[i] }), {})
    let uploadPromises = []
    dependents.forEach((c,i) => {
      let currentForm = this.fh.forms[c]
      let native = c == this.name ? data : dependentsData[i]
      let computed = currentForm.computeData(native, previous)
      previous[c] = { native, computed }
      uploadPromises.push(currentForm._upload(previous[c], token))
    })
    await Promise.all(uploadPromises)
    return previous[this.name].computed
  }
  async _upload(data, token) {
    let toUpload = data.native || {}
    toUpload.computed = JSON.stringify(data.computed)
    if(this.model.schema.obj._id) {
      toUpload._id = token.id;
      return await this.model.findOneAndUpdate({ _id: token.id }, toUpload, { upsert: true });
    } 
    return await (new this.model(toUpload)).save()
  }
  async _findSortedDependents(token) {
    let dependents = this._findDependents()
    let completed = await this.fh.getCompleted(token)
    dependents = [...dependents].filter(d => completed[d] || d==this.name)
    return this._sortDependents(dependents)
  }
  _findDependents() {
    let allDependent = new Set()
    this._findDependentsR(this.name, allDependent)
    return allDependent
  }
  _findDependentsR(current, visited) {
    current = this.fh.forms[current]
    if(visited.has(current.name)) return
    visited.add(current.name)
    for(let dependent of current.dependents) {
      this._findDependentsR(dependent, visited)
    }
  }
  _sortDependents(dependents) {
    let sDependents = []
    let visited = new Set()
    dependents.forEach(dependent => this._sortDependentsR(dependent, visited, sDependents, new Set(dependents)))
    return sDependents
  }
  _sortDependentsR(current, visited, stack, allDependents) {
    current = this.fh.forms[current]
    if(visited.has(current.name)) return
    visited.add(current.name)
    if(current.hardDependencies()) current.hardDependencies().forEach(dependency => {
      if(allDependents.has(current)) this._sortDependentsR(dependency, visited, stack, allDependents)
    })
    stack.push(current.name)
  }
  _getDependentsDependencies(dependents) {
    let dependencies = dependents.reduce((allDependencies, dependent) => {
      let dependencies = this.fh.forms[dependent].hardDependencies() || []
      dependencies.forEach(dependency => allDependencies.add(dependency))
      return allDependencies
    }, new Set())
    return [...dependencies].filter(c => !dependents.includes(c))
  }

  //dependencies
  initDependencies() {
    let dependencies = this.dependencies() || [];
    for(let dependency of dependencies) {
      if (!this.fh.formNames().includes(dependency))
        throw new Error(
          `${this.name} has an invalid dependency: ${dependency}`
        );
    }
    this.dependents = []
    Object.values(this.fh.forms).forEach(f => {
      if(f.dependencies() && f.hardDependencies().includes(this.name)) this.dependents.push(f.name)
    })
  }
  dependencies() {
    if(!this.form.dependencies) return null
    return this.form.dependencies.hard.concat(this.form.dependencies.soft);
  }
  hardDependencies() {
    if(!this.form.dependencies) return null
    return this.form.dependencies.hard
  }
  softDependencies() {
    if(!this.form.dependencies) return null
    return this.form.dependencies.soft
  }
  async dependenciesFulfilled(token) {
    let completed = await this.fh.getCompleted(token);
    return (this.dependencies() || [])
      .map((d) => completed[d])
      .reduce((a, v) => a && v, true);
  }

  //validator
  async validate(data, token) {
    let error = this._validateSync(data);
    if (error) return error;
    error = await this._validateAsync(data, token);
    if (error) return error;
    return null;
  }
  _initValidator() {
    this._validator = null;
    if (this.hasTemplate()) {
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
            validator => getAsyncValidator(validator)
          );
        }
        if (typeof component.options == "string")
          component.options = options(component.options);
        validator[component.name] = component;
      });
    });
    return validator;
  }
  _validateSync(data) {
    for (let key in this._validator || [])
      if (!(key in data)) return "data is missing some keys in the template";
    if (Object.keys(this._validator).length != Object.keys(data).length)
      return "data has additional keys not in the template";
    for (let key in this._validator) {
      data[key] = this._validator[key].dType(data[key]);
      for (let validator of this._validator[key].validators) {
        if (!validator.expression.test(data[key]))
          return `field ${key} ${validator.message}`;
      }
      if (
        ["dropdown", "radio"].includes(this._validator[key].type) &&
        !this._validator[key].options.includes(data[key])
      ) {
        return `field ${key} must be one of the following options ${this._validator[key].options}`;
      }
    }
    return null;
  }
  async _validateAsync(data, token) {
    let allPromises = [];
    for (let key in this._validator || []) {
      let asyncValidators = this._validator[key].asyncValidators || [];
      let promises = asyncValidators.map((validator) =>
        validator(this, key, data[key], token)
      );
      allPromises.push(Promise.all(promises));
    }
    allPromises = await Promise.all(allPromises);
    for (let error of allPromises.reduce((a, c) => a.concat(c), [])) {
      if (error) return error;
    }
  }

  async validateField(field, value, token) {
    let asyncValidators = this._validator[field].asyncValidators;
    let errors = await Promise.all(asyncValidators.map((validator) =>
      validator(this, field, value, token)
    ));
    for(let error of errors) {
      if(error) return error
    }
    return null
  }

  //template
  hasTemplate() {
    return Boolean(this.template)
  }
  _initTemplate() {
    this.template = null;
    if (this.form.template) {
      this.template = this._createTemplate();
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
};