package com.memoryuniverse.module.storage;

public interface StorageService {

    /**
     * 存储对象并返回可公开访问的 URL。
     *
     * @param bytes       文件内容
     * @param objectName  对象相对路径，例如 photos/2026/06/xxx.jpg
     * @param contentType MIME 类型
     */
    StoredObject store(byte[] bytes, String objectName, String contentType);

    /**
     * 删除对象；实现方需自行吞掉「对象不存在」等非致命异常。
     */
    void delete(String objectName);
}
