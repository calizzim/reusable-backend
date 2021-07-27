module.exports = {
  unique: async (database, formName, name, value, token) => {
    let query = {}; query[name] = value
    let result = await database.models[formName].findOne(query)
    if (result) return { unique: 'has already been taken' }
    return null
  }
}