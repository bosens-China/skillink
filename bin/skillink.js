#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// 检查 dist 目录是否存在
const distPath = path.join(__dirname, '..', 'dist', 'index.js');

if (!fs.existsSync(distPath)) {
  console.error('错误: 未找到编译后的文件，请先运行 pnpm build');
  console.error('  pnpm build');
  process.exit(1);
}

// 加载编译后的入口
require(distPath);
