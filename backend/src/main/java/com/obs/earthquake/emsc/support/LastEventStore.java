package com.obs.earthquake.emsc.support;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

public class LastEventStore {

    private static final Logger log = LoggerFactory.getLogger(LastEventStore.class);

    private final Path cachePath;
    private final AtomicReference<String> lastId = new AtomicReference<>();

    public LastEventStore(Path cachePath) {
        this.cachePath = cachePath;
        loadFromDisk();
    }

    public Optional<String> read() {
        return Optional.ofNullable(lastId.get());
    }

    public void write(String id) {
        if (id == null || id.isBlank()) {
            return;
        }
        lastId.set(id);
        persist(id);
    }

    private void loadFromDisk() {
        try {
            if (Files.exists(cachePath)) {
                String value = Files.readString(cachePath, StandardCharsets.UTF_8).trim();
                if (!value.isEmpty()) {
                    lastId.set(value);
                    log.info("Loaded last event id from cache: {}", value);
                }
            }
        } catch (IOException e) {
            log.warn("Could not read last event cache {}: {}", cachePath, e.getMessage());
        }
    }

    private void persist(String id) {
        try {
            Path parent = cachePath.getParent();
            if (parent != null && Files.notExists(parent)) {
                Files.createDirectories(parent);
            }
            Files.writeString(cachePath, id, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
        } catch (IOException e) {
            log.warn("Could not persist last event cache {}: {}", cachePath, e.getMessage());
        }
    }
}
