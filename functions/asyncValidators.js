let functions = {
  unique: async (form, fieldName, fieldValue, token) => {
    let query = { [fieldName]:fieldValue };
    let result = await form.model.findOne(query)
    if (result) return { unique: 'has already been taken' }
    return null
  },
  zipcodeOrCounty: async (form, fieldName, fieldValue, token) => {
    // let state = (await database.models.salaryInfo.findById(token.id)).state
    // let taxes = propertyTaxes.getTaxrateZipcode(value)
    // if(taxes) return null
    // taxes = propertyTaxes.getTaxrateCounty(state,value)
    // if(taxes) return null
    // let message
    // if(/\d/.test(value.slice(0,1))) message = 'this zipcode is invalid'
    // else message = state + ' does not have a county with this name'
    // return { zipcodeOrCounty: message }
    return null
  }
}

module.exports = (name) => functions[name]