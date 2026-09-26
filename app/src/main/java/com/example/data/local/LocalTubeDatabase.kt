package com.example.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(
    entities = [
        VideoEntity::class,
        ChannelEntity::class,
        PlaylistEntity::class,
        WatchProgressEntity::class,
        WatchHistoryEntity::class,
        UserInteractionEntity::class,
        SearchHistoryEntity::class,
        AppPreferenceEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class LocalTubeDatabase : RoomDatabase() {
    abstract fun localTubeDao(): LocalTubeDao

    companion object {
        @Volatile
        private var INSTANCE: LocalTubeDatabase? = null

        fun getDatabase(context: Context): LocalTubeDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    LocalTubeDatabase::class.java,
                    "localtube_database"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
