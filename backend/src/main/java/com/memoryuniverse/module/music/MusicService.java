package com.memoryuniverse.module.music;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.memoryuniverse.common.exception.BusinessException;
import com.memoryuniverse.module.music.dto.MusicUpdateRequest;
import com.memoryuniverse.module.music.dto.MusicVO;
import com.memoryuniverse.module.music.entity.Music;
import com.memoryuniverse.module.music.mapper.MusicMapper;
import com.memoryuniverse.module.storage.StorageService;
import com.memoryuniverse.module.storage.StoredObject;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class MusicService {

    private static final DateTimeFormatter PATH_FORMATTER = DateTimeFormatter.ofPattern("yyyy/MM");
    private static final long MAX_SIZE = 20L * 1024 * 1024;

    /** 允许上传的音频扩展名，覆盖常见的背景音乐格式。 */
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "mp3", "wav", "ogg", "m4a", "aac", "flac", "opus"
    );

    private static final Map<String, String> CONTENT_TYPES = Map.of(
            "mp3", "audio/mpeg",
            "wav", "audio/wav",
            "ogg", "audio/ogg",
            "m4a", "audio/mp4",
            "aac", "audio/aac",
            "flac", "audio/flac",
            "opus", "audio/opus"
    );

    private final MusicMapper musicMapper;
    private final StorageService storageService;

    public MusicService(MusicMapper musicMapper, StorageService storageService) {
        this.musicMapper = musicMapper;
        this.storageService = storageService;
    }

    public List<MusicVO> listPublic() {
        return musicMapper.selectList(new LambdaQueryWrapper<Music>()
                        .eq(Music::getEnabled, true)
                        .orderByAsc(Music::getSortOrder)
                        .orderByAsc(Music::getId))
                .stream()
                .map(this::toVo)
                .toList();
    }

    public List<MusicVO> listAdmin() {
        return musicMapper.selectList(new LambdaQueryWrapper<Music>()
                        .orderByAsc(Music::getSortOrder)
                        .orderByDesc(Music::getId))
                .stream()
                .map(this::toVo)
                .toList();
    }

    @Transactional(rollbackFor = Exception.class)
    public MusicVO create(MultipartFile file, String url, String title, String artist, Integer sortOrder) {
        String resolvedUrl = StringUtils.hasText(url) ? url.trim() : null;
        if (file != null && !file.isEmpty()) {
            resolvedUrl = storeAudio(file);
        }
        if (resolvedUrl == null) {
            throw BusinessException.badRequest("请上传音频文件或填写音频地址");
        }

        Music music = new Music();
        music.setTitle(resolveTitle(title, file));
        music.setArtist(trimToNull(artist));
        music.setUrl(resolvedUrl);
        music.setSortOrder(sortOrder == null ? 0 : sortOrder);
        music.setEnabled(true);
        musicMapper.insert(music);
        return toVo(music);
    }

    @Transactional(rollbackFor = Exception.class)
    public MusicVO update(Long id, MusicUpdateRequest request) {
        Music music = require(id);
        if (request.title() != null) {
            String title = trimToNull(request.title());
            if (title == null) {
                throw BusinessException.badRequest("曲目名称不能为空");
            }
            music.setTitle(title);
        }
        if (request.artist() != null) {
            music.setArtist(trimToNull(request.artist()));
        }
        if (request.sortOrder() != null) {
            music.setSortOrder(request.sortOrder());
        }
        if (request.enabled() != null) {
            music.setEnabled(request.enabled());
        }
        musicMapper.updateById(music);
        return toVo(music);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        Music music = require(id);
        musicMapper.deleteById(id);
        String objectName = objectNameOf(music.getUrl());
        if (objectName != null) {
            storageService.delete(objectName);
        }
    }

    private String storeAudio(MultipartFile file) {
        String extension = extensionOf(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw BusinessException.badRequest("仅支持 MP3 / WAV / OGG / M4A / AAC / FLAC / OPUS 格式");
        }
        if (file.getSize() > MAX_SIZE) {
            throw BusinessException.badRequest("音频文件不能超过 20MB");
        }

        String folder = "music/" + LocalDate.now().format(PATH_FORMATTER);
        String objectName = folder + "/" + UUID.randomUUID().toString().replace("-", "") + "." + extension;
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("audio/")) {
            contentType = CONTENT_TYPES.get(extension);
        }

        try {
            StoredObject stored = storageService.store(file.getBytes(), objectName, contentType);
            return stored.url();
        } catch (IOException ex) {
            throw new BusinessException(500, "音频读取失败");
        }
    }

    private String resolveTitle(String title, MultipartFile file) {
        String value = trimToNull(title);
        if (value != null) {
            return value;
        }
        String original = file == null ? null : file.getOriginalFilename();
        if (original != null) {
            int dot = original.lastIndexOf('.');
            String name = (dot > 0 ? original.substring(0, dot) : original).trim();
            if (!name.isEmpty()) {
                return name;
            }
        }
        return "未命名曲目";
    }

    private Music require(Long id) {
        Music music = musicMapper.selectById(id);
        if (music == null) {
            throw BusinessException.notFound("曲目不存在");
        }
        return music;
    }

    /** 只删除本系统 music/ 目录下的对象，外部链接不做处理。 */
    private String objectNameOf(String url) {
        if (url == null) {
            return null;
        }
        int index = url.indexOf("/music/");
        if (index < 0) {
            return null;
        }
        String candidate = url.substring(index + 1);
        int query = candidate.indexOf('?');
        if (query >= 0) {
            candidate = candidate.substring(0, query);
        }
        return ALLOWED_EXTENSIONS.contains(extensionOf(candidate)) ? candidate : null;
    }

    private String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private MusicVO toVo(Music music) {
        return new MusicVO(
                music.getId(),
                music.getTitle(),
                music.getArtist(),
                music.getUrl(),
                music.getCoverUrl(),
                music.getDuration(),
                music.getSortOrder(),
                music.getEnabled(),
                music.getCreatedAt()
        );
    }
}
