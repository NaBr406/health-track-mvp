package com.healthtrack.mobile.steps

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

internal object DeviceStepCounterScheduler {
  private const val UNIQUE_WORK_NAME = "device-step-counter-sampling"

  fun ensureScheduled(context: Context) {
    val request = PeriodicWorkRequestBuilder<DeviceStepCounterWorker>(
      DEVICE_STEP_COUNTER_SAMPLING_INTERVAL_MINUTES,
      TimeUnit.MINUTES
    ).build()

    WorkManager.getInstance(context).enqueueUniquePeriodicWork(
      UNIQUE_WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      request
    )
  }
}
