import { ofetch } from "ofetch";
import { ProxyAgent } from "undici";

const wireguardDispatcher = new ProxyAgent("http://wireguard:8888");
const TIMEOUT = 5000;

const httpFetchClient = {
  get: async (url: string, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "GET",
      headers,
      dispatcher: wireguardDispatcher,
      timeout: TIMEOUT,
    });

    return response;
  },
  post: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      dispatcher: wireguardDispatcher,
      timeout: TIMEOUT,
    });

    return response;
  },
  put: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
      dispatcher: wireguardDispatcher,
      timeout: TIMEOUT,
    });

    return response;
  },
  patch: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      dispatcher: wireguardDispatcher,
      timeout: TIMEOUT,
    });

    return response;
  },
  delete: async (url: string, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "DELETE",
      headers,
      dispatcher: wireguardDispatcher,
      timeout: TIMEOUT,
    });

    return response;
  },
};
export default httpFetchClient;
