type ColorTextFn = (text: string) => string;

export class LoggerColorUtils {
  static isColorAllowed = () => !process.env.NO_COLOR;
  static colorIfAllowed = (colorFn: ColorTextFn) => (text: string) =>
    LoggerColorUtils.isColorAllowed() ? colorFn(text) : text;

  static clc = {
    green: LoggerColorUtils.colorIfAllowed((text: string) => `\x1B[32m${text}\x1B[39m`),
    yellow: LoggerColorUtils.colorIfAllowed((text: string) => `\x1B[33m${text}\x1B[39m`),
    red: LoggerColorUtils.colorIfAllowed((text: string) => `\x1B[31m${text}\x1B[39m`),
    magentaBright: LoggerColorUtils.colorIfAllowed((text: string) => `\x1B[95m${text}\x1B[39m`),
    cyanBright: LoggerColorUtils.colorIfAllowed((text: string) => `\x1B[96m${text}\x1B[39m`),
  };
}
