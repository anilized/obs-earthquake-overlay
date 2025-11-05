package com.obs.earthquake.emsc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.obs.earthquake.emsc.model.EmscEvent;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Component
class EmscEventMapper {

    /**
     * Converts a WebSocket payload object into an {@link EmscEvent}.
     */
    Optional<EmscEvent> map(JsonNode node) {
        if (node == null || node.isNull()) {
            return Optional.empty();
        }
        String id = node.path("id").asText(null);
        if (id == null || id.isBlank()) {
            // fallback: build unique id from coordinates and time
            Instant time = parseTimestamp(node.get("event_time"));
            double lat = node.path("latitude").asDouble(Double.NaN);
            double lon = node.path("longitude").asDouble(Double.NaN);
            if (!Double.isFinite(lat) || !Double.isFinite(lon) || time == null) {
                return Optional.empty();
            }
            id = time.toString() + ":" + round(lat) + "," + round(lon);
        }

        Instant time = parseTimestamp(node.get("event_time"));
        if (time == null) {
            return Optional.empty();
        }

        double mag = node.path("magnitude").asDouble(Double.NaN);
        double lat = node.path("latitude").asDouble(Double.NaN);
        double lon = node.path("longitude").asDouble(Double.NaN);
        if (!Double.isFinite(mag) || !Double.isFinite(lat) || !Double.isFinite(lon)) {
            return Optional.empty();
        }

        Double depth = node.hasNonNull("depth") ? node.path("depth").asDouble() : null;
        String province = node.path("province").asText(null);
        String flynn = node.path("location").asText(null);
        String magType = node.path("magtype").asText(null);

        return Optional.of(new EmscEvent(id, time, lat, lon, mag,
                depth, magType, province, flynn));
    }

    List<EmscEvent> fromPayload(JsonNode payload) {
        List<EmscEvent> events = new ArrayList<>();
        if (payload == null || payload.isNull() || payload.isMissingNode()) {
            return events;
        }
        if (payload.isArray()) {
            payload.forEach(node -> map(node).ifPresent(events::add));
        } else if (payload.isObject()) {
            map(payload).ifPresent(events::add);
        }
        return events;
    }

    private Instant parseTimestamp(JsonNode node) {
        if (node == null) {
            return null;
        }
        if (node.isNumber()) {
            long value = node.asLong();
            if (String.valueOf(value).length() <= 10) {
                value *= 1000;
            }
            return Instant.ofEpochMilli(value);
        }
        String text = node.asText(null);
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            if (text.matches("^\\d+$")) {
                long numeric = Long.parseLong(text);
                if (text.length() <= 10) {
                    numeric *= 1000;
                }
                return Instant.ofEpochMilli(numeric);
            }
            return Instant.parse(text);
        } catch (DateTimeParseException | NumberFormatException ex) {
            return null;
        }
    }

    private String round(double v) {
        return String.format("%.3f", v);
    }
}
