package com.healthtrack.mvp.service;

import java.time.Instant;

record UserTimeContext(
        Instant currentInstant,
        String timeZone,
        String currentDate,
        String currentTime,
        String currentDateTime,
        String utcOffset
) {
}
