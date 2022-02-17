** axios插件，适配axios，网关轮询重试机制,参考自 [axios-retry](https://www.npmjs.com/package/axios-retry)  **


# Installation
```
npm i axios-gateway-retry
```

# Usage
```
import axios from 'axios';
import axiosGatewayRetry from 'axios-gateway-retry';
const instance = axios.create({
  withCredentials: false,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'content-type': 'application/json',
  },
  baseURL: 'http://gateway1.com',// example
});

// axiosGatewayRetry 需要在你的axios拦截器前调用
axiosGatewayRetry(instance, {
  mainGateway: ''http://gateway1.com'', // you main gateway
  standbyGateway: [
    'http://gateway2.com',
    'http://gateway3.com',
    'http://gateway4.com',
  ],
});
instance.interceptors.response.use(fn);
instance.interceptors.request.use(fn);
```
# Options
| Name           | Type     | Default                                    |  Description |
| -----------    | -------- |  ---------------------------------------   | -----------  |
| safeHeadMethod | string[] | ['get', 'head', 'options', 'put', 'delete']| 可进行网关错误尝试的htttp请求类型    | 
| retryDelay     | number   |  0                                         |   重试延迟时间                      |
| mainGateway    | string   |                                            | 主网关，需要和axios配置的baseURL相同 |
| standbyGateway | string[] |                                            | 备用网关地址列表                    |

# why use this?
当主节点的网关不可用时，切换到备用节点请求服务器
