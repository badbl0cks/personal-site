import { ofetch } from "ofetch";
import { ProxyAgent } from "undici";

const wireguardDispatcher = new ProxyAgent("http://wireguard:8888");

const httpFetchClient = {
  get: async (url: string, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "GET",
      headers,
      dispatcher: wireguardDispatcher,
    });

    return response.json();
  },
  post: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      dispatcher: wireguardDispatcher,
    });

    return response.json();
  },
  put: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
      dispatcher: wireguardDispatcher,
    });

    return response.json();
  },
  patch: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
      dispatcher: wireguardDispatcher,
    });

    return response.json();
  },
  delete: async (url: string, headers: Record<string, string>) => {
    const response = await ofetch(url, {
      method: "DELETE",
      headers,
      dispatcher: wireguardDispatcher,
    });

    return response.json();
  },
};
export default httpFetchClient;
