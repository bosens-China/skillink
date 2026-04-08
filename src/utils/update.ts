// 声明全局注入的 require (由 tsup banner 提供)
declare const require: (id: string) => { version: string };

const pkg = require('../../package.json');

export const currentVersion = pkg.version;
