package com.memoryuniverse.module.storage;

import com.memoryuniverse.common.exception.BusinessException;
import com.memoryuniverse.config.MinioProperties;
import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.SetBucketPolicyArgs;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;

@Service
@ConditionalOnProperty(prefix = "app.storage", name = "type", havingValue = "minio", matchIfMissing = true)
public class MinioStorageService implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(MinioStorageService.class);

    private final MinioClient minioClient;
    private final MinioProperties properties;
    private volatile boolean bucketReady;

    public MinioStorageService(MinioClient minioClient, MinioProperties properties) {
        this.minioClient = minioClient;
        this.properties = properties;
    }

    @PostConstruct
    void init() {
        try {
            ensureBucket();
        } catch (Exception ex) {
            log.warn("MinIO 初始化失败，上传功能将在修复后重试：{}", ex.getMessage());
        }
    }

    @Override
    public StoredObject store(byte[] bytes, String objectName, String contentType) {
        try {
            ensureBucket();
            try (ByteArrayInputStream input = new ByteArrayInputStream(bytes)) {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(properties.resolvedBucket())
                        .object(objectName)
                        .stream(input, bytes.length, -1)
                        .contentType(contentType)
                        .build());
            }
            return new StoredObject(objectName, urlOf(objectName));
        } catch (Exception ex) {
            log.error("MinIO upload failed: {}", objectName, ex);
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "对象存储暂不可用，请稍后重试");
        }
    }

    @Override
    public void delete(String objectName) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(properties.resolvedBucket())
                    .object(objectName)
                    .build());
        } catch (Exception ex) {
            log.warn("MinIO delete failed: {}", objectName, ex);
        }
    }

    private String urlOf(String objectName) {
        return properties.resolvedPublicBaseUrl() + "/" + objectName;
    }

    private synchronized void ensureBucket() throws Exception {
        if (bucketReady) {
            return;
        }
        String bucket = properties.resolvedBucket();
        boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
        if (!exists) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
            log.info("Created MinIO bucket: {}", bucket);
        }
        try {
            minioClient.setBucketPolicy(SetBucketPolicyArgs.builder()
                    .bucket(bucket)
                    .config(publicReadPolicy(bucket))
                    .build());
        } catch (Exception ex) {
            log.warn("设置 MinIO 公共读策略失败，请确认桶权限：{}", ex.getMessage());
        }
        bucketReady = true;
    }

    private String publicReadPolicy(String bucket) {
        return """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {"AWS": ["*"]},
                      "Action": ["s3:GetObject"],
                      "Resource": ["arn:aws:s3:::%s/*"]
                    }
                  ]
                }
                """.formatted(bucket);
    }
}
