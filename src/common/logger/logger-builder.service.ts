import { LoggerColorUtils } from './utils/colors.utils';
import { WINSTON } from '../../constants';
import { Injectable, Inject } from '@nestjs/common';
import winstonNs, { Logger } from 'winston';
import { ConfigService } from '../config/config.service';
import { TransformableInfo } from 'logform';

@Injectable()
export class LoggerBuilderService {
  public logger: Logger;

  constructor(private readonly config: ConfigService, @Inject(WINSTON) private readonly winston: typeof winstonNs) {
    this.logger = this.createLogger();
  }

  shouldLog(options?: { force?: boolean }): boolean {
    return !this.config.isEnv('test') || options?.force || false || this.config.getLog().force;
  }

  private createMessage(info: TransformableInfo): string {
    const msg = [
      [
        LoggerColorUtils.clc.cyanBright(`[${info.label}] `),
        `${info.timestamp}\t`,
        `${info.level}\t`,
        info.context ? LoggerColorUtils.clc.yellow(`[${info.context}] `) : '',
        `${info.message}`,
      ].join(''),
    ];

    for (const key in info) {
      if (['timestamp', 'basic', 'level', 'label', 'context'].includes(key)) {
        continue;
      }

      let value: string;
      if (typeof info[key] === 'string') {
        value = info[key];
      } else {
        try {
          const visited = new WeakSet();
          const replacer = (k: string, v: any): any => {
            if (typeof v === 'object' && v !== null) {
              if (visited.has(v)) {
                return '[Circular]';
              }
              visited.add(v);
            }
            return v;
          };
          value = JSON.stringify(info[key], replacer, 2);
        } catch (error) {
          value = `[Unable to stringify: ${error.message}]`;
        }
      }
      msg.push(`\n${key}:\n${value}\n`);
    }

    return msg.join('\n');
  }

  get formats() {
    return [
      this.winston.format((info) => {
        info.level = info.level.toUpperCase();
        return info;
      })(),
      this.winston.format.label({ label: this.config.app.name }),
      this.winston.format.timestamp({ format: 'YYYY-MM-DD hh:mm:ss' }),
      this.winston.format.printf((info) => this.createMessage(info)),
    ];
  }

  private transportConsole() {
    return new this.winston.transports.Console({
      format: this.winston.format.combine(this.winston.format.colorize(), ...this.formats),
      handleExceptions: true,
    });
  }

  createLogger(): Logger {
    return this.winston.createLogger({
      level: this.config.getLog().level,
      transports: [this.transportConsole()],
    });
  }
}
