import ApiRoutes from '../constants/ApiRoutes';
import RequestUtils from '../utils/RequestUtils';
import { ProjectBucket } from '../types/Types';

class BucketService {
  /**
   * List all buckets for a project
   */
  static async listBuckets(projectId: string, includeStats: boolean = false): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const params = includeStats ? '?includeStats=true' : '';
      const url = `${ApiRoutes.PROJECT_BUCKETS.LIST(projectId)}${params}`;
      const result = await RequestUtils.get(url, token);
      
      return result;
    } catch (error) {
      console.error('Error listing buckets:', error);
      return { success: false, error: 'Failed to list buckets' };
    }
  }

  /**
   * Create a new bucket for a project
   */
  static async createBucket(
    projectId: string,
    bucketName: string,
    description?: string,
    accessPolicy: 'private' | 'public' = 'private'
  ): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.post(
        ApiRoutes.PROJECT_BUCKETS.CREATE(projectId),
        token,
        { bucketName, description, accessPolicy }
      );
      
      return result;
    } catch (error) {
      console.error('Error creating bucket:', error);
      return { success: false, error: 'Failed to create bucket' };
    }
  }

  /**
   * Update a bucket
   */
  static async updateBucket(
    projectId: string,
    bucketId: number,
    bucketName?: string,
    description?: string,
    accessPolicy?: 'private' | 'public'
  ): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.put(
        ApiRoutes.PROJECT_BUCKETS.UPDATE(projectId, bucketId),
        token,
        { bucketName, description, accessPolicy }
      );
      
      return result;
    } catch (error) {
      console.error('Error updating bucket:', error);
      return { success: false, error: 'Failed to update bucket' };
    }
  }

  /**
   * Delete a bucket
   */
  static async deleteBucket(
    projectId: string,
    bucketId: number,
    force: boolean = false
  ): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const params = force ? '?force=true' : '';
      const url = `${ApiRoutes.PROJECT_BUCKETS.DELETE(projectId, bucketId)}${params}`;
      const result = await RequestUtils.delete(url, token, {});
      
      return result;
    } catch (error) {
      console.error('Error deleting bucket:', error);
      return { success: false, error: 'Failed to delete bucket' };
    }
  }

  /**
   * Get a single bucket by ID
   */
  static async getBucket(projectId: string, bucketId: number): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.PROJECT_BUCKETS.GET(projectId, bucketId),
        token
      );
      
      return result;
    } catch (error) {
      console.error('Error getting bucket:', error);
      return { success: false, error: 'Failed to get bucket' };
    }
  }

  /**
   * Get bucket access policy
   */
  static async getBucketPolicy(projectId: string, bucketId: number): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.PROJECT_BUCKETS.GET_POLICY(projectId, bucketId),
        token
      );
      
      return result;
    } catch (error) {
      console.error('Error getting bucket policy:', error);
      return { success: false, error: 'Failed to get bucket policy' };
    }
  }

  /**
   * Set bucket access policy
   */
  static async setBucketPolicy(
    projectId: string,
    bucketId: number,
    accessPolicy: 'private' | 'public'
  ): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.put(
        ApiRoutes.PROJECT_BUCKETS.SET_POLICY(projectId, bucketId),
        token,
        { accessPolicy }
      );
      
      return result;
    } catch (error) {
      console.error('Error setting bucket policy:', error);
      return { success: false, error: 'Failed to set bucket policy' };
    }
  }

  /**
   * Get bucket statistics
   */
  static async getBucketStats(projectId: string, bucketId: number): Promise<any> {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const result = await RequestUtils.get(
        ApiRoutes.PROJECT_BUCKETS.GET_STATS(projectId, bucketId),
        token
      );
      
      return result;
    } catch (error) {
      console.error('Error getting bucket stats:', error);
      return { success: false, error: 'Failed to get bucket statistics' };
    }
  }
}

export default BucketService;

