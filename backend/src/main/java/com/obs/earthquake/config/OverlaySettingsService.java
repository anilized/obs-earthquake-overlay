package com.obs.earthquake.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class OverlaySettingsService {

    private static final Logger log = LoggerFactory.getLogger(OverlaySettingsService.class);

    private final ObjectMapper mapper;
    private final Path settingsFile;
    private final AtomicReference<OverlaySettings> current = new AtomicReference<>(OverlaySettings.defaults());

    public OverlaySettingsService(ObjectMapper mapper,
                                  @Value("${overlay.settings-file:backend-data/settings.json}") String settingsPath) {
        this.mapper = mapper;
        this.settingsFile = Path.of(settingsPath);
    }

    @PostConstruct
    void load() {
        if (Files.notExists(settingsFile)) {
            persist(current.get());
            return;
        }
        try {
            OverlaySettings loaded = mapper.readValue(settingsFile.toFile(), OverlaySettings.class);
            current.set(loaded.normalize());
            log.info("Overlay settings loaded from {}", settingsFile);
        } catch (IOException e) {
            log.warn("Failed to load overlay settings from {}: {}", settingsFile, e.getMessage());
            persist(current.get());
        }
    }

    public OverlaySettings current() {
        return current.get();
    }

    public synchronized OverlaySettings update(OverlaySettings candidate) {
        OverlaySettings normalized = candidate == null ? OverlaySettings.defaults() : candidate.normalize();
        current.set(normalized);
        persist(normalized);
        return normalized;
    }

    public synchronized OverlaySettings reset() {
        OverlaySettings defaults = OverlaySettings.defaults();
        current.set(defaults);
        persist(defaults);
        return defaults;
    }

    private void persist(OverlaySettings settings) {
        try {
            if (Files.notExists(settingsFile.getParent())) {
                Files.createDirectories(settingsFile.getParent());
            }
            mapper.writerWithDefaultPrettyPrinter().writeValue(settingsFile.toFile(), settings);
        } catch (IOException e) {
            log.warn("Failed to persist overlay settings to {}: {}", settingsFile, e.getMessage());
        }
    }
}
