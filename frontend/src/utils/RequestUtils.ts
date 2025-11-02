// Use empty string to make requests relative (will use Vite proxy)
// or use full URL for direct requests
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

class RequestUtils {

  static async fetch(url: string, method: string, body = {}, accessToken?: string): Promise<any | null> {

    try {
      console.log(`🌐 [REQUEST] ${method} ${API_BASE_URL}${url}`, {
        hasToken: !!accessToken,
        tokenType: accessToken === 'session-managed-by-supertokens' ? 'SuperTokens' : 'JWT',
        credentials: 'include',
      });

      const headers: any = {
        'Content-Type': 'application/json',
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: method,
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        ...(method !== "GET" && { body: JSON.stringify(body) })
      });

      console.log(`📥 [RESPONSE] ${method} ${url}:`, {
        status: response.status,
        ok: response.ok,
        headers: {
          'set-cookie': response.headers.get('set-cookie'),
        }
      });

      const res = await response.json();
      console.log("📦 [DATA]:", res);

      return res;

    } catch (error: Error | any) {
      console.error('❌ [REQUEST ERROR]:', error.message)
      throw new Error("NetworkError");

    };
  };

  static async get(url: string, accessToken: string): Promise<any | null> {
    try {
      console.log(`🌐 [GET] ${API_BASE_URL}${url}`, {
        hasToken: !!accessToken,
        tokenType: accessToken === 'session-managed-by-supertokens' ? 'SuperTokens' : 'JWT',
        credentials: 'include',
      });

      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "GET",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
      });

      console.log(`📥 [GET RESPONSE] ${url}:`, {
        status: response.status,
        ok: response.ok,
      });

      const res = await response.json();
      console.log("📦 [GET DATA]:", res);
      return res;
    } catch (error: Error | any) {
      console.error('❌ [GET ERROR]:', error.message)
      throw new Error("NetworkError");
    }
  }

  static async post(url: string, accessToken: string, body: any): Promise<any | null> {
    try {
      console.log(`🌐 [POST] ${API_BASE_URL}${url}`, {
        hasToken: !!accessToken,
        tokenType: accessToken === 'session-managed-by-supertokens' ? 'SuperTokens' : 'JWT',
        bodyKeys: Object.keys(body),
        credentials: 'include',
      });

      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }
      
      const response = await fetch(API_BASE_URL + url, {
        method: "POST",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
        body: JSON.stringify(body),
      });

      console.log(`📥 [POST RESPONSE] ${url}:`, {
        status: response.status,
        ok: response.ok,
      });

      const res = await response.json();
      console.log("📦 [POST DATA]:", res);
      return res;
    } catch (error: Error | any) {
      console.error('❌ [POST ERROR]:', error.message)
      throw new Error("NetworkError");
    }
  }

  static async postFormData(url: string, accessToken: string, body: any): Promise<any | null> {
    try {
      const headers: any = {};
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "POST",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
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
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "PUT",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
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
      const headers: any = {
        "Content-Type": "application/json",
      };
      
      // Only add Authorization header if token is provided (for backward compatibility)
      if (accessToken && accessToken !== 'session-managed-by-supertokens') {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(API_BASE_URL + url, {
        method: "DELETE",
        headers,
        credentials: 'include', // Send cookies for SuperTokens
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
