package com.healthtrack.mobile.steps

data class DeviceStepSnapshot(
  val id: Long = 0L,
  val recordedAtEpochMs: Long,
  val elapsedRealtimeMs: Long,
  val stepsSinceBoot: Long
)

data class DeviceStepDailyRecord(
  val recordedOn: String,
  val steps: Int,
  val sampledAtIso: String?
)

data class DeviceStepHourlyRecord(
  val hourStartIso: String,
  val label: String,
  val steps: Int,
  val isCurrentHour: Boolean
)
