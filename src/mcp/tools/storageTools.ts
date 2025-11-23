import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';

// Legacy export for backward compatibility during migration
export interface StorageToolsConfig {
  s3Client: S3Client;
  pool: Pool;
}

export function createStorageTools(config: StorageToolsConfig): Tool[] {
  return [
    {
      name: 'search_bucket',
      description: 'Search files in MinIO buckets',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          bucketName: {
            type: 'string',
            description: 'Bucket name (required)',
          },
          query: {
            type: 'string',
            description: 'Search query string',
          },
          fileType: {
            type: 'string',
            description: 'Filter by file extension (e.g., ".txt", ".json")',
          },
          dateRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' },
            },
            description: 'Filter files by date range',
          },
        },
        required: ['projectId', 'bucketName', 'query'],
      },
    },
    {
      name: 'upload_file',
      description: 'Upload files to MinIO',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          bucketName: {
            type: 'string',
            description: 'Bucket name (required)',
          },
          filePath: {
            type: 'string',
            description: 'Path where the file should be stored',
          },
          fileContent: {
            type: 'string',
            description: 'Base64 encoded file content',
          },
          contentType: {
            type: 'string',
            description: 'MIME type of the file',
          },
          metadata: {
            type: 'object',
            description: 'Additional metadata as key-value pairs',
          },
        },
        required: ['projectId', 'bucketName', 'filePath', 'fileContent'],
      },
    },
    {
      name: 'download_file',
      description: 'Download files from MinIO',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          bucketName: {
            type: 'string',
            description: 'Bucket name (required)',
          },
          filePath: {
            type: 'string',
            description: 'Path to the file to download',
          },
          range: {
            type: 'object',
            properties: {
              start: { type: 'number' },
              end: { type: 'number' },
            },
            description: 'Byte range for partial download',
          },
        },
        required: ['projectId', 'bucketName', 'filePath'],
      },
    },
    {
      name: 'list_project_buckets',
      description: 'List all buckets for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          includeStats: {
            type: 'boolean',
            description: 'Include bucket size and file count statistics',
            default: false,
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'create_project_bucket',
      description: 'Create a new bucket for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          bucketName: {
            type: 'string',
            description: 'Name of the bucket to create (3-63 chars, lowercase alphanumeric with hyphens)',
          },
          description: {
            type: 'string',
            description: 'Optional bucket description',
          },
        },
        required: ['projectId', 'bucketName'],
      },
    },
    {
      name: 'list_buckets',
      description: 'List available MinIO buckets (deprecated - use list_project_buckets)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          includeStats: {
            type: 'boolean',
            description: 'Include bucket size and file count statistics',
            default: false,
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'create_bucket',
      description: 'Create new MinIO bucket (deprecated - use create_project_bucket)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          bucketName: {
            type: 'string',
            description: 'Name of the bucket to create',
          },
          region: {
            type: 'string',
            description: 'AWS region (defaults to us-east-1)',
            default: 'us-east-1',
          },
          versioning: {
            type: 'boolean',
            description: 'Enable versioning for the bucket',
            default: false,
          },
        },
        required: ['projectId', 'bucketName'],
      },
    },
    {
      name: 'delete_bucket',
      description: 'Delete MinIO bucket',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          bucketName: {
            type: 'string',
            description: 'Name of the bucket to delete',
          },
          force: {
            type: 'boolean',
            description: 'Force deletion even if bucket contains files',
            default: false,
          },
        },
        required: ['projectId', 'bucketName'],
      },
    },
    {
      name: 'list_files',
      description: 'List files in a bucket',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          bucketName: {
            type: 'string',
            description: 'Bucket name (required)',
          },
          prefix: {
            type: 'string',
            description: 'Prefix to filter files',
          },
          maxKeys: {
            type: 'number',
            description: 'Maximum number of files to return',
            default: 1000,
          },
        },
        required: ['projectId', 'bucketName'],
      },
    },
  ];
}

// Helper to validate bucket belongs to project
async function validateBucketForProject(pool: Pool, projectId: string, bucketName: string): Promise<boolean> {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT id FROM skaftin_system_project_buckets WHERE project_id = $1 AND bucket_name = $2',
      [projectId, bucketName]
    );
    client.release();
    
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error validating bucket for project:', error);
    return false;
  }
}

// Legacy export for backward compatibility during migration
export async function handleStorageTool(
  toolName: string,
  args: any,
  config: StorageToolsConfig
): Promise<any> {
  const { s3Client, pool } = config;

  switch (toolName) {
    case 'search_bucket': {
      const { projectId, bucketName, query, fileType, dateRange } = args;
      
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket name is required' }, null, 2) 
          }],
          isError: true
        };
      }

      // Validate bucket belongs to project
      const isValid = await validateBucketForProject(pool, projectId, bucketName);
      if (!isValid) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket not found or does not belong to this project' }, null, 2) 
          }],
          isError: true
        };
      }
      
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
      });
      
      const response = await s3Client.send(command);
      
      if (!response.Contents) {
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ files: [] }, null, 2) 
          }] 
        };
      }
      
      let files = response.Contents;
      
      // Filter by query (filename)
      if (query) {
        files = files.filter(file => 
          file.Key?.toLowerCase().includes(query.toLowerCase())
        );
      }
      
      // Filter by file type
      if (fileType) {
        files = files.filter(file => 
          file.Key?.endsWith(fileType)
        );
      }
      
      // Filter by date range
      if (dateRange) {
        const start = new Date(dateRange.start);
        const end = new Date(dateRange.end);
        files = files.filter(file => {
          if (!file.LastModified) return false;
          const modDate = new Date(file.LastModified);
          return modDate >= start && modDate <= end;
        });
      }
      
      const results = files.map(file => ({
        key: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
        etag: file.ETag,
      }));
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ files: results }, null, 2) 
        }] 
      };
    }

    case 'upload_file': {
      const { projectId, bucketName, filePath, fileContent, contentType, metadata } = args;
      
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket name is required' }, null, 2) 
          }],
          isError: true
        };
      }

      // Validate bucket belongs to project
      const isValid = await validateBucketForProject(pool, projectId, bucketName);
      if (!isValid) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket not found or does not belong to this project' }, null, 2) 
          }],
          isError: true
        };
      }
      
      // Decode base64 content
      const buffer = Buffer.from(fileContent, 'base64');
      
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: filePath,
        Body: buffer,
        ContentType: contentType || 'application/octet-stream',
        Metadata: metadata || {},
      });
      
      await s3Client.send(command);
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            success: true,
            message: 'File uploaded successfully',
            bucket: bucketName,
            path: filePath,
            size: buffer.length,
          }, null, 2) 
        }] 
      };
    }

    case 'download_file': {
      const { projectId, bucketName, filePath, range } = args;
      
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket name is required' }, null, 2) 
          }],
          isError: true
        };
      }

      // Validate bucket belongs to project
      const isValid = await validateBucketForProject(pool, projectId, bucketName);
      if (!isValid) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket not found or does not belong to this project' }, null, 2) 
          }],
          isError: true
        };
      }
      
      try {
        const command = new GetObjectCommand({
          Bucket: bucketName,
          Key: filePath,
          Range: range ? `bytes=${range.start}-${range.end}` : undefined,
        });
        
        const response = await s3Client.send(command);
        
        // Read the stream
        const chunks: Uint8Array[] = [];
        if (response.Body) {
          for await (const chunk of response.Body as any) {
            chunks.push(chunk);
          }
        }
        
        const buffer = Buffer.concat(chunks);
        const base64Content = buffer.toString('base64');
        
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true,
              bucket: bucketName,
              path: filePath,
              content: base64Content,
              contentType: response.ContentType,
              size: buffer.length,
            }, null, 2) 
          }] 
        };
      } catch (error: any) {
        if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'File not found' }, null, 2) 
            }],
            isError: true
          };
        }
        throw error;
      }
    }

    case 'list_project_buckets':
    case 'list_buckets': {
      const { projectId, includeStats = false } = args;
      
      // Get all buckets for the project from database
      const client = await pool.connect();
      try {
        const result = await client.query(
          'SELECT id, bucket_name, description, created_at, updated_at FROM skaftin_system_project_buckets WHERE project_id = $1 ORDER BY created_at',
          [projectId]
        );
        
        if (result.rows.length === 0) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ buckets: [] }, null, 2) 
            }] 
          };
        }
        
        const buckets = await Promise.all(
          result.rows.map(async (row) => {
            const bucketInfo: any = {
              id: row.id,
              name: row.bucket_name,
              description: row.description,
              creationDate: row.created_at,
              updatedAt: row.updated_at,
            };
            
            if (includeStats) {
              try {
                const command = new ListObjectsV2Command({
                  Bucket: row.bucket_name,
                  MaxKeys: 1000,
                });
                const objects = await s3Client.send(command);
                
                bucketInfo.fileCount = objects.KeyCount || 0;
                bucketInfo.totalSize = objects.Contents?.reduce((sum: number, obj: any) => sum + (obj.Size || 0), 0) || 0;
              } catch (error) {
                bucketInfo.fileCount = 0;
                bucketInfo.totalSize = 0;
              }
            }
            
            return bucketInfo;
          })
        );
        
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ buckets }, null, 2) 
          }] 
        };
      } finally {
        client.release();
      }
    }

    case 'create_project_bucket':
    case 'create_bucket': {
      const { projectId, bucketName, description } = args;
      
      // Validate bucket name format
      const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
      if (!bucketNameRegex.test(bucketName) || bucketName.length < 3 || bucketName.length > 63) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens' 
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      const client = await pool.connect();
      try {
        // Check if bucket name already exists
        const existingResult = await client.query(
          'SELECT id FROM skaftin_system_project_buckets WHERE bucket_name = $1',
          [bucketName]
        );
        
        if (existingResult.rows.length > 0) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Bucket name already exists' 
              }, null, 2) 
            }],
            isError: true
          };
        }
        
        // Create bucket in MinIO
        try {
          const createCommand = new PutObjectCommand({
            Bucket: bucketName,
            Key: '.bucket-init',
            Body: Buffer.from(''),
          });
          
          await s3Client.send(createCommand);
          
          // Delete the init file
          const deleteCommand = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: '.bucket-init',
          });
          
          await s3Client.send(deleteCommand);
        } catch (minioError: any) {
          // If bucket already exists in MinIO, that's okay
          if (minioError.name !== 'BucketAlreadyOwnedByYou' && minioError.name !== 'BucketAlreadyExists') {
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ 
                  error: `Failed to create bucket in storage: ${minioError.message}` 
                }, null, 2) 
              }],
              isError: true
            };
          }
        }
        
        // Create bucket record in database
        const result = await client.query(
          'INSERT INTO skaftin_system_project_buckets (project_id, bucket_name, description) VALUES ($1, $2, $3) RETURNING id, bucket_name, description, created_at, updated_at',
          [projectId, bucketName, description || null]
        );
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true,
              message: 'Bucket created successfully',
              bucket: result.rows[0],
            }, null, 2) 
          }] 
        };
      } catch (error: any) {
        if (error.code === '23505') {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Bucket name already exists' 
              }, null, 2) 
            }],
            isError: true
          };
        }
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: `Failed to create bucket: ${error.message}` 
            }, null, 2) 
          }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'delete_bucket': {
      const { projectId, bucketName, force = false } = args;
      
      // Validate bucket belongs to project
      const isValid = await validateBucketForProject(pool, projectId, bucketName);
      if (!isValid) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Bucket not found or does not belong to this project' 
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      try {
        if (force) {
          // Delete all objects first
          const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
          });
          
          const response = await s3Client.send(listCommand);
          
          if (response.Contents && response.Contents.length > 0) {
            for (const obj of response.Contents) {
              if (obj.Key) {
                const deleteCommand = new DeleteObjectCommand({
                  Bucket: bucketName,
                  Key: obj.Key,
                });
                await s3Client.send(deleteCommand);
              }
            }
          }
        } else {
          // Check if bucket is empty
          const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 1,
          });
          
          const response = await s3Client.send(listCommand);
          
          if (response.KeyCount && response.KeyCount > 0) {
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ 
                  error: 'Bucket is not empty. Use force=true to delete anyway.' 
                }, null, 2) 
              }],
              isError: true
            };
          }
        }
        
        // Delete bucket record from database
        const client = await pool.connect();
        try {
          await client.query(
            'DELETE FROM skaftin_system_project_buckets WHERE project_id = $1 AND bucket_name = $2',
            [projectId, bucketName]
          );
        } finally {
          client.release();
        }
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true,
              message: 'Bucket deleted successfully',
              bucket: bucketName,
            }, null, 2) 
          }] 
        };
      } catch (error: any) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: `Failed to delete bucket: ${error.message}` 
            }, null, 2) 
          }],
          isError: true
        };
      }
    }

    case 'list_files': {
      const { projectId, bucketName, prefix, maxKeys = 1000 } = args;
      
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket name is required' }, null, 2) 
          }],
          isError: true
        };
      }

      // Validate bucket belongs to project
      const isValid = await validateBucketForProject(pool, projectId, bucketName);
      if (!isValid) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Bucket not found or does not belong to this project' }, null, 2) 
          }],
          isError: true
        };
      }
      
      const command = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });
      
      const response = await s3Client.send(command);
      
      const files = (response.Contents || []).map(file => ({
        key: file.Key,
        size: file.Size,
        lastModified: file.LastModified,
        etag: file.ETag,
      }));
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            files,
            isTruncated: response.IsTruncated,
            nextContinuationToken: response.NextContinuationToken,
          }, null, 2) 
        }] 
      };
    }

    default:
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Unknown storage tool: ${toolName}` }, null, 2)
        }],
        isError: true
      };
  }
}

/**
 * Internal handler that works with MCPToolsConfig
 */
async function handleStorageToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  // Use the legacy handler which has the same signature for the tool logic
  return handleStorageTool(toolName, args, config);
}

/**
 * Storage tools module
 */
export const storageToolModule: ToolModule = {
  category: ToolCategory.STORAGE,
  metadata: {
    name: 'storage',
    description: 'Storage and file management tools',
    category: ToolCategory.STORAGE,
  },
  createTools: (config: MCPToolsConfig): Tool[] => createStorageTools(config),
  handleTool: handleStorageToolInternal,
  getToolNames: (): string[] => {
    return [
      'search_bucket',
      'upload_file',
      'download_file',
      'list_buckets',
      'create_bucket',
      'delete_bucket',
      'list_files',
    ];
  },
  getClientSafeTools: (): string[] => {
    // All storage tools are client-safe
    return [
      'search_bucket',
      'upload_file',
      'download_file',
      'list_buckets',
      'create_bucket',
      'delete_bucket',
      'list_files',
    ];
  },
};

