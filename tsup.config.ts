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
});
