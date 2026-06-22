import { cp } from 'node:fs/promises';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
    'bin/skillink': 'src/bin/skillink.ts',
  },
  format: ['esm'],
  dts: true,
  clean: true,
  shims: true,
  minify: false,
  target: 'node20',
  splitting: true,
  esbuildOptions(options) {
    options.banner = {
      js: `import { createRequire } from 'module';const require = createRequire(import.meta.url);`,
    };
  },
  // 默认配置模板是纯文本，构建后复制到 dist/templates，供运行时 fs 读取
  async onSuccess() {
    await cp('src/templates', 'dist/templates', { recursive: true });
  },
});
