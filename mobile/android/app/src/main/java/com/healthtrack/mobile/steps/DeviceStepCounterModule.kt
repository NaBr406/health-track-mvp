package com.healthtrack.mobile.steps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.util.concurrent.TimeUnit

class DeviceStepCounterModule(
  reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var liveStepListener: SensorEventListener? = null
  @Volatile private var jsListenerCount = 0

  override fun getName(): String = MODULE_NAME

  override fun invalidate() {
    stopLiveUpdatesInternal()
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

  @ReactMethod
  fun readRecentHourlyRecords(hours: Double, promise: Promise) {
    moduleScope.launch {
      try {
        val context = reactApplicationContext
        if (!isStepCounterSensorAvailable(context) || !hasActivityRecognitionPermission(context)) {
          promise.resolve(Arguments.createArray())
          return@launch
        }

        DeviceStepCounterScheduler.ensureScheduled(context)

        val store = DeviceStepSnapshotStore(context)
        try {
          store.pruneOlderThan(System.currentTimeMillis() - TimeUnit.DAYS.toMillis(35))
          val records = buildHourlyRecords(store, hours.toInt().coerceIn(1, 24))
          val payload = Arguments.createArray()

          records.forEach { record ->
            payload.pushMap(
              Arguments.createMap().apply {
                putString("hourStartIso", record.hourStartIso)
                putString("label", record.label)
                putInt("steps", record.steps)
                putBoolean("isCurrentHour", record.isCurrentHour)
              }
            )
          }

          promise.resolve(payload)
        } finally {
          store.close()
        }
      } catch (error: Exception) {
        promise.reject("E_DEVICE_STEP_COUNTER_RECENT_HOURLY", error.message, error)
      }
    }
  }

  @ReactMethod
  fun startLiveUpdates(promise: Promise) {
    moduleScope.launch {
      try {
        ensureLiveUpdatesStarted()
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("E_DEVICE_STEP_COUNTER_LIVE_START", error.message, error)
      }
    }
  }

  @ReactMethod
  fun stopLiveUpdates(promise: Promise) {
    stopLiveUpdatesInternal()
    promise.resolve(true)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    jsListenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Double) {
    jsListenerCount = (jsListenerCount - count.toInt()).coerceAtLeast(0)
    if (jsListenerCount == 0) {
      stopLiveUpdatesInternal()
    }
  }

  private fun buildDailyRecords(
    store: DeviceStepSnapshotStore,
    days: Int,
    endDate: LocalDate
  ): List<DeviceStepDailyRecord> {
    val startDate = endDate.minusDays((days - 1).toLong())

    return List(days) { index ->
      buildDailyRecord(store, startDate.plusDays(index.toLong()))
    }
  }

  private fun buildDailyRecord(
    store: DeviceStepSnapshotStore,
    date: LocalDate,
    additionalSnapshot: DeviceStepSnapshot? = null
  ): DeviceStepDailyRecord {
    val zoneId = ZoneId.systemDefault()
    val dayStartEpochMs = date.atStartOfDay(zoneId).toInstant().toEpochMilli()
    val dayEndEpochMs = date.plusDays(1).atStartOfDay(zoneId).toInstant().toEpochMilli()
    val daySnapshots = store.getSnapshotsBetween(dayStartEpochMs, dayEndEpochMs)
    val sequence = buildSnapshotSequence(store, dayStartEpochMs, dayEndEpochMs, additionalSnapshot)

    val steps = if (sequence.size < 2) {
      0
    } else {
      sequence
        .zipWithNext()
        .sumOf { (previous, current) -> resolveStepIncrement(previous, current) }
        .coerceIn(0L, Int.MAX_VALUE.toLong())
        .toInt()
    }

    val sampledAtIso = when {
      additionalSnapshot != null && epochMsToLocalDate(additionalSnapshot.recordedAtEpochMs, zoneId) == date ->
        toIsoInstant(additionalSnapshot.recordedAtEpochMs)
      else -> daySnapshots.lastOrNull()?.let { toIsoInstant(it.recordedAtEpochMs) }
    }

    return DeviceStepDailyRecord(
      recordedOn = date.toString(),
      steps = steps,
      sampledAtIso = sampledAtIso
    )
  }

  private fun buildHourlyRecords(
    store: DeviceStepSnapshotStore,
    hours: Int,
    additionalSnapshot: DeviceStepSnapshot? = null
  ): List<DeviceStepHourlyRecord> {
    val zoneId = ZoneId.systemDefault()
    val bucketCount = hours.coerceIn(1, 24)
    val currentHourStart = Instant.ofEpochMilli(additionalSnapshot?.recordedAtEpochMs ?: System.currentTimeMillis())
      .atZone(zoneId)
      .withMinute(0)
      .withSecond(0)
      .withNano(0)
    val hourStarts = List(bucketCount) { index ->
      currentHourStart.minusHours((bucketCount - 1 - index).toLong())
    }
    val windowStartEpochMs = hourStarts.first().toInstant().toEpochMilli()
    val windowEndEpochMs = currentHourStart.plusHours(1).toInstant().toEpochMilli()
    val sequence = buildSnapshotSequence(store, windowStartEpochMs, windowEndEpochMs, additionalSnapshot)

    if (sequence.size < 2) {
      return emptyList()
    }

    val hourIndexByStartEpochMs = hourStarts
      .mapIndexed { index, hourStart -> hourStart.toInstant().toEpochMilli() to index }
      .toMap()
    val bucketSteps = IntArray(bucketCount)

    sequence.zipWithNext().forEach { (previous, current) ->
      val increment = resolveStepIncrement(previous, current)
        .coerceIn(0L, Int.MAX_VALUE.toLong())
        .toInt()
      val bucketStartEpochMs = toHourStart(current.recordedAtEpochMs, zoneId).toInstant().toEpochMilli()
      val bucketIndex = hourIndexByStartEpochMs[bucketStartEpochMs] ?: return@forEach

      bucketSteps[bucketIndex] = (bucketSteps[bucketIndex].toLong() + increment)
        .coerceIn(0L, Int.MAX_VALUE.toLong())
        .toInt()
    }

    return hourStarts.mapIndexed { index, hourStart ->
      DeviceStepHourlyRecord(
        hourStartIso = hourStart.toInstant().toString(),
        label = hourStart.hour.toString().padStart(2, '0'),
        steps = bucketSteps[index],
        isCurrentHour = index == bucketCount - 1
      )
    }
  }

  private fun buildSnapshotSequence(
    store: DeviceStepSnapshotStore,
    startEpochMsInclusive: Long,
    endEpochMsExclusive: Long,
    additionalSnapshot: DeviceStepSnapshot? = null
  ): List<DeviceStepSnapshot> {
    val baseline = store.getLatestSnapshotBefore(startEpochMsInclusive)
    val windowSnapshots = store.getSnapshotsBetween(startEpochMsInclusive, endEpochMsExclusive)

    return buildList {
      if (baseline != null) {
        add(baseline)
      }
      addAll(windowSnapshots)
      if (additionalSnapshot != null) {
        val lastSnapshot = lastOrNull()
        val isDuplicate = lastSnapshot != null &&
          lastSnapshot.recordedAtEpochMs == additionalSnapshot.recordedAtEpochMs &&
          lastSnapshot.elapsedRealtimeMs == additionalSnapshot.elapsedRealtimeMs &&
          lastSnapshot.stepsSinceBoot == additionalSnapshot.stepsSinceBoot

        if (!isDuplicate) {
          add(additionalSnapshot)
        }
      }
    }
  }

  private suspend fun ensureLiveUpdatesStarted() {
    val context = reactApplicationContext
    if (!isStepCounterSensorAvailable(context)) {
      throw IllegalStateException("Step counter sensor unavailable.")
    }
    if (!hasActivityRecognitionPermission(context)) {
      throw IllegalStateException("Activity recognition permission unavailable.")
    }

    DeviceStepCounterScheduler.ensureScheduled(context)

    withContext(Dispatchers.Main) {
      if (liveStepListener != null) {
        return@withContext
      }

      val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
        ?: throw IllegalStateException("Step counter service unavailable.")
      val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        ?: throw IllegalStateException("Step counter sensor unavailable.")

      val listener = object : SensorEventListener {
        override fun onSensorChanged(event: SensorEvent) {
          val value = event.values.firstOrNull() ?: return
          handleLiveStepSensorChanged(value.toLong())
        }

        override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
      }

      val registered = sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_UI, mainHandler)
      if (!registered) {
        throw IllegalStateException("Unable to register live step counter listener.")
      }

      liveStepListener = listener
    }
  }

  private fun stopLiveUpdatesInternal() {
    val context = reactApplicationContext
    val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return
    val listener = liveStepListener ?: return
    liveStepListener = null
    mainHandler.post {
      sensorManager.unregisterListener(listener)
    }
  }

  private fun handleLiveStepSensorChanged(stepsSinceBoot: Long) {
    moduleScope.launch {
      val context = reactApplicationContext
      val snapshot = DeviceStepSnapshot(
        recordedAtEpochMs = System.currentTimeMillis(),
        elapsedRealtimeMs = SystemClock.elapsedRealtime(),
        stepsSinceBoot = stepsSinceBoot
      )

      try {
        val store = DeviceStepSnapshotStore(context)
        val (dailyRecord, hourlyRecords) = try {
          val latestSnapshot = store.getLatestSnapshot()
          if (shouldPersistLiveSnapshot(latestSnapshot, snapshot)) {
            store.insertSnapshot(snapshot)
          }

          buildDailyRecord(store, epochMsToLocalDate(snapshot.recordedAtEpochMs), snapshot) to
            buildHourlyRecords(store, STEP_TREND_WINDOW_HOURS, snapshot)
        } finally {
          store.close()
        }

        DeviceStepCounterStateStore.saveReadSuccess(context, toIsoInstant(snapshot.recordedAtEpochMs))
        emitLiveStepUpdate(dailyRecord, hourlyRecords)
      } catch (error: Exception) {
        DeviceStepCounterStateStore.saveReadFailure(context, error.message ?: "Device step counter live update failed.")
      }
    }
  }

  private fun shouldPersistLiveSnapshot(previous: DeviceStepSnapshot?, current: DeviceStepSnapshot): Boolean {
    if (previous == null) {
      return true
    }
    if (epochMsToLocalDate(previous.recordedAtEpochMs) != epochMsToLocalDate(current.recordedAtEpochMs)) {
      return true
    }
    if (current.elapsedRealtimeMs < previous.elapsedRealtimeMs || current.stepsSinceBoot < previous.stepsSinceBoot) {
      return true
    }

    return current.recordedAtEpochMs - previous.recordedAtEpochMs >= LIVE_SNAPSHOT_PERSIST_INTERVAL_MS
  }

  private fun emitLiveStepUpdate(record: DeviceStepDailyRecord, hourlyRecords: List<DeviceStepHourlyRecord>) {
    if (!reactApplicationContext.hasActiveCatalystInstance()) {
      return
    }

    val payload = Arguments.createMap().apply {
      putString("recordedOn", record.recordedOn)
      putInt("steps", record.steps)
      putString("sampledAt", record.sampledAtIso)
      putString("sourceDevice", resolveDeviceName())
      putString("sourceTimeZone", ZoneId.systemDefault().id)
      putArray(
        "stepTrend8h",
        Arguments.createArray().apply {
          hourlyRecords.forEach { hourlyRecord ->
            pushMap(
              Arguments.createMap().apply {
                putString("hourStartIso", hourlyRecord.hourStartIso)
                putString("label", hourlyRecord.label)
                putInt("steps", hourlyRecord.steps)
                putBoolean("isCurrentHour", hourlyRecord.isCurrentHour)
              }
            )
          }
        }
      )
    }

    reactApplicationContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(LIVE_UPDATE_EVENT_NAME, payload)
  }

  private fun resolveStepIncrement(previous: DeviceStepSnapshot, current: DeviceStepSnapshot): Long {
    return if (current.elapsedRealtimeMs >= previous.elapsedRealtimeMs && current.stepsSinceBoot >= previous.stepsSinceBoot) {
      current.stepsSinceBoot - previous.stepsSinceBoot
    } else {
      current.stepsSinceBoot
    }
  }

  private fun toHourStart(epochMs: Long, zoneId: ZoneId): ZonedDateTime {
    return Instant.ofEpochMilli(epochMs)
      .atZone(zoneId)
      .withMinute(0)
      .withSecond(0)
      .withNano(0)
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
    const val LIVE_UPDATE_EVENT_NAME = "deviceStepCounterLiveUpdate"
    private const val STEP_TREND_WINDOW_HOURS = 8
    private const val LIVE_SNAPSHOT_PERSIST_INTERVAL_MS = 60_000L
  }
}
