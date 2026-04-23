package com.healthtrack.mvp.service;

record AdjustmentModel(
        String title,
        String parameterLabel,
        String parameterDelta,
        String rationale,
        String observation
) {
}
