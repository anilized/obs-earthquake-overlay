package com.obs.earthquake.emsc.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Objects;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record EmscEvent(
        String unid,
        Instant time,
        @JsonProperty("lat") double latitude,
        @JsonProperty("lon") double longitude,
        @JsonProperty("mag") double magnitude,
        Double depth,
        @JsonProperty("magtype") String magnitudeType,
        @JsonProperty("province") String province,
        @JsonProperty("flynn_region") String flynnRegion
) {

    public EmscEvent normalize() {
        return new EmscEvent(
                unid,
                time,
                latitude,
                longitude,
                magnitude,
                depth,
                magnitudeType,
                province,
                flynnRegion
        );
    }

    public String signature() {
        String timestamp = time != null ? time.toString() : "";
        double roundedMag = Double.isFinite(magnitude) ? magnitude : -999;
        return unid + "::" + timestamp + "::" + roundedMag;
    }

    public boolean isValid() {
        return unid != null && !unid.isBlank()
                && time != null
                && !Double.isNaN(latitude)
                && !Double.isNaN(longitude)
                && !Double.isNaN(magnitude);
    }

    public EmscEvent withRevision(EmscEvent other) {
        if (other == null) {
            return this;
        }
        return new EmscEvent(
                Objects.requireNonNullElse(other.unid, unid),
                Objects.requireNonNullElse(other.time, time),
                Double.isFinite(other.latitude) ? other.latitude : latitude,
                Double.isFinite(other.longitude) ? other.longitude : longitude,
                Double.isFinite(other.magnitude) ? other.magnitude : magnitude,
                other.depth != null ? other.depth : depth,
                other.magnitudeType != null ? other.magnitudeType : magnitudeType,
                other.province != null ? other.province : province,
                other.flynnRegion != null ? other.flynnRegion : flynnRegion
        );
    }
}
