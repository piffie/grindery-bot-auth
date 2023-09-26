require("dotenv").config();

module.exports = {
  timeout: 100000,
  exit: true,
  require: "src/test/hooks.mjs",
  "async-only": true,
  retries: parseInt(process.env.RETRIES),
};
