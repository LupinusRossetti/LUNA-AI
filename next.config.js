const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const dotenvExpand = require("dotenv-expand");

// =====================
// 1. .env読み込み
// =====================
const mode = process.env.APP_ENV ? `.${process.env.APP_ENV}` : ".A";
const envPath = `.env${mode}`;

if (fs.existsSync(envPath)) {
  dotenvExpand.expand(dotenv.config({ path: envPath }));
  console.log(`Loaded env: ${envPath}`);
} else {
  console.warn(`env file not found: ${envPath}`);
}

// =====================
// 2. PROMPT_FILE 読み込み
// =====================
let SystemPromptValue = process.env.NEXT_PUBLIC_SYSTEM_PROMPT || "";

if (process.env.PROMPT_FILE) {
  const promptFile = path.resolve(process.env.PROMPT_FILE);
  try {
    SystemPromptValue = fs.readFileSync(promptFile, "utf8");
    console.log(`Loaded prompt: ${promptFile}`);
  } catch (e) {
    console.error(`Failed to load prompt file: ${promptFile}`);
  }
}

// =====================
// 3. Next.js の環境変数として注入（DefinePlugin 不使用）
// =====================
module.exports = {
  reactStrictMode: true,
  distDir: mode === ".A" ? ".next-A" : ".next-B",

  env: {
    NEXT_PUBLIC_SYSTEM_PROMPT: SystemPromptValue,
  },
};
