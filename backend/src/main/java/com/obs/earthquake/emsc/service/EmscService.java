package com.obs.earthquake.emsc.service;

import com.obs.earthquake.config.OverlaySettings;
import com.obs.earthquake.config.OverlaySettingsService;
import jakarta.annotation.PreDestroy;
import com.obs.earthquake.emsc.model.EmscEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Duration;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Service
public class EmscService {

    private static final Logger log = LoggerFactory.getLogger(EmscService.class);
    private static final long SSE_TIMEOUT_MS = Duration.ofMinutes(30).toMillis();
    private static final double TURKEY_LAT_MIN = 35d;
    private static final double TURKEY_LAT_MAX = 43d;
    private static final double TURKEY_LON_MIN = 25d;
    private static final double TURKEY_LON_MAX = 45d;

    private final Set<SseEmitter> emitters = new CopyOnWriteArraySet<>();
    private final ScheduledExecutorService keepAliveScheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "emsc-sse-keepalive");
        t.setDaemon(true);
        return t;
    });

    private final OverlaySettingsService settingsService;
    private volatile EmscEvent latestEvent;
    private volatile EmscClient.EmscStatus lastStatus = EmscClient.EmscStatus.CLOSED;

    public EmscService(EmscClient client, OverlaySettingsService settingsService) {
        this.settingsService = settingsService;
        client.addEventListener(this::handleEvent);
        client.addStatusListener(this::handleStatus);

        keepAliveScheduler.scheduleAtFixedRate(this::sendKeepAlive, 25, 25, TimeUnit.SECONDS);
    }

    @PreDestroy
    void shutdown() {
        keepAliveScheduler.shutdownNow();
        emitters.forEach(SseEmitter::complete);
        emitters.clear();
    }

    public Optional<EmscEvent> latestEvent() {
        return Optional.ofNullable(latestEvent);
    }

    public EmscClient.EmscStatus lastStatus() {
        return lastStatus;
    }

    public SseEmitter stream() {
        SseEmitter emitter = new SseEmitter(SSE_TIMEOUT_MS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(ex -> emitters.remove(emitter));

        try {
            emitter.send(SseEmitter.event().name("settings").data(settingsService.current()));
            emitter.send(SseEmitter.event().name("status").data(lastStatus.name()));
            if (latestEvent != null) {
                emitter.send(SseEmitter.event().name("earthquake").data(latestEvent));
            }
        } catch (IOException ex) {
            log.debug("Failed to send initial SSE payload: {}", ex.getMessage());
        }

        return emitter;
    }

    public void broadcastSettings() {
        OverlaySettings settings = settingsService.current();
        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("settings").data(settings));
            } catch (IOException ex) {
                emitter.complete();
                emitters.remove(emitter);
            }
        });
    }

    public void publishManualEvent(EmscEvent event, boolean respectFilters) {
        if (event == null) {
            return;
        }
        if (respectFilters && !shouldEmit(event)) {
            return;
        }
        emitEvent(event);
    }

    private void handleEvent(EmscEvent event) {
        if (!shouldEmit(event)) {
            return;
        }
        emitEvent(event);
    }

    private boolean shouldEmit(EmscEvent event) {
        if (event == null || !event.isValid()) {
            return false;
        }
        OverlaySettings settings = settingsService.current();
        if (!settings.streamEnabled()) {
            return false;
        }
        if (!Double.isFinite(event.magnitude()) || event.magnitude() < settings.minMag()) {
            return false;
        }
        double lat = event.latitude();
        double lon = event.longitude();
        return lat >= TURKEY_LAT_MIN && lat <= TURKEY_LAT_MAX && lon >= TURKEY_LON_MIN && lon <= TURKEY_LON_MAX;
    }

    private void emitEvent(EmscEvent event) {
        latestEvent = event;
        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("earthquake").data(event));
            } catch (IOException ex) {
                emitter.complete();
                emitters.remove(emitter);
            }
        });
    }

    private void handleStatus(EmscClient.EmscStatus status) {
        lastStatus = status;
        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("status").data(status.name()));
            } catch (IOException ex) {
                emitter.complete();
                emitters.remove(emitter);
            }
        });
    }

    private void sendKeepAlive() {
        emitters.forEach(emitter -> {
            try {
                emitter.send(SseEmitter.event().name("ping").data(System.currentTimeMillis()));
            } catch (IOException ex) {
                emitter.complete();
                emitters.remove(emitter);
            }
        });
    }
}
