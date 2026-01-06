const httpFetchClient = {
  get: async (url: string, headers: Record<string, string>) => {
    const response = await fetch(url, {
      method: "GET",
      headers,
    });

    return response.json();
  },
  post: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    return response.json();
  },
  put: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    });

    return response.json();
  },
  patch: async (url: string, body: JSON, headers: Record<string, string>) => {
    const response = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    });

    return response.json();
  },
  delete: async (url: string, headers: Record<string, string>) => {
    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    return response.json();
  },
};
export default httpFetchClient;
