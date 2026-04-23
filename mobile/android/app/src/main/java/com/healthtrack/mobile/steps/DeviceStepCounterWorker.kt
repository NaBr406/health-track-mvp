package com.healthtrack.mobile.steps

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class DeviceStepCounterWorker(
  appContext: Context,
  params: WorkerParameters
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    if (!hasActivityRecognitionPermission(applicationContext) || !isStepCounterSensorAvailable(applicationContext)) {
      return Result.success()
    }

    val reader = DeviceStepCounterReader(applicationContext)
    val store = DeviceStepSnapshotStore(applicationContext)

    return try {
      val snapshot = reader.captureSnapshot()
      store.insertSnapshot(snapshot)
      store.pruneOlderThan(System.currentTimeMillis() - TimeUnit.DAYS.toMillis(35))
      Result.success()
    } catch (_: Exception) {
      Result.success()
    } finally {
      store.close()
    }
  }
}
