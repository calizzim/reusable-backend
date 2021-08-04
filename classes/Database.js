const config = require("config");
const db = require("mongoose");

const databaseURL = config.get("databaseURL");
db.connect(databaseURL, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useFindAndModify: false,
  useCreateIndex: true,
})
  .then(() => console.log("connected to database successfully"))
  .catch((error) => console.log(error));

module.exports = db