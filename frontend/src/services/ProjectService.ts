const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4006';

interface Project {
  id: string;
  name: string;
  description?: string;
  schema_name: string;
  bucket_name: string;
  created_at: string;
  updated_at: string;
}

interface ApiResponse {
  status: 'success' | 'error';
  message?: string;
  data?: any;
  error?: string;
}

class ProjectService {
  private getToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  private getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async getUserProjects(): Promise<{ success: boolean; projects?: Project[]; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });

      const data: ApiResponse = await response.json();

      if (response.ok && data.status === 'success' && data.data) {
        return {
          success: true,
          projects: Array.isArray(data.data) ? data.data : [],
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Failed to fetch projects',
        };
      }
    } catch (error) {
      console.error('Get projects error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  async createProject(name: string, description?: string): Promise<{ success: boolean; project?: Project; error?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/projects`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ name, description }),
      });

      const data: ApiResponse = await response.json();

      if (response.ok && data.status === 'success' && data.data) {
        return {
          success: true,
          project: data.data,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Failed to create project',
        };
      }
    } catch (error) {
      console.error('Create project error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }
}

export default new ProjectService();

