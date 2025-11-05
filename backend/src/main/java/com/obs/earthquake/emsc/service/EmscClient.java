package com.obs.earthquake.emsc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.obs.earthquake.emsc.EmscProperties;
import com.obs.earthquake.emsc.model.EmscEvent;
import com.obs.earthquake.emsc.support.LastEventStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.concurrent.CompletionStage;

@Component
class EmscClient {

    private static final Logger log = LoggerFactory.getLogger(EmscClient.class);

    private final ObjectMapper mapper;
    private final EmscEventMapper eventMapper;
    private final EmscProperties properties;
    private final LastEventStore lastEventStore;
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "emsc-ws");
        t.setDaemon(true);
        return t;
    });

    private final Set<Consumer<EmscEvent>> eventListeners = new CopyOnWriteArraySet<>();
    private final Set<Consumer<EmscStatus>> statusListeners = new CopyOnWriteArraySet<>();
    private final AtomicBoolean stopped = new AtomicBoolean(false);
    private final AtomicInteger attempts = new AtomicInteger(0);
    private final Set<String> seenSignatures = new CopyOnWriteArraySet<>();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private WebSocket socket;
    private ScheduledFuture<?> heartbeat;

    EmscClient(ObjectMapper mapper,
               EmscEventMapper eventMapper,
               EmscProperties properties,
               LastEventStore lastEventStore) {
        this.mapper = mapper;
        this.eventMapper = eventMapper;
        this.properties = properties;
        this.lastEventStore = lastEventStore;
    }

    @PostConstruct
    void start() {
        connect();
    }

    @PreDestroy
    void stop() {
        stopped.set(true);
        cancelHeartbeat();
        if (socket != null) {
            try {
                socket.sendClose(WebSocket.NORMAL_CLOSURE, "shutdown");
            } catch (Exception ex) {
                log.debug("Error closing WebSocket: {}", ex.getMessage());
            }
        }
        scheduler.shutdownNow();
    }

    void addEventListener(Consumer<EmscEvent> listener) {
        eventListeners.add(listener);
    }

    void addStatusListener(Consumer<EmscStatus> listener) {
        statusListeners.add(listener);
    }

    private void connect() {
        if (stopped.get()) {
            return;
        }
        final String url = properties.wsUrl();
        if (url == null || url.isBlank()) {
            log.warn("EMSC ws-url is not configured; skipping connect");
            return;
        }
        try {
            log.info("Connecting to EMSC WebSocket at {}", url);
            WebSocket.Builder builder = httpClient.newWebSocketBuilder()
                    .connectTimeout(Duration.ofSeconds(10));
            if (properties.bearer() != null && !properties.bearer().isBlank()) {
                builder.subprotocols("bearer", properties.bearer());
            }
            CompletableFuture<WebSocket> future = builder.buildAsync(URI.create(url), new Listener());
            future.whenComplete((ws, err) -> {
                if (err != null) {
                    log.warn("Failed to connect to EMSC: {}", err.getMessage());
                    notifyStatus(EmscStatus.LOST);
                    scheduleReconnect();
                } else {
                    socket = ws;
                }
            });
        } catch (Exception ex) {
            log.warn("Error initiating WebSocket connection: {}", ex.getMessage());
            notifyStatus(EmscStatus.LOST);
            scheduleReconnect();
        }
    }

    private void scheduleReconnect() {
        if (stopped.get()) {
            return;
        }
        int attempt = attempts.getAndIncrement();
        int base = Math.min(30_000, (int) (2000 * Math.pow(2, attempt)));
        int jitter = (int) (Math.random() * 500);
        long delay = base + jitter;
        log.info("Reconnecting in {} ms (attempt #{})", delay, attempt + 1);
        scheduler.schedule(this::connect, delay, TimeUnit.MILLISECONDS);
    }

    private void notifyStatus(EmscStatus status) {
        statusListeners.forEach(listener -> {
            try {
                listener.accept(status);
            } catch (Exception ex) {
                log.debug("Status listener failed: {}", ex.getMessage());
            }
        });
    }

    private void onEvent(EmscEvent event) {
        if (event == null || !event.isValid()) {
            return;
        }
        String signature = event.signature();
        if (!seenSignatures.add(signature)) {
            return;
        }
        lastEventStore.write(event.unid());
        eventListeners.forEach(listener -> {
            try {
                listener.accept(event);
            } catch (Exception ex) {
                log.debug("Event listener failure: {}", ex.getMessage());
            }
        });
    }

    private void sendSubscribe(WebSocket webSocket) {
        try {
            long since = 0;
            if (properties.fixedTimestamp() != null) {
                since = properties.fixedTimestamp();
            } else if (properties.sinceWindowSec() > 0) {
                since = (System.currentTimeMillis() / 1000) - properties.sinceWindowSec();
            }
            var root = mapper.createObjectNode();
            root.put("type", "subscribe");
            root.put("topic", properties.topic());
            root.put("id", properties.clientId());
            if (since > 0) {
                root.put("ts", since);
            }
            lastEventStore.read().ifPresent(id -> root.put("after_id", id));
            String json = mapper.writeValueAsString(root);
            webSocket.sendText(json, true);
        } catch (Exception ex) {
            log.debug("Failed to send subscribe message: {}", ex.getMessage());
        }
    }

    private void startHeartbeat(WebSocket webSocket) {
        cancelHeartbeat();
        int pingSec = properties.pingIntervalSec();
        if (pingSec <= 0) {
            return;
        }
        heartbeat = scheduler.scheduleAtFixedRate(() -> {
            try {
                var ping = mapper.createObjectNode();
                ping.put("type", "ping");
                ping.put("t", System.currentTimeMillis());
                webSocket.sendText(mapper.writeValueAsString(ping), true);
            } catch (Exception ex) {
                log.debug("Heartbeat send failed: {}", ex.getMessage());
            }
        }, pingSec, pingSec, TimeUnit.SECONDS);
    }

    private void cancelHeartbeat() {
        if (heartbeat != null) {
            heartbeat.cancel(true);
            heartbeat = null;
        }
    }

    public enum EmscStatus { OPEN, LOST, CLOSED }

    private class Listener implements WebSocket.Listener {

        private final StringBuilder buffer = new StringBuilder();

        @Override
        public void onOpen(WebSocket webSocket) {
            log.info("Connected to EMSC WebSocket");
            attempts.set(0);
            notifyStatus(EmscStatus.OPEN);

            if (properties.bearer() != null && !properties.bearer().isBlank()) {
                try {
                    var auth = mapper.createObjectNode();
                    auth.put("type", "auth");
                    auth.put("authorization", "Bearer " + properties.bearer());
                    webSocket.sendText(mapper.writeValueAsString(auth), true);
                } catch (Exception ex) {
                    log.debug("Failed to send auth message: {}", ex.getMessage());
                }
            }

            sendSubscribe(webSocket);
            startHeartbeat(webSocket);
            WebSocket.Listener.super.onOpen(webSocket);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            buffer.append(data);
            if (last) {
                String payload = buffer.toString();
                buffer.setLength(0);
                scheduler.execute(() -> handlePayload(payload));
            }
            return WebSocket.Listener.super.onText(webSocket, data, last);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.warn("WebSocket error: {}", error.getMessage());
            notifyStatus(EmscStatus.LOST);
            cancelHeartbeat();
            scheduleReconnect();
        }

        @Override
        public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
            log.info("WebSocket closed: {} - {}", statusCode, reason);
            notifyStatus(EmscStatus.CLOSED);
            cancelHeartbeat();
            if (!stopped.get()) {
                scheduleReconnect();
            }
            return WebSocket.Listener.super.onClose(webSocket, statusCode, reason);
        }

        private void handlePayload(String payload) {
            try {
                JsonNode node = mapper.readTree(payload);
                if (node == null || node.isNull()) {
                    return;
                }
                String type = node.path("type").asText("");
                if ("event".equals(type) && "earthquake_alert".equals(node.path("event").asText(""))) {
                    JsonNode payloadNode = node.path("payload");
                    List<EmscEvent> events = eventMapper.fromPayload(payloadNode);
                    if (events.isEmpty()) {
                        return;
                    }
                    events.stream()
                            .filter(EmscEvent::isValid)
                            .max((a, b) -> {
                                long at = Optional.ofNullable(a.time()).map(Instant::toEpochMilli).orElse(0L);
                                long bt = Optional.ofNullable(b.time()).map(Instant::toEpochMilli).orElse(0L);
                                return Long.compare(at, bt);
                            })
                            .ifPresent(EmscClient.this::onEvent);
                }
            } catch (Exception ex) {
                log.debug("Failed to parse message: {}", ex.getMessage());
            }
        }
    }
}
