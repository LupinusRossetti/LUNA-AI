const fs = require('fs');
const path = require('path');

// プロンプトファイルの読み込み関数
const loadPromptFile = (filePath) => {
  if (!filePath) return '';
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (fs.existsSync(fullPath)) {
      return fs.readFileSync(fullPath, 'utf8');
    }
    console.warn(`Prompt file not found: ${fullPath}`);
    return '';
  } catch (error) {
    console.error(`Error loading prompt file ${filePath}:`, error);
    return '';
  }
};

// 環境変数からプロンプトファイルパスを取得して読み込む
const promptFileA = process.env.NEXT_PUBLIC_PROMPT_FILE_A || './prompts/iris.txt';
const promptFileB = process.env.NEXT_PUBLIC_PROMPT_FILE_B || './prompts/fiona.txt';
const systemPromptA = loadPromptFile(promptFileA);
const systemPromptB = loadPromptFile(promptFileB);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // セキュリティ強化: X-Powered-By ヘッダーを隠蔽
  eslint: {
    ignoreDuringBuilds: true,
  },
  webpack: (config) => {
    config.experiments = { ...config.experiments, topLevelAwait: true };
    return config;
  },
  env: {
    NEXT_PUBLIC_SYSTEM_PROMPT_A: systemPromptA,
    NEXT_PUBLIC_SYSTEM_PROMPT_B: systemPromptB,
  },
};

module.exports = nextConfig;
