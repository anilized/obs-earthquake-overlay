package com.obs.earthquake.config;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

public record OverlaySettings(
        @JsonProperty(defaultValue = "3.0") double minMag,
        @JsonProperty(defaultValue = "true") boolean beep,
        @JsonProperty(defaultValue = "assets/default_alert.mp3") String soundUrl,
        @JsonProperty(defaultValue = "#dc2626") String notifColor,
        @JsonProperty(defaultValue = "8") int displayDurationSec,
        @JsonProperty(defaultValue = "dark") String theme,
        @JsonProperty(defaultValue = "square") String overlayStyle,
        @JsonProperty(defaultValue = "true") boolean streamEnabled
) {

    public static OverlaySettings defaults() {
        return new OverlaySettings(
                3.0,
                true,
                "assets/default_alert.mp3",
                "#dc2626",
                8,
                "dark",
                "square",
                true
        );
    }

    @JsonIgnore
    public OverlaySettings normalize() {
        double minMagNormalized = Double.isFinite(minMag) ? Math.max(0, minMag) : 3.0;
        int display = displayDurationSec >= 0 ? displayDurationSec : 0;
        String themeNormalized = "light".equalsIgnoreCase(theme) ? "light" : "dark";
        String styleNormalized = "flat".equalsIgnoreCase(overlayStyle) ? "flat" : "square";
        String sound = (soundUrl == null || soundUrl.isBlank()) ? "assets/default_alert.mp3" : soundUrl.trim();
        String color = (notifColor == null || notifColor.isBlank()) ? "#dc2626" : notifColor.trim();

        return new OverlaySettings(
                minMagNormalized,
                beep,
                sound,
                color,
                display,
                themeNormalized,
                styleNormalized,
                streamEnabled
        );
    }
}
