const fs = require('fs')
const path = require('path')
const typesToValidators = require('../functions/typeToValidators')
const options = require('../functions/options')
const _ = require('lodash')
const axios = require('axios').default
const Database = require('./Database')

module.exports = class {
    
    constructor() {
      this.templateNames = []
      let templatePaths = ['../templates', '../../native/templates']

      this.clientTemplates = {}
      this.serverTemplates = {}
      this.computedTemplates = {}

      for(let templatePath of templatePaths) {
        let currentTemplateNames = fs
          .readdirSync(path.join(__dirname,templatePath))
          .map(ele => ele.split('.')[0])

        this.templateNames = this.templateNames.concat(currentTemplateNames)
  
        for(let templateName of currentTemplateNames) {
            let template = require(path.join(__dirname,templatePath,templateName))
            if(template.computed) {
                this.computedTemplates[templateName] = { properties: template.computed, order: template.order }
            }
            if(template.template) {
              this.clientTemplates[templateName] = this.convertTemplate(template.template,true)
              this.serverTemplates[templateName] = this.removeGroups(this.convertTemplate(template.template,false))
            }
        }
      }

      this.database = new Database(this)
    }

    checkName(templateName) {
        return this.templateNames.includes(templateName)
    }

    getTemplateClient(templateName) {
        if(!this.clientTemplates[templateName]) return null
        return this.clientTemplates[templateName]
    }

    getTemplateServer(templateName) {
        if(!this.serverTemplates[templateName]) return null
        return this.serverTemplates[templateName]
    }

    computeData(templateName, data, previous) {
        let computedTemplate = this.computedTemplates[templateName].properties
        return computedTemplate.reduce((properties,current) => {
            properties[current.name] = current.compute(data,properties,previous)
            return properties
        },{}) 
    }

    async getComputed(templateName, data, token) {
      let template = this.computedTemplates[templateName]
      if(!template) return null
      let order = template.order
      let names = [...Array(order).keys()].map(o => {
        let name = Object.keys(this.computedTemplates).find(k => this.computedTemplates[k].order == o)
        return name
      })
      let native = await Promise.all(names.map(name => {
        return this.database.getFormData(name,token)
      }))
      let previous = names.reduce((p,c,i) => {
        let computed = this.computeData(c, native[i], p)
        p[c] = { native: native[i], computed: computed }
        return p
      },{})
      return this.computeData(templateName, data, previous)
    }


    async verify(data, templateName, token = null) {
        const template = this.serverTemplates[templateName]
        for(let key in template) if(!(key in data)) return 'data is missing some keys in the template'
        if(Object.keys(template).length != Object.keys(data).length) return 'data has additional keys not in the template'
        for(let key in template) {
            data[key] = template[key].dType(data[key])
            for(let validator of template[key].validators) 
            { if(!validator.expression.test(data[key])) return `field ${key} ${validator.message}` }
            if(template[key].type == 'dropdown' && !(template[key].options.includes(data[key]))) 
            { return `field ${key} must be one of the following options ${template[key].options}` }
            let result = await this.database.verify(templateName,key,data[key],token)
            if(result) {
                result = result[Object.keys(result)[0]]
                return `${key} ${result}`
            }
        }
        return ''
    }
    
    convertTemplate(template,isClient) {
        template = _.cloneDeep(template)
        template.groups.forEach(group => {
            group.components.forEach(component => {
                component.validators = typesToValidators(component.validators, isClient)
                if(typeof(component.options) == 'string') component.options = options(component.options)
            });
        });
        return template
    }

    removeGroups(template) {
        let newTemplate = {}
        template.groups.forEach(group => {
            group.components.forEach(component => {
                newTemplate[component.name] = _.cloneDeep(component)
            });
        });
        return newTemplate
    }
}

