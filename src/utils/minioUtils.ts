import { Request, Response } from "express";
import { Client } from "minio";
import { Readable } from "stream";
import ResponseUtils from "../utils/ResponseUtils";
import multer from 'multer';
import multerS3 from 'multer-s3';
import { randomUUID } from 'crypto';

export default class MinioS3Service {

  private getMinioClient() {
    return new Client({
      endPoint: process.env.MINIO_ENDPOINT || "",
      port: parseInt(process.env.MINIO_PORT || "443"),
      useSSL: true,
      accessKey: process.env.MINIO_ACCESS_KEY || "",
      secretKey: process.env.MINIO_SECRET_KEY || ""
    });
  }

  async deleteMinioFile(objectName: string): Promise<void> {
    try {
      const minioClient = this.getMinioClient();
      const bucketName = process.env.BUCKET_NAME || "";

      await minioClient.removeObject(bucketName, objectName);
    } catch (error) {
      console.error("MinIO delete error:", error);
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  async uploadVendorLogo(file: Express.Multer.File, vendor_id: string): Promise<string> {
    try {
      const minioClient = this.getMinioClient();
      const bucketName = process.env.BUCKET_NAME || "";
      const fileExtension = file.originalname.split('.').pop() || 'png';
      const fileName = `${randomUUID()}.${fileExtension}`;
      const objectName = `vendors/logo/${vendor_id}/logo/${fileName}`;

      // Upload the file to MinIO
      await minioClient.putObject(
        bucketName,
        objectName,
        file.buffer,
        file.size,
        {
          'Content-Type': file.mimetype,
          'Content-Disposition': `inline; filename="${fileName}"`
        }
      );

      // Return the full URL that can be used to access the file
      const baseUrl = process.env.MINIO_ENDPOINT || "localhost";
      const port = process.env.MINIO_PORT || "443";
      const protocol = process.env.MINIO_USE_SSL === "false" ? "http" : "https";
      const fullUrl = `${protocol}://${baseUrl}:${port}/${bucketName}/${objectName}`;

      return fullUrl;
    } catch (error) {
      console.error("MinIO upload error:", error);
      throw new Error(`Failed to upload vendor logo: ${error}`);
    }
  }

  async download_minio_file(req: Request, res: Response, filePath: any) {
    try {
      const minioClient = this.getMinioClient();


      const dataStream: Readable = await minioClient.getObject(
        process.env.BUCKET_NAME || "",
        filePath
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filePath.split("/").pop()}"`
      );
      res.setHeader("Content-Type", "application/octet-stream");

      dataStream.on("error", (err) => {
        console.error("Stream error:", err);
        ResponseUtils.error(res, "Stream failed", err, req.body);
      });

      dataStream.pipe(res);
    } catch (error) {
      console.error("MinIO download error:", error);
      ResponseUtils.error(res, `Failed to download file ${process.env.BUCKET_NAME || ""}`, error, req.body);


    }
  }

}
