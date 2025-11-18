const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");
const fs = require("fs");

const mode = process.env.APP_ENV || ".A"; // .A/.B .env.Aもしくはenv.B

const envFile = `.env${mode}`;
if (fs.existsSync(envFile)) {
  dotenvExpand.expand(dotenv.config({ path: envFile }));
}

const nextConfig = {
  reactStrictMode: true,
  distDir: mode === ".A" ? ".next-A" : ".next-B",
};

module.exports = nextConfig;
