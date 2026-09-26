package com.example.data.local

object InitialDataSeeder {

    val defaultChannels = listOf(
        ChannelEntity(
            id = "channel_creators_hub",
            name = "Local Creators",
            handle = "@localcreators",
            colorHex = "#FF0000",
            description = "Curated offline video showcases, animations, and top community uploads.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 30,
            isSubscribed = true
        ),
        ChannelEntity(
            id = "channel_tech_lab",
            name = "Code & Tech Lab",
            handle = "@codetechlab",
            colorHex = "#3EA6FF",
            description = "Programming guides, deep technical tutorials, and open-source project walkthroughs.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 25,
            isSubscribed = true
        ),
        ChannelEntity(
            id = "channel_cinematic",
            name = "Cinematic Universe",
            handle = "@cinematic",
            colorHex = "#A855F7",
            description = "4K short films, visual effects demos, cinematics, and movie trailers.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 20,
            isSubscribed = false
        ),
        ChannelEntity(
            id = "channel_htme",
            name = "How To Make Everything",
            handle = "@htme",
            colorHex = "#AEB2B0",
            description = "Discover what it takes to make everything from scratch! Mining materials, forging tools, and crafting historic items.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 15,
            isSubscribed = true
        ),
        ChannelEntity(
            id = "channel_bam_anim",
            name = "BaM Animation",
            handle = "@BaMAnimation",
            colorHex = "#06B6D4",
            description = "Television animation industry artists sharing character design, background painting, and animation fundamentals.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 10,
            isSubscribed = false
        ),
        ChannelEntity(
            id = "channel_shorts",
            name = "Shorts",
            handle = "@shorts",
            colorHex = "#2BA640",
            description = "Bite-sized vertical videos and fast highlights.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 8,
            isSubscribed = true
        ),
        ChannelEntity(
            id = "channel_brothers_make",
            name = "Brothers Make",
            handle = "@brothersmake",
            colorHex = "#FF6161",
            description = "Sustainable making and creative recycling workshop projects.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 5,
            isSubscribed = false
        ),
        ChannelEntity(
            id = "channel_engineezy",
            name = "Engineezy",
            handle = "@engineezy",
            colorHex = "#065FD4",
            description = "Engineering with style and ease: 3D printing, mechanical wonders, and kinetic sculpture.",
            logoUri = null,
            createdAt = System.currentTimeMillis() - 86400000L * 2,
            isSubscribed = false
        )
    )

    val defaultPlaylists = listOf(
        PlaylistEntity(
            id = "pl_fav_highlights",
            name = "Best Highlights",
            createdAt = System.currentTimeMillis() - 86400000L * 7,
            videoKeysJson = "[]"
        ),
        PlaylistEntity(
            id = "pl_tutorials",
            name = "Learning & Tutorials",
            createdAt = System.currentTimeMillis() - 86400000L * 3,
            videoKeysJson = "[]"
        )
    )

    // Curated offline-ready sample video collection
    val sampleVideos = listOf(
        VideoEntity(
            key = "sample_big_buck_bunny",
            name = "Big Buck Bunny - Open Movie.mp4",
            title = "Big Buck Bunny - 4K Open Source Film",
            uriString = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            size = 158008374L,
            formattedSize = "150.7 MB",
            durationMs = 596000L,
            formattedDuration = "9:56",
            ext = "MP4",
            isShort = false,
            channelId = "channel_cinematic",
            collabChannelIds = "channel_creators_hub",
            tags = "Movies,Animation,Cinematic",
            thumbnailUri = "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=640",
            isCustomThumbnail = true,
            dateAdded = System.currentTimeMillis() - 86400000L * 5
        ),
        VideoEntity(
            key = "sample_elephants_dream",
            name = "Elephants Dream - Science Fiction Demo.mp4",
            title = "Elephants Dream - Open CGI Showcase",
            uriString = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
            size = 98400000L,
            formattedSize = "93.8 MB",
            durationMs = 653000L,
            formattedDuration = "10:53",
            ext = "MP4",
            isShort = false,
            channelId = "channel_tech_lab",
            collabChannelIds = "",
            tags = "Technology,Animation,Code",
            thumbnailUri = "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=640",
            isCustomThumbnail = true,
            dateAdded = System.currentTimeMillis() - 86400000L * 4
        ),
        VideoEntity(
            key = "sample_for_bigger_blazes",
            name = "Building Solar Kiln From Scratch.mp4",
            title = "Building a High Temp Solar Kiln From Scratch",
            uriString = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            size = 15400000L,
            formattedSize = "14.7 MB",
            durationMs = 15000L,
            formattedDuration = "0:15",
            ext = "MP4",
            isShort = true,
            channelId = "channel_htme",
            collabChannelIds = "channel_brothers_make",
            tags = "shorts,DIY,Science",
            thumbnailUri = "https://images.unsplash.com/photo-1509391365360-2e959784a276?w=640",
            isCustomThumbnail = true,
            dateAdded = System.currentTimeMillis() - 86400000L * 3
        ),
        VideoEntity(
            key = "sample_for_bigger_escapes",
            name = "Kinetic Mechanical Clock in Real Life.mp4",
            title = "Kinetic Mechanical Clock 3D Printed Prototype",
            uriString = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
            size = 15200000L,
            formattedSize = "14.5 MB",
            durationMs = 15000L,
            formattedDuration = "0:15",
            ext = "MP4",
            isShort = true,
            channelId = "channel_engineezy",
            collabChannelIds = "",
            tags = "shorts,Technology,3d printing",
            thumbnailUri = "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=640",
            isCustomThumbnail = true,
            dateAdded = System.currentTimeMillis() - 86400000L * 2
        ),
        VideoEntity(
            key = "sample_for_bigger_fun",
            name = "Drawing Faces Plane Structure Tutorial.mp4",
            title = "Drawing Anatomy & Planes of the Head Masterclass",
            uriString = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
            size = 62000000L,
            formattedSize = "59.1 MB",
            durationMs = 60000L,
            formattedDuration = "1:00",
            ext = "MP4",
            isShort = false,
            channelId = "channel_bam_anim",
            collabChannelIds = "",
            tags = "Tutorials,Animation",
            thumbnailUri = "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=640",
            isCustomThumbnail = true,
            dateAdded = System.currentTimeMillis() - 86400000L * 1
        ),
        VideoEntity(
            key = "sample_we_are_going_on_bullrun",
            name = "Tears of Steel - High Tech Short.mp4",
            title = "Tears of Steel - Cyber VFX Demonstration",
            uriString = "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
            size = 128000000L,
            formattedSize = "122.1 MB",
            durationMs = 734000L,
            formattedDuration = "12:14",
            ext = "MP4",
            isShort = false,
            channelId = "channel_cinematic",
            collabChannelIds = "channel_tech_lab",
            tags = "Movies,Cinematic,Science",
            thumbnailUri = "https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=640",
            isCustomThumbnail = true,
            dateAdded = System.currentTimeMillis()
        )
    )
}
