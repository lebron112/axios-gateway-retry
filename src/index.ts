import { AxiosStatic, AxiosInstance, AxiosRequestConfig } from "axios";
import isRetryAllowed from 'is-retry-allowed';

const namespace = 'request_retry';
const DEFAULT_SAFE_HEAD_METHOD = ['get', 'head', 'options', 'put', 'delete'];

/**
 * @param  {Error}  error
 * @return {boolean}
 */
export const isNetworkError = (error: any): boolean => {

  return (
    !error.response &&
    Boolean(error.code) && // Prevents retrying cancelled requests
    error.code !== 'ECONNABORTED' && // Prevents retrying timed out requests
    isRetryAllowed(error)
  ); // Prevents retrying unsafe errors
};

export function isNetworkOrIdempotentRequestError(error: any, methods: string[]) {
  return isNetworkError(error) || isIdempotentRequestError(error, methods);
}

/**
 * @param  {Error}  error
 * @return {boolean}
 */
export function isIdempotentRequestError(error: any, safeMethods: string[]): boolean {
  if (!error.config) return false;
  return isRetryableError(error) && safeMethods.indexOf(error.config.method) !== -1;
}

/**
 * @param  {Error}  error
 * @return {boolean}
 */
export function isRetryableError(error: any): boolean {
  return (
    error.code !== 'ECONNABORTED' &&
    (!error.response || (error.response.status >= 500 && error.response.status <= 599))
  );
}

type TCurrentState = {
  retryCount: number;
  lastTryGateway?: string;
  lastRequestTime?: number;
};

const getCurrentState = (config: AxiosRequestConfig<any>): TCurrentState => {
  const currentState = config[namespace] || {};
  currentState.retryCount = currentState.retryCount || 0;
  config[namespace] = currentState;
  return currentState;
};

/**
 * @param  {Axios} axios
 * @param  {AxiosRequestConfig} config
 */
function fixConfig(axios: any, config: any) {
  if (axios.defaults.agent === config.agent) {
    delete config.agent;
  }
  if (axios.defaults.httpAgent === config.httpAgent) {
    delete config.httpAgent;
  }
  if (axios.defaults.httpsAgent === config.httpsAgent) {
    delete config.httpsAgent;
  }
}

const getRequestOptions = (config: AxiosRequestConfig<any>, defaultOptions: IRequestConfig): IRequestConfig => {
  return { ...defaultOptions, ...config[namespace] };
};

export interface IRequestConfig {
  standbyGateway?: string[];
  mainGateway?: string;
  safeHeadMethod?: string[];
  retryDelay?: number;
}

const axiosGatewayRetry = (axios: AxiosStatic | AxiosInstance, defaultOptions: IRequestConfig) => {
  axios.interceptors.request.use((config) => {
    const currentState = getCurrentState(config);
    currentState.lastRequestTime = Date.now();
    const { standbyGateway, mainGateway } = getRequestOptions(config, defaultOptions);
    const findIndex = standbyGateway?.findIndex(item => item === mainGateway);
    if (findIndex && findIndex !== -1) {
      standbyGateway?.splice(findIndex, 1);
    }
    return config;
  });

  axios.interceptors.response.use(data => data, async (error) => {

    const { config } = error;

    if (!config) {
      return Promise.reject(error);
    }
    const currentState = getCurrentState(config);
    const {
      standbyGateway = [], safeHeadMethod = DEFAULT_SAFE_HEAD_METHOD, retryDelay, mainGateway,
    } = getRequestOptions(config, defaultOptions);

    // 第一次失败，如果mainGateway 和 当前的不匹配，则不进行重试
    const { url, baseURL } = config;
    const fullPath = url.startsWith('http') ? url : (baseURL + url);

    if (!currentState.retryCount) {
      if (!fullPath.startsWith(mainGateway)) {
        return Promise.reject(error);
      }
    }

    if (
      standbyGateway.length > 0 && currentState.retryCount < standbyGateway.length &&
      isNetworkOrIdempotentRequestError(error, safeHeadMethod)
    ) {

      if (config.timeout && currentState.lastRequestTime) {
        const lastRequestDuration = Date.now() - currentState.lastRequestTime as number;
        // Minimum 1ms timeout (passing 0 or less to XHR means no timeout)
        config.timeout = Math.max(config.timeout - lastRequestDuration, 1);
      }
      // const gatewayList: string[] = Array.from(new Set(standbyGateway));
      const gatewayList: string[] = standbyGateway;

      if (!currentState.retryCount) {
        config.url = fullPath.replace(mainGateway, gatewayList[currentState.retryCount]);
      } else {
        
        config.url = fullPath.replace(gatewayList[currentState.retryCount - 1], gatewayList[currentState.retryCount]);
      }
      currentState.retryCount += 1;

      fixConfig(axios, config);
      config.transformRequest = [(data: any) => data];
      return new Promise((resolve) => setTimeout(() => resolve(axios(config)), retryDelay));
    }

    return Promise.reject(error);
  });
};

export default axiosGatewayRetry;
