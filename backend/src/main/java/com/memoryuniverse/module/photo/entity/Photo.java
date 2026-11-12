package com.memoryuniverse.module.photo.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("photo")
public class Photo {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String description;

    private Long categoryId;

    private String originalUrl;

    private String thumbnailUrl;

    private String objectName;

    private String thumbnailObjectName;

    private Long fileSize;

    private LocalDate takenAt;

    private String location;

    private Integer sortOrder;

    private Boolean visible;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
