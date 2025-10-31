const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4006';

export interface ApiResponse<T = any> {
  status: 'success' | 'error';
  message?: string;
  data?: T;
  error?: string;
}

class RequestUtils {
  private getToken(): string | null {
    return localStorage.getItem('skaftin_token');
  }

  private getAuthHeaders(includeContentType: boolean = true): Record<string, string> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
  }

  async get<T = any>(url: string): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data: ApiResponse<T> = await response.json();

      if (response.ok && data.status === 'success') {
        return {
          success: true,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Request failed',
        };
      }
    } catch (error) {
      console.error('GET request error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  async post<T = any>(url: string, body?: any): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      const data: ApiResponse<T> = await response.json();

      if (response.ok && data.status === 'success') {
        return {
          success: true,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Request failed',
        };
      }
    } catch (error) {
      console.error('POST request error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  async put<T = any>(url: string, body?: any): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      const data: ApiResponse<T> = await response.json();

      if (response.ok && data.status === 'success') {
        return {
          success: true,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Request failed',
        };
      }
    } catch (error) {
      console.error('PUT request error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  async delete<T = any>(url: string): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });

      const data: ApiResponse<T> = await response.json();

      if (response.ok && data.status === 'success') {
        return {
          success: true,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Request failed',
        };
      }
    } catch (error) {
      console.error('DELETE request error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  async uploadFile(url: string, file: File, onProgress?: (progress: number) => void): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      return new Promise((resolve) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const progress = (e.loaded / e.total) * 100;
            onProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({
                success: true,
                data: data.data || data,
              });
            } catch {
              resolve({
                success: true,
                data: xhr.responseText,
              });
            }
          } else {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve({
                success: false,
                error: data.message || data.error || 'Upload failed',
              });
            } catch {
              resolve({
                success: false,
                error: 'Upload failed',
              });
            }
          }
        });

        xhr.addEventListener('error', () => {
          resolve({
            success: false,
            error: 'Network error during upload',
          });
        });

        const token = this.getToken();
        xhr.open('POST', `${API_BASE_URL}${url}`);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
      });
    } catch (error) {
      console.error('File upload error:', error);
      return {
        success: false,
        error: 'Failed to upload file',
      };
    }
  }
}

export default new RequestUtils();

