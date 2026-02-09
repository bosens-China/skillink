import pc from 'picocolors';

export const logger = {
  info: (msg: string) => console.log(pc.cyan(msg)),
  success: (msg: string) => console.log(pc.green(msg)),
  warn: (msg: string) => console.log(pc.yellow(msg)),
  error: (msg: string) => console.error(pc.red(msg)),
  gray: (msg: string) => console.log(pc.gray(msg)),
  title: (msg: string) => console.log(pc.bold(pc.magenta(msg))),
  newline: () => console.log(''),
};
