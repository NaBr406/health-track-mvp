package com.healthtrack.mobile.steps

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.os.Build
import androidx.core.content.ContextCompat
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

internal const val DEVICE_STEP_COUNTER_SAMPLING_INTERVAL_MINUTES = 15L

internal fun hasActivityRecognitionPermission(context: Context): Boolean {
  if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
    return true
  }

  return ContextCompat.checkSelfPermission(
    context,
    Manifest.permission.ACTIVITY_RECOGNITION
  ) == PackageManager.PERMISSION_GRANTED
}

internal fun isStepCounterSensorAvailable(context: Context): Boolean {
  val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager ?: return false
  return sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
}

internal fun toIsoInstant(epochMs: Long): String {
  return Instant.ofEpochMilli(epochMs).toString()
}

internal fun epochMsToLocalDate(epochMs: Long, zoneId: ZoneId = ZoneId.systemDefault()): LocalDate {
  return Instant.ofEpochMilli(epochMs).atZone(zoneId).toLocalDate()
}

internal fun parseLocalDate(value: String): LocalDate {
  return LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE)
}
