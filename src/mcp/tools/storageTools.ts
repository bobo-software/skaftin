import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';

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
            description: 'Bucket name (optional, defaults to project bucket)',
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
        required: ['projectId', 'query'],
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
            description: 'Bucket name (optional, defaults to project bucket)',
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
        required: ['projectId', 'filePath', 'fileContent'],
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
            description: 'Bucket name (optional, defaults to project bucket)',
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
        required: ['projectId', 'filePath'],
      },
    },
    {
      name: 'list_buckets',
      description: 'List available MinIO buckets',
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
      description: 'Create new MinIO bucket',
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
            description: 'Bucket name (optional, defaults to project bucket)',
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
        required: ['projectId'],
      },
    },
  ];
}

async function getProjectBucket(pool: Pool, projectId: string): Promise<string | null> {
  try {
    const client = await pool.connect();
    const result = await client.query(
      'SELECT bucket_name FROM projects WHERE id = $1',
      [projectId]
    );
    client.release();
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].bucket_name;
  } catch (error) {
    console.error('Error getting project bucket:', error);
    return null;
  }
}

export async function handleStorageTool(
  toolName: string,
  args: any,
  config: StorageToolsConfig
): Promise<any> {
  const { s3Client, pool } = config;

  switch (toolName) {
    case 'search_bucket': {
      const { projectId, bucketName: providedBucket, query, fileType, dateRange } = args;
      
      const bucketName = providedBucket || await getProjectBucket(pool, projectId);
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Project not found or bucket not configured' }, null, 2) 
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
      const { projectId, bucketName: providedBucket, filePath, fileContent, contentType, metadata } = args;
      
      const bucketName = providedBucket || await getProjectBucket(pool, projectId);
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Project not found or bucket not configured' }, null, 2) 
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
      const { projectId, bucketName: providedBucket, filePath, range } = args;
      
      const bucketName = providedBucket || await getProjectBucket(pool, projectId);
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Project not found or bucket not configured' }, null, 2) 
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

    case 'list_buckets': {
      const { projectId, includeStats = false } = args;
      
      // Get project bucket
      const projectBucket = await getProjectBucket(pool, projectId);
      if (!projectBucket) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Project not found' }, null, 2) 
          }],
          isError: true
        };
      }
      
      // For MinIO, we can't list all buckets easily without admin access
      // So we return the project bucket with stats if requested
      const buckets: any[] = [{
        name: projectBucket,
        creationDate: new Date().toISOString(), // Would need to track this
      }];
      
      if (includeStats) {
        const command = new ListObjectsV2Command({
          Bucket: projectBucket,
          MaxKeys: 1,
        });
        
        try {
          const response = await s3Client.send(command);
          const fileCount = response.KeyCount || 0;
          
          // Get total size
          const listAllCommand = new ListObjectsV2Command({
            Bucket: projectBucket,
          });
          
          const allObjects = await s3Client.send(listAllCommand);
          let totalSize = 0;
          if (allObjects.Contents) {
            totalSize = allObjects.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
          }
          
          buckets[0].fileCount = fileCount;
          buckets[0].totalSize = totalSize;
        } catch (error) {
          // Bucket might not exist yet
          buckets[0].fileCount = 0;
          buckets[0].totalSize = 0;
        }
      }
      
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ buckets }, null, 2) 
        }] 
      };
    }

    case 'create_bucket': {
      const { projectId, bucketName, region = 'us-east-1', versioning } = args;
      
      // Note: MinIO doesn't support CreateBucketCommand the same way as S3
      // We'll use HeadBucketCommand to check, then PutObjectCommand to "create"
      // For a proper implementation, you'd need MinIO admin API or SDK
      
      try {
        // Try to head the bucket first
        const headCommand = new HeadObjectCommand({
          Bucket: bucketName,
          Key: '.minio.sys', // Dummy key to check bucket
        });
        
        try {
          await s3Client.send(headCommand);
          // Bucket exists
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                success: true,
                message: 'Bucket already exists',
                bucket: bucketName,
              }, null, 2) 
            }] 
          };
        } catch (error: any) {
          // Bucket doesn't exist - create it by uploading a dummy file
          // This is a workaround for MinIO without admin API
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
          
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                success: true,
                message: 'Bucket created successfully',
                bucket: bucketName,
              }, null, 2) 
            }] 
          };
        }
      } catch (error: any) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: `Failed to create bucket: ${error.message}` 
            }, null, 2) 
          }],
          isError: true
        };
      }
    }

    case 'delete_bucket': {
      const { projectId, bucketName, force = false } = args;
      
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
        
        // Note: MinIO doesn't support DeleteBucketCommand directly
        // In a real implementation, you'd need the admin API
        // For now, we just verify it's empty
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true,
              message: 'Bucket emptied successfully (use admin API for full deletion)',
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
      const { projectId, bucketName: providedBucket, prefix, maxKeys = 1000 } = args;
      
      const bucketName = providedBucket || await getProjectBucket(pool, projectId);
      if (!bucketName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Project not found or bucket not configured' }, null, 2) 
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
      throw new Error(`Unknown storage tool: ${toolName}`);
  }
}

