package com.healthtrack.mobile.steps

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

internal class DeviceStepSnapshotStore(context: Context) : SQLiteOpenHelper(
  context,
  DATABASE_NAME,
  null,
  DATABASE_VERSION
) {
  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      """
      CREATE TABLE $TABLE_NAME (
        $COLUMN_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        $COLUMN_RECORDED_AT_EPOCH_MS INTEGER NOT NULL,
        $COLUMN_ELAPSED_REALTIME_MS INTEGER NOT NULL,
        $COLUMN_STEPS_SINCE_BOOT INTEGER NOT NULL
      )
      """.trimIndent()
    )
    db.execSQL(
      "CREATE INDEX ${TABLE_NAME}_recorded_at_idx ON $TABLE_NAME($COLUMN_RECORDED_AT_EPOCH_MS)"
    )
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
    db.execSQL("DROP TABLE IF EXISTS $TABLE_NAME")
    onCreate(db)
  }

  fun insertSnapshot(snapshot: DeviceStepSnapshot) {
    val values = ContentValues().apply {
      put(COLUMN_RECORDED_AT_EPOCH_MS, snapshot.recordedAtEpochMs)
      put(COLUMN_ELAPSED_REALTIME_MS, snapshot.elapsedRealtimeMs)
      put(COLUMN_STEPS_SINCE_BOOT, snapshot.stepsSinceBoot)
    }
    writableDatabase.insert(TABLE_NAME, null, values)
  }

  fun getLatestSnapshot(): DeviceStepSnapshot? {
    return readableDatabase.query(
      TABLE_NAME,
      PROJECTION,
      null,
      null,
      null,
      null,
      "$COLUMN_RECORDED_AT_EPOCH_MS DESC",
      "1"
    ).use { cursor ->
      if (!cursor.moveToFirst()) {
        null
      } else {
        cursor.toSnapshot()
      }
    }
  }

  fun getLatestSnapshotBefore(recordedAtEpochMs: Long): DeviceStepSnapshot? {
    return readableDatabase.query(
      TABLE_NAME,
      PROJECTION,
      "$COLUMN_RECORDED_AT_EPOCH_MS < ?",
      arrayOf(recordedAtEpochMs.toString()),
      null,
      null,
      "$COLUMN_RECORDED_AT_EPOCH_MS DESC",
      "1"
    ).use { cursor ->
      if (!cursor.moveToFirst()) {
        null
      } else {
        cursor.toSnapshot()
      }
    }
  }

  fun getSnapshotsBetween(startEpochMsInclusive: Long, endEpochMsExclusive: Long): List<DeviceStepSnapshot> {
    return readableDatabase.query(
      TABLE_NAME,
      PROJECTION,
      "$COLUMN_RECORDED_AT_EPOCH_MS >= ? AND $COLUMN_RECORDED_AT_EPOCH_MS < ?",
      arrayOf(startEpochMsInclusive.toString(), endEpochMsExclusive.toString()),
      null,
      null,
      "$COLUMN_RECORDED_AT_EPOCH_MS ASC"
    ).use { cursor ->
      buildList {
        while (cursor.moveToNext()) {
          add(cursor.toSnapshot())
        }
      }
    }
  }

  fun getEarliestSnapshotAtOrAfter(recordedAtEpochMs: Long): DeviceStepSnapshot? {
    return readableDatabase.query(
      TABLE_NAME,
      PROJECTION,
      "$COLUMN_RECORDED_AT_EPOCH_MS >= ?",
      arrayOf(recordedAtEpochMs.toString()),
      null,
      null,
      "$COLUMN_RECORDED_AT_EPOCH_MS ASC",
      "1"
    ).use { cursor ->
      if (!cursor.moveToFirst()) {
        null
      } else {
        cursor.toSnapshot()
      }
    }
  }

  fun pruneOlderThan(recordedAtEpochMs: Long) {
    writableDatabase.delete(
      TABLE_NAME,
      "$COLUMN_RECORDED_AT_EPOCH_MS < ?",
      arrayOf(recordedAtEpochMs.toString())
    )
  }

  private fun android.database.Cursor.toSnapshot(): DeviceStepSnapshot {
    return DeviceStepSnapshot(
      id = getLong(getColumnIndexOrThrow(COLUMN_ID)),
      recordedAtEpochMs = getLong(getColumnIndexOrThrow(COLUMN_RECORDED_AT_EPOCH_MS)),
      elapsedRealtimeMs = getLong(getColumnIndexOrThrow(COLUMN_ELAPSED_REALTIME_MS)),
      stepsSinceBoot = getLong(getColumnIndexOrThrow(COLUMN_STEPS_SINCE_BOOT))
    )
  }

  companion object {
    private const val DATABASE_NAME = "device_step_counter.db"
    private const val DATABASE_VERSION = 1
    private const val TABLE_NAME = "step_counter_snapshots"
    private const val COLUMN_ID = "_id"
    private const val COLUMN_RECORDED_AT_EPOCH_MS = "recorded_at_epoch_ms"
    private const val COLUMN_ELAPSED_REALTIME_MS = "elapsed_realtime_ms"
    private const val COLUMN_STEPS_SINCE_BOOT = "steps_since_boot"
    private val PROJECTION = arrayOf(
      COLUMN_ID,
      COLUMN_RECORDED_AT_EPOCH_MS,
      COLUMN_ELAPSED_REALTIME_MS,
      COLUMN_STEPS_SINCE_BOOT
    )
  }
}
