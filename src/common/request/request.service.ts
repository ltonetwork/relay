import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { LoggerService } from '../logger/logger.service';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class RequestService {
  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async send(config: AxiosRequestConfig): Promise<AxiosResponse> {
    try {
      return await lastValueFrom(this.http.request(config));
    } catch (error) {
      if (!error.response) {
        this.log(error, config.method, config.url);
        throw error;
      }

      return error.response;
    }
  }

  async get<T>(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse<T>> {
    config.method = 'get';
    config.url = url;
    return await this.send(config);
  }

  async delete(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    config.method = 'delete';
    config.url = url;
    return await this.send(config);
  }

  async head(url: string, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    config.method = 'head';
    config.url = url;
    return await this.send(config);
  }

  async post(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    config.method = 'post';
    config.url = url;
    config.data = data;
    return await this.send(config);
  }

  async put(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    config.method = 'put';
    config.url = url;
    config.data = data;
    return await this.send(config);
  }

  async patch(url: string, data?: any, config: AxiosRequestConfig = {}): Promise<AxiosResponse> {
    config.method = 'patch';
    config.url = url;
    config.data = data;
    return await this.send(config);
  }

  private log(e, method, url) {
    this.logger.error(`request: failed send '${method}: ${url}', error: '${e}'`, {
      stack: e.stack,
      response: e.response ? e.response.data : undefined,
    });
  }
}
