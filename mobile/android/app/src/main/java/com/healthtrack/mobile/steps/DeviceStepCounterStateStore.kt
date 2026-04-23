package com.healthtrack.mobile.steps

import android.content.Context

internal object DeviceStepCounterStateStore {
  private const val PREFS_NAME = "device_step_counter_state"
  private const val KEY_LAST_ERROR = "last_error"
  private const val KEY_LAST_READ_AT = "last_read_at"

  fun getLastError(context: Context): String? {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_LAST_ERROR, null)
  }

  fun getLastReadAt(context: Context): String? {
    return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .getString(KEY_LAST_READ_AT, null)
  }

  fun saveReadSuccess(context: Context, readAtIso: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_LAST_READ_AT, readAtIso)
      .remove(KEY_LAST_ERROR)
      .apply()
  }

  fun saveReadFailure(context: Context, message: String) {
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      .edit()
      .putString(KEY_LAST_ERROR, message)
      .apply()
  }
}
