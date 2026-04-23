package com.healthtrack.mobile.steps

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.TimeUnit

class DeviceStepCounterModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

  override fun getName(): String = MODULE_NAME

  override fun invalidate() {
    super.invalidate()
    moduleScope.cancel()
  }

  @ReactMethod
  fun getStatus(promise: Promise) {
    moduleScope.launch {
      try {
        val context = reactApplicationContext
        val sensorAvailable = isStepCounterSensorAvailable(context)
        val permissionGranted = hasActivityRecognitionPermission(context)
        if (sensorAvailable && permissionGranted) {
          DeviceStepCounterScheduler.ensureScheduled(context)
        }

        val store = DeviceStepSnapshotStore(context)
        val latestSnapshot = try {
          store.getLatestSnapshot()
        } finally {
          store.close()
        }

        val payload = Arguments.createMap().apply {
          putBoolean("sensorAvailable", sensorAvailable)
          putBoolean("permissionGranted", permissionGranted)
          putBoolean("backgroundSamplingEnabled", sensorAvailable && permissionGranted)
          putString("lastSnapshotAt", latestSnapshot?.let { toIsoInstant(it.recordedAtEpochMs) })
          putString("lastReadAt", DeviceStepCounterStateStore.getLastReadAt(context))
          putString("lastError", DeviceStepCounterStateStore.getLastError(context))
          putString("sourceDevice", resolveDeviceName())
          putInt("samplingIntervalMinutes", DEVICE_STEP_COUNTER_SAMPLING_INTERVAL_MINUTES.toInt())
        }

        promise.resolve(payload)
      } catch (error: Exception) {
        promise.reject("E_DEVICE_STEP_COUNTER_STATUS", error.message, error)
      }
    }
  }

  @ReactMethod
  fun readDailyRecords(days: Double, endDate: String?, promise: Promise) {
    moduleScope.launch {
      try {
        val context = reactApplicationContext
        if (!isStepCounterSensorAvailable(context) || !hasActivityRecognitionPermission(context)) {
          promise.resolve(Arguments.createArray())
          return@launch
        }

        DeviceStepCounterScheduler.ensureScheduled(context)

        val reader = DeviceStepCounterReader(context)
        val store = DeviceStepSnapshotStore(context)

        try {
          try {
            val snapshot = reader.captureSnapshot()
            store.insertSnapshot(snapshot)
            DeviceStepCounterStateStore.saveReadSuccess(context, toIsoInstant(snapshot.recordedAtEpochMs))
          } catch (captureError: Exception) {
            DeviceStepCounterStateStore.saveReadFailure(context, captureError.message ?: "Device step counter read failed.")
          }

          store.pruneOlderThan(System.currentTimeMillis() - TimeUnit.DAYS.toMillis(35))
          val records = buildDailyRecords(
            store = store,
            days = days.toInt().coerceIn(1, 30),
            endDate = endDate?.takeIf { it.isNotBlank() }?.let(::parseLocalDate) ?: LocalDate.now(ZoneId.systemDefault())
          )

          val payload = Arguments.createArray()
          records.forEach { record ->
            payload.pushMap(
              Arguments.createMap().apply {
                putString("recordedOn", record.recordedOn)
                putInt("steps", record.steps)
                putString("sampledAt", record.sampledAtIso)
              }
            )
          }

          promise.resolve(payload)
        } finally {
          store.close()
        }
      } catch (error: Exception) {
        promise.reject("E_DEVICE_STEP_COUNTER_READ", error.message, error)
      }
    }
  }

  private fun buildDailyRecords(
    store: DeviceStepSnapshotStore,
    days: Int,
    endDate: LocalDate
  ): List<DeviceStepDailyRecord> {
    val zoneId = ZoneId.systemDefault()
    val startDate = endDate.minusDays((days - 1).toLong())

    return List(days) { index ->
      val date = startDate.plusDays(index.toLong())
      val dayStartEpochMs = date.atStartOfDay(zoneId).toInstant().toEpochMilli()
      val dayEndEpochMs = date.plusDays(1).atStartOfDay(zoneId).toInstant().toEpochMilli()
      val baseline = store.getLatestSnapshotBefore(dayStartEpochMs)
      val daySnapshots = store.getSnapshotsBetween(dayStartEpochMs, dayEndEpochMs)
      val sequence = buildList {
        if (baseline != null) {
          add(baseline)
        }
        addAll(daySnapshots)
      }

      val steps = if (sequence.size < 2) {
        0
      } else {
        sequence
          .zipWithNext()
          .sumOf { (previous, current) -> resolveStepIncrement(previous, current) }
          .coerceIn(0L, Int.MAX_VALUE.toLong())
          .toInt()
      }

      DeviceStepDailyRecord(
        recordedOn = date.toString(),
        steps = steps,
        sampledAtIso = daySnapshots.lastOrNull()?.let { toIsoInstant(it.recordedAtEpochMs) }
      )
    }
  }

  private fun resolveStepIncrement(previous: DeviceStepSnapshot, current: DeviceStepSnapshot): Long {
    return if (current.elapsedRealtimeMs >= previous.elapsedRealtimeMs && current.stepsSinceBoot >= previous.stepsSinceBoot) {
      current.stepsSinceBoot - previous.stepsSinceBoot
    } else {
      current.stepsSinceBoot
    }
  }

  private fun resolveDeviceName(): String {
    val manufacturer = Build.MANUFACTURER?.trim().orEmpty()
    val model = Build.MODEL?.trim().orEmpty()
    return listOf(manufacturer, model)
      .filter { it.isNotEmpty() }
      .joinToString(" ")
      .ifEmpty { "Android device" }
  }

  companion object {
    const val MODULE_NAME = "DeviceStepCounter"
  }
}
