package com.healthtrack.mvp.service;

record ActiveGlucoseForecastContext(
        Double currentGlucoseMmol,
        Double currentHourOffset,
        Boolean valid,
        String startedAt,
        String expiresAt
) {

    static ActiveGlucoseForecastContext empty() {
        return new ActiveGlucoseForecastContext(null, null, null, null, null);
    }
}
