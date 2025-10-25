const API_BASE_URL = 'http://localhost:4005';

class RequestUtils {

  static async fetch(url: string, method: string, body = {}, accessToken?: string): Promise<any | null> {

    try {
      const response = await fetch(API_BASE_URL + url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        ...(method !== "GET" && { body: JSON.stringify(body) })
      });

      const res = await response.json();
      console.log("response: ", res);

      return res;

    } catch (error: Error | any) {
      console.error(error.message)
      throw new Error("NetworkError");

    };
  };

  static async get(url: string, accessToken: string): Promise<any | null> {
    try {
      const response = await fetch(API_BASE_URL + url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const res = await response.json();
      console.log("Get Response: ", res);
      return res;
    } catch (error: Error | any) {
      console.error(error.message)
      throw new Error("NetworkError");
    }
  }

  static async post(url: string, accessToken: string, body: any): Promise<any | null> {
    try {
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      
      const response = await fetch(API_BASE_URL + url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const res = await response.json();
      console.log("Post Response: ", res);
      return res;
    } catch (error: Error | any) {
      console.error(error.message)
      throw new Error("NetworkError");
    }
  }

  static async postFormData(url: string, accessToken: string, body: any): Promise<any | null> {
    try {
      const response = await fetch(API_BASE_URL + url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: body,
      });

      const res = await response.json();
      console.log("Post Form Data Response: ", res);
      return res;
    } catch (error: Error | any) {
      console.error(error.message)
      throw new Error("NetworkError on post form data");
    }
  }

  static async put(url: string, accessToken: string, body: any): Promise<any | null> {
    try {
      const response = await fetch(API_BASE_URL + url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const res = await response.json();
      console.log("Put Response: ", res);
      return res;
    } catch (error: Error | any) {
      console.error(error.message)
      throw new Error("NetworkError");
    }
  };

  static async delete(url: string, accessToken: string, body: any): Promise<any | null> {
    try {
      const response = await fetch(API_BASE_URL + url, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const res = await response.json();
      console.log("Delete Response: ", res);
      return res;
    } catch (error: Error | any) {
      console.error(error.message)
      throw new Error("NetworkError");
    }
  }

}

export default RequestUtils;
