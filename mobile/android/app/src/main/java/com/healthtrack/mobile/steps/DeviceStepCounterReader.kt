package com.healthtrack.mobile.steps

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

internal class DeviceStepCounterReader(context: Context) {
  private val sensorManager = context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager

  fun isSensorAvailable(): Boolean {
    return sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
  }

  suspend fun captureSnapshot(timeoutMs: Long = 3000L): DeviceStepSnapshot {
    val sensorManager = sensorManager ?: throw IllegalStateException("Step counter service unavailable.")
    val sensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
      ?: throw IllegalStateException("Step counter sensor unavailable.")

    val snapshot = withTimeoutOrNull(timeoutMs) {
      suspendCancellableCoroutine { continuation ->
        val listener = object : SensorEventListener {
          override fun onSensorChanged(event: SensorEvent) {
            sensorManager.unregisterListener(this)
            val value = event.values.firstOrNull()
            if (value == null) {
              if (continuation.isActive) {
                continuation.resumeWithException(IllegalStateException("Step counter reading was empty."))
              }
              return
            }

            if (continuation.isActive) {
              continuation.resume(
                DeviceStepSnapshot(
                  recordedAtEpochMs = System.currentTimeMillis(),
                  elapsedRealtimeMs = SystemClock.elapsedRealtime(),
                  stepsSinceBoot = value.toLong()
                )
              )
            }
          }

          override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
        }

        val registered = sensorManager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL)
        if (!registered) {
          continuation.resumeWithException(IllegalStateException("Unable to register step counter listener."))
          return@suspendCancellableCoroutine
        }

        continuation.invokeOnCancellation {
          sensorManager.unregisterListener(listener)
        }
      }
    }

    return snapshot ?: throw IllegalStateException("Step counter read timed out.")
  }
}
