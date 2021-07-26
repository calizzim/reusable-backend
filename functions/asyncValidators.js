module.exports = {
  unique: async (formName, name, value, token) => {
    let query = {}; query[name] = value
    let result = await this.models[formName].findOne(query)
    if (result) return { unique: 'has already been taken' }
    return null
  }
}