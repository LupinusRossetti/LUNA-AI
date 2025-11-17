const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
const fs = require("fs");

const mode = process.env.APP_ENV || "fiona"; // iris/fiona

const envFile = `.env.${mode}`;
if (fs.existsSync(envFile)) {
  dotenvExpand.expand(dotenv.config({ path: envFile }));
}

const nextConfig = {
  reactStrictMode: true,
  distDir: mode === "iris" ? ".next-iris" : ".next-fiona",
};

module.exports = nextConfig;
