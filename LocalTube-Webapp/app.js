/**
 * LocalTube - Power-User Offline Video Player Engine
 * Features:
 * 1. Persistent Directory Memory (IndexedDB & File System Access API)
 * 2. High-Performance Parallel Canvas Thumbnail Generation & Persistent Cache
 * 3. YouTube Watch Stage & Up Next Queue
 * 4. Segmented Like / Dislike, Watch Later & Custom Playlists Engine
 * 5. Untagged Video Organizer View
 * 6. Dynamic Tag Filtering with Smooth Left / Right Scroll Navigation
 * 7. Timestamp Resumption & Watch History Logging
 */

(function () {
  'use strict';

  // ================= STORAGE KEYS =================
  const STORAGE_KEYS = {
    LIKES: 'localtube:likes',
    DISLIKES: 'localtube:dislikes',
    WATCH_LATER: 'localtube:watch_later',
    PLAYLISTS: 'localtube:playlists',
    FAVORITES_LEGACY: 'localtube:favorites',
    AUTOPLAY: 'localtube:autoplay',
    PROGRESS: 'localtube:progress_markers',
    HISTORY: 'localtube:watch_history',
    TAGS: 'localtube:custom_tags',
    SUGGESTIONS: 'localtube:quick_suggestions',
    THUMBNAILS: 'localtube:thumb_cache',
    DIRECTORY_NAME: 'localtube:dir_name',
    SEARCH_HISTORY: 'localtube:search_history',
    CHANNELS: 'localtube:channels',
    SUBSCRIPTIONS: 'localtube:subscriptions',
    VIDEO_CHANNELS: 'localtube:video_channels',
    VIDEO_COLLABS: 'localtube:video_collabs',
    CUSTOM_THUMBNAILS: 'localtube:custom_thumbnails'
  };

  // ================= APP STATE =================
  const state = {
    videos: [],             // Full list of loaded video objects
    filteredVideos: [],     // Videos after search/filter/tag/sort
    likes: new Set(),       // Set of liked video unique keys
    dislikes: new Set(),    // Set of disliked video unique keys
    watchLater: new Set(),  // Set of watch later video unique keys
    playlists: [],          // [{ id, name, createdAt, videoKeys: [] }]
    channels: [],           // [{ id, name, handle, color, description, createdAt }]
    subscriptions: new Set(), // Set of channel IDs
    videoChannels: {},      // videoKey -> channelId (Primary creator)
    videoCollabs: {},       // videoKey -> [channelId, ...] (Collaborating co-creators)
    activeChannelId: null,  // active channel id for channel view
    searchHistory: [],      // Array of past search terms
    suggestionSelectedIndex: -1,
    
    currentView: 'all',     // 'all' | 'liked' | 'watch-later' | 'untagged' | 'history' | 'shorts' | 'playlist' | 'channel' | 'all-channels' | 'subscribed-channels' | 'videos-without-channel'
    activePlaylistId: null, // string or null
    currentSort: 'none',    // 'name' | 'size' | 'none'
    currentTagFilter: null, // string tag or null
    searchQuery: '',
    isShuffled: false,
    shuffledOrder: [],
    shuffleWeights: new Map(),
    upNextQueue: null,
    
    // Playback state
    activeVideoIndex: -1,
    activeVideo: null,
    isPlaying: false,
    isMuted: false,
    volume: 1,
    isLooping: false,
    playbackSpeed: 1,
    autoplayEnabled: true,
    
    // Persistent directory handle (IndexedDB)
    directoryHandle: null,
    savedDirName: null,
    
    // Modal states
    tagModalVideoKey: null,
    playlistModalVideoKey: null,
    assignModalVideoKey: null,
    assignModalSelectedPrimary: null,
    assignModalSelectedCollabs: new Set(),
    channelAddModalChannelId: null,
    createModalChannelId: null,
    createModalSelectedColor: '#ff0000',
    createModalCustomLogo: null,
    channelActiveTab: 'videos',
    channelHeroDescExpanded: false,
    customThumbnails: new Set(), // Set of video keys with user-uploaded original images
    thumbnailModalVideoKey: null,
    thumbModalTempDataUrl: null,
    visibleVideoLimit: 36,

    // Multi-Select Batch State (Untagged & Without Channel tabs)
    selectedVideoKeys: new Set(),
    tagModalBatchKeys: null,
    assignModalBatchKeys: null
  };

  // ================= THUMBNAIL CACHE & PARALLEL WORKERS =================
  const thumbnailMemoryCache = new Map(); // key -> dataUrl
  const thumbQueue = [];
  const MAX_CONCURRENT_THUMBNAILS = 6;
  let activeThumbWorkers = 0;
  let thumbObserver = null;

  // Progress save throttle
  let lastProgressSaveTime = 0;

  // ================= DOM ELEMENTS =================
  const elements = {
    // Header & Navigation
    reconnectBanner: document.getElementById('reconnectBanner'),
    savedFolderNameLabel: document.getElementById('savedFolderNameLabel'),
    reconnectFolderBtn: document.getElementById('reconnectFolderBtn'),
    forgetFolderBtn: document.getElementById('forgetFolderBtn'),
    closeBannerBtn: document.getElementById('closeBannerBtn'),
    
    hamburgerBtn: document.getElementById('hamburgerBtn'),
    topbarBackBtn: document.getElementById('topbarBackBtn'),
    logoHomeBtn: document.getElementById('logoHomeBtn'),
    searchWrap: document.getElementById('searchWrap'),
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    searchSuggestions: document.getElementById('searchSuggestions'),
    searchBtn: document.getElementById('searchBtn'),
    topbarShuffleBtn: document.getElementById('topbarShuffleBtn'),
    folderLabel: document.getElementById('folderLabel'),
    selectFolderBtn: document.getElementById('selectFolderBtn'),
    folderInput: document.getElementById('folderInput'),
    
    // Sidebar
    sidebar: document.getElementById('sidebar'),
    navAllBtn: document.getElementById('navAllBtn'),
    navLikedBtn: document.getElementById('navLikedBtn'),
    navWatchLaterBtn: document.getElementById('navWatchLaterBtn'),
    navUntaggedBtn: document.getElementById('navUntaggedBtn'),
    navHistoryBtn: document.getElementById('navHistoryBtn'),
    navShortsBtn: document.getElementById('navShortsBtn'),
    sideStatTotal: document.getElementById('sideStatTotal'),
    sideStatLiked: document.getElementById('sideStatLiked'),
    sideStatWatchLater: document.getElementById('sideStatWatchLater'),
    sideStatUntagged: document.getElementById('sideStatUntagged'),
    sideStatHistory: document.getElementById('sideStatHistory'),
    statFolderName: document.getElementById('statFolderName'),
    statTotalVideos: document.getElementById('statTotalVideos'),
    statTotalSize: document.getElementById('statTotalSize'),
    statTotalDuration: document.getElementById('statTotalDuration'),
    statMemoryStatus: document.getElementById('statMemoryStatus'),
    sidebarChangeFolderBtn: document.getElementById('sidebarChangeFolderBtn'),
    sidebarForgetFolderBtn: document.getElementById('sidebarForgetFolderBtn'),
    sidebarExportDataBtn: document.getElementById('sidebarExportDataBtn'),
    sidebarImportDataBtn: document.getElementById('sidebarImportDataBtn'),
    importMetadataFileInput: document.getElementById('importMetadataFileInput'),
    sidebarPlaylistsList: document.getElementById('sidebarPlaylistsList'),
    sidebarNewPlaylistBtn: document.getElementById('sidebarNewPlaylistBtn'),
    navSettingsBtn: document.getElementById('navSettingsBtn'),
    settingsView: document.getElementById('settingsView'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    themeToggleLabel: document.getElementById('themeToggleLabel'),
    scanDuplicatesBtn: document.getElementById('scanDuplicatesBtn'),
    duplicateResultsContainer: document.getElementById('duplicateResultsContainer'),
    settingsExportDataBtn: document.getElementById('settingsExportDataBtn'),
    settingsImportDataBtn: document.getElementById('settingsImportDataBtn'),
    
    // Channels Sidebar Elements
    navChannelsBtn: document.getElementById('navChannelsBtn'),
    sideStatChannels: document.getElementById('sideStatChannels'),
    subnavAllChannelsBtn: document.getElementById('subnavAllChannelsBtn') || document.getElementById('sideSubAllChannels'),
    sideSubAllChannels: document.getElementById('sideSubAllChannels') || document.getElementById('subnavAllChannelsBtn'),
    subnavSubscribedBtn: document.getElementById('subnavSubscribedBtn') || document.getElementById('sideSubSubscribed'),
    sideSubSubscribed: document.getElementById('sideSubSubscribed') || document.getElementById('subnavSubscribedBtn'),
    sideSubSubscribedCount: document.getElementById('sideSubSubscribedCount'),
    subnavWithoutChannelBtn: document.getElementById('subnavWithoutChannelBtn') || document.getElementById('sideSubNoChannel'),
    sideSubNoChannel: document.getElementById('sideSubNoChannel') || document.getElementById('subnavWithoutChannelBtn'),
    sideSubNoChannelCount: document.getElementById('sideSubNoChannelCount'),
    sidebarChannelsList: document.getElementById('sidebarChannelsList'),
    sidebarNewChannelBtn: document.getElementById('sidebarNewChannelBtn'),
    sideStatChannelsAll: document.getElementById('sideStatChannelsAll') || document.getElementById('sideStatChannels'),
    sideStatChannelsSub: document.getElementById('sideSubSubscribedCount') || document.getElementById('sideStatChannelsSub'),
    sideStatChannelsNone: document.getElementById('sideSubNoChannelCount') || document.getElementById('sideStatChannelsNone'),
    
    // Filter Bar & Scrolling
    filterBar: document.querySelector('.filter-bar'),
    filterScrollLeft: document.getElementById('filterScrollLeft'),
    filterScrollRight: document.getElementById('filterScrollRight'),
    filterChipsContainer: document.getElementById('filterChipsContainer'),
    filterChips: document.getElementById('filterChips'),
    chipAll: document.getElementById('chipAll'),
    dynamicTagChips: document.getElementById('dynamicTagChips'),
    chipSortName: document.getElementById('chipSortName'),
    chipSortSize: document.getElementById('chipSortSize'),
    filterCountLabel: document.getElementById('filterCountLabel'),
    
    // Browse View
    browseView: document.getElementById('browseView'),
    viewTitle: document.getElementById('viewTitle'),
    shuffleStatusBadge: document.getElementById('shuffleStatusBadge'),
    tagFilterBadge: document.getElementById('tagFilterBadge'),
    historyActionsHeader: document.getElementById('historyActionsHeader'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),
    tagActionsHeader: document.getElementById('tagActionsHeader'),
    deleteActiveTagBtn: document.getElementById('deleteActiveTagBtn'),
    playlistActionsHeader: document.getElementById('playlistActionsHeader'),
    deleteActivePlaylistBtn: document.getElementById('deleteActivePlaylistBtn'),
    emptyState: document.getElementById('emptyState'),
    emptySelectBtn: document.getElementById('emptySelectBtn'),
    videoGrid: document.getElementById('videoGrid'),
    shortsFeedContainer: document.getElementById('shortsFeedContainer'),
    shortsScrollViewport: document.getElementById('shortsScrollViewport'),
    shortsNavPrevBtn: document.getElementById('shortsNavPrevBtn'),
    shortsNavNextBtn: document.getElementById('shortsNavNextBtn'),
    
    // Multi-Select Floating Bar
    multiSelectBar: document.getElementById('multiSelectBar'),
    multiSelectCount: document.getElementById('multiSelectCount'),
    multiSelectSelectAllBtn: document.getElementById('multiSelectSelectAllBtn'),
    multiSelectTagBtn: document.getElementById('multiSelectTagBtn'),
    multiSelectChannelBtn: document.getElementById('multiSelectChannelBtn'),
    multiSelectClearBtn: document.getElementById('multiSelectClearBtn'),
    
    // Watch Page View
    watchView: document.getElementById('watchView'),
    player: document.getElementById('player'),
    mainVideo: document.getElementById('mainVideo'),
    resumeToast: document.getElementById('resumeToast'),
    resumeToastText: document.getElementById('resumeToastText'),
    centerPlayOverlay: document.getElementById('centerPlayOverlay'),
    playerControls: document.getElementById('playerControls'),
    seekBar: document.getElementById('seekBar'),
    playPauseBtn: document.getElementById('playPauseBtn'),
    seekBackBtn: document.getElementById('seekBackBtn'),
    seekForwardBtn: document.getElementById('seekForwardBtn'),
    iconPlay: document.getElementById('iconPlay'),
    iconPause: document.getElementById('iconPause'),
    prevVideoBtn: document.getElementById('prevVideoBtn'),
    nextVideoBtn: document.getElementById('nextVideoBtn'),
    muteBtn: document.getElementById('muteBtn'),
    iconVolume: document.getElementById('iconVolume'),
    iconMuted: document.getElementById('iconMuted'),
    volumeBar: document.getElementById('volumeBar'),
    timeCurrent: document.getElementById('timeCurrent'),
    timeDuration: document.getElementById('timeDuration'),
    speedBtn: document.getElementById('speedBtn'),
    speedMenu: document.getElementById('speedMenu'),
    loopBtn: document.getElementById('loopBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    
    // Watch Info & Action Pills
    watchTitle: document.getElementById('watchTitle'),
    watchTagsSection: document.getElementById('watchTagsSection'),
    watchTagsContainer: document.getElementById('watchTagsContainer'),
    inlineAddTagBtn: document.getElementById('inlineAddTagBtn'),
    inlineTagInputBox: document.getElementById('inlineTagInputBox'),
    inlineTagInput: document.getElementById('inlineTagInput'),
    inlineSaveTagBtn: document.getElementById('inlineSaveTagBtn'),
    inlineCancelTagBtn: document.getElementById('inlineCancelTagBtn'),
    watchAvatar: document.getElementById('watchAvatar'),
    watchChannelName: document.getElementById('watchChannelName'),
    watchFolderInfo: document.getElementById('watchFolderInfo'),
    
    watchLikeBtn: document.getElementById('watchLikeBtn'),
    watchLikeCount: document.getElementById('watchLikeCount'),
    watchDislikeBtn: document.getElementById('watchDislikeBtn'),
    watchLaterBtn: document.getElementById('watchLaterBtn'),
    watchLaterLabel: document.getElementById('watchLaterLabel'),
    watchPlaylistBtn: document.getElementById('watchPlaylistBtn'),
    watchTagBtn: document.getElementById('watchTagBtn'),
    watchShuffleBtn: document.getElementById('watchShuffleBtn'),
    watchBackBtn: document.getElementById('watchBackBtn'),
    
    // Watch Channels & Subscribe & 3-Dots
    watchSubscribeBtn: document.getElementById('watchSubscribeBtn'),
    watchSubscribeLabel: document.getElementById('watchSubscribeLabel'),
    watchMoreBtn: document.getElementById('watchMoreBtn'),
    watchMoreDropdown: document.getElementById('watchDropdown') || document.getElementById('watchMoreDropdown'),
    watchActionAddChannel: document.getElementById('watchActionAddChannel'),
    watchActionManageTags: document.getElementById('watchActionManageTags'),
    watchActionShuffleNext: document.getElementById('watchActionShuffleNext'),
    
    watchFileExtBadge: document.getElementById('watchFileExtBadge'),
    watchFileSize: document.getElementById('watchFileSize'),
    watchDurationLabel: document.getElementById('watchDurationLabel'),
    watchFileNameLabel: document.getElementById('watchFileNameLabel'),
    
    // Channel Hero Banner Elements
    channelHeroBanner: document.getElementById('channelHeroBanner'),
    channelHeroCover: document.getElementById('channelHeroCover'),
    channelHeroAvatar: document.getElementById('channelHeroAvatar'),
    channelHeroLogoFileInput: document.getElementById('channelHeroLogoFileInput'),
    channelHeroChangeLogoBtn: document.getElementById('channelHeroChangeLogoBtn'),
    channelHeroChangeLogoActionBtn: document.getElementById('channelHeroChangeLogoActionBtn'),
    channelHeroName: document.getElementById('channelHeroName'),
    channelHeroHandle: document.getElementById('channelHeroHandle'),
    channelHeroVideoCount: document.getElementById('channelHeroVideoCount'),
    channelHeroSubCount: document.getElementById('channelHeroSubStatus') || document.getElementById('channelHeroSubCount'),
    channelHeroDesc: document.getElementById('channelHeroDesc'),
    channelHeroSubscribeBtn: document.getElementById('channelHeroSubBtn') || document.getElementById('channelHeroSubscribeBtn'),
    channelHeroSubLabel: document.getElementById('channelHeroSubLabel'),
    channelHeroAddVideosBtn: document.getElementById('channelHeroAddVideosBtn'),
    channelHeroEditBtn: document.getElementById('channelHeroEditBtn'),
    channelHeroDeleteBtn: document.getElementById('channelHeroDeleteBtn'),
    channelTabVideos: document.getElementById('channelTabVideos'),
    channelTabAbout: document.getElementById('channelTabAbout'),
    channelAboutBox: document.getElementById('channelAboutSection') || document.getElementById('channelAboutBox'),
    channelAboutDesc: document.getElementById('channelAboutText') || document.getElementById('channelAboutDesc'),
    channelAboutJoined: document.getElementById('channelAboutCreated') || document.getElementById('channelAboutJoined'),
    channelAboutTotalVideos: document.getElementById('channelAboutTotalVideos'),
    
    // All Channels Directory
    allChannelsDirectory: document.getElementById('allChannelsDirectory'),
    channelsGrid: document.getElementById('channelsGrid'),
    dirCreateChannelBtn: document.getElementById('dirCreateChannelBtn') || document.getElementById('channelsDirNewBtn'),
    channelsDirNewBtn: document.getElementById('channelsDirNewBtn') || document.getElementById('dirCreateChannelBtn'),
    
    // Up Next Sidebar
    upNextCount: document.getElementById('upNextCount'),
    autoplayToggle: document.getElementById('autoplayToggle'),
    upNextMixBtn: document.getElementById('upNextMixBtn'),
    upNextList: document.getElementById('upNextList'),
    
    // Tag Modal
    tagModal: document.getElementById('tagModal'),
    tagModalVideoTitle: document.getElementById('tagModalVideoTitle'),
    modalActiveTags: document.getElementById('modalActiveTags'),
    customTagInput: document.getElementById('customTagInput'),
    addCustomTagBtn: document.getElementById('addCustomTagBtn'),
    modalQuickTags: document.getElementById('modalQuickTags'),
    closeTagModalBtn: document.getElementById('closeTagModalBtn'),
    saveTagModalBtn: document.getElementById('saveTagModalBtn'),

    // Playlist Modal
    playlistModal: document.getElementById('playlistModal'),
    playlistModalVideoTitle: document.getElementById('playlistModalVideoTitle'),
    playlistCheckboxList: document.getElementById('playlistCheckboxList'),
    newPlaylistInput: document.getElementById('newPlaylistInput'),
    createNewPlaylistBtn: document.getElementById('createNewPlaylistBtn'),
    closePlaylistModalBtn: document.getElementById('closePlaylistModalBtn'),
    donePlaylistModalBtn: document.getElementById('donePlaylistModalBtn'),
    
    // Channels Choice Modal (4 Options)
    channelsChoiceModal: document.getElementById('channelsChoiceModal'),
    closeChannelsChoiceModalBtn: document.getElementById('closeChannelsChoiceModalBtn'),
    choiceNewChannelBtn: document.getElementById('choiceNewChannelBtn'),
    choiceSubscribedBtn: document.getElementById('choiceSubscribedBtn'),
    choiceWithoutChannelBtn: document.getElementById('choiceWithoutChannelBtn') || document.getElementById('choiceNoChannelBtn'),
    choiceNoChannelBtn: document.getElementById('choiceNoChannelBtn') || document.getElementById('choiceWithoutChannelBtn'),
    choiceAllChannelsBtn: document.getElementById('choiceAllChannelsBtn'),
    choiceSubscribedCount: document.getElementById('choiceSubCountBadge') || document.getElementById('choiceSubscribedCount'),
    choiceWithoutChannelCount: document.getElementById('choiceNoChannelCountBadge') || document.getElementById('choiceWithoutChannelCount'),
    choiceAllChannelsCount: document.getElementById('choiceAllChannelsCountBadge') || document.getElementById('choiceAllChannelsCount'),
    choiceSubCountBadge: document.getElementById('choiceSubCountBadge'),
    choiceNoChannelCountBadge: document.getElementById('choiceNoChannelCountBadge'),
    choiceAllChannelsCountBadge: document.getElementById('choiceAllChannelsCountBadge'),
    
    // Create / Edit Channel Modal
    createChannelModal: document.getElementById('createChannelModal'),
    createChannelModalTitle: document.getElementById('createChannelModalTitle'),
    closeCreateChannelModalBtn: document.getElementById('closeCreateChannelModalBtn'),
    channelPreviewAvatar: document.getElementById('createChannelPreviewAvatar') || document.getElementById('channelPreviewAvatar'),
    channelPreviewName: document.getElementById('createChannelPreviewName') || document.getElementById('channelPreviewName'),
    channelPreviewHandle: document.getElementById('createChannelPreviewHandle') || document.getElementById('channelPreviewHandle'),
    channelPreviewLogoStatus: document.getElementById('channelPreviewLogoStatus'),
    channelLogoFileInput: document.getElementById('channelLogoFileInput'),
    channelChooseLogoBtn: document.getElementById('channelChooseLogoBtn'),
    removeChannelLogoBtn: document.getElementById('removeChannelLogoBtn'),
    channelNameInput: document.getElementById('channelNameInput'),
    channelHandleInput: document.getElementById('channelHandleInput'),
    channelDescInput: document.getElementById('channelDescInput'),
    channelDescCharCounter: document.getElementById('channelDescCharCounter'),
    channelColorPalette: document.getElementById('channelColorPalette'),
    channelCustomColorPicker: document.getElementById('channelCustomColorPicker'),
    channelColorWheelBtn: document.getElementById('channelColorWheelBtn'),
    channelColorHexInput: document.getElementById('channelColorHexInput'),
    channelColorHexTag: document.getElementById('channelColorHexTag'),
    cancelCreateChannelBtn: document.getElementById('cancelCreateChannelBtn'),
    saveChannelBtn: document.getElementById('saveCreateChannelBtn') || document.getElementById('saveChannelBtn'),
    
    // Assign Channel Modal
    assignChannelModal: document.getElementById('assignChannelModal'),
    assignChannelVideoTitle: document.getElementById('assignChannelVideoTitle'),
    channelRadioList: document.getElementById('channelRadioList'),
    collabCheckboxList: document.getElementById('collabCheckboxList'),
    collabSelectedCount: document.getElementById('collabSelectedCount'),
    collabLivePreviewBox: document.getElementById('collabLivePreviewBox'),
    collabPreviewContent: document.getElementById('collabPreviewContent'),
    quickChannelInput: document.getElementById('quickChannelInput'),
    quickCreateChannelBtn: document.getElementById('quickCreateChannelBtn'),
    closeAssignChannelModalBtn: document.getElementById('closeAssignChannelModalBtn'),
    cancelAssignChannelBtn: document.getElementById('cancelAssignChannelBtn'),
    doneAssignChannelModalBtn: document.getElementById('doneAssignChannelBtn') || document.getElementById('doneAssignChannelModalBtn'),
    assignChannelSearchInput: document.getElementById('assignChannelSearchInput'),
    clearAssignChannelSearchBtn: document.getElementById('clearAssignChannelSearchBtn'),
    
    // Add Multiple Videos to Channel Modal
    channelAddVideosModal: document.getElementById('channelAddVideosModal'),
    channelAddVideosModalTitle: document.getElementById('channelAddVideosTitle') || document.getElementById('channelAddVideosModalTitle'),
    closeChannelAddVideosModalBtn: document.getElementById('closeChannelAddVideosModalBtn'),
    channelAddVideosSearch: document.getElementById('channelAddVideoSearch') || document.getElementById('channelAddVideosSearch'),
    channelAddSelectAllBtn: document.getElementById('channelAddSelectAllBtn'),
    channelAddDeselectAllBtn: document.getElementById('channelAddDeselectAllBtn'),
    channelVideosChecklist: document.getElementById('channelVideosChecklist'),
    channelAddSelectedCount: document.getElementById('channelAddSelectedCount'),
    cancelChannelAddVideosBtn: document.getElementById('closeChannelAddVideosModalBtn') || document.getElementById('cancelChannelAddVideosBtn'),
    saveChannelAddVideosBtn: document.getElementById('saveChannelVideosBtn') || document.getElementById('saveChannelAddVideosBtn'),
    
    // Upload Original Thumbnail Modal
    uploadThumbnailModal: document.getElementById('uploadThumbnailModal'),
    closeUploadThumbnailModalBtn: document.getElementById('closeUploadThumbnailModalBtn'),
    thumbModalVideoTitle: document.getElementById('thumbModalVideoTitle'),
    thumbModalPreviewBox: document.getElementById('thumbModalPreviewBox'),
    thumbModalPreviewImg: document.getElementById('thumbModalPreviewImg'),
    thumbModalPreviewPlaceholder: document.getElementById('thumbModalPreviewPlaceholder'),
    thumbModalCustomBadge: document.getElementById('thumbModalCustomBadge'),
    thumbTabFileBtn: document.getElementById('thumbTabFileBtn'),
    thumbTabUrlBtn: document.getElementById('thumbTabUrlBtn'),
    thumbFilePane: document.getElementById('thumbFilePane'),
    thumbUrlPane: document.getElementById('thumbUrlPane'),
    thumbDropZone: document.getElementById('thumbDropZone'),
    thumbFileInput: document.getElementById('thumbFileInput'),
    thumbBrowseBtn: document.getElementById('thumbBrowseBtn'),
    thumbUrlInput: document.getElementById('thumbUrlInput'),
    thumbFetchUrlBtn: document.getElementById('thumbFetchUrlBtn'),
    thumbResetFrameBtn: document.getElementById('thumbResetFrameBtn'),
    cancelUploadThumbnailBtn: document.getElementById('cancelUploadThumbnailBtn'),
    saveUploadThumbnailBtn: document.getElementById('saveUploadThumbnailBtn'),
    watchActionUploadThumbnail: document.getElementById('watchActionUploadThumbnail'),
    appToast: document.getElementById('appToast'),

    // Offscreen Canvas Generator
    thumbGenCanvas: document.getElementById('thumbGenCanvas')
  };

  // ================= INDEXED DB UTILITIES =================
  const IDB_CONFIG = {
    dbName: 'LocalTubeDB',
    version: 2,
    storeName: 'directoryHandles',
    thumbStoreName: 'thumbnails',
    key: 'active_folder_handle'
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        return reject(new Error('IndexedDB not supported'));
      }
      const request = indexedDB.open(IDB_CONFIG.dbName, IDB_CONFIG.version);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_CONFIG.storeName)) {
          db.createObjectStore(IDB_CONFIG.storeName);
        }
        if (!db.objectStoreNames.contains(IDB_CONFIG.thumbStoreName)) {
          db.createObjectStore(IDB_CONFIG.thumbStoreName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function saveDirectoryHandleToIDB(handle) {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_CONFIG.storeName, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.storeName);
        const req = store.put(handle, IDB_CONFIG.key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Could not store handle in IndexedDB:', err);
      return false;
    }
  }

  async function getDirectoryHandleFromIDB() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_CONFIG.storeName, 'readonly');
        const store = tx.objectStore(IDB_CONFIG.storeName);
        const req = store.get(IDB_CONFIG.key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Could not retrieve handle from IndexedDB:', err);
      return null;
    }
  }

  async function clearDirectoryHandleFromIDB() {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_CONFIG.storeName, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.storeName);
        const req = store.delete(IDB_CONFIG.key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      console.warn('Could not clear handle from IndexedDB:', err);
      return false;
    }
  }

  async function saveThumbnailToIDB(key, dataUrl) {
    try {
      const db = await openDatabase();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_CONFIG.thumbStoreName, 'readwrite');
        const store = tx.objectStore(IDB_CONFIG.thumbStoreName);
        const req = store.put(dataUrl, key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch (err) {
      return false;
    }
  }

  async function loadAllThumbnailsFromIDB() {
    try {
      const db = await openDatabase();
      return new Promise((resolve) => {
        if (!db.objectStoreNames.contains(IDB_CONFIG.thumbStoreName)) return resolve({});
        const tx = db.transaction(IDB_CONFIG.thumbStoreName, 'readonly');
        const store = tx.objectStore(IDB_CONFIG.thumbStoreName);
        const req = store.openCursor();
        const results = {};
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            results[cursor.key] = cursor.value;
            thumbnailMemoryCache.set(cursor.key, cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        req.onerror = () => resolve({});
      });
    } catch (e) {
      return {};
    }
  }

  // ================= STORAGE & PERSISTENCE HELPERS =================
  function loadLikesAndDislikes() {
    try {
      // Migrate legacy favorites if found
      const legacyFavs = localStorage.getItem(STORAGE_KEYS.FAVORITES_LEGACY);
      const storedLikes = localStorage.getItem(STORAGE_KEYS.LIKES);
      const storedDislikes = localStorage.getItem(STORAGE_KEYS.DISLIKES);
      const storedWatchLater = localStorage.getItem(STORAGE_KEYS.WATCH_LATER);

      let likesArray = storedLikes ? JSON.parse(storedLikes) : [];
      if (legacyFavs && (!storedLikes || likesArray.length === 0)) {
        try {
          const old = JSON.parse(legacyFavs);
          if (Array.isArray(old)) likesArray = [...new Set([...likesArray, ...old])];
        } catch (e) {}
      }

      state.likes = new Set(likesArray);
      state.dislikes = new Set(storedDislikes ? JSON.parse(storedDislikes) : []);
      state.watchLater = new Set(storedWatchLater ? JSON.parse(storedWatchLater) : []);

      const storedCustomThumbs = localStorage.getItem(STORAGE_KEYS.CUSTOM_THUMBNAILS);
      state.customThumbnails = new Set(storedCustomThumbs ? JSON.parse(storedCustomThumbs) : []);
    } catch (e) {
      state.likes = new Set();
      state.dislikes = new Set();
      state.watchLater = new Set();
      state.customThumbnails = new Set();
    }
  }

  function saveLikes() {
    try {
      localStorage.setItem(STORAGE_KEYS.LIKES, JSON.stringify([...state.likes]));
    } catch (e) {}
  }

  function saveDislikes() {
    try {
      localStorage.setItem(STORAGE_KEYS.DISLIKES, JSON.stringify([...state.dislikes]));
    } catch (e) {}
  }

  function saveWatchLater() {
    try {
      localStorage.setItem(STORAGE_KEYS.WATCH_LATER, JSON.stringify([...state.watchLater]));
    } catch (e) {}
  }

  function saveCustomThumbnails() {
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_THUMBNAILS, JSON.stringify([...state.customThumbnails]));
    } catch (e) {}
  }

  let toastTimeout = null;
  function showToast(message) {
    const toast = elements.appToast || document.getElementById('appToast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 3200);
  }

  function setVideoCustomThumbnail(videoItem, dataUrl) {
    if (!videoItem || !dataUrl) return;
    thumbnailMemoryCache.set(videoItem.key, dataUrl);
    videoItem.thumbnail = dataUrl;
    updateCardThumbnails(videoItem.key, dataUrl);
    saveThumbnailToIDB(videoItem.key, dataUrl);
    state.customThumbnails.add(videoItem.key);
    saveCustomThumbnails();
  }

  function resetVideoThumbnailToFrame(videoItem) {
    if (!videoItem) return;
    state.customThumbnails.delete(videoItem.key);
    saveCustomThumbnails();
    queueThumbnailGeneration(videoItem);
  }

  function applyImageFileAsThumbnail(videoItem, file) {
    if (!videoItem || !file) return;
    if (!file.type.startsWith('image/') && !isImageFile(file.name)) {
      showToast('Please choose an image file (.jpg, .png, .webp, .avif)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setVideoCustomThumbnail(videoItem, dataUrl);
      showToast(`Original YouTube thumbnail saved for "${videoItem.title}"!`);
      if (state.thumbnailModalVideoKey === videoItem.key) {
        updateThumbModalPreview(dataUrl);
        if (elements.thumbModalCustomBadge) elements.thumbModalCustomBadge.style.display = 'inline-block';
      }
    };
    reader.onerror = () => {
      showToast('Failed to read image file');
    };
    reader.readAsDataURL(file);
  }

  function processImageToAvatarDataUrl(file, maxSize = 256) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      if (!file.type.startsWith('image/') && !isImageFile(file.name)) {
        reject(new Error('Selected file is not an image'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const width = img.width;
            const height = img.height;
            const minDim = Math.min(width, height);
            const startX = (width - minDim) / 2;
            const startY = (height - minDim) / 2;
            const targetDim = Math.min(minDim, maxSize);

            canvas.width = targetDim;
            canvas.height = targetDim;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, targetDim, targetDim);

            // Compress cleanly for local storage
            let resultDataUrl = canvas.toDataURL('image/webp', 0.9);
            if (!resultDataUrl.startsWith('data:image/webp')) {
              resultDataUrl = canvas.toDataURL('image/png');
            }
            resolve(resultDataUrl);
          } catch (err) {
            resolve(e.target.result);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // --- Upload Custom Thumbnail Modal ---
  function openUploadThumbnailModal(videoItem) {
    if (!videoItem) return;
    state.thumbnailModalVideoKey = videoItem.key;
    state.thumbModalTempDataUrl = null;

    if (elements.thumbModalVideoTitle) {
      elements.thumbModalVideoTitle.textContent = `Video: ${videoItem.title}`;
    }

    const currThumb = videoItem.thumbnail || thumbnailMemoryCache.get(videoItem.key);
    if (currThumb) {
      updateThumbModalPreview(currThumb);
    } else {
      clearThumbModalPreview();
    }

    if (elements.thumbModalCustomBadge) {
      elements.thumbModalCustomBadge.style.display = state.customThumbnails.has(videoItem.key) ? 'inline-block' : 'none';
    }

    if (elements.thumbFileInput) elements.thumbFileInput.value = '';
    if (elements.thumbUrlInput) elements.thumbUrlInput.value = '';
    if (elements.saveUploadThumbnailBtn) elements.saveUploadThumbnailBtn.disabled = true;

    switchThumbModalTab('file');

    if (elements.uploadThumbnailModal) {
      elements.uploadThumbnailModal.style.display = 'flex';
    }
  }

  function closeUploadThumbnailModal() {
    state.thumbnailModalVideoKey = null;
    state.thumbModalTempDataUrl = null;
    if (elements.uploadThumbnailModal) {
      elements.uploadThumbnailModal.style.display = 'none';
    }
  }

  function updateThumbModalPreview(dataUrl) {
    if (elements.thumbModalPreviewImg && elements.thumbModalPreviewPlaceholder) {
      elements.thumbModalPreviewImg.src = dataUrl;
      elements.thumbModalPreviewImg.style.display = 'block';
      elements.thumbModalPreviewPlaceholder.style.display = 'none';
    }
  }

  function clearThumbModalPreview() {
    if (elements.thumbModalPreviewImg && elements.thumbModalPreviewPlaceholder) {
      elements.thumbModalPreviewImg.src = '';
      elements.thumbModalPreviewImg.style.display = 'none';
      elements.thumbModalPreviewPlaceholder.style.display = 'flex';
    }
  }

  function switchThumbModalTab(tab) {
    if (tab === 'file') {
      elements.thumbTabFileBtn?.classList.add('is-active');
      elements.thumbTabUrlBtn?.classList.remove('is-active');
      if (elements.thumbFilePane) elements.thumbFilePane.style.display = 'flex';
      if (elements.thumbUrlPane) elements.thumbUrlPane.style.display = 'none';
    } else {
      elements.thumbTabUrlBtn?.classList.add('is-active');
      elements.thumbTabFileBtn?.classList.remove('is-active');
      if (elements.thumbFilePane) elements.thumbFilePane.style.display = 'none';
      if (elements.thumbUrlPane) elements.thumbUrlPane.style.display = 'flex';
    }
  }

  async function fetchThumbnailFromUrl(inputUrl) {
    if (!inputUrl || !inputUrl.trim()) {
      showToast('Please enter a YouTube video link or image URL');
      return;
    }
    const cleanUrl = inputUrl.trim();
    let targetImageUrl = cleanUrl;

    // Check if YouTube URL
    const ytMatch = cleanUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i);
    let fallbackUrl = null;
    if (ytMatch && ytMatch[1]) {
      const videoId = ytMatch[1];
      targetImageUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      fallbackUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }

    showToast('Fetching thumbnail from URL...');
    try {
      const dataUrl = await loadImageUrlToDataUrl(targetImageUrl, fallbackUrl);
      state.thumbModalTempDataUrl = dataUrl;
      updateThumbModalPreview(dataUrl);
      if (elements.saveUploadThumbnailBtn) elements.saveUploadThumbnailBtn.disabled = false;
      showToast('Thumbnail loaded! Click Save Thumbnail to apply.');
    } catch (err) {
      console.warn('Direct fetch failed:', err);
      showToast('Could not load image directly from web. You can download the image and use "Upload Image File".');
    }
  }

  function loadImageUrlToDataUrl(url, fallbackUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 640;
          canvas.height = img.naturalHeight || 360;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => {
        if (fallbackUrl) {
          const imgFallback = new Image();
          imgFallback.crossOrigin = 'anonymous';
          imgFallback.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = imgFallback.naturalWidth || 480;
              canvas.height = imgFallback.naturalHeight || 360;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(imgFallback, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.85));
            } catch (e) {
              reject(e);
            }
          };
          imgFallback.onerror = () => reject(new Error('Failed to load image'));
          imgFallback.src = fallbackUrl;
        } else {
          reject(new Error('Failed to load image'));
        }
      };
      img.src = url;
    });
  }

  function toggleLike(videoKey) {
    if (!videoKey) return;
    if (state.likes.has(videoKey)) {
      state.likes.delete(videoKey);
    } else {
      state.likes.add(videoKey);
      state.dislikes.delete(videoKey); // Can't both like and dislike
    }
    saveLikes();
    saveDislikes();
    updateSidebarStats();
    updateWatchViewActions();

    if (state.currentView === 'liked') {
      applyFiltersAndRender();
    } else {
      updateCardActionsInDOM(videoKey);
    }
  }

  function toggleDislike(videoKey) {
    if (!videoKey) return;
    if (state.dislikes.has(videoKey)) {
      state.dislikes.delete(videoKey);
    } else {
      state.dislikes.add(videoKey);
      state.likes.delete(videoKey); // Can't both like and dislike
    }
    saveLikes();
    saveDislikes();
    updateSidebarStats();
    updateWatchViewActions();

    if (state.currentView === 'liked') {
      applyFiltersAndRender();
    } else {
      updateCardActionsInDOM(videoKey);
    }
  }

  function toggleWatchLater(videoKey) {
    if (!videoKey) return;
    if (state.watchLater.has(videoKey)) {
      state.watchLater.delete(videoKey);
    } else {
      state.watchLater.add(videoKey);
    }
    saveWatchLater();
    updateSidebarStats();
    updateWatchViewActions();

    if (state.currentView === 'watch-later') {
      applyFiltersAndRender();
    } else {
      updateCardActionsInDOM(videoKey);
    }
  }

  // ================= PLAYLISTS MANAGEMENT =================
  function loadPlaylists() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.PLAYLISTS);
      if (stored) {
        state.playlists = JSON.parse(stored);
      } else {
        // Default sample playlists for local organization
        state.playlists = [
          { id: 'pl_fav_highlights', name: 'Best Highlights', createdAt: Date.now() - 86400000, videoKeys: [] },
          { id: 'pl_tutorials', name: 'Learning & Tutorials', createdAt: Date.now() - 43200000, videoKeys: [] }
        ];
        savePlaylists();
      }
    } catch (e) {
      state.playlists = [];
    }
    renderSidebarPlaylists();
  }

  function savePlaylists() {
    try {
      localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(state.playlists));
    } catch (e) {}
    renderSidebarPlaylists();
  }

  function createPlaylist(name) {
    const cleanName = (name || '').trim();
    if (!cleanName) return null;
    const newPl = {
      id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      createdAt: Date.now(),
      videoKeys: []
    };
    state.playlists.push(newPl);
    savePlaylists();
    return newPl;
  }

  function deletePlaylist(playlistId) {
    state.playlists = state.playlists.filter(p => p.id !== playlistId);
    savePlaylists();
    if (state.currentView === 'playlist' && state.activePlaylistId === playlistId) {
      setActiveView('all');
    }
    if (elements.playlistModal && elements.playlistModal.style.display !== 'none') {
      renderPlaylistModalList();
    }
  }

  function toggleVideoInPlaylist(playlistId, videoKey) {
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl || !videoKey) return;
    const idx = pl.videoKeys.indexOf(videoKey);
    if (idx !== -1) {
      pl.videoKeys.splice(idx, 1);
    } else {
      pl.videoKeys.push(videoKey);
    }
    savePlaylists();
    if (state.currentView === 'playlist' && state.activePlaylistId === playlistId) {
      applyFiltersAndRender();
    }
  }

  function isVideoInPlaylist(playlistId, videoKey) {
    const pl = state.playlists.find(p => p.id === playlistId);
    return pl ? pl.videoKeys.includes(videoKey) : false;
  }

  function renderSidebarPlaylists() {
    const container = elements.sidebarPlaylistsList;
    if (!container) return;
    container.innerHTML = '';

    if (state.playlists.length === 0) {
      container.innerHTML = `
        <div style="font-size: 11px; color: var(--text-muted); padding: 6px 10px; font-style: italic;">
          No playlists yet
        </div>
      `;
      return;
    }

    state.playlists.forEach(pl => {
      const row = document.createElement('div');
      row.className = `sidebar__playlist-row ${state.currentView === 'playlist' && state.activePlaylistId === pl.id ? 'is-active' : ''}`;

      const btn = document.createElement('button');
      btn.className = `sidebar__playlist-item`;
      btn.title = pl.name;
      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M19 11H5m14-4H5m14 8H5m14 4h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span class="sidebar__playlist-item-name" title="${pl.name}">${pl.name}</span>
        <span class="sidebar__playlist-item-count">${pl.videoKeys.length}</span>
      `;
      btn.addEventListener('click', () => {
        openPlaylistView(pl.id);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'sidebar__playlist-del-btn';
      delBtn.title = `Delete playlist: ${pl.name}`;
      delBtn.setAttribute('aria-label', `Delete playlist ${pl.name}`);
      delBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" fill="none"/></svg>
      `;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Delete playlist library "${pl.name}"? (Your video files on disk will not be deleted)`)) {
          deletePlaylist(pl.id);
        }
      });

      row.appendChild(btn);
      row.appendChild(delBtn);
      container.appendChild(row);
    });
  }

  function openPlaylistView(playlistId) {
    state.activePlaylistId = playlistId;
    state.currentTagFilter = null;
    state.currentView = 'playlist';
    
    // Update sidebar navigation active classes
    elements.navAllBtn?.classList.remove('is-active');
    elements.navLikedBtn?.classList.remove('is-active');
    elements.navWatchLaterBtn?.classList.remove('is-active');
    elements.navUntaggedBtn?.classList.remove('is-active');
    elements.navHistoryBtn?.classList.remove('is-active');
    elements.navShortsBtn?.classList.remove('is-active');

    // Update chips
    elements.chipAll?.classList.remove('is-active');

    renderSidebarPlaylists();

    if (elements.watchView.style.display === 'block') {
      returnToBrowseView();
    }

    applyFiltersAndRender();
  }

  // ================= PLAYLIST MODAL =================
  function openPlaylistModal(videoItem) {
    if (!videoItem) return;
    state.playlistModalVideoKey = videoItem.key;
    elements.playlistModalVideoTitle.textContent = `Video: ${videoItem.title}`;
    elements.newPlaylistInput.value = '';

    renderPlaylistModalList();
    elements.playlistModal.style.display = 'flex';
  }

  function closePlaylistModal() {
    elements.playlistModal.style.display = 'none';
    state.playlistModalVideoKey = null;
  }

  function renderPlaylistModalList() {
    const list = elements.playlistCheckboxList;
    if (!list) return;
    list.innerHTML = '';

    if (state.playlists.length === 0) {
      list.innerHTML = `
        <div style="font-size: 12px; color: var(--text-muted); padding: 8px 0; font-style: italic;">
          You don't have any playlists yet. Create one below!
        </div>
      `;
      return;
    }

    state.playlists.forEach(pl => {
      const isChecked = isVideoInPlaylist(pl.id, state.playlistModalVideoKey);
      const row = document.createElement('div');
      row.className = 'playlist-modal-row';

      const label = document.createElement('label');
      label.className = 'playlist-check-item';
      label.innerHTML = `
        <input type="checkbox" ${isChecked ? 'checked' : ''} data-pl-id="${pl.id}">
        <span>${pl.name}</span>
        <span class="playlist-check-count">${pl.videoKeys.length} items</span>
      `;

      label.querySelector('input').addEventListener('change', (e) => {
        toggleVideoInPlaylist(pl.id, state.playlistModalVideoKey);
        label.querySelector('.playlist-check-count').textContent = `${pl.videoKeys.length} items`;
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'playlist-modal-del-btn';
      delBtn.title = `Delete playlist "${pl.name}"`;
      delBtn.setAttribute('aria-label', `Delete playlist ${pl.name}`);
      delBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14"><polyline points="3 6 5 6 21 6" stroke="currentColor" stroke-width="2" fill="none"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" fill="none"/></svg>
      `;
      delBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Delete playlist library "${pl.name}"?`)) {
          deletePlaylist(pl.id);
        }
      });

      row.appendChild(label);
      row.appendChild(delBtn);
      list.appendChild(row);
    });
  }

  // ================= CHANNELS SUBSYSTEM (YOUTUBE STYLE) =================
  const CHANNEL_PRESET_COLORS = [
    '#ff0000', // YouTube Red
    '#065fd4', // Royal Blue
    '#2ba640', // Emerald Green
    '#8e24aa', // Purple
    '#ff8f00', // Amber Orange
    '#00bcd4', // Cyan
    '#e91e63', // Pink
    '#455a64', // Slate
    '#673ab7', // Deep Violet
    '#009688', // Teal
    '#795548', // Brown
    '#d32f2f'  // Crimson
  ];

  function loadChannels() {
    try {
      const storedChannels = localStorage.getItem(STORAGE_KEYS.CHANNELS);
      if (storedChannels) {
        state.channels = JSON.parse(storedChannels);
      } else {
        // Default YouTube-like sample channels
        state.channels = [
          {
            id: 'channel_creators_hub',
            name: 'Local Creators',
            handle: '@localcreators',
            color: '#ff0000',
            description: 'Curated offline video showcases, animations, and top community uploads.',
            createdAt: Date.now() - 86400000 * 7
          },
          {
            id: 'channel_tech_lab',
            name: 'Code & Tech Lab',
            handle: '@codetechlab',
            color: '#3ea6ff',
            description: 'Programming guides, deep technical tutorials, and open-source project walkthroughs.',
            createdAt: Date.now() - 86400000 * 3
          },
          {
            id: 'channel_cinematic',
            name: 'Cinematic Universe',
            handle: '@cinematic',
            color: '#a855f7',
            description: '4K short films, visual effects demos, cinematics, and movie trailers.',
            createdAt: Date.now() - 86400000 * 1
          }
        ];
        saveChannels();
      }

      // Subscriptions
      const storedSubs = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
      if (storedSubs) {
        state.subscriptions = new Set(JSON.parse(storedSubs));
      } else {
        // Default subscribed to first channel
        state.subscriptions = new Set(['channel_creators_hub']);
        saveSubscriptions();
      }

      // Video to channel mapping
      const storedVideoChannels = localStorage.getItem(STORAGE_KEYS.VIDEO_CHANNELS);
      if (storedVideoChannels) {
        state.videoChannels = JSON.parse(storedVideoChannels);
      } else {
        state.videoChannels = {};
      }

      // Video to collabs mapping
      const storedVideoCollabs = localStorage.getItem(STORAGE_KEYS.VIDEO_COLLABS);
      if (storedVideoCollabs) {
        state.videoCollabs = JSON.parse(storedVideoCollabs);
      } else {
        state.videoCollabs = {};
      }
    } catch (e) {
      state.channels = [];
      state.subscriptions = new Set();
      state.videoChannels = {};
      state.videoCollabs = {};
    }

    renderSidebarChannels();
    updateChannelStats();
  }

  function saveChannels() {
    try {
      localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(state.channels));
    } catch (e) {}
    renderSidebarChannels();
    updateChannelStats();
  }

  function saveSubscriptions() {
    try {
      localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify([...state.subscriptions]));
    } catch (e) {}
    renderSidebarChannels();
    updateChannelStats();
  }

  function saveVideoChannels() {
    try {
      localStorage.setItem(STORAGE_KEYS.VIDEO_CHANNELS, JSON.stringify(state.videoChannels));
    } catch (e) {}
    renderSidebarChannels();
    updateChannelStats();
  }

  function saveVideoCollabs() {
    try {
      localStorage.setItem(STORAGE_KEYS.VIDEO_COLLABS, JSON.stringify(state.videoCollabs));
    } catch (e) {}
  }

  function getVideoChannel(videoKey) {
    if (!videoKey) return null;
    const channelId = state.videoChannels[videoKey];
    if (!channelId) return null;
    return state.channels.find(c => c.id === channelId) || null;
  }

  function getVideoCollabs(videoKey) {
    if (!videoKey) return [];
    const collabIds = state.videoCollabs[videoKey] || [];
    if (!Array.isArray(collabIds) || collabIds.length === 0) return [];
    const primaryId = state.videoChannels[videoKey];
    return collabIds
      .filter(id => id && id !== primaryId)
      .map(id => state.channels.find(c => c.id === id))
      .filter(Boolean);
  }

  function getAllVideoChannels(videoKey) {
    if (!videoKey) return [];
    const primary = getVideoChannel(videoKey);
    const collabs = getVideoCollabs(videoKey);
    const list = [];
    if (primary) list.push(primary);
    collabs.forEach(c => {
      if (!list.some(existing => existing.id === c.id)) {
        list.push(c);
      }
    });
    return list;
  }

  function isVideoInChannel(videoKey, channelId) {
    if (!videoKey || !channelId) return false;
    if (state.videoChannels[videoKey] === channelId) return true;
    const collabIds = state.videoCollabs[videoKey] || [];
    return Array.isArray(collabIds) && collabIds.includes(channelId);
  }

  function getChannelVideos(channelId) {
    if (!channelId) return [];
    return state.videos.filter(v => isVideoInChannel(v.key, channelId));
  }

  function isSubscribed(channelId) {
    return state.subscriptions.has(channelId);
  }

  function toggleSubscribe(channelId) {
    if (!channelId) return;
    const channel = state.channels.find(c => c.id === channelId);
    if (!channel) return;

    if (state.subscriptions.has(channelId)) {
      state.subscriptions.delete(channelId);
    } else {
      state.subscriptions.add(channelId);
    }
    saveSubscriptions();

    // Update channel hero if visible
    if (state.currentView === 'channel' && state.activeChannelId === channelId) {
      renderChannelHeroBanner();
    }

    // Update watch view if active
    if (elements.watchView && elements.watchView.style.display === 'block' && state.activeVideo) {
      updateWatchChannelInfo(state.activeVideo);
    }

    // If on directory view, update button
    if (state.currentView === 'all-channels') {
      renderAllChannelsDirectory();
    }
    
    // If on subscribed-channels view and unsubscribed, re-filter
    if (state.currentView === 'subscribed-channels') {
      applyFiltersAndRender();
    }
  }

  function createChannel({ name, handle, color, description, logo }) {
    const cleanName = (name || '').trim();
    if (!cleanName) return null;

    let cleanHandle = (handle || '').trim();
    if (!cleanHandle) {
      cleanHandle = '@' + cleanName.toLowerCase().replace(/[^a-z0-9]/g, '');
    }
    if (!cleanHandle.startsWith('@')) {
      cleanHandle = '@' + cleanHandle;
    }

    const newChannel = {
      id: 'channel_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: cleanName,
      handle: cleanHandle,
      color: color || '#ff0000',
      description: (description || '').trim() || `Welcome to the official ${cleanName} channel. Enjoy our local video library collection!`,
      logo: logo || null,
      createdAt: Date.now()
    };

    state.channels.push(newChannel);
    // Auto subscribe to own created channel
    state.subscriptions.add(newChannel.id);
    saveChannels();
    saveSubscriptions();
    renderSidebarChannels();
    return newChannel;
  }

  function updateChannel(channelId, { name, handle, color, description, logo }) {
    const ch = state.channels.find(c => c.id === channelId);
    if (!ch) return null;

    if (name) ch.name = name.trim();
    if (handle) {
      let h = handle.trim();
      if (!h.startsWith('@')) h = '@' + h;
      ch.handle = h;
    }
    if (color) ch.color = color;
    if (description !== undefined) ch.description = description.trim();
    if (logo !== undefined) ch.logo = logo;

    saveChannels();
    renderSidebarChannels();
    if (state.currentView === 'channel' && state.activeChannelId === channelId) {
      renderChannelHeroBanner();
    }
    if (state.currentView === 'all-channels') {
      renderAllChannelsDirectory();
    }
    return ch;
  }

  function deleteChannel(channelId) {
    state.channels = state.channels.filter(c => c.id !== channelId);
    state.subscriptions.delete(channelId);

    // Unassign videos from this channel
    for (const [key, chId] of Object.entries(state.videoChannels)) {
      if (chId === channelId) {
        delete state.videoChannels[key];
      }
    }

    // Remove from collabs
    for (const [key, collabs] of Object.entries(state.videoCollabs)) {
      if (Array.isArray(collabs)) {
        const filtered = collabs.filter(id => id !== channelId);
        if (filtered.length > 0) {
          state.videoCollabs[key] = filtered;
        } else {
          delete state.videoCollabs[key];
        }
      }
    }

    saveChannels();
    saveSubscriptions();
    saveVideoChannels();
    saveVideoCollabs();

    if (state.currentView === 'channel' && state.activeChannelId === channelId) {
      setActiveView('all-channels');
    } else {
      applyFiltersAndRender();
    }
  }

  function assignVideoToChannel(videoKey, channelId, collabIds = []) {
    if (!videoKey) return;
    if (channelId) {
      state.videoChannels[videoKey] = channelId;
    } else {
      delete state.videoChannels[videoKey];
    }

    const cleanCollabs = Array.isArray(collabIds)
      ? collabIds.filter(id => id && id !== channelId)
      : [];

    if (cleanCollabs.length > 0) {
      state.videoCollabs[videoKey] = cleanCollabs;
    } else {
      delete state.videoCollabs[videoKey];
    }

    saveVideoChannels();
    saveVideoCollabs();

    if (state.activeVideo && state.activeVideo.key === videoKey) {
      updateWatchChannelInfo(state.activeVideo);
    }
    applyFiltersAndRender();
  }

  function addVideosToChannel(channelId, videoKeys) {
    if (!channelId || !Array.isArray(videoKeys)) return;
    videoKeys.forEach(k => {
      state.videoChannels[k] = channelId;
    });
    saveVideoChannels();
    applyFiltersAndRender();
  }

  function updateChannelStats() {
    const totalChannels = state.channels.length;
    const subscribedCount = state.channels.filter(c => state.subscriptions.has(c.id)).length;
    const withoutChannelCount = state.videos.filter(v => !state.videoChannels[v.key]).length;

    if (elements.sideStatChannels) elements.sideStatChannels.textContent = totalChannels;
    if (elements.sideStatChannelsAll) elements.sideStatChannelsAll.textContent = totalChannels;
    if (elements.sideStatChannelsSub) elements.sideStatChannelsSub.textContent = subscribedCount;
    if (elements.sideStatChannelsNone) elements.sideStatChannelsNone.textContent = withoutChannelCount;
    if (elements.sideSubSubscribedCount) elements.sideSubSubscribedCount.textContent = subscribedCount;
    if (elements.sideSubNoChannelCount) elements.sideSubNoChannelCount.textContent = withoutChannelCount;

    if (elements.choiceAllChannelsCount) elements.choiceAllChannelsCount.textContent = `${totalChannels} channels`;
    if (elements.choiceSubscribedCount) elements.choiceSubscribedCount.textContent = `${subscribedCount} channels`;
    if (elements.choiceWithoutChannelCount) elements.choiceWithoutChannelCount.textContent = `${withoutChannelCount} videos`;
    if (elements.choiceSubCountBadge) elements.choiceSubCountBadge.textContent = `${subscribedCount}`;
    if (elements.choiceNoChannelCountBadge) elements.choiceNoChannelCountBadge.textContent = `${withoutChannelCount}`;
    if (elements.choiceAllChannelsCountBadge) elements.choiceAllChannelsCountBadge.textContent = `${totalChannels}`;
  }

  function renderSidebarChannels() {
    const container = elements.sidebarChannelsList;
    if (!container) return;
    container.innerHTML = '';

    if (state.channels.length === 0) {
      container.innerHTML = `
        <div style="font-size: 11px; color: var(--text-muted); padding: 6px 12px; font-style: italic;">
          No channels created yet
        </div>
      `;
      return;
    }

    state.channels.forEach(ch => {
      const isCurrent = state.currentView === 'channel' && state.activeChannelId === ch.id;
      const isSub = state.subscriptions.has(ch.id);

      const btn = document.createElement('button');
      btn.className = `sidebar__channel-item ${isCurrent ? 'is-active' : ''}`;
      btn.title = ch.name;
      btn.innerHTML = `
        <div class="sidebar__channel-avatar" style="${ch.logo ? '' : `background-color: ${ch.color || '#ff0000'};`}">
          ${ch.logo ? `<img src="${ch.logo}" alt="${ch.name}" class="channel-avatar-img">` : getInitials(ch.name)}
        </div>
        <span class="sidebar__channel-name">${ch.name}</span>
        ${isSub ? `<span class="sidebar__channel-sub-dot" title="Subscribed"></span>` : ''}
      `;

      btn.addEventListener('click', () => {
        openChannelPage(ch.id);
      });

      container.appendChild(btn);
    });
  }

  function openChannelPage(channelId) {
    const ch = state.channels.find(c => c.id === channelId);
    if (!ch) return;

    state.activeChannelId = channelId;
    state.activePlaylistId = null;
    state.currentTagFilter = null;
    state.currentView = 'channel';
    state.channelActiveTab = 'videos';
    state.channelHeroDescExpanded = false;

    // Clear main views active styles
    elements.navAllBtn?.classList.remove('is-active');
    elements.navLikedBtn?.classList.remove('is-active');
    elements.navWatchLaterBtn?.classList.remove('is-active');
    elements.navUntaggedBtn?.classList.remove('is-active');
    elements.navHistoryBtn?.classList.remove('is-active');
    elements.navShortsBtn?.classList.remove('is-active');
    elements.chipAll?.classList.remove('is-active');
    elements.subnavAllChannelsBtn?.classList.remove('is-active');
    elements.subnavSubscribedBtn?.classList.remove('is-active');
    elements.subnavWithoutChannelBtn?.classList.remove('is-active');

    renderSidebarPlaylists();
    renderSidebarChannels();

    if (elements.watchView.style.display === 'block') {
      returnToBrowseView();
    }

    applyFiltersAndRender();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderChannelHeroBanner() {
    const ch = state.channels.find(c => c.id === state.activeChannelId);
    if (!ch || !elements.channelHeroBanner) return;

    elements.channelHeroBanner.style.display = 'block';
    
    // Avatar & Info
    if (ch.logo) {
      elements.channelHeroAvatar.innerHTML = `<img src="${ch.logo}" class="channel-hero-avatar-img" alt="${ch.name}">`;
      elements.channelHeroAvatar.style.backgroundColor = 'transparent';
    } else {
      elements.channelHeroAvatar.innerHTML = getInitials(ch.name);
      elements.channelHeroAvatar.style.backgroundColor = ch.color || '#ff0000';
    }
    elements.channelHeroName.textContent = ch.name;
    elements.channelHeroHandle.textContent = ch.handle || '@channel';
    
    const vids = getChannelVideos(ch.id);
    elements.channelHeroVideoCount.textContent = `${vids.length} ${vids.length === 1 ? 'video' : 'videos'}`;
    
    const isSub = isSubscribed(ch.id);
    elements.channelHeroSubCount.textContent = isSub ? '1 subscriber' : '0 subscribers';
    
    // Description formatting with expandable "...more" / "Show less"
    if (elements.channelHeroDesc) {
      const desc = ch.description || 'Welcome to this channel!';
      const isLong = desc.length > 180 || desc.includes('\n');
      if (isLong && !state.channelHeroDescExpanded) {
        const preview = desc.slice(0, 160).trim();
        elements.channelHeroDesc.innerHTML = `${escapeHtml(preview)}... <button type="button" class="channel-hero-more-btn" id="channelHeroMoreBtn">...more</button>`;
        const moreBtn = elements.channelHeroDesc.querySelector('#channelHeroMoreBtn');
        if (moreBtn) {
          moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.channelHeroDescExpanded = true;
            renderChannelHeroBanner();
          });
        }
      } else if (isLong && state.channelHeroDescExpanded) {
        elements.channelHeroDesc.innerHTML = `${escapeHtml(desc)} <button type="button" class="channel-hero-more-btn" id="channelHeroLessBtn">Show less</button>`;
        const lessBtn = elements.channelHeroDesc.querySelector('#channelHeroLessBtn');
        if (lessBtn) {
          lessBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            state.channelHeroDescExpanded = false;
            renderChannelHeroBanner();
          });
        }
      } else {
        elements.channelHeroDesc.textContent = desc;
      }
    }

    // Subscribe button
    if (elements.channelHeroSubscribeBtn && elements.channelHeroSubLabel) {
      if (isSub) {
        elements.channelHeroSubscribeBtn.classList.add('is-subscribed');
        elements.channelHeroSubLabel.textContent = 'Subscribed';
      } else {
        elements.channelHeroSubscribeBtn.classList.remove('is-subscribed');
        elements.channelHeroSubLabel.textContent = 'Subscribe';
      }
    }

    // Tabs
    if (elements.channelTabVideos) {
      elements.channelTabVideos.classList.toggle('is-active', state.channelActiveTab === 'videos');
    }
    if (elements.channelTabAbout) {
      elements.channelTabAbout.classList.toggle('is-active', state.channelActiveTab === 'about');
    }

    if (elements.channelAboutBox) {
      elements.channelAboutBox.style.display = state.channelActiveTab === 'about' ? 'block' : 'none';
      if (elements.channelAboutDesc) elements.channelAboutDesc.textContent = ch.description || 'No description provided for this channel.';
      if (elements.channelAboutJoined) elements.channelAboutJoined.textContent = `Created ${new Date(ch.createdAt).toLocaleDateString()}`;
      if (elements.channelAboutTotalVideos) elements.channelAboutTotalVideos.textContent = `${vids.length} videos`;
    }

    if (elements.videoGrid) {
      elements.videoGrid.style.display = state.channelActiveTab === 'about' ? 'none' : 'grid';
    }
  }

  function renderAllChannelsDirectory() {
    const grid = elements.channelsGrid;
    if (!grid) return;
    grid.innerHTML = '';

    if (state.channels.length === 0) {
      grid.innerHTML = `
        <div class="empty-state is-visible" style="margin: 40px auto; grid-column: 1 / -1;">
          <div class="empty-state__icon-wrap">
            <svg viewBox="0 0 24 24" width="42" height="42"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor"/></svg>
          </div>
          <h3 class="empty-state__title">No channels found</h3>
          <p class="empty-state__desc">Create your first channel to organize your local videos just like on YouTube!</p>
          <button class="header-action-btn header-action-btn--primary" id="emptyCreateChannelBtn" style="margin-top: 14px;">
            + Create Channel
          </button>
        </div>
      `;
      const btn = grid.querySelector('#emptyCreateChannelBtn');
      if (btn) btn.addEventListener('click', () => openCreateChannelModal());
      return;
    }

    state.channels.forEach(ch => {
      const vids = getChannelVideos(ch.id);
      const isSub = isSubscribed(ch.id);

      const card = document.createElement('div');
      card.className = 'channel-card';
      card.innerHTML = `
        <div class="channel-card__cover" style="background: linear-gradient(135deg, ${ch.color || '#333'}44, #121212);"></div>
        <div class="channel-card__body">
          <div class="channel-card__avatar" style="${ch.logo ? '' : `background-color: ${ch.color || '#ff0000'};`}">
            ${ch.logo ? `<img src="${ch.logo}" alt="${ch.name}" class="channel-card-avatar-img">` : getInitials(ch.name)}
          </div>
          <h3 class="channel-card__name" title="${ch.name}">${ch.name}</h3>
          <div class="channel-card__handle">${ch.handle || '@channel'}</div>
          <div class="channel-card__stats">${vids.length} ${vids.length === 1 ? 'video' : 'videos'} • ${isSub ? 'Subscribed' : 'Not Subscribed'}</div>
          <p class="channel-card__desc">${ch.description || 'Welcome to this channel!'}</p>
          <div class="channel-card__actions">
            <button class="watch-action-pill channel-card__btn view-channel-btn" style="flex:1;">
              View Channel
            </button>
            <button class="watch-subscribe-btn ${isSub ? 'is-subscribed' : ''} channel-sub-btn" style="margin-left:0; height:36px; padding:0 14px;">
              ${isSub ? 'Subscribed' : 'Subscribe'}
            </button>
          </div>
        </div>
      `;

      card.querySelector('.view-channel-btn').addEventListener('click', () => {
        openChannelPage(ch.id);
      });
      card.querySelector('.channel-card__name').addEventListener('click', () => {
        openChannelPage(ch.id);
      });
      card.querySelector('.channel-card__avatar').addEventListener('click', () => {
        openChannelPage(ch.id);
      });

      const subBtn = card.querySelector('.channel-sub-btn');
      subBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSubscribe(ch.id);
      });

      grid.appendChild(card);
    });
  }

  // --- Channels Choice Modal (4 Options) ---
  function openChannelsChoiceModal() {
    updateChannelStats();
    if (elements.channelsChoiceModal) {
      elements.channelsChoiceModal.style.display = 'flex';
    }
  }

  function closeChannelsChoiceModal() {
    if (elements.channelsChoiceModal) {
      elements.channelsChoiceModal.style.display = 'none';
    }
  }

  // --- Create / Edit Channel Modal ---
  function openCreateChannelModal(channelId = null) {
    state.createModalChannelId = channelId;
    closeChannelsChoiceModal();

    const titleEl = elements.createChannelModalTitle;
    const nameIn = elements.channelNameInput;
    const handleIn = elements.channelHandleInput;
    const descIn = elements.channelDescInput;

    if (channelId) {
      const ch = state.channels.find(c => c.id === channelId);
      if (ch) {
        if (titleEl) titleEl.textContent = 'Edit Channel';
        if (nameIn) nameIn.value = ch.name;
        if (handleIn) handleIn.value = ch.handle;
        if (descIn) descIn.value = ch.description || '';
        state.createModalSelectedColor = ch.color || '#ff0000';
        state.createModalCustomLogo = ch.logo || null;
      }
    } else {
      if (titleEl) titleEl.textContent = 'Create New Channel';
      if (nameIn) nameIn.value = '';
      if (handleIn) handleIn.value = '';
      if (descIn) descIn.value = '';
      state.createModalSelectedColor = CHANNEL_PRESET_COLORS[Math.floor(Math.random() * CHANNEL_PRESET_COLORS.length)];
      state.createModalCustomLogo = null;
    }

    if (elements.channelLogoFileInput) {
      elements.channelLogoFileInput.value = '';
    }

    setCreateModalColor(state.createModalSelectedColor);
    updateCreateChannelDescCounter();
    updateCreateChannelPreview();

    if (elements.createChannelModal) {
      elements.createChannelModal.style.display = 'flex';
    }
    if (nameIn) {
      setTimeout(() => nameIn.focus(), 100);
    }
  }

  function closeCreateChannelModal() {
    if (elements.createChannelModal) {
      elements.createChannelModal.style.display = 'none';
    }
    state.createModalChannelId = null;
    state.createModalCustomLogo = null;
    if (elements.channelLogoFileInput) {
      elements.channelLogoFileInput.value = '';
    }
  }

  function setCreateModalColor(color, fromInput = null) {
    if (!color) return;
    let hex = color.trim();
    if (!hex.startsWith('#')) hex = '#' + hex;
    if (!/^#[0-9a-fA-F]{6}$/i.test(hex) && !/^#[0-9a-fA-F]{3}$/i.test(hex)) {
      return;
    }
    if (hex.length === 4) {
      hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
    }
    hex = hex.toLowerCase();
    state.createModalSelectedColor = hex;

    if (elements.channelCustomColorPicker && fromInput !== 'picker') {
      elements.channelCustomColorPicker.value = hex;
    }
    if (elements.channelColorHexInput && fromInput !== 'hexInput') {
      elements.channelColorHexInput.value = hex.replace('#', '').toUpperCase();
    }
    if (elements.channelColorHexTag) {
      elements.channelColorHexTag.textContent = hex.toUpperCase();
    }

    renderColorPalette();
    updateCreateChannelPreview();
  }

  function updateCreateChannelDescCounter() {
    if (elements.channelDescCharCounter && elements.channelDescInput) {
      const len = elements.channelDescInput.value.length;
      elements.channelDescCharCounter.textContent = `${len.toLocaleString()} / 5,000`;
    }
  }

  function renderColorPalette() {
    const container = elements.channelColorPalette;
    if (!container) return;
    container.innerHTML = '';

    const currentColor = (state.createModalSelectedColor || '#ff0000').toLowerCase();
    const isPreset = CHANNEL_PRESET_COLORS.some(c => c.toLowerCase() === currentColor);

    CHANNEL_PRESET_COLORS.forEach(color => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      const isSelected = currentColor === color.toLowerCase();
      swatch.className = `color-swatch ${isSelected ? 'is-selected' : ''}`;
      swatch.style.backgroundColor = color;
      swatch.title = `Color: ${color}`;
      swatch.addEventListener('click', () => {
        setCreateModalColor(color);
      });
      container.appendChild(swatch);
    });

    if (elements.channelColorWheelBtn) {
      elements.channelColorWheelBtn.classList.toggle('is-active', !isPreset);
    }
  }

  function updateCreateChannelPreview() {
    const name = elements.channelNameInput?.value.trim() || 'Channel Name';
    const handle = elements.channelHandleInput?.value.trim() || '@handle';

    if (elements.channelPreviewAvatar) {
      if (state.createModalCustomLogo) {
        elements.channelPreviewAvatar.innerHTML = `<img src="${state.createModalCustomLogo}" class="channel-preview-avatar-img" alt="${name}">`;
        elements.channelPreviewAvatar.style.backgroundColor = 'transparent';
      } else {
        elements.channelPreviewAvatar.innerHTML = getInitials(name);
        elements.channelPreviewAvatar.style.backgroundColor = state.createModalSelectedColor;
      }
    }
    if (elements.removeChannelLogoBtn) {
      elements.removeChannelLogoBtn.style.display = state.createModalCustomLogo ? 'inline-flex' : 'none';
    }
    if (elements.channelPreviewLogoStatus) {
      elements.channelPreviewLogoStatus.textContent = state.createModalCustomLogo
        ? 'Custom logo active (stored persistently in browser)'
        : 'Using initial letters avatar';
      elements.channelPreviewLogoStatus.style.color = state.createModalCustomLogo ? 'var(--accent-blue)' : 'var(--text-secondary)';
    }
    if (elements.channelPreviewName) elements.channelPreviewName.textContent = name;
    if (elements.channelPreviewHandle) {
      elements.channelPreviewHandle.textContent = handle.startsWith('@') ? handle : '@' + handle;
    }
  }

  function saveChannelFromModal() {
    const name = elements.channelNameInput?.value.trim();
    if (!name) {
      alert('Please enter a channel name.');
      elements.channelNameInput?.focus();
      return;
    }

    let handle = elements.channelHandleInput?.value.trim();
    const desc = elements.channelDescInput?.value.trim();
    const color = state.createModalSelectedColor;
    const logo = state.createModalCustomLogo;

    if (state.createModalChannelId) {
      updateChannel(state.createModalChannelId, { name, handle, color, description: desc, logo });
      closeCreateChannelModal();
      openChannelPage(state.createModalChannelId);
      showToast(`Channel "${name}" updated successfully!`);
    } else {
      const newCh = createChannel({ name, handle, color, description: desc, logo });
      closeCreateChannelModal();
      if (newCh) {
        openChannelPage(newCh.id);
        showToast(`Channel "${name}" created!`);
      }
    }
  }

  // --- Assign Channel & Collabs Modal ---
  function openAssignChannelModal(videoItem, batchKeys = null) {
    if (batchKeys && batchKeys.length > 0) {
      state.assignModalBatchKeys = [...batchKeys];
      state.assignModalVideoKey = null;
      state.assignModalSelectedPrimary = null;
      state.assignModalSelectedCollabs = new Set();
      if (elements.assignChannelVideoTitle) {
        elements.assignChannelVideoTitle.textContent = `Assign Channel & Collabs to ${batchKeys.length} selected videos:`;
      }
    } else if (videoItem) {
      state.assignModalBatchKeys = null;
      state.assignModalVideoKey = videoItem.key;
      state.assignModalSelectedPrimary = state.videoChannels[videoItem.key] || null;
      const currentCollabs = state.videoCollabs[videoItem.key] || [];
      state.assignModalSelectedCollabs = new Set(Array.isArray(currentCollabs) ? currentCollabs : []);
      if (elements.assignChannelVideoTitle) {
        elements.assignChannelVideoTitle.textContent = `Video: ${videoItem.title}`;
      }
    } else {
      return;
    }

    if (elements.assignChannelSearchInput) {
      elements.assignChannelSearchInput.value = '';
    }
    if (elements.clearAssignChannelSearchBtn) {
      elements.clearAssignChannelSearchBtn.style.display = 'none';
    }

    renderAssignChannelRadioList('');
    renderAssignCollabList('');
    updateCollabPreview();

    if (elements.assignChannelModal) {
      elements.assignChannelModal.style.display = 'flex';
    }
  }

  function closeAssignChannelModal() {
    if (elements.assignChannelModal) {
      elements.assignChannelModal.style.display = 'none';
    }
    state.assignModalVideoKey = null;
    state.assignModalBatchKeys = null;
    state.assignModalSelectedPrimary = null;
    state.assignModalSelectedCollabs.clear();
  }

  function renderAssignChannelRadioList(filterQuery = '') {
    const container = elements.channelRadioList;
    if (!container) return;
    container.innerHTML = '';

    const q = (filterQuery || '').toLowerCase().trim();
    const currentPrimary = state.assignModalSelectedPrimary;

    // "None (Remove from Channel)" option
    const showNone = !q || 'none'.includes(q) || 'unassign'.includes(q);
    if (showNone) {
      const noneItem = document.createElement('label');
      noneItem.className = `channel-radio-item ${currentPrimary === null ? 'is-checked' : ''}`;
      noneItem.innerHTML = `
        <input type="radio" name="channelRadio" value="" ${currentPrimary === null ? 'checked' : ''}>
        <div class="channel-radio-avatar" style="background-color: #444; color: #aaa;">
          <svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg>
        </div>
        <div class="channel-radio-meta">
          <div class="channel-radio-name">None (No Primary Channel)</div>
          <div class="channel-radio-handle">Unassign video from primary channel</div>
        </div>
      `;
      noneItem.querySelector('input').addEventListener('change', () => {
        container.querySelectorAll('.channel-radio-item').forEach(el => el.classList.remove('is-checked'));
        noneItem.classList.add('is-checked');
        state.assignModalSelectedPrimary = null;
        renderAssignCollabList(elements.assignChannelSearchInput ? elements.assignChannelSearchInput.value : '');
        updateCollabPreview();
      });
      container.appendChild(noneItem);
    }

    // Channels list
    state.channels.forEach(ch => {
      const cName = (ch.name || '').toLowerCase();
      const cHandle = (ch.handle || '').toLowerCase();
      if (q && !cName.includes(q) && !cHandle.includes(q)) {
        return;
      }

      const isChecked = currentPrimary === ch.id;
      const row = document.createElement('label');
      row.className = `channel-radio-item ${isChecked ? 'is-checked' : ''}`;
      row.innerHTML = `
        <input type="radio" name="channelRadio" value="${ch.id}" ${isChecked ? 'checked' : ''}>
        <div class="channel-radio-avatar" style="${ch.logo ? '' : `background-color: ${ch.color || '#ff0000'};`}">
          ${ch.logo ? `<img src="${ch.logo}" class="channel-radio-avatar-img" alt="${ch.name}">` : getInitials(ch.name)}
        </div>
        <div class="channel-radio-meta">
          <div class="channel-radio-name">${escapeHtml(ch.name)}</div>
          <div class="channel-radio-handle">${escapeHtml(ch.handle || '@channel')}</div>
        </div>
      `;
      row.querySelector('input').addEventListener('change', () => {
        container.querySelectorAll('.channel-radio-item').forEach(el => el.classList.remove('is-checked'));
        row.classList.add('is-checked');
        state.assignModalSelectedPrimary = ch.id;
        // If primary channel was in collabs, remove it
        state.assignModalSelectedCollabs.delete(ch.id);
        renderAssignCollabList(elements.assignChannelSearchInput ? elements.assignChannelSearchInput.value : '');
        updateCollabPreview();
      });
      container.appendChild(row);
    });
  }

  function renderAssignCollabList(filterQuery = '') {
    const container = elements.collabCheckboxList;
    if (!container) return;
    container.innerHTML = '';

    const q = (filterQuery || '').toLowerCase().trim();
    const primaryId = state.assignModalSelectedPrimary;

    const filteredChannels = state.channels.filter(ch => {
      if (!q) return true;
      const cName = (ch.name || '').toLowerCase();
      const cHandle = (ch.handle || '').toLowerCase();
      return cName.includes(q) || cHandle.includes(q);
    });

    if (state.channels.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; text-align:center;">No channels available. Create channels below to add collaborators!</div>`;
      if (elements.collabSelectedCount) elements.collabSelectedCount.textContent = '0 collabs';
      return;
    }

    if (filteredChannels.length === 0) {
      container.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:10px; text-align:center;">No channels matching "${escapeHtml(filterQuery)}"</div>`;
      return;
    }

    filteredChannels.forEach(ch => {
      const isPrimary = ch.id === primaryId;
      const isChecked = state.assignModalSelectedCollabs.has(ch.id) && !isPrimary;

      const item = document.createElement('label');
      item.className = `collab-checkbox-item ${isChecked ? 'is-checked' : ''} ${isPrimary ? 'is-disabled' : ''}`;
      item.title = isPrimary ? `${ch.name} is selected as Primary Creator` : `Select ${ch.name} as collaborator`;
      item.innerHTML = `
        <input type="checkbox" value="${ch.id}" ${isChecked ? 'checked' : ''} ${isPrimary ? 'disabled' : ''} style="accent-color: #ff9800; cursor: pointer;">
        <div class="collab-checkbox-avatar" style="${ch.logo ? '' : `background-color: ${ch.color || '#ff9800'};`}">
          ${ch.logo ? `<img src="${ch.logo}" alt="${ch.name}">` : getInitials(ch.name)}
        </div>
        <div class="collab-checkbox-meta">
          <div class="collab-checkbox-name">${escapeHtml(ch.name)} ${isPrimary ? '<span style="font-size:10px; color:#3ea6ff; font-weight:600; margin-left:4px;">(Primary)</span>' : ''}</div>
          <div class="collab-checkbox-handle">${escapeHtml(ch.handle || '@channel')}</div>
        </div>
      `;

      if (!isPrimary) {
        item.querySelector('input').addEventListener('change', (e) => {
          if (e.target.checked) {
            state.assignModalSelectedCollabs.add(ch.id);
            item.classList.add('is-checked');
          } else {
            state.assignModalSelectedCollabs.delete(ch.id);
            item.classList.remove('is-checked');
          }
          updateCollabCount();
          updateCollabPreview();
        });
      }

      container.appendChild(item);
    });

    updateCollabCount();
  }

  function updateCollabCount() {
    if (elements.collabSelectedCount) {
      const count = state.assignModalSelectedCollabs.size;
      elements.collabSelectedCount.textContent = `${count} collab${count === 1 ? '' : 's'}`;
    }
  }

  function updateCollabPreview() {
    const container = elements.collabPreviewContent;
    if (!container) return;
    container.innerHTML = '';

    const primaryCh = state.channels.find(c => c.id === state.assignModalSelectedPrimary);
    const collabChs = Array.from(state.assignModalSelectedCollabs)
      .map(id => state.channels.find(c => c.id === id))
      .filter(Boolean);

    if (!primaryCh && collabChs.length === 0) {
      container.innerHTML = `<span style="font-size:12px; color:var(--text-muted); font-style:italic;">No channels assigned (Standard offline video)</span>`;
      return;
    }

    if (primaryCh) {
      const chip = document.createElement('div');
      chip.className = 'collab-preview-chip collab-preview-chip--primary';
      chip.innerHTML = `
        <span class="collab-preview-chip-dot" style="background-color: ${primaryCh.color || '#3ea6ff'};"></span>
        <span>${primaryCh.name}</span>
        <span style="font-size:9.5px; opacity:0.8; text-transform:uppercase; margin-left:2px;">(Primary)</span>
      `;
      container.appendChild(chip);
    }

    collabChs.forEach(c => {
      if (container.children.length > 0) {
        const mult = document.createElement('span');
        mult.style.cssText = 'color:#ff9800; font-weight:700; font-size:13px;';
        mult.textContent = '×';
        container.appendChild(mult);
      }

      const chip = document.createElement('div');
      chip.className = 'collab-preview-chip collab-preview-chip--collab';
      chip.innerHTML = `
        <span class="collab-preview-chip-dot" style="background-color: ${c.color || '#ff9800'};"></span>
        <span>${c.name}</span>
        <span style="font-size:9.5px; opacity:0.8; text-transform:uppercase; margin-left:2px;">(Collab)</span>
      `;
      container.appendChild(chip);
    });
  }

  function saveAssignChannelFromModal() {
    const primaryId = state.assignModalSelectedPrimary || null;
    const collabIds = Array.from(state.assignModalSelectedCollabs);

    if (state.assignModalBatchKeys && state.assignModalBatchKeys.length > 0) {
      state.assignModalBatchKeys.forEach(k => {
        assignVideoToChannel(k, primaryId, collabIds);
      });
      const count = state.assignModalBatchKeys.length;
      const ch = state.channels.find(c => c.id === primaryId);
      showToast(primaryId ? `Assigned ${count} videos to ${ch ? ch.name : 'channel'}!` : `Removed channel from ${count} videos`);
      clearVideoSelection();
      closeAssignChannelModal();
      return;
    }

    if (!state.assignModalVideoKey) return;

    assignVideoToChannel(state.assignModalVideoKey, primaryId, collabIds);
    closeAssignChannelModal();
    showToast('Channel and collaboration connections saved!');
  }

  // --- Add Multiple Videos Modal ---
  let channelAddTempSelectedKeys = new Set();

  function openChannelAddVideosModal(channelId) {
    const ch = state.channels.find(c => c.id === channelId);
    if (!ch) return;

    state.channelAddModalChannelId = channelId;
    if (elements.channelAddVideosModalTitle) {
      elements.channelAddVideosModalTitle.textContent = `Add Videos to ${ch.name}`;
    }
    if (elements.channelAddVideosSearch) {
      elements.channelAddVideosSearch.value = '';
    }

    // Populate currently assigned videos
    channelAddTempSelectedKeys = new Set();
    state.videos.forEach(v => {
      if (state.videoChannels[v.key] === channelId) {
        channelAddTempSelectedKeys.add(v.key);
      }
    });

    renderChannelVideosChecklist('');
    if (elements.channelAddVideosModal) {
      elements.channelAddVideosModal.style.display = 'flex';
    }
  }

  function closeChannelAddVideosModal() {
    if (elements.channelAddVideosModal) {
      elements.channelAddVideosModal.style.display = 'none';
    }
    state.channelAddModalChannelId = null;
    channelAddTempSelectedKeys.clear();
  }

  function renderChannelVideosChecklist(filterQuery = '') {
    const list = elements.channelVideosChecklist;
    if (!list) return;
    list.innerHTML = '';

    const q = (filterQuery || '').toLowerCase().trim();
    let eligible = state.videos;
    if (q) {
      eligible = eligible.filter(v => v.title.toLowerCase().includes(q) || v.name.toLowerCase().includes(q));
    }

    if (eligible.length === 0) {
      list.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-muted); font-size: 13px;">
          No matching videos found in your library.
        </div>
      `;
      updateChannelAddCountLabel();
      return;
    }

    eligible.forEach(v => {
      const isSelected = channelAddTempSelectedKeys.has(v.key);
      const currCh = getVideoChannel(v.key);

      const row = document.createElement('label');
      row.className = `channel-video-check-item ${isSelected ? 'is-selected' : ''}`;
      row.innerHTML = `
        <input type="checkbox" data-video-key="${v.key}" ${isSelected ? 'checked' : ''}>
        <img class="channel-video-check-thumb" src="${v.thumbnail || ''}" alt="${v.title}">
        <div class="channel-video-check-title" title="${v.title}">${v.title}</div>
        <div class="channel-video-check-curr">
          ${currCh ? (currCh.id === state.channelAddModalChannelId ? '<span style="color:var(--accent-blue);">In this channel</span>' : `In ${currCh.name}`) : 'No channel'}
        </div>
      `;

      const chk = row.querySelector('input');
      chk.addEventListener('change', () => {
        if (chk.checked) {
          channelAddTempSelectedKeys.add(v.key);
          row.classList.add('is-selected');
        } else {
          channelAddTempSelectedKeys.delete(v.key);
          row.classList.remove('is-selected');
        }
        updateChannelAddCountLabel();
      });

      list.appendChild(row);
    });

    updateChannelAddCountLabel();
  }

  function updateChannelAddCountLabel() {
    if (elements.channelAddSelectedCount) {
      elements.channelAddSelectedCount.textContent = `${channelAddTempSelectedKeys.size} videos selected`;
    }
  }

  function saveChannelAddVideosFromModal() {
    const channelId = state.channelAddModalChannelId;
    if (!channelId) return;

    // First unassign any videos previously in this channel that were deselected
    state.videos.forEach(v => {
      if (state.videoChannels[v.key] === channelId && !channelAddTempSelectedKeys.has(v.key)) {
        delete state.videoChannels[v.key];
      }
    });

    // Assign selected videos to this channel
    channelAddTempSelectedKeys.forEach(k => {
      state.videoChannels[k] = channelId;
    });

    saveVideoChannels();
    closeChannelAddVideosModal();
    if (state.currentView === 'channel' && state.activeChannelId === channelId) {
      renderChannelHeroBanner();
      applyFiltersAndRender();
    }
  }

  function updateWatchChannelInfo(videoItem) {
    if (!videoItem) return;
    const allChannels = getAllVideoChannels(videoItem.key);
    const primaryChannel = getVideoChannel(videoItem.key);
    const collabChannels = getVideoCollabs(videoItem.key);

    const ownerSection = document.querySelector('.watch-action-bar .watch-owner');
    if (!ownerSection) return;

    if (allChannels.length > 1) {
      // Multiple creators (YouTube Collabs)
      let creatorsHtml = '';
      allChannels.forEach((ch, idx) => {
        const isPrim = idx === 0 && primaryChannel && ch.id === primaryChannel.id;
        const isSub = isSubscribed(ch.id);
        creatorsHtml += `
          <div class="watch-creator-card" data-channel-id="${ch.id}">
            <div class="watch-creator-avatar" style="${ch.logo ? '' : `background-color: ${ch.color || '#ff0000'};`}" title="Visit ${ch.name}" data-action="visit-channel" data-channel-id="${ch.id}">
              ${ch.logo ? `<img src="${ch.logo}" alt="${ch.name}">` : getInitials(ch.name)}
            </div>
            <div class="watch-creator-meta">
              <div class="watch-creator-title-row">
                <span class="watch-creator-name" data-action="visit-channel" data-channel-id="${ch.id}" title="Visit ${ch.name}">${ch.name}</span>
                <span class="watch-creator-role-tag ${isPrim ? 'watch-creator-role-tag--primary' : 'watch-creator-role-tag--collab'}">${isPrim ? 'Creator' : 'Collab'}</span>
              </div>
              <span class="watch-creator-handle">${ch.handle || '@channel'}</span>
            </div>
            <button class="watch-creator-sub-btn ${isSub ? 'is-subscribed' : ''}" data-action="sub-creator" data-channel-id="${ch.id}" title="${isSub ? `Unsubscribe from ${ch.name}` : `Subscribe to ${ch.name}`}">
              <span>${isSub ? 'Subscribed' : 'Subscribe'}</span>
            </button>
          </div>
        `;
      });

      ownerSection.innerHTML = `
        <div class="watch-owners-container">
          ${creatorsHtml}
        </div>
      `;

      // Attach event listeners for multiple creators
      ownerSection.querySelectorAll('[data-action="visit-channel"]').forEach(el => {
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          const chId = el.getAttribute('data-channel-id');
          if (chId) {
            closeWatchView();
            openChannelPage(chId);
          }
        });
      });

      ownerSection.querySelectorAll('[data-action="sub-creator"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const chId = btn.getAttribute('data-channel-id');
          if (chId) {
            toggleSubscribe(chId);
          }
        });
      });

    } else if (allChannels.length === 1) {
      const channel = allChannels[0];
      const isSub = isSubscribed(channel.id);

      ownerSection.innerHTML = `
        <div class="watch-avatar" id="watchAvatar" style="${channel.logo ? '' : `background-color: ${channel.color || '#ff0000'};`}" title="Go to ${channel.name}">
          ${channel.logo ? `<img src="${channel.logo}" class="watch-channel-avatar-img" alt="${channel.name}">` : getInitials(channel.name)}
        </div>
        <div class="watch-owner__meta">
          <span class="watch-channel-name" id="watchChannelName" title="Go to ${channel.name}">${channel.name}</span>
          <span class="watch-folder-sub" id="watchFolderInfo">${channel.handle || '@channel'} • ${isSub ? 'Subscribed' : 'Offline Channel'}</span>
        </div>
        <button id="watchSubscribeBtn" class="watch-subscribe-btn ${isSub ? 'is-subscribed' : ''}" title="${isSub ? `Unsubscribe from ${channel.name}` : `Subscribe to ${channel.name}`}">
          <svg viewBox="0 0 24 24" width="16" height="16" class="sub-bell-icon"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2"/></svg>
          <span id="watchSubscribeLabel">${isSub ? 'Subscribed' : 'Subscribe'}</span>
        </button>
      `;

      ownerSection.querySelector('#watchAvatar')?.addEventListener('click', () => {
        closeWatchView();
        openChannelPage(channel.id);
      });
      ownerSection.querySelector('#watchChannelName')?.addEventListener('click', () => {
        closeWatchView();
        openChannelPage(channel.id);
      });
      ownerSection.querySelector('#watchSubscribeBtn')?.addEventListener('click', () => {
        toggleSubscribe(channel.id);
      });

    } else {
      // No channel assigned
      ownerSection.innerHTML = `
        <div class="watch-avatar" id="watchAvatar" style="background-color: #383838;" title="No channel assigned (Click to assign)">
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg>
        </div>
        <div class="watch-owner__meta">
          <span class="watch-channel-name" id="watchChannelName" title="Click to assign this video to a channel">No Channel</span>
          <span class="watch-folder-sub" id="watchFolderInfo">Offline Video • No Channel</span>
        </div>
        <button id="watchSubscribeBtn" class="watch-subscribe-btn" title="Assign this video to a channel">
          <span id="watchSubscribeLabel">+ Add to Channel</span>
        </button>
      `;

      const openAssign = () => {
        if (state.activeVideo) {
          openAssignChannelModal(state.activeVideo);
        }
      };

      ownerSection.querySelector('#watchAvatar')?.addEventListener('click', openAssign);
      ownerSection.querySelector('#watchChannelName')?.addEventListener('click', openAssign);
      ownerSection.querySelector('#watchSubscribeBtn')?.addEventListener('click', openAssign);
    }
  }

  function setupChannelModalEvents() {
    // 4 Choices Modal Events
    if (elements.closeChannelsChoiceModalBtn) {
      elements.closeChannelsChoiceModalBtn.addEventListener('click', closeChannelsChoiceModal);
    }
    if (elements.choiceNewChannelBtn) {
      elements.choiceNewChannelBtn.addEventListener('click', () => {
        closeChannelsChoiceModal();
        openCreateChannelModal();
      });
    }
    if (elements.choiceSubscribedBtn) {
      elements.choiceSubscribedBtn.addEventListener('click', () => {
        closeChannelsChoiceModal();
        setActiveView('subscribed-channels');
      });
    }
    if (elements.choiceWithoutChannelBtn) {
      elements.choiceWithoutChannelBtn.addEventListener('click', () => {
        closeChannelsChoiceModal();
        setActiveView('videos-without-channel');
      });
    }
    if (elements.choiceAllChannelsBtn) {
      elements.choiceAllChannelsBtn.addEventListener('click', () => {
        closeChannelsChoiceModal();
        setActiveView('all-channels');
      });
    }

    // Create / Edit Channel Modal Events
    if (elements.closeCreateChannelModalBtn) {
      elements.closeCreateChannelModalBtn.addEventListener('click', closeCreateChannelModal);
    }
    if (elements.cancelCreateChannelBtn) {
      elements.cancelCreateChannelBtn.addEventListener('click', closeCreateChannelModal);
    }
    if (elements.saveChannelBtn) {
      elements.saveChannelBtn.addEventListener('click', saveChannelFromModal);
    }
    if (elements.channelChooseLogoBtn && elements.channelLogoFileInput) {
      elements.channelChooseLogoBtn.addEventListener('click', () => {
        elements.channelLogoFileInput.click();
      });
    }
    if (elements.channelLogoFileInput) {
      elements.channelLogoFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          try {
            const dataUrl = await processImageToAvatarDataUrl(file, 256);
            state.createModalCustomLogo = dataUrl;
            updateCreateChannelPreview();
            showToast('Channel logo loaded from your local device!');
          } catch (err) {
            showToast(err.message || 'Failed to process logo image');
          }
        }
      });
    }
    if (elements.removeChannelLogoBtn) {
      elements.removeChannelLogoBtn.addEventListener('click', () => {
        state.createModalCustomLogo = null;
        if (elements.channelLogoFileInput) elements.channelLogoFileInput.value = '';
        updateCreateChannelPreview();
        showToast('Channel logo reset to initial letters');
      });
    }
    if (elements.channelNameInput) {
      elements.channelNameInput.addEventListener('input', () => {
        const name = elements.channelNameInput.value.trim();
        if (elements.channelHandleInput && !state.createModalChannelId) {
          elements.channelHandleInput.value = '@' + name.toLowerCase().replace(/[^a-z0-9]/g, '');
        }
        updateCreateChannelPreview();
      });
    }
    if (elements.channelHandleInput) {
      elements.channelHandleInput.addEventListener('input', updateCreateChannelPreview);
    }
    if (elements.channelDescInput) {
      elements.channelDescInput.addEventListener('input', updateCreateChannelDescCounter);
    }
    if (elements.channelCustomColorPicker) {
      elements.channelCustomColorPicker.addEventListener('input', (e) => {
        setCreateModalColor(e.target.value, 'picker');
      });
      elements.channelCustomColorPicker.addEventListener('change', (e) => {
        setCreateModalColor(e.target.value, 'picker');
      });
    }
    if (elements.channelColorHexInput) {
      elements.channelColorHexInput.addEventListener('input', (e) => {
        const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
        if (val.length === 6 || val.length === 3) {
          setCreateModalColor('#' + val, 'hexInput');
        }
      });
      elements.channelColorHexInput.addEventListener('blur', (e) => {
        const val = e.target.value.trim().replace(/[^0-9a-fA-F]/g, '');
        if (val.length !== 6 && val.length !== 3) {
          e.target.value = state.createModalSelectedColor.replace('#', '').toUpperCase();
        }
      });
    }

    // Assign Channel Modal Events
    if (elements.closeAssignChannelModalBtn) {
      elements.closeAssignChannelModalBtn.addEventListener('click', closeAssignChannelModal);
    }
    if (elements.assignChannelSearchInput) {
      elements.assignChannelSearchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (elements.clearAssignChannelSearchBtn) {
          elements.clearAssignChannelSearchBtn.style.display = val.length > 0 ? 'flex' : 'none';
        }
        renderAssignChannelRadioList(val);
        renderAssignCollabList(val);
      });
    }
    if (elements.clearAssignChannelSearchBtn) {
      elements.clearAssignChannelSearchBtn.addEventListener('click', () => {
        if (elements.assignChannelSearchInput) {
          elements.assignChannelSearchInput.value = '';
          elements.assignChannelSearchInput.focus();
        }
        elements.clearAssignChannelSearchBtn.style.display = 'none';
        renderAssignChannelRadioList('');
        renderAssignCollabList('');
      });
    }
    if (elements.cancelAssignChannelBtn) {
      elements.cancelAssignChannelBtn.addEventListener('click', closeAssignChannelModal);
    }
    if (elements.doneAssignChannelModalBtn) {
      elements.doneAssignChannelModalBtn.addEventListener('click', saveAssignChannelFromModal);
    }
    if (elements.quickCreateChannelBtn) {
      elements.quickCreateChannelBtn.addEventListener('click', () => {
        const quickName = elements.quickChannelInput ? elements.quickChannelInput.value.trim() : '';
        if (quickName) {
          const newCh = createChannel({ name: quickName });
          if (newCh) {
            elements.quickChannelInput.value = '';
            state.assignModalSelectedPrimary = newCh.id;
            renderAssignChannelRadioList();
            renderAssignCollabList();
            updateCollabPreview();
            showToast(`Created channel "${newCh.name}"!`);
          }
        } else {
          closeAssignChannelModal();
          openCreateChannelModal();
        }
      });
    }

    // Channel Add Multiple Videos Modal Events
    if (elements.closeChannelAddVideosModalBtn) {
      elements.closeChannelAddVideosModalBtn.addEventListener('click', closeChannelAddVideosModal);
    }
    if (elements.cancelChannelAddVideosBtn) {
      elements.cancelChannelAddVideosBtn.addEventListener('click', closeChannelAddVideosModal);
    }
    if (elements.saveChannelAddVideosBtn) {
      elements.saveChannelAddVideosBtn.addEventListener('click', saveChannelAddVideosFromModal);
    }
    if (elements.channelAddVideosSearch) {
      elements.channelAddVideosSearch.addEventListener('input', (e) => {
        renderChannelVideosChecklist(e.target.value);
      });
    }
    if (elements.channelAddSelectAllBtn) {
      elements.channelAddSelectAllBtn.addEventListener('click', () => {
        const q = elements.channelAddVideosSearch?.value.toLowerCase().trim() || '';
        state.videos.forEach(v => {
          if (!q || v.title.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)) {
            channelAddTempSelectedKeys.add(v.key);
          }
        });
        renderChannelVideosChecklist(q);
      });
    }
    if (elements.channelAddDeselectAllBtn) {
      elements.channelAddDeselectAllBtn.addEventListener('click', () => {
        const q = elements.channelAddVideosSearch?.value.toLowerCase().trim() || '';
        if (q) {
          state.videos.forEach(v => {
            if (v.title.toLowerCase().includes(q) || v.name.toLowerCase().includes(q)) {
              channelAddTempSelectedKeys.delete(v.key);
            }
          });
        } else {
          channelAddTempSelectedKeys.clear();
        }
        renderChannelVideosChecklist(q);
      });
    }

    // Upload Original Thumbnail Modal Events
    if (elements.closeUploadThumbnailModalBtn) {
      elements.closeUploadThumbnailModalBtn.addEventListener('click', closeUploadThumbnailModal);
    }
    if (elements.cancelUploadThumbnailBtn) {
      elements.cancelUploadThumbnailBtn.addEventListener('click', closeUploadThumbnailModal);
    }
    if (elements.thumbTabFileBtn) {
      elements.thumbTabFileBtn.addEventListener('click', () => switchThumbModalTab('file'));
    }
    if (elements.thumbTabUrlBtn) {
      elements.thumbTabUrlBtn.addEventListener('click', () => switchThumbModalTab('url'));
    }
    if (elements.thumbBrowseBtn) {
      elements.thumbBrowseBtn.addEventListener('click', () => elements.thumbFileInput?.click());
    }
    if (elements.thumbDropZone) {
      elements.thumbDropZone.addEventListener('click', (e) => {
        if (e.target !== elements.thumbBrowseBtn) elements.thumbFileInput?.click();
      });
      elements.thumbDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.thumbDropZone.classList.add('is-drag-over');
      });
      elements.thumbDropZone.addEventListener('dragleave', () => {
        elements.thumbDropZone.classList.remove('is-drag-over');
      });
      elements.thumbDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.thumbDropZone.classList.remove('is-drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          const vItem = state.videos.find(v => v.key === state.thumbnailModalVideoKey);
          if (vItem) {
            applyImageFileAsThumbnail(vItem, file);
          }
        }
      });
    }
    if (elements.thumbFileInput) {
      elements.thumbFileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          const vItem = state.videos.find(v => v.key === state.thumbnailModalVideoKey);
          if (vItem) {
            applyImageFileAsThumbnail(vItem, file);
          }
        }
      });
    }
    if (elements.thumbFetchUrlBtn) {
      elements.thumbFetchUrlBtn.addEventListener('click', () => {
        fetchThumbnailFromUrl(elements.thumbUrlInput?.value);
      });
    }
    if (elements.thumbUrlInput) {
      elements.thumbUrlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          fetchThumbnailFromUrl(elements.thumbUrlInput.value);
        }
      });
    }
    if (elements.saveUploadThumbnailBtn) {
      elements.saveUploadThumbnailBtn.addEventListener('click', () => {
        if (state.thumbModalTempDataUrl && state.thumbnailModalVideoKey) {
          const vItem = state.videos.find(v => v.key === state.thumbnailModalVideoKey);
          if (vItem) {
            setVideoCustomThumbnail(vItem, state.thumbModalTempDataUrl);
            showToast(`Original YouTube thumbnail saved for "${vItem.title}"!`);
          }
          closeUploadThumbnailModal();
        }
      });
    }
    if (elements.thumbResetFrameBtn) {
      elements.thumbResetFrameBtn.addEventListener('click', () => {
        if (state.thumbnailModalVideoKey) {
          const vItem = state.videos.find(v => v.key === state.thumbnailModalVideoKey);
          if (vItem) {
            resetVideoThumbnailToFrame(vItem);
            showToast(`Thumbnail reset to video frame for "${vItem.title}"`);
          }
          closeUploadThumbnailModal();
        }
      });
    }
    if (elements.watchActionUploadThumbnail) {
      elements.watchActionUploadThumbnail.addEventListener('click', () => {
        if (elements.watchDropdown) elements.watchDropdown.style.display = 'none';
        if (state.activeVideo) {
          openUploadThumbnailModal(state.activeVideo);
        }
      });
    }

    // Channel Hero Action Events
    if (elements.channelHeroChangeLogoBtn && elements.channelHeroLogoFileInput) {
      elements.channelHeroChangeLogoBtn.addEventListener('click', () => {
        elements.channelHeroLogoFileInput.click();
      });
    }
    if (elements.channelHeroChangeLogoActionBtn && elements.channelHeroLogoFileInput) {
      elements.channelHeroChangeLogoActionBtn.addEventListener('click', () => {
        elements.channelHeroLogoFileInput.click();
      });
    }
    if (elements.channelHeroAvatar && elements.channelHeroLogoFileInput) {
      elements.channelHeroAvatar.addEventListener('click', () => {
        elements.channelHeroLogoFileInput.click();
      });
    }
    if (elements.channelHeroLogoFileInput) {
      elements.channelHeroLogoFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file && state.activeChannelId) {
          try {
            const dataUrl = await processImageToAvatarDataUrl(file, 256);
            updateChannel(state.activeChannelId, { logo: dataUrl });
            showToast('Channel logo updated and saved to local storage!');
          } catch (err) {
            showToast(err.message || 'Failed to process logo image');
          }
        }
      });
    }
    if (elements.channelHeroSubscribeBtn) {
      elements.channelHeroSubscribeBtn.addEventListener('click', () => {
        if (state.activeChannelId) {
          toggleSubscribe(state.activeChannelId);
        }
      });
    }
    if (elements.channelHeroAddVideosBtn) {
      elements.channelHeroAddVideosBtn.addEventListener('click', () => {
        if (state.activeChannelId) {
          openChannelAddVideosModal(state.activeChannelId);
        }
      });
    }
    if (elements.channelHeroEditBtn) {
      elements.channelHeroEditBtn.addEventListener('click', () => {
        if (state.activeChannelId) {
          openCreateChannelModal(state.activeChannelId);
        }
      });
    }
    if (elements.channelHeroDeleteBtn) {
      elements.channelHeroDeleteBtn.addEventListener('click', () => {
        const ch = state.channels.find(c => c.id === state.activeChannelId);
        if (ch && confirm(`Delete channel "${ch.name}"? (Your video files on disk will not be affected)`)) {
          deleteChannel(ch.id);
        }
      });
    }
    if (elements.channelTabVideos) {
      elements.channelTabVideos.addEventListener('click', () => {
        state.channelActiveTab = 'videos';
        renderChannelHeroBanner();
      });
    }
    if (elements.channelTabAbout) {
      elements.channelTabAbout.addEventListener('click', () => {
        state.channelActiveTab = 'about';
        renderChannelHeroBanner();
      });
    }

    // Directory Create Channel Button
    if (elements.dirCreateChannelBtn) {
      elements.dirCreateChannelBtn.addEventListener('click', () => {
        openCreateChannelModal();
      });
    }

    // Sidebar New Channel Button
    if (elements.sidebarNewChannelBtn) {
      elements.sidebarNewChannelBtn.addEventListener('click', () => {
        openCreateChannelModal();
      });
    }

    // Watch Page Channel & Subscribe Click Events
    if (elements.watchSubscribeBtn) {
      elements.watchSubscribeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!state.activeVideo) return;
        const channel = getVideoChannel(state.activeVideo.key);
        if (channel) {
          toggleSubscribe(channel.id);
        } else {
          openAssignChannelModal(state.activeVideo);
        }
      });
    }

    const handleWatchChannelNav = () => {
      if (!state.activeVideo) return;
      const channel = getVideoChannel(state.activeVideo.key);
      if (channel) {
        returnToBrowseView();
        openChannelPage(channel.id);
      } else {
        openAssignChannelModal(state.activeVideo);
      }
    };

    if (elements.watchAvatar) {
      elements.watchAvatar.addEventListener('click', handleWatchChannelNav);
    }
    if (elements.watchChannelName) {
      elements.watchChannelName.addEventListener('click', handleWatchChannelNav);
    }

    // Watch 3-dots dropdown menu
    if (elements.watchMoreBtn) {
      elements.watchMoreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dd = elements.watchMoreDropdown;
        if (dd) {
          dd.style.display = dd.style.display === 'none' ? 'flex' : 'none';
        }
      });
    }

    document.addEventListener('click', (e) => {
      if (elements.watchMoreDropdown && !e.target.closest('.watch-more-wrap')) {
        elements.watchMoreDropdown.style.display = 'none';
      }
    });

    if (elements.watchActionAddChannel) {
      elements.watchActionAddChannel.addEventListener('click', () => {
        if (elements.watchMoreDropdown) elements.watchMoreDropdown.style.display = 'none';
        if (state.activeVideo) openAssignChannelModal(state.activeVideo);
      });
    }
    if (elements.watchActionManageTags) {
      elements.watchActionManageTags.addEventListener('click', () => {
        if (elements.watchMoreDropdown) elements.watchMoreDropdown.style.display = 'none';
        if (state.activeVideo) openTagModal(state.activeVideo);
      });
    }
    if (elements.watchActionShuffleNext) {
      elements.watchActionShuffleNext.addEventListener('click', () => {
        if (elements.watchMoreDropdown) elements.watchMoreDropdown.style.display = 'none';
        mixUpNext();
        playNextVideo();
      });
    }

    // Sidebar "Channels" Nav Button -> Opens 4-choices modal
    if (elements.navChannelsBtn) {
      elements.navChannelsBtn.addEventListener('click', () => {
        openChannelsChoiceModal();
      });
    }

    // Sidebar Sub-nav items
    const allChBtn = elements.sideSubAllChannels || elements.subnavAllChannelsBtn;
    if (allChBtn) {
      allChBtn.addEventListener('click', () => {
        setActiveView('all-channels');
      });
    }
    const subChBtn = elements.sideSubSubscribed || elements.subnavSubscribedBtn;
    if (subChBtn) {
      subChBtn.addEventListener('click', () => {
        setActiveView('subscribed-channels');
      });
    }
    const noChBtn = elements.sideSubNoChannel || elements.subnavWithoutChannelBtn;
    if (noChBtn) {
      noChBtn.addEventListener('click', () => {
        setActiveView('videos-without-channel');
      });
    }

    // Modal Backdrop Dismissals
    const channelModals = [
      elements.channelsChoiceModal,
      elements.createChannelModal,
      elements.assignChannelModal,
      elements.channelAddVideosModal
    ];
    channelModals.forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (e) => {
          if (e.target === modal) {
            modal.style.display = 'none';
          }
        });
      }
    });
  }

  // ================= AUTOPLAY & TIMESTAMP MEMORY =================
  function loadAutoplay() {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTOPLAY);
      state.autoplayEnabled = saved !== 'false';
      if (elements.autoplayToggle) {
        elements.autoplayToggle.checked = state.autoplayEnabled;
      }
    } catch (e) {
      state.autoplayEnabled = true;
    }
  }

  function saveAutoplay(val) {
    state.autoplayEnabled = Boolean(val);
    try {
      localStorage.setItem(STORAGE_KEYS.AUTOPLAY, state.autoplayEnabled ? 'true' : 'false');
    } catch (e) {}
  }

  function getPlaybackProgressMap() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function getVideoProgress(videoKey) {
    if (!videoKey) return null;
    const map = getPlaybackProgressMap();
    return map[videoKey] || null;
  }

  function saveVideoProgress(videoKey, currentTime, duration) {
    if (!videoKey || !duration || isNaN(currentTime)) return;
    try {
      const map = getPlaybackProgressMap();
      if (currentTime >= duration - 2) {
        map[videoKey] = {
          currentTime: 0,
          duration: duration,
          completed: true,
          updatedAt: Date.now()
        };
      } else {
        map[videoKey] = {
          currentTime: Math.max(0, currentTime),
          duration: duration,
          completed: false,
          updatedAt: Date.now()
        };
      }
      localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(map));
    } catch (e) {}
  }

  // ================= WATCH HISTORY =================
  function getWatchHistoryList() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function recordWatchHistory(video) {
    if (!video || !video.key) return;
    try {
      let list = getWatchHistoryList();
      list = list.filter(item => item.key !== video.key);
      list.unshift({
        key: video.key,
        name: video.name,
        title: video.title,
        size: video.size,
        formattedSize: video.formattedSize,
        duration: video.duration || 0,
        formattedDuration: video.formattedDuration || '0:00',
        isShort: Boolean(video.isShort),
        channel: video.channel || 'Local Video',
        color: video.color || '#3ea6ff',
        lastWatched: Date.now()
      });
      if (list.length > 100) list = list.slice(0, 100);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
      updateHistoryCounter();
    } catch (e) {}
  }

  function removeHistoryItem(videoKey) {
    try {
      let list = getWatchHistoryList();
      list = list.filter(item => item.key !== videoKey);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(list));
      updateHistoryCounter();
      if (state.currentView === 'history') {
        applyFiltersAndRender();
      }
    } catch (e) {}
  }

  function clearAllWatchHistory() {
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY);
      updateHistoryCounter();
      if (state.currentView === 'history') {
        applyFiltersAndRender();
      }
    } catch (e) {}
  }

  function updateHistoryCounter() {
    const list = getWatchHistoryList();
    if (elements.sideStatHistory) {
      elements.sideStatHistory.textContent = list.length;
    }
  }

  // ================= CUSTOM TAGGING =================
  const DEFAULT_SUGGESTIONS = [
    { tag: 'Gaming', icon: '🎮' },
    { tag: 'Music', icon: '🎵' },
    { tag: 'Tutorials', icon: '📚' },
    { tag: 'Clips', icon: '✂️' },
    { tag: 'Movies', icon: '🍿' },
    { tag: 'Podcast', icon: '🎙️' },
    { tag: 'Highlights', icon: '⭐' }
  ];

  function getAllTagsMap() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TAGS);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function getVideoTags(videoKey) {
    if (!videoKey) return [];
    const map = getAllTagsMap();
    return Array.isArray(map[videoKey]) ? map[videoKey] : [];
  }

  function setVideoTags(videoKey, tagsArray) {
    if (!videoKey) return;
    try {
      const map = getAllTagsMap();
      const cleanTags = [...new Set(tagsArray.map(t => t.trim()).filter(Boolean))];
      if (cleanTags.length > 0) {
        map[videoKey] = cleanTags;
        cleanTags.forEach(t => addQuickSuggestion(t));
      } else {
        delete map[videoKey];
      }
      localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(map));
      renderDynamicTagChips();
      updateSidebarStats();
    } catch (e) {}
  }

  function getAllUniqueTags() {
    const map = getAllTagsMap();
    const tagsSet = new Set();
    Object.values(map).forEach(tags => {
      if (Array.isArray(tags)) {
        tags.forEach(t => tagsSet.add(t));
      }
    });
    if (state.videos.some(v => isShortVideo(v))) {
      tagsSet.add('shorts');
    }
    return Array.from(tagsSet).sort();
  }

  function getSavedQuickSuggestions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SUGGESTIONS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  function saveQuickSuggestions(list) {
    try {
      localStorage.setItem(STORAGE_KEYS.SUGGESTIONS, JSON.stringify(list));
    } catch (e) {}
  }

  function addQuickSuggestion(tagName) {
    if (!tagName) return;
    const cleanTag = tagName.trim().replace(/^#+/, '');
    if (!cleanTag) return;

    const saved = getSavedQuickSuggestions();
    const existsInSaved = saved.some(t => t.toLowerCase() === cleanTag.toLowerCase());
    const existsInDefault = DEFAULT_SUGGESTIONS.some(s => s.tag.toLowerCase() === cleanTag.toLowerCase());

    if (!existsInSaved && !existsInDefault) {
      saved.push(cleanTag);
      saveQuickSuggestions(saved);
    }

    if (elements.tagModal && elements.tagModal.style.display !== 'none') {
      renderModalQuickSuggestions();
    }
  }

  function getAllQuickSuggestions() {
    const saved = getSavedQuickSuggestions();
    const allUsedTags = getAllUniqueTags();
    const combined = [];
    const seen = new Set();

    DEFAULT_SUGGESTIONS.forEach(item => {
      seen.add(item.tag.toLowerCase());
      combined.push({ tag: item.tag, icon: item.icon, isCustom: false });
    });

    const customList = [...new Set([...saved, ...allUsedTags])];
    customList.forEach(tag => {
      const lower = tag.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        combined.push({ tag: tag, icon: '🏷️', isCustom: true });
      }
    });

    return combined;
  }

  function deleteTagGlobally(tagName) {
    if (!tagName) return;
    const cleanTag = tagName.trim().replace(/^#+/, '');
    if (!cleanTag) return;

    // 1. Remove from all video tags
    const allTagsMap = getAllTagsMap();
    let changed = false;
    Object.keys(allTagsMap).forEach(key => {
      if (Array.isArray(allTagsMap[key])) {
        const originalLength = allTagsMap[key].length;
        allTagsMap[key] = allTagsMap[key].filter(t => t.toLowerCase() !== cleanTag.toLowerCase());
        if (allTagsMap[key].length !== originalLength) {
          changed = true;
          if (allTagsMap[key].length === 0) {
            delete allTagsMap[key];
          }
        }
      }
    });

    if (changed) {
      try {
        localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(allTagsMap));
      } catch (e) {}
    }

    // 2. Remove from saved quick suggestions
    const saved = getSavedQuickSuggestions();
    const filteredSaved = saved.filter(t => t.toLowerCase() !== cleanTag.toLowerCase());
    saveQuickSuggestions(filteredSaved);

    // 3. Reset active filter if deleting active tag
    if (state.currentTagFilter && state.currentTagFilter.toLowerCase() === cleanTag.toLowerCase()) {
      state.currentTagFilter = null;
    }

    // 4. Update UI
    renderDynamicTagChips();
    updateSidebarStats();
    if (elements.tagModal && elements.tagModal.style.display !== 'none') {
      renderModalActiveTags();
      renderModalQuickSuggestions();
    }
    applyFiltersAndRender();
  }

  // ================= FORMATTING HELPERS =================
  function calculateTotalRawVideoDuration() {
    if (!state.videos || state.videos.length === 0) return '0.0 hrs';
    const totalSeconds = state.videos.reduce((sum, v) => sum + (v.duration || 0), 0);
    if (totalSeconds === 0) {
      return '0.0 hrs';
    }
    const totalHours = totalSeconds / 3600;
    const wholeHours = Math.floor(totalHours);
    const remMins = Math.round((totalSeconds % 3600) / 60);

    if (totalHours < 0.1) {
      const mins = Math.max(1, Math.round(totalSeconds / 60));
      return `${mins} min${mins === 1 ? '' : 's'}`;
    }
    if (remMins === 0) {
      return `${totalHours.toFixed(1)} hrs`;
    }
    return `${totalHours.toFixed(1)} hrs (${wholeHours}h ${remMins}m)`;
  }
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatDuration(seconds) {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
    }
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  function cleanVideoTitle(filename) {
    return filename
      .replace(/\.(mp4|webm|mkv|mov|avi|m4v|ogg)$/i, '')
      .replace(/[\._\-]+/g, ' ')
      .trim();
  }

  function getInitials(name) {
    const parts = name.split(' ').filter(Boolean);
    if (parts.length === 0) return 'V';
    if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  function getRandomColor(str) {
    const colors = ['#a855f7', '#3ea6ff', '#2ba640', '#f59e0b', '#ec4899', '#06b6d4', '#e11d48'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function formatTimeAgo(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - timestamp) / 1000);
    if (elapsedSeconds < 60) return 'Just now';
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h ago`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays === 1) return 'Yesterday';
    if (elapsedDays < 30) return `${elapsedDays}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  // ================= FAST PARALLEL THUMBNAIL GENERATOR & CACHE =================
  function loadThumbnailCache() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.THUMBNAILS);
      if (stored) {
        const obj = JSON.parse(stored);
        Object.entries(obj).forEach(([k, v]) => {
          thumbnailMemoryCache.set(k, v);
        });
      }
    } catch (e) {}
  }

  function saveThumbnailCache() {
    try {
      // Save top 120 thumbnails to prevent localStorage quota exhaustion
      const obj = {};
      const entries = Array.from(thumbnailMemoryCache.entries()).slice(-120);
      entries.forEach(([k, v]) => {
        obj[k] = v;
      });
      localStorage.setItem(STORAGE_KEYS.THUMBNAILS, JSON.stringify(obj));
    } catch (e) {}
  }

  function setupThumbnailIntersectionObserver() {
    if (!('IntersectionObserver' in window)) return;
    if (thumbObserver) thumbObserver.disconnect();

    thumbObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          const key = card.getAttribute('data-video-key') || card.querySelector('[data-thumb-key]')?.getAttribute('data-thumb-key');
          if (key && !thumbnailMemoryCache.has(key)) {
            prioritizeThumbnailKey(key);
          }
        }
      });
    }, { rootMargin: '300px 0px' });
  }

  function prioritizeThumbnailKey(key) {
    const idx = thumbQueue.findIndex(v => v.key === key);
    if (idx > 0) {
      const item = thumbQueue.splice(idx, 1)[0];
      thumbQueue.unshift(item);
      dispatchThumbnailWorkers();
    }
  }

  function observeCardsForThumbnails() {
    if (!thumbObserver) {
      setupThumbnailIntersectionObserver();
    }
    if (!thumbObserver) return;
    const cards = document.querySelectorAll('.video-card, .up-next-card');
    cards.forEach(card => {
      const img = card.querySelector('.video-card__thumb-img, .up-next-card__thumb-img');
      if (img && img.style.display !== 'block') {
        thumbObserver.observe(card);
      }
    });
  }

  function queueThumbnailGeneration(videoItem) {
    if (state.customThumbnails && state.customThumbnails.has(videoItem.key)) {
      if (thumbnailMemoryCache.has(videoItem.key)) {
        videoItem.thumbnail = thumbnailMemoryCache.get(videoItem.key);
        updateCardThumbnails(videoItem.key, videoItem.thumbnail);
      }
      return;
    }
    if (thumbnailMemoryCache.has(videoItem.key)) {
      videoItem.thumbnail = thumbnailMemoryCache.get(videoItem.key);
      updateCardThumbnails(videoItem.key, videoItem.thumbnail);
      return;
    }
    if (!thumbQueue.some(v => v.key === videoItem.key)) {
      thumbQueue.push(videoItem);
    }
    dispatchThumbnailWorkers();
  }

  function dispatchThumbnailWorkers() {
    while (activeThumbWorkers < MAX_CONCURRENT_THUMBNAILS && thumbQueue.length > 0) {
      const nextVideo = thumbQueue.shift();
      if (nextVideo && nextVideo.file) {
        activeThumbWorkers++;
        generateSingleThumbnail(nextVideo).finally(() => {
          activeThumbWorkers--;
          dispatchThumbnailWorkers();
        });
      }
    }
  }

  function updateDurationLabels(videoKey, formattedDuration) {
    const durSpans = document.querySelectorAll(`[data-dur-key="${videoKey}"]`);
    durSpans.forEach(s => {
      s.textContent = formattedDuration;
    });
  }

  function generateSingleThumbnail(videoItem) {
    return new Promise((resolve) => {
      let url;
      try {
        url = URL.createObjectURL(videoItem.file);
      } catch (e) {
        return resolve();
      }

      const v = document.createElement('video');
      v.muted = true;
      v.preload = 'metadata';
      v.playsInline = true;

      let isFinished = false;
      const timeoutId = setTimeout(() => {
        cleanup();
      }, 1200);

      const cleanup = () => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(timeoutId);
        v.onloadedmetadata = null;
        v.onseeked = null;
        v.onerror = null;
        v.src = '';
        try { URL.revokeObjectURL(url); } catch (e) {}
        resolve();
      };

      const captureFrame = () => {
        if (isFinished) return;
        if (state.customThumbnails && state.customThumbnails.has(videoItem.key)) {
          cleanup();
          return;
        }
        try {
          if (v.duration && (!videoItem.duration || videoItem.duration === 0)) {
            videoItem.duration = v.duration;
            videoItem.formattedDuration = formatDuration(v.duration);
            updateDurationLabels(videoItem.key, videoItem.formattedDuration);
          }

          const canvas = elements.thumbGenCanvas || document.createElement('canvas');
          const ctx = canvas.getContext('2d', { alpha: false });
          canvas.width = 320;
          canvas.height = 180;

          ctx.drawImage(v, 0, 0, 320, 180);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);

          if (dataUrl && dataUrl.length > 100) {
            thumbnailMemoryCache.set(videoItem.key, dataUrl);
            videoItem.thumbnail = dataUrl;
            updateCardThumbnails(videoItem.key, dataUrl);
            saveThumbnailToIDB(videoItem.key, dataUrl);
            saveThumbnailCache();
          }
        } catch (err) {
          console.warn('Canvas thumbnail extraction warning:', err);
        }
        cleanup();
      };

      v.onseeked = captureFrame;

      v.onloadedmetadata = () => {
        try {
          const seekTime = Math.min(0.1, (v.duration || 1) * 0.05);
          if (typeof v.fastSeek === 'function') {
            v.fastSeek(seekTime);
          } else {
            v.currentTime = seekTime;
          }
        } catch (err) {
          captureFrame();
        }
      };

      v.onerror = () => {
        cleanup();
      };

      v.src = url;
    });
  }

  function updateCardThumbnails(videoKey, dataUrl) {
    const thumbImgs = document.querySelectorAll('.video-card__thumb-img, .up-next-card__thumb-img');
    thumbImgs.forEach(img => {
      if (img.getAttribute('data-thumb-key') === videoKey) {
        img.src = dataUrl;
        img.style.display = 'block';
        const placeholder = img.nextElementSibling;
        if (placeholder && placeholder.classList.contains('thumb-placeholder')) {
          placeholder.style.display = 'none';
        }
      }
    });
  }

  // ================= FILE & DIRECTORY PROCESSING =================
  const SUPPORTED_VIDEO_EXTS = ['.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v', '.ogg'];
  const SUPPORTED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.bmp'];

  function isVideoFile(name) {
    const lower = name.toLowerCase();
    return SUPPORTED_VIDEO_EXTS.some(ext => lower.endsWith(ext));
  }

  function isImageFile(name) {
    const lower = name.toLowerCase();
    return SUPPORTED_IMAGE_EXTS.some(ext => lower.endsWith(ext));
  }

  async function handleDirectorySelection() {
    if ('showDirectoryPicker' in window) {
      try {
        const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
        await processDirectoryHandle(dirHandle);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('showDirectoryPicker fallback to input:', err);
          elements.folderInput.click();
        }
      }
    } else {
      elements.folderInput.click();
    }
  }

  async function processDirectoryHandle(dirHandle) {
    state.directoryHandle = dirHandle;
    state.savedDirName = dirHandle.name;
    
    await saveDirectoryHandleToIDB(dirHandle);
    localStorage.setItem(STORAGE_KEYS.DIRECTORY_NAME, dirHandle.name);
    
    hideReconnectBanner();
    await scanDirectoryEntries(dirHandle);
  }

  async function scanDirectoryEntries(dirHandle) {
    const videoFiles = [];
    const imageFiles = [];
    
    async function readEntries(handle, path = '') {
      for await (const entry of handle.values()) {
        if (entry.kind === 'file') {
          if (isVideoFile(entry.name)) {
            const file = await entry.getFile();
            videoFiles.push({ file, path: path + entry.name });
          } else if (isImageFile(entry.name)) {
            const file = await entry.getFile();
            imageFiles.push({ file, path: path + entry.name, name: entry.name });
          }
        } else if (entry.kind === 'directory') {
          try {
            await readEntries(entry, path + entry.name + '/');
          } catch (e) {}
        }
      }
    }

    try {
      await readEntries(dirHandle);
      loadVideoFilesIntoState(videoFiles, dirHandle.name, imageFiles);
    } catch (err) {
      console.error('Error scanning directory entries:', err);
    }
  }

  function handleFileInputChange(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    const videoFiles = files
      .filter(f => isVideoFile(f.name))
      .map(f => ({ file: f, path: f.webkitRelativePath || f.name }));

    const imageFiles = files
      .filter(f => isImageFile(f.name))
      .map(f => ({ file: f, path: f.webkitRelativePath || f.name, name: f.name }));
    
    const folderName = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Uploaded Files';
    loadVideoFilesIntoState(videoFiles, folderName, imageFiles);
  }

  function loadVideoFilesIntoState(fileList, folderName, imageFiles = []) {
    state.videos = fileList.map((item, index) => {
      const title = cleanVideoTitle(item.file.name);
      const ext = (item.file.name.split('.').pop() || 'mp4').toUpperCase();
      const key = `local_${item.file.name}_${item.file.size}`;
      
      const videoObj = {
        key: key,
        name: item.file.name,
        title: title,
        _lowerTitle: title.toLowerCase(),
        _lowerName: item.file.name.toLowerCase(),
        file: item.file,
        path: item.path,
        size: item.file.size,
        formattedSize: formatBytes(item.file.size),
        duration: 0,
        formattedDuration: '0:00',
        ext: ext,
        isShort: false,
        channel: folderName || 'Local Library',
        color: getRandomColor(title),
        thumbnail: thumbnailMemoryCache.get(key) || null,
        url: null
      };

      // If an image with the same base name was downloaded alongside the video, auto-apply it
      if (!videoObj.thumbnail && imageFiles && imageFiles.length > 0) {
        const lastDot = item.file.name.lastIndexOf('.');
        const baseName = (lastDot > 0 ? item.file.name.substring(0, lastDot) : item.file.name).toLowerCase();
        const matchedImage = imageFiles.find(img => {
          const imgDot = img.name.lastIndexOf('.');
          const imgBase = (imgDot > 0 ? img.name.substring(0, imgDot) : img.name).toLowerCase();
          return imgBase === baseName || imgBase === `${baseName}-thumb` || imgBase === `${baseName}.poster` || imgBase === `${baseName}_thumbnail`;
        });

        if (matchedImage && matchedImage.file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target.result;
            setVideoCustomThumbnail(videoObj, dataUrl);
          };
          reader.readAsDataURL(matchedImage.file);
        }
      }

      // Probe duration & queue thumbnail
      probeVideoMetadata(videoObj);
      if (!state.customThumbnails.has(key)) {
        queueThumbnailGeneration(videoObj);
      }

      return videoObj;
    });

    elements.folderLabel.textContent = `📁 ${folderName} (${state.videos.length} videos)`;
    elements.statFolderName.textContent = folderName;
    if (elements.statTotalVideos) elements.statTotalVideos.textContent = `${state.videos.length} videos`;
    elements.statTotalSize.textContent = formatBytes(state.videos.reduce((acc, v) => acc + v.size, 0));
    if (elements.statTotalDuration) elements.statTotalDuration.textContent = calculateTotalRawVideoDuration();
    elements.statMemoryStatus.textContent = 'Active (IndexedDB)';
    elements.statMemoryStatus.classList.add('stats-value--active');

    returnToBrowseView();
    applyFiltersAndRender();
  }

  function probeVideoMetadata(videoObj) {
    if (!videoObj.file) return;
    let url;
    try {
      url = URL.createObjectURL(videoObj.file);
    } catch (e) {
      return;
    }

    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => {
      videoObj.duration = v.duration || 0;
      videoObj.formattedDuration = formatDuration(videoObj.duration);
      videoObj.isShort = (v.duration > 0 && v.duration <= 60) || (v.videoHeight > v.videoWidth);
      
      // Update rendered duration in DOM
      const durSpans = document.querySelectorAll('.video-card__duration, .up-next-card__duration');
      durSpans.forEach(s => {
        if (s.getAttribute('data-dur-key') === videoObj.key) {
          s.textContent = videoObj.formattedDuration;
        }
      });

      // Update total raw video duration in sidebar stats
      if (elements.statTotalDuration) {
        elements.statTotalDuration.textContent = calculateTotalRawVideoDuration();
      }
      
      try { URL.revokeObjectURL(url); } catch(e) {}
    };
    v.onerror = () => {
      try { URL.revokeObjectURL(url); } catch(e) {}
    };
    v.src = url;
  }

  // ================= RECONNECT BANNER =================
  async function checkSavedDirectoryMemory() {
    try {
      const savedDirName = localStorage.getItem(STORAGE_KEYS.DIRECTORY_NAME);
      const handle = await getDirectoryHandleFromIDB();
      
      if (handle && savedDirName) {
        state.savedDirName = savedDirName;
        state.directoryHandle = handle;
        elements.savedFolderNameLabel.textContent = savedDirName;
        elements.reconnectBanner.style.display = 'flex';
      }
    } catch (e) {
      console.warn('Memory check error:', e);
    }
  }

  async function handleReconnectClick() {
    if (!state.directoryHandle) return;
    try {
      const status = await state.directoryHandle.requestPermission({ mode: 'read' });
      if (status === 'granted') {
        hideReconnectBanner();
        await scanDirectoryEntries(state.directoryHandle);
      } else {
        alert('Permission was not granted to read the directory.');
      }
    } catch (err) {
      console.warn('Permission re-request failed:', err);
      elements.folderInput.click();
    }
  }

  async function handleForgetFolderClick() {
    await clearDirectoryHandleFromIDB();
    localStorage.removeItem(STORAGE_KEYS.DIRECTORY_NAME);
    state.directoryHandle = null;
    state.savedDirName = null;
    hideReconnectBanner();
    
    state.videos = [];
    state.filteredVideos = [];
    elements.folderLabel.textContent = 'No folder connected';
    elements.statFolderName.textContent = 'None';
    if (elements.statTotalVideos) elements.statTotalVideos.textContent = '0 videos';
    elements.statTotalSize.textContent = '0 MB';
    if (elements.statTotalDuration) elements.statTotalDuration.textContent = '0.0 hrs';
    elements.statMemoryStatus.textContent = 'Disconnected';
    elements.statMemoryStatus.classList.remove('stats-value--active');
    
    returnToBrowseView();
    applyFiltersAndRender();
  }

  function hideReconnectBanner() {
    elements.reconnectBanner.style.display = 'none';
  }

  // ================= FILTER BAR HORIZONTAL SCROLLING =================
  function setupFilterBarScrolling() {
    const chipsContainer = elements.filterChips;
    const btnLeft = elements.filterScrollLeft;
    const btnRight = elements.filterScrollRight;

    if (!chipsContainer || !btnLeft || !btnRight) return;

    function updateScrollArrows() {
      const scrollLeft = chipsContainer.scrollLeft;
      const maxScrollLeft = chipsContainer.scrollWidth - chipsContainer.clientWidth;
      
      btnLeft.classList.toggle('is-disabled', scrollLeft <= 2);
      btnRight.classList.toggle('is-disabled', scrollLeft >= maxScrollLeft - 2);
    }

    btnLeft.addEventListener('click', () => {
      chipsContainer.scrollBy({ left: -260, behavior: 'smooth' });
    });

    btnRight.addEventListener('click', () => {
      chipsContainer.scrollBy({ left: 260, behavior: 'smooth' });
    });

    chipsContainer.addEventListener('scroll', updateScrollArrows, { passive: true });
    window.addEventListener('resize', updateScrollArrows);

    // Initial check
    setTimeout(updateScrollArrows, 100);
  }

  function isShortVideo(videoObj) {
    if (!videoObj) return false;
    if (videoObj.isShort) return true;
    const tags = getVideoTags(videoObj.key);
    if (tags.some(t => {
      const tl = t.toLowerCase().trim();
      return tl === 'shorts' || tl === 'short' || tl === 'short shorts' || tl === 'shortshorts';
    })) {
      return true;
    }
    const titleLower = (videoObj.title || '').toLowerCase();
    const nameLower = (videoObj.name || '').toLowerCase();
    if (titleLower.includes('shorts') || titleLower.includes('short') || nameLower.includes('shorts') || nameLower.includes('short')) {
      return true;
    }
    return false;
  }

  // ================= FILTERING & SORTING =================
  function applyFiltersAndRender() {
    state.visibleVideoLimit = 36;
    // Directory View for All Channels
    if (state.currentView === 'all-channels') {
      if (elements.channelHeroBanner) elements.channelHeroBanner.style.display = 'none';
      if (elements.shortsFeedContainer) elements.shortsFeedContainer.style.display = 'none';
      if (elements.videoGrid) elements.videoGrid.style.display = 'none';
      if (elements.emptyState) elements.emptyState.classList.remove('is-visible');
      if (elements.allChannelsDirectory) elements.allChannelsDirectory.style.display = 'block';

      renderAllChannelsDirectory();
      updateSidebarStats();
      return;
    } else {
      if (elements.allChannelsDirectory) elements.allChannelsDirectory.style.display = 'none';
    }

    if (state.currentView === 'channel') {
      if (elements.channelHeroBanner) {
        elements.channelHeroBanner.style.display = 'block';
        renderChannelHeroBanner();
      }
    } else {
      if (elements.channelHeroBanner) {
        elements.channelHeroBanner.style.display = 'none';
      }
    }

    let list = [];
    
    if (state.currentView === 'history') {
      const hist = getWatchHistoryList();
      list = hist.map(h => {
        const existing = state.videos.find(v => v.key === h.key);
        return existing || {
          key: h.key,
          name: h.name,
          title: h.title,
          size: h.size,
          formattedSize: h.formattedSize,
          duration: h.duration,
          formattedDuration: h.formattedDuration,
          isShort: h.isShort,
          channel: h.channel || 'History Video',
          color: h.color || '#3ea6ff',
          lastWatched: h.lastWatched,
          isHistoryOnly: true
        };
      });
    } else {
      list = [...state.videos];
      
      // Filter by View
      if (state.currentView === 'all') {
        if (!state.currentTagFilter) {
          list = list.filter(v => !isShortVideo(v));
        }
      } else if (state.currentView === 'liked') {
        list = list.filter(v => state.likes.has(v.key));
      } else if (state.currentView === 'watch-later') {
        list = list.filter(v => state.watchLater.has(v.key));
      } else if (state.currentView === 'untagged') {
        list = list.filter(v => getVideoTags(v.key).length === 0);
      } else if (state.currentView === 'shorts') {
        list = list.filter(v => isShortVideo(v));
      } else if (state.currentView === 'playlist') {
        const pl = state.playlists.find(p => p.id === state.activePlaylistId);
        if (pl) {
          list = list.filter(v => pl.videoKeys.includes(v.key));
        } else {
          list = [];
        }
      } else if (state.currentView === 'channel') {
        list = list.filter(v => isVideoInChannel(v.key, state.activeChannelId));
      } else if (state.currentView === 'subscribed-channels') {
        list = list.filter(v => {
          const allChs = getAllVideoChannels(v.key);
          return allChs.some(c => state.subscriptions.has(c.id));
        });
      } else if (state.currentView === 'videos-without-channel') {
        list = list.filter(v => getAllVideoChannels(v.key).length === 0);
      }
    }

    // Filter by Custom Tag
    if (state.currentTagFilter) {
      const tagLower = state.currentTagFilter.toLowerCase().trim();
      const isShortsTagFilter = ['shorts', 'short', 'short shorts', 'shortshorts'].includes(tagLower);
      list = list.filter(v => {
        const tags = getVideoTags(v.key);
        const hasTag = tags.some(t => t.toLowerCase().trim() === tagLower);
        if (hasTag) return true;
        if (isShortsTagFilter && isShortVideo(v)) return true;
        return false;
      });
    }

    // Filter by Search Query (Matches Titles, File Names, Tags, AND Channel Names/Handles)
    if (state.searchQuery) {
      const rawQ = state.searchQuery.toLowerCase().trim();
      const rawQNoHash = rawQ.replace(/^#+/, '').trim();
      const rawQNoAt = rawQ.replace(/^@+/, '').trim();

      list = list.filter(v => {
        const titleLower = v._lowerTitle || (v._lowerTitle = (v.title || '').toLowerCase());
        if (titleLower.includes(rawQ) || (rawQNoHash && titleLower.includes(rawQNoHash))) {
          return true;
        }

        const nameLower = v._lowerName || (v._lowerName = (v.name || '').toLowerCase());
        if (nameLower.includes(rawQ) || (rawQNoHash && nameLower.includes(rawQNoHash))) {
          return true;
        }

        const tags = getVideoTags(v.key);
        if (tags.some(t => {
          const tLower = (t || '').toLowerCase().trim();
          const tWithHash = `#${tLower}`;
          return tLower.includes(rawQ) || (rawQNoHash && tLower.includes(rawQNoHash)) || tWithHash.includes(rawQ);
        })) {
          return true;
        }

        // Scan primary creator and all collaborator channel names and handles
        const allChs = getAllVideoChannels(v.key);
        return allChs.some(ch => {
          if (!ch) return false;
          const chName = (ch.name || '').toLowerCase();
          const chHandle = (ch.handle || '').toLowerCase();
          const chHandleNoAt = chHandle.replace(/^@+/, '');
          return (
            chName.includes(rawQ) ||
            (rawQNoHash && chName.includes(rawQNoHash)) ||
            chHandle.includes(rawQ) ||
            (rawQNoAt && chHandleNoAt.includes(rawQNoAt))
          );
        });
      });
    }

    // Sort or Shuffle
    if (state.isShuffled && state.currentView !== 'history') {
      state.videos.forEach(v => {
        if (!state.shuffleWeights.has(v.key)) {
          state.shuffleWeights.set(v.key, Math.random());
        }
      });
      list.sort((a, b) => {
        const wA = state.shuffleWeights.get(a.key) ?? 0;
        const wB = state.shuffleWeights.get(b.key) ?? 0;
        return wA - wB;
      });
    } else if (state.currentSort === 'name') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (state.currentSort === 'size') {
      list.sort((a, b) => b.size - a.size);
    } else if (state.currentSort === 'none') {
      // Smart Subscription Prioritization & Content Balancing Algorithm
      // Prioritizes subscribed channels, gives extra heavy boost on the first 2 loads,
      // and prioritizes subscribed channels with fewer content than channels with massive video libraries for a balanced share on screen.
      list.sort((a, b) => {
        function getSubScore(v) {
          const chs = getAllVideoChannels(v.key);
          let score = 0;
          chs.forEach(ch => {
            if (state.subscriptions.has(ch.id)) {
              let subBonus = 1500;
              if (state.appLoadCount <= 2) {
                subBonus += 5000;
              }
              const chVideos = getChannelVideos(ch.id).length;
              const rarityBonus = Math.round(1000 / (chVideos + 1));
              score = Math.max(score, subBonus + rarityBonus);
            }
          });
          return score;
        }
        const scoreA = getSubScore(a);
        const scoreB = getSubScore(b);
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        return 0;
      });
    }

    state.filteredVideos = list;
    
    updateSidebarStats();
    renderVideoGrid();

    // Trigger scroll arrows update after tags render
    setTimeout(() => {
      if (elements.filterChips) {
        const maxScroll = elements.filterChips.scrollWidth - elements.filterChips.clientWidth;
        elements.filterScrollLeft.classList.toggle('is-disabled', elements.filterChips.scrollLeft <= 2);
        elements.filterScrollRight.classList.toggle('is-disabled', elements.filterChips.scrollLeft >= maxScroll - 2);
      }
    }, 50);
  }

  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function randomizeShuffleWeights() {
    state.shuffleWeights.clear();
    state.videos.forEach(v => {
      state.shuffleWeights.set(v.key, Math.random());
    });
  }

  function toggleShuffle() {
    state.isShuffled = true;
    state.currentSort = 'none';

    elements.chipSortName?.classList.remove('is-active');
    elements.chipSortSize?.classList.remove('is-active');

    randomizeShuffleWeights();

    if (elements.shuffleStatusBadge) {
      elements.shuffleStatusBadge.style.display = 'inline-block';
    }
    
    elements.topbarShuffleBtn?.classList.add('is-active');
    elements.filterShuffleChip?.classList.add('is-active');
    
    if (elements.watchView && elements.watchView.style.display === 'block') {
      mixUpNext();
    }
    
    applyFiltersAndRender();
  }

  function updateSidebarStats() {
    const nonShortsCount = state.videos.filter(v => !isShortVideo(v)).length;
    if (elements.sideStatTotal) elements.sideStatTotal.textContent = nonShortsCount;
    if (elements.sideStatLiked) elements.sideStatLiked.textContent = state.likes.size;
    if (elements.sideStatWatchLater) elements.sideStatWatchLater.textContent = state.watchLater.size;
    
    // Calculate untagged count
    const untaggedCount = state.videos.filter(v => getVideoTags(v.key).length === 0).length;
    if (elements.sideStatUntagged) elements.sideStatUntagged.textContent = untaggedCount;
    
    if (elements.statTotalVideos) {
      elements.statTotalVideos.textContent = `${state.videos.length} videos`;
    }
    if (elements.statTotalDuration) {
      elements.statTotalDuration.textContent = calculateTotalRawVideoDuration();
    }

    updateHistoryCounter();
    if (elements.filterCountLabel) elements.filterCountLabel.textContent = `${state.filteredVideos.length} videos`;
    
    // View Title & Header Action Headers
    if (state.currentView === 'history') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'Watch History';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'block';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'liked') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'Liked Videos';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'watch-later') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'Watch Later';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'untagged') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'Untagged Videos';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'shorts') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'Shorts';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'playlist') {
      const pl = state.playlists.find(p => p.id === state.activePlaylistId);
      if (elements.viewTitle) elements.viewTitle.textContent = pl ? `Playlist: ${pl.name}` : 'Playlist';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'block';
    } else if (state.currentView === 'channel') {
      const ch = state.channels.find(c => c.id === state.activeChannelId);
      if (elements.viewTitle) elements.viewTitle.textContent = ch ? ch.name : 'Channel';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'all-channels') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'All Channels';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'subscribed-channels') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'Subscribed Channels';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else if (state.currentView === 'videos-without-channel') {
      if (elements.viewTitle) elements.viewTitle.textContent = 'Videos Without a Channel';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    } else {
      if (elements.viewTitle) elements.viewTitle.textContent = 'All Videos';
      if (elements.historyActionsHeader) elements.historyActionsHeader.style.display = 'none';
      if (elements.playlistActionsHeader) elements.playlistActionsHeader.style.display = 'none';
    }

    updateChannelStats();

    // Tag Filter Badge & Delete Tag Action Header
    if (state.currentTagFilter) {
      if (elements.tagFilterBadge) {
        elements.tagFilterBadge.textContent = `Tag: ${state.currentTagFilter}`;
        elements.tagFilterBadge.style.display = 'inline-block';
      }
      if (elements.tagActionsHeader) elements.tagActionsHeader.style.display = 'block';
    } else {
      if (elements.tagFilterBadge) {
        elements.tagFilterBadge.style.display = 'none';
      }
      if (elements.tagActionsHeader) elements.tagActionsHeader.style.display = 'none';
    }
  }

  // ================= DYNAMIC TAG CHIPS & TAG FILTERING =================
  function selectTagFilter(tag) {
    const cleanTag = (tag || '').replace(/^#+/, '').trim();
    if (!cleanTag) return;

    const allTags = getAllUniqueTags();
    const matched = allTags.find(t => t.toLowerCase() === cleanTag.toLowerCase());
    const finalTag = matched || cleanTag;

    state.currentTagFilter = finalTag;
    state.searchQuery = '';
    if (elements.searchInput) {
      elements.searchInput.value = '';
    }
    if (elements.searchClearBtn) {
      elements.searchClearBtn.style.display = 'none';
    }
    hideSearchSuggestions();

    if (elements.watchView && elements.watchView.style.display === 'block') {
      returnToBrowseView();
    }

    if (state.currentView === 'all-channels') {
      state.currentView = 'all';
    }

    renderDynamicTagChips();
    applyFiltersAndRender();

    setTimeout(() => {
      const container = elements.dynamicTagChips;
      if (container) {
        const activeChip = container.querySelector('.chip.is-active');
        if (activeChip) {
          activeChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    }, 50);

    showToast(`Filtered by tag #${finalTag}`);
  }

  function renderDynamicTagChips() {
    const container = elements.dynamicTagChips;
    if (!container) return;
    container.innerHTML = '';
    
    const uniqueTags = getAllUniqueTags();
    uniqueTags.forEach(tag => {
      const chip = document.createElement('button');
      chip.className = `chip chip--tag ${state.currentTagFilter === tag ? 'is-active' : ''}`;
      chip.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" stroke-width="2" fill="none"/></svg>
        <span>${tag}</span>
        <span class="chip-delete-tag" title="Delete #${tag} tag from all videos in your library" aria-label="Delete tag">&times;</span>
      `;
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.chip-delete-tag')) {
          e.stopPropagation();
          e.preventDefault();
          if (confirm(`Delete tag "#${tag}" from all videos in your library?`)) {
            deleteTagGlobally(tag);
          }
          return;
        }
        if (state.currentTagFilter === tag) {
          state.currentTagFilter = null;
          renderDynamicTagChips();
          applyFiltersAndRender();
        } else {
          selectTagFilter(tag);
        }
      });
      container.appendChild(chip);
    });
  }

  // ================= YOUTUBE SHORTS IMMERSIVE FEED =================
  let shortsObserver = null;
  const shortsObjectUrlsMap = new Map();

  function stopShortsFeed() {
    if (shortsObserver) {
      shortsObserver.disconnect();
      shortsObserver = null;
    }
    if (elements.shortsScrollViewport) {
      const vids = elements.shortsScrollViewport.querySelectorAll('video');
      vids.forEach(v => {
        try {
          v.pause();
          v.src = '';
          v.load();
        } catch (e) {}
      });
      elements.shortsScrollViewport.innerHTML = '';
      elements.shortsScrollViewport.onscroll = null;
    }
  }

  function getShuffledShortsList() {
    let list = state.filteredVideos.filter(v => isShortVideo(v));
    if (list.length === 0) {
      list = state.videos.filter(v => isShortVideo(v));
    }
    let shuffled = [...list];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function createShortCard(item, index) {
    const isLiked = state.likes.has(item.key);
    const isDisliked = state.dislikes.has(item.key);
    const isWatchLater = state.watchLater.has(item.key);
    const tags = getVideoTags(item.key);

    const card = document.createElement('div');
    card.className = 'short-card';
    card.setAttribute('data-video-key', item.key);
    card.setAttribute('data-index', index);

    let videoSrc = item.url;
    if (!videoSrc && item.file) {
      if (shortsObjectUrlsMap.has(item.key)) {
        videoSrc = shortsObjectUrlsMap.get(item.key);
      } else {
        try {
          videoSrc = URL.createObjectURL(item.file);
          shortsObjectUrlsMap.set(item.key, videoSrc);
        } catch (e) {
          videoSrc = '';
        }
      }
    } else if (!videoSrc && item.sampleUrl) {
      videoSrc = item.sampleUrl;
    }

    const tagsMarkup = tags.length > 0
      ? tags.map(t => `<span class="short-tag-pill">#${t}</span>`).join('')
      : `<span class="short-tag-pill">#shorts</span>`;

    card.innerHTML = `
      <!-- Symmetric Left Spacer (Balances External Right Side Actions) -->
      <div class="short-card__left-spacer" aria-hidden="true"></div>

      <div class="short-card__video-wrapper">
        <video class="short-card__video" src="${videoSrc || ''}" preload="metadata" loop playsinline></video>
        
        <div class="short-card__pause-indicator">
          <svg viewBox="0 0 24 24" width="32" height="32"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>
        </div>

        <!-- Bottom Metadata Overlay Inside Video Frame -->
        <div class="short-card__overlay-info">
          <div class="short-card__channel-row">
            <div class="short-card__avatar" style="background-color: ${item.color || '#3ea6ff'};">
              ${getInitials(item.title || item.name)}
            </div>
            <span class="short-card__channel-name">${item.channel || 'Channel'}</span>
          </div>
          <h3 class="short-card__title" title="${item.title}">${item.title}</h3>
          <div class="short-card__tags-row">
            ${tagsMarkup}
          </div>
        </div>

        <!-- Scrubber Progress Bar -->
        <div class="short-card__progress-bar">
          <div class="short-card__progress-fill"></div>
        </div>
      </div>

      <!-- External Side Action Bar on the Right (Outside Video Canvas) -->
      <div class="short-card__side-actions">
        <!-- Like -->
        <div class="short-action-btn-group">
          <button class="short-action-btn ${isLiked ? 'is-active' : ''}" data-action="short-like" title="${isLiked ? 'Unlike' : 'Like'}">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="2" fill="${isLiked ? 'currentColor' : 'none'}" stroke-linejoin="round"/></svg>
          </button>
          <span class="short-action-label">${isLiked ? 'Liked' : 'Like'}</span>
        </div>

        <!-- Dislike -->
        <div class="short-action-btn-group">
          <button class="short-action-btn ${isDisliked ? 'is-active' : ''}" data-action="short-dislike" title="${isDisliked ? 'Remove dislike' : 'Dislike'}">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" stroke="currentColor" stroke-width="2" fill="${isDisliked ? 'currentColor' : 'none'}" stroke-linejoin="round"/></svg>
          </button>
          <span class="short-action-label">Dislike</span>
        </div>

        <!-- Playlist -->
        <div class="short-action-btn-group">
          <button class="short-action-btn" data-action="short-playlist" title="Add to Playlist">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M19 11H5m14-4H5m14 8H5m14 4h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="18" x2="18" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
          <span class="short-action-label">Playlist</span>
        </div>

        <!-- Manage Tags -->
        <div class="short-action-btn-group">
          <button class="short-action-btn" data-action="short-tags" title="Edit Tags">
            <svg viewBox="0 0 24 24" width="22" height="22"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" stroke-width="2" fill="none"/><line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
          </button>
          <span class="short-action-label">Tags</span>
        </div>

        <!-- Sound Mute Toggle -->
        <div class="short-action-btn-group">
          <button class="short-action-btn" data-action="short-mute" title="Mute/Unmute">
            <svg class="icon-short-unmuted" viewBox="0 0 24 24" width="22" height="22" style="${state.isMuted ? 'display:none;' : 'display:block;'}"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            <svg class="icon-short-muted" viewBox="0 0 24 24" width="22" height="22" style="${state.isMuted ? 'display:block;' : 'display:none;'}"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"/><line x1="17" y1="9" x2="23" y2="15" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <span class="short-action-label">${state.isMuted ? 'Muted' : 'Sound'}</span>
        </div>
      </div>
    `;

    const v = card.querySelector('video');
    const fill = card.querySelector('.short-card__progress-fill');
    const pauseInd = card.querySelector('.short-card__pause-indicator');

    v.muted = state.isMuted;
    v.volume = state.volume;

    v.addEventListener('timeupdate', () => {
      if (v.duration > 0 && fill) {
        fill.style.width = `${(v.currentTime / v.duration) * 100}%`;
      }
    });

    const wrapper = card.querySelector('.short-card__video-wrapper');
    wrapper.addEventListener('click', (e) => {
      if (e.target.closest('.short-card__overlay-info')) return;
      if (v.paused) {
        v.play().catch(() => {});
        pauseInd.classList.remove('is-visible');
      } else {
        v.pause();
        pauseInd.classList.add('is-visible');
      }
    });

    card.addEventListener('click', (e) => {
      const likeBtn = e.target.closest('[data-action="short-like"]');
      if (likeBtn) {
        e.stopPropagation();
        toggleLike(item.key);
        renderShortsFeed();
        return;
      }
      const dislikeBtn = e.target.closest('[data-action="short-dislike"]');
      if (dislikeBtn) {
        e.stopPropagation();
        toggleDislike(item.key);
        renderShortsFeed();
        return;
      }
      const watchLaterBtn = e.target.closest('[data-action="short-watch-later"]');
      if (watchLaterBtn) {
        e.stopPropagation();
        toggleWatchLater(item.key);
        renderShortsFeed();
        return;
      }
      const playlistBtn = e.target.closest('[data-action="short-playlist"]');
      if (playlistBtn) {
        e.stopPropagation();
        openPlaylistModal(item);
        return;
      }
      const tagsBtn = e.target.closest('[data-action="short-tags"]');
      if (tagsBtn) {
        e.stopPropagation();
        openTagModal(item);
        return;
      }
      const muteBtn = e.target.closest('[data-action="short-mute"]');
      if (muteBtn) {
        e.stopPropagation();
        state.isMuted = !state.isMuted;
        document.querySelectorAll('.short-card video').forEach(vid => vid.muted = state.isMuted);
        renderShortsFeed();
        return;
      }
    });

    return card;
  }

  function renderShortsFeed() {
    const viewport = elements.shortsScrollViewport;
    if (!viewport) return;

    stopShortsFeed();

    const shortsList = getShuffledShortsList();

    if (shortsList.length === 0) {
      viewport.innerHTML = `
        <div class="empty-state is-visible" style="margin: 60px auto; text-align: center; max-width: 360px;">
          <div class="empty-state__icon-wrap">
            <svg viewBox="0 0 24 24" width="42" height="42"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
          </div>
          <h3 class="empty-state__title">No Shorts Found</h3>
          <p class="empty-state__desc" style="font-size: 13px; line-height: 1.5; color: var(--text-secondary);">
            Add the tag <strong>#shorts</strong> to any video in your library or upload short/vertical videos (&le;60s) to automatically watch them in this YouTube Shorts scroll feed!
          </p>
        </div>
      `;
      return;
    }

    shortsList.forEach((item, index) => {
      const card = createShortCard(item, index);
      viewport.appendChild(card);
    });

    // Infinite scroll / randomized playlist looping handler
    viewport.onscroll = () => {
      if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 150) {
        const nextBatch = getShuffledShortsList();
        nextBatch.forEach((item, bIndex) => {
          const card = createShortCard(item, viewport.children.length + bIndex);
          viewport.appendChild(card);
          if (shortsObserver) {
            shortsObserver.observe(card);
          }
        });
      }
    };

    // Intersection Observer for auto-playing active video on vertical scroll
    shortsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const card = entry.target;
        const v = card.querySelector('video');
        if (!v) return;

        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          v.play().then(() => {
            const key = card.getAttribute('data-video-key');
            const found = state.videos.find(x => x.key === key);
            if (found) {
              recordWatchHistory(found);
            }
          }).catch(() => {});
        } else {
          v.pause();
        }
      });
    }, {
      root: viewport,
      threshold: 0.5
    });

    viewport.querySelectorAll('.short-card').forEach(card => {
      shortsObserver.observe(card);
    });
  }

  // ================= MULTI-SELECT TOOL (Untagged & Videos Without Channel) =================
  function isMultiSelectEligibleView() {
    return state.currentView === 'untagged' || state.currentView === 'videos-without-channel';
  }

  function toggleVideoSelection(videoKey) {
    if (!isMultiSelectEligibleView()) return;
    if (state.selectedVideoKeys.has(videoKey)) {
      state.selectedVideoKeys.delete(videoKey);
    } else {
      state.selectedVideoKeys.add(videoKey);
    }

    const cards = document.querySelectorAll(`.video-card[data-video-key="${CSS.escape(videoKey)}"], .video-card[data-key="${CSS.escape(videoKey)}"]`);
    cards.forEach(c => {
      const isSel = state.selectedVideoKeys.has(videoKey);
      c.classList.toggle('is-selected', isSel);
      const badge = c.querySelector('.video-card__select-badge');
      if (badge) {
        badge.classList.toggle('is-selected', isSel);
      }
    });

    updateMultiSelectBar();
  }

  function selectAllVideosInView() {
    if (!isMultiSelectEligibleView()) return;
    state.filteredVideos.forEach(v => {
      state.selectedVideoKeys.add(v.key);
    });

    const cards = document.querySelectorAll('.video-card');
    cards.forEach(c => {
      const k = c.getAttribute('data-video-key') || c.getAttribute('data-key');
      if (k && state.selectedVideoKeys.has(k)) {
        c.classList.add('is-selected');
        const badge = c.querySelector('.video-card__select-badge');
        if (badge) badge.classList.add('is-selected');
      }
    });

    updateMultiSelectBar();
    showToast(`Selected all ${state.selectedVideoKeys.size} videos in view`);
  }

  function clearVideoSelection() {
    state.selectedVideoKeys.clear();
    document.querySelectorAll('.video-card.is-selected').forEach(c => {
      c.classList.remove('is-selected');
      const badge = c.querySelector('.video-card__select-badge');
      if (badge) badge.classList.remove('is-selected');
    });
    updateMultiSelectBar();
  }

  function updateMultiSelectBar() {
    if (!isMultiSelectEligibleView() || state.selectedVideoKeys.size === 0) {
      if (elements.multiSelectBar) elements.multiSelectBar.style.display = 'none';
      document.body.classList.remove('has-selected-videos');
      return;
    }

    document.body.classList.add('has-selected-videos');
    if (elements.multiSelectBar) {
      elements.multiSelectBar.style.display = 'block';
    }
    if (elements.multiSelectCount) {
      const count = state.selectedVideoKeys.size;
      elements.multiSelectCount.textContent = `${count} video${count === 1 ? '' : 's'} selected`;
    }
  }

  // ================= RENDER VIDEO GRID =================
  function renderVideoGrid() {
    if (state.currentView === 'shorts') {
      elements.emptyState.classList.remove('is-visible');
      if (elements.videoGrid) elements.videoGrid.style.display = 'none';
      if (elements.shortsFeedContainer) elements.shortsFeedContainer.style.display = 'flex';
      renderShortsFeed();
      return;
    } else {
      stopShortsFeed();
      if (elements.shortsFeedContainer) elements.shortsFeedContainer.style.display = 'none';
    }

    const grid = elements.videoGrid;
    grid.innerHTML = '';

    if (state.filteredVideos.length === 0) {
      if (state.videos.length === 0 && state.currentView !== 'history') {
        elements.emptyState.classList.add('is-visible');
        grid.style.display = 'none';
      } else {
        elements.emptyState.classList.remove('is-visible');
        grid.style.display = 'block';
        let emptyMessage = 'Try changing your search query or selecting a different filter chip.';
        if (state.currentView === 'history') emptyMessage = 'Your watch history is currently empty.';
        if (state.currentView === 'liked') emptyMessage = 'You have not liked any videos yet. Click the Like button on any video to add it here.';
        if (state.currentView === 'watch-later') emptyMessage = 'Your Watch Later list is empty. Click Save to Watch Later on any video.';
        if (state.currentView === 'untagged') emptyMessage = 'All videos in your library have tags assigned! Great organization.';
        if (state.currentView === 'playlist') emptyMessage = 'This playlist has no videos yet. Add videos by clicking "Save" on the watch page or card menu.';
        if (state.currentView === 'channel') emptyMessage = 'This channel has no videos yet. Click "+ Add Videos" above or use the 3 dots menu on any video.';
        if (state.currentView === 'subscribed-channels') emptyMessage = 'No videos found from subscribed channels. Subscribe to channels to see their videos here!';
        if (state.currentView === 'videos-without-channel') emptyMessage = 'All videos in your library are assigned to channels! Great organization.';

        grid.innerHTML = `
          <div class="empty-state is-visible" style="margin: 40px auto;">
            <div class="empty-state__icon-wrap">
              <svg viewBox="0 0 24 24" width="42" height="42"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2"/></svg>
            </div>
            <h3 class="empty-state__title">No videos found</h3>
            <p class="empty-state__desc">${emptyMessage}</p>
          </div>
        `;
      }
      return;
    }

    elements.emptyState.classList.remove('is-visible');
    grid.style.display = 'grid';

    // If searching, check for matching Channel Profile Result Card to display on top
    if (state.searchQuery) {
      const rawQ = state.searchQuery.toLowerCase().trim();
      const rawQNoHash = rawQ.replace(/^#+/, '').trim();
      const rawQNoAt = rawQ.replace(/^@+/, '').trim();

      const matchingChannels = state.channels.filter(ch => {
        const cName = (ch.name || '').toLowerCase();
        const cHandle = (ch.handle || '').toLowerCase();
        const cHandleNoAt = cHandle.replace(/^@+/, '');
        return (
          cName.includes(rawQ) ||
          (rawQNoHash && cName.includes(rawQNoHash)) ||
          cHandle.includes(rawQ) ||
          (rawQNoAt && cHandleNoAt.includes(rawQNoAt))
        );
      });

      matchingChannels.forEach(ch => {
        const isSub = isSubscribed(ch.id);
        const chVideosCount = getChannelVideos(ch.id).length;
        const channelCard = document.createElement('div');
        channelCard.className = 'search-channel-result-card';
        channelCard.innerHTML = `
          <div class="search-channel-result-avatar" style="${ch.logo ? '' : `background-color: ${ch.color || '#ff0000'};`}" data-action="visit-channel" data-channel-id="${ch.id}">
            ${ch.logo ? `<img src="${ch.logo}" alt="${ch.name}">` : getInitials(ch.name)}
          </div>
          <div class="search-channel-result-info">
            <div class="search-channel-result-title-row">
              <h3 class="search-channel-result-name" data-action="visit-channel" data-channel-id="${ch.id}">${ch.name}</h3>
              <span class="search-channel-badge">Channel</span>
            </div>
            <div class="search-channel-result-meta">
              <span>${ch.handle || '@channel'}</span>
              <span>•</span>
              <span>${chVideosCount} video${chVideosCount === 1 ? '' : 's'}</span>
              <span>•</span>
              <span>${isSub ? 'Subscribed' : 'Offline Channel'}</span>
            </div>
            <p class="search-channel-result-desc">${escapeHtml(ch.description || '')}</p>
          </div>
          <div class="search-channel-result-actions">
            <button class="btn btn--secondary btn--sm" data-action="visit-channel" data-channel-id="${ch.id}">Visit Channel</button>
            <button class="watch-subscribe-btn ${isSub ? 'is-subscribed' : ''}" data-action="toggle-channel-sub" data-channel-id="${ch.id}">
              <svg viewBox="0 0 24 24" width="14" height="14" class="sub-bell-icon"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" stroke-width="2"/></svg>
              <span>${isSub ? 'Subscribed' : 'Subscribe'}</span>
            </button>
          </div>
        `;

        channelCard.querySelectorAll('[data-action="visit-channel"]').forEach(el => {
          el.addEventListener('click', () => openChannelPage(ch.id));
        });
        channelCard.querySelector('[data-action="toggle-channel-sub"]')?.addEventListener('click', () => {
          toggleSubscribe(ch.id);
        });

        grid.appendChild(channelCard);
      });
    }

    const batchVideos = state.filteredVideos.slice(0, state.visibleVideoLimit);
    batchVideos.forEach((item) => {
      const channel = getVideoChannel(item.key);
      const collabs = getVideoCollabs(item.key);
      const allChannels = getAllVideoChannels(item.key);
      const isLiked = state.likes.has(item.key);
      const isWatchLater = state.watchLater.has(item.key);
      const tags = getVideoTags(item.key);
      const progress = getVideoProgress(item.key);
      
      let progressPercent = 0;
      if (progress && progress.duration > 0 && progress.currentTime > 2) {
        progressPercent = Math.min(100, Math.max(0, (progress.currentTime / progress.duration) * 100));
      }

      const card = document.createElement('div');
      card.className = 'video-card';
      card.setAttribute('data-video-key', item.key);
      card.setAttribute('data-key', item.key);
      const isSelected = isMultiSelectEligibleView() && state.selectedVideoKeys.has(item.key);
      if (isSelected) {
        card.classList.add('is-selected');
      }
      
      const tagsMarkup = tags.map(t => `<span class="video-tag-pill" data-tag="${t}">#${t}</span>`).join('');

      let avatarMarkup = '';
      let channelNamesMarkup = '';
      let channelPillMarkup = '';

      if (allChannels.length > 1) {
        // Multi-creator YouTube Collab Avatar Stack
        const prim = allChannels[0];
        const collab1 = allChannels[1];
        avatarMarkup = `
          <div class="video-card__avatar-collab-stack" title="Collaborators: ${allChannels.map(c => c.name).join(' & ')}">
            <div class="video-card__avatar-collab-item video-card__avatar-collab-item--primary" data-action="open-channel" data-channel-id="${prim.id}" style="${prim.logo ? '' : `background-color: ${prim.color || '#ff0000'};`}" title="Primary: ${prim.name}">
              ${prim.logo ? `<img src="${prim.logo}" alt="${prim.name}">` : getInitials(prim.name)}
            </div>
            <div class="video-card__avatar-collab-item video-card__avatar-collab-item--collab" data-action="open-channel" data-channel-id="${collab1.id}" style="${collab1.logo ? '' : `background-color: ${collab1.color || '#ff9800'};`}" title="Collab: ${collab1.name}">
              ${collab1.logo ? `<img src="${collab1.logo}" alt="${collab1.name}">` : getInitials(collab1.name)}
            </div>
          </div>
        `;

        channelNamesMarkup = `
          <div class="video-card__channel-collab-names">
            <span class="video-card__channel video-card__channel--link" data-action="open-channel" data-channel-id="${prim.id}" title="Go to ${prim.name}">${prim.name}</span>
            <span class="collab-divider">×</span>
            <span class="video-card__channel video-card__channel--link" data-action="open-channel" data-channel-id="${collab1.id}" title="Go to ${collab1.name}">${collab1.name}</span>
            ${allChannels.length > 2 ? `<span class="collab-more-count">+${allChannels.length - 2}</span>` : ''}
          </div>
        `;

        channelPillMarkup = `
          <button class="video-card__edit-channel-btn is-assigned" data-action="assign-channel" title="Collabs: ${allChannels.map(c => c.name).join(' × ')} (Click to edit)">
            <span class="video-card__channel-dot" style="background-color: ${prim.color || '#ff0000'};"></span>
            <span class="video-card__channel-btn-text">${prim.name}</span>
            <span class="collab-badge-chip">🤝 Collab (${allChannels.length})</span>
          </button>
        `;
      } else if (allChannels.length === 1) {
        const ch = allChannels[0];
        avatarMarkup = `
          <div class="video-card__avatar video-card__avatar--channel" data-action="open-channel" data-channel-id="${ch.id}" style="${ch.logo ? '' : `background-color: ${ch.color || '#ff0000'};`}" title="Go to ${ch.name}">
            ${ch.logo ? `<img src="${ch.logo}" alt="${ch.name}" class="channel-card-avatar-img">` : getInitials(ch.name)}
          </div>
        `;
        const isSub = isSubscribed(ch.id);
        channelNamesMarkup = `
          <span class="video-card__channel video-card__channel--link" data-action="open-channel" data-channel-id="${ch.id}" title="Go to ${ch.name}">${ch.name}</span>
          ${isSub ? `<span class="video-card__sub-pill" title="Subscribed Channel">★ Subscribed</span>` : ''}
        `;
        channelPillMarkup = `
          <button class="video-card__edit-channel-btn is-assigned" data-action="assign-channel" title="Channel: ${ch.name} (Click to change/add collabs)">
            <span class="video-card__channel-dot" style="background-color: ${ch.color || '#ff0000'};"></span>
            <span class="video-card__channel-btn-text">${ch.name}</span>
          </button>
        `;
      } else {
        avatarMarkup = `
          <div class="video-card__avatar video-card__avatar--no-channel" data-action="assign-channel" title="No channel (Click to assign)" style="background-color: #383838; color: #888888; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/></svg>
          </div>
        `;
        channelNamesMarkup = `
          <span class="video-card__channel video-card__channel--none video-card__channel--empty" data-action="assign-channel" title="Click to assign to a channel">No Channel</span>
        `;
        channelPillMarkup = `
          <button class="video-card__edit-channel-btn" data-action="assign-channel" title="Add to Channel / Collabs">
            <svg viewBox="0 0 24 24" width="10" height="10" style="vertical-align: -1px; margin-right: 2px;"><path d="M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 12H4V9h16v10zM10 10.5v7l6-3.5z" fill="currentColor"/></svg>+ Channel
          </button>
        `;
      }

      card.innerHTML = `
        <div class="video-card__thumb-wrap">
          <img class="video-card__thumb-img" data-thumb-key="${item.key}" src="${item.thumbnail || ''}" style="${item.thumbnail ? 'display:block;' : 'display:none;'}" alt="${item.title}">
          <div class="video-card__thumb-placeholder thumb-placeholder" style="${item.thumbnail ? 'display:none;' : 'display:flex;'}">
            <svg viewBox="0 0 24 24" width="36" height="36"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
          </div>
          <span class="video-card__duration" data-dur-key="${item.key}">${item.formattedDuration || '0:00'}</span>
          
          <!-- Multi-Select Checkbox Badge (Only in Untagged & Without Channel tabs) -->
          ${isMultiSelectEligibleView() ? `
            <div class="video-card__select-badge ${isSelected ? 'is-selected' : ''}" data-action="toggle-select" title="Right-click to select / deselect">
              <svg viewBox="0 0 24 24" width="14" height="14"><polyline points="20 6 9 17 4 12" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          ` : ''}

          <!-- Quick Upload Thumbnail Button on Thumbnail Hover -->
          <button class="video-card__thumb-upload-btn" data-action="upload-thumbnail" title="Upload original YouTube image / thumbnail" aria-label="Upload original image">
            <svg viewBox="0 0 24 24" width="13" height="13"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" stroke="currentColor" stroke-width="2" fill="none"/></svg>
            <span>Upload Image</span>
          </button>

          <!-- Progress Bar on bottom of thumbnail -->
          ${progressPercent > 0 ? `
            <div class="video-card__progress">
              <div class="video-card__progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          ` : ''}
          
          <!-- Quick Like Button on Thumbnail -->
          <button class="video-card__fav-btn ${isLiked ? 'is-fav' : ''}" data-action="like-btn" title="${isLiked ? 'Unlike' : 'Like video'}" aria-label="Like">
            <svg viewBox="0 0 24 24" width="16" height="16"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" stroke="currentColor" stroke-width="2" fill="${isLiked ? 'currentColor' : 'none'}" stroke-linejoin="round"/></svg>
          </button>

          <!-- Three-dot Options Menu (⋮) on top-right of thumbnail -->
          <div class="video-card__more-wrap">
            <button class="video-card__more-btn" data-action="more-menu" title="More options" aria-label="More options">
              <svg viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="5" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="19" r="2" fill="currentColor"/></svg>
            </button>
            <div class="video-card__dropdown">
              <button class="dropdown-item" data-action="upload-thumbnail-menu">
                <svg viewBox="0 0 24 24" width="15" height="15"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/><polyline points="21 15 16 10 5 21" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                <span>Upload Original Image</span>
              </button>
              <button class="dropdown-item" data-action="watch-later-menu">
                <svg viewBox="0 0 24 24" width="15" height="15"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="12 6 12 12 16 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <span>${isWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later'}</span>
              </button>
              <button class="dropdown-item" data-action="playlist-menu">
                <svg viewBox="0 0 24 24" width="15" height="15"><path d="M19 11H5m14-4H5m14 8H5m14 4h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18" y1="18" x2="18" y2="22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="20" x2="20" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                <span>Save to Playlist</span>
              </button>
              <button class="dropdown-item" data-action="channel-menu">
                <svg viewBox="0 0 24 24" width="15" height="15"><path d="M20 7H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2zm0 12H4V9h16v10zM10 10.5v7l6-3.5z" fill="currentColor"/></svg>
                <span>${allChannels.length > 0 ? 'Channel & Collabs' : 'Add to Channel'}</span>
              </button>
              <button class="dropdown-item" data-action="edit-tags-menu">
                <svg viewBox="0 0 24 24" width="15" height="15"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="currentColor" stroke-width="2" fill="none"/><line x1="7" y1="7" x2="7.01" y2="7" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>
                <span>Edit Tags</span>
              </button>
            </div>
          </div>

          <!-- History Remove Button (if in history view) -->
          ${state.currentView === 'history' ? `
            <button class="video-card__remove-history-btn" data-action="remove-history" title="Remove from watch history" aria-label="Remove from history">
              <svg viewBox="0 0 24 24" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2"/></svg>
            </button>
          ` : ''}

          <div class="video-card__play-badge">
            <svg viewBox="0 0 24 24" width="22" height="22"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>
          </div>
        </div>

        <div class="video-card__details">
          ${avatarMarkup}
          <div class="video-card__meta">
            <h3 class="video-card__title" title="${item.title}">${item.title}</h3>
            ${channelNamesMarkup}
            <div class="video-card__submeta">
              <span>${item.formattedSize}</span>
              ${item.lastWatched ? `<span>• Watched ${formatTimeAgo(item.lastWatched)}</span>` : `<span>• ${item.ext}</span>`}
            </div>

            <!-- Tags & Channel Row -->
            <div class="video-card__tags-row">
              ${tagsMarkup}
              <button class="video-card__edit-tag-btn" data-action="edit-tags" title="Edit tags">+ Tag</button>
              ${channelPillMarkup}
            </div>
          </div>
        </div>
      `;

      // Context menu event for right-click multi-selection
      card.addEventListener('contextmenu', (e) => {
        if (isMultiSelectEligibleView()) {
          e.preventDefault();
          e.stopPropagation();
          toggleVideoSelection(item.key);
        }
      });

      // Event handlers on card
      card.addEventListener('click', (e) => {
        // Multi-select toggle button on thumbnail
        const selectBtn = e.target.closest('[data-action="toggle-select"]');
        if (selectBtn && isMultiSelectEligibleView()) {
          e.stopPropagation();
          toggleVideoSelection(item.key);
          return;
        }

        // Channel click (Avatar or Name) -> Open Channel Page
        const openChannelBtn = e.target.closest('[data-action="open-channel"]');
        if (openChannelBtn) {
          e.stopPropagation();
          const chId = openChannelBtn.getAttribute('data-channel-id');
          if (chId) {
            openChannelPage(chId);
          }
          return;
        }

        // Unassigned channel click -> Assign to channel
        const assignChannelBtn = e.target.closest('[data-action="assign-channel"]');
        if (assignChannelBtn) {
          e.stopPropagation();
          openAssignChannelModal(item);
          return;
        }

        // Upload thumbnail button on hover or dropdown item
        const uploadThumbBtn = e.target.closest('[data-action="upload-thumbnail"], [data-action="upload-thumbnail-menu"]');
        if (uploadThumbBtn) {
          e.stopPropagation();
          card.querySelector('.video-card__more-wrap')?.classList.remove('is-open');
          openUploadThumbnailModal(item);
          return;
        }

        // More menu toggle
        const moreBtn = e.target.closest('[data-action="more-menu"]');
        if (moreBtn) {
          e.stopPropagation();
          const moreWrap = card.querySelector('.video-card__more-wrap');
          document.querySelectorAll('.video-card__more-wrap.is-open').forEach(w => {
            if (w !== moreWrap) w.classList.remove('is-open');
          });
          moreWrap.classList.toggle('is-open');
          return;
        }

        // Channel item in dropdown
        const channelMenu = e.target.closest('[data-action="channel-menu"]');
        if (channelMenu) {
          e.stopPropagation();
          card.querySelector('.video-card__more-wrap')?.classList.remove('is-open');
          openAssignChannelModal(item);
          return;
        }

        // Watch Later item in dropdown
        const watchLaterMenu = e.target.closest('[data-action="watch-later-menu"]');
        if (watchLaterMenu) {
          e.stopPropagation();
          card.querySelector('.video-card__more-wrap')?.classList.remove('is-open');
          toggleWatchLater(item.key);
          return;
        }

        // Playlist item in dropdown
        const playlistMenu = e.target.closest('[data-action="playlist-menu"]');
        if (playlistMenu) {
          e.stopPropagation();
          card.querySelector('.video-card__more-wrap')?.classList.remove('is-open');
          openPlaylistModal(item);
          return;
        }

        // Edit tags item in dropdown
        const editTagsMenu = e.target.closest('[data-action="edit-tags-menu"]');
        if (editTagsMenu) {
          e.stopPropagation();
          card.querySelector('.video-card__more-wrap')?.classList.remove('is-open');
          openTagModal(item);
          return;
        }

        // Like button on card thumbnail
        const likeBtn = e.target.closest('[data-action="like-btn"]');
        if (likeBtn) {
          e.stopPropagation();
          toggleLike(item.key);
          return;
        }

        // Remove history
        const removeHistBtn = e.target.closest('[data-action="remove-history"]');
        if (removeHistBtn) {
          e.stopPropagation();
          removeHistoryItem(item.key);
          return;
        }

        // Tag edit button
        const editTagBtn = e.target.closest('[data-action="edit-tags"]');
        if (editTagBtn) {
          e.stopPropagation();
          openTagModal(item);
          return;
        }

        // Tag pill click
        const tagPill = e.target.closest('.video-tag-pill');
        if (tagPill) {
          e.stopPropagation();
          selectTagFilter(tagPill.getAttribute('data-tag'));
          return;
        }

        // If multi-select is active in eligible view, clicking card body toggles selection
        if (isMultiSelectEligibleView() && state.selectedVideoKeys.size > 0) {
          toggleVideoSelection(item.key);
          return;
        }

        // Open in Watch Page View
        playVideoFromCard(item);
      });

      // Drag and drop image file directly onto card to set as original YouTube thumbnail
      card.addEventListener('dragover', (e) => {
        if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) {
          e.preventDefault();
          e.stopPropagation();
          card.classList.add('is-drag-over');
        }
      });
      card.addEventListener('dragleave', (e) => {
        e.stopPropagation();
        card.classList.remove('is-drag-over');
      });
      card.addEventListener('drop', (e) => {
        card.classList.remove('is-drag-over');
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const file = e.dataTransfer.files[0];
          if (file.type.startsWith('image/') || isImageFile(file.name)) {
            e.preventDefault();
            e.stopPropagation();
            applyImageFileAsThumbnail(item, file);
          }
        }
      });

      grid.appendChild(card);
    });

    if (state.filteredVideos.length > state.visibleVideoLimit) {
      const remainingCount = state.filteredVideos.length - state.visibleVideoLimit;
      const loadMoreDiv = document.createElement('div');
      loadMoreDiv.className = 'load-more-grid-container';
      loadMoreDiv.style.cssText = 'grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; gap: 12px;';
      loadMoreDiv.innerHTML = `
        <p style="color: var(--text-secondary); font-size: 13px; font-weight: 500; margin: 0;">
          Showing <strong style="color: var(--text-primary);">${batchVideos.length}</strong> of <strong style="color: var(--text-primary);">${state.filteredVideos.length}</strong> videos (${remainingCount} more available)
        </p>
        <button type="button" id="loadMoreBatchBtn" class="btn btn--secondary" style="padding: 10px 28px; font-weight: 600; font-size: 13px; cursor: pointer;">
          Load More Videos
        </button>
      `;
      loadMoreDiv.querySelector('#loadMoreBatchBtn').addEventListener('click', () => {
        state.visibleVideoLimit += 36;
        renderVideoGrid();
      });
      grid.appendChild(loadMoreDiv);
    }

    observeCardsForThumbnails();
    updateMultiSelectBar();
  }

  function updateCardActionsInDOM(key) {
    const isLiked = state.likes.has(key);
    const isWatchLater = state.watchLater.has(key);
    const cards = document.querySelectorAll('.video-card');
    cards.forEach(card => {
      if (card.getAttribute('data-video-key') === key) {
        const likeBtns = card.querySelectorAll('[data-action="like-btn"]');
        likeBtns.forEach(btn => {
          btn.classList.toggle('is-fav', isLiked);
          btn.title = isLiked ? 'Unlike' : 'Like video';
          const path = btn.querySelector('path');
          if (path) path.setAttribute('fill', isLiked ? 'currentColor' : 'none');
        });
        const watchLaterSpan = card.querySelector('[data-action="watch-later-menu"] span');
        if (watchLaterSpan) {
          watchLaterSpan.textContent = isWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later';
        }
      }
    });
  }

  function playVideoFromCard(item) {
    let idx = state.videos.findIndex(v => v.key === item.key);
    if (idx === -1) {
      idx = state.videos.length;
      state.videos.push(item);
    }
    openWatchView(idx);
  }

  // ================= WATCH PAGE VIEW =================
  function openWatchView(videoIndex, autoResume = true) {
    if (videoIndex < 0 || videoIndex >= state.videos.length) return;
    
    const videoItem = state.videos[videoIndex];
    state.activeVideoIndex = videoIndex;
    state.activeVideo = videoItem;

    elements.browseView.style.display = 'none';
    elements.watchView.style.display = 'block';
    if (elements.topbarBackBtn) elements.topbarBackBtn.style.display = 'inline-flex';
    if (elements.topbarShuffleBtn) elements.topbarShuffleBtn.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    elements.watchTitle.textContent = videoItem.title;
    elements.watchTitle.title = videoItem.title;
    updateWatchChannelInfo(videoItem);
    elements.watchFileExtBadge.textContent = videoItem.ext;
    elements.watchFileSize.textContent = videoItem.formattedSize;
    elements.watchDurationLabel.textContent = videoItem.formattedDuration || '0:00';
    elements.watchFileNameLabel.textContent = videoItem.name;

    renderWatchTagsRow(videoItem);
    updateWatchViewActions();
    recordWatchHistory(videoItem);

    let videoUrl = videoItem.url;
    if (!videoUrl && videoItem.file) {
      videoUrl = URL.createObjectURL(videoItem.file);
      videoItem.url = videoUrl;
    } else if (!videoUrl && videoItem.sampleUrl) {
      videoUrl = videoItem.sampleUrl;
      videoItem.url = videoUrl;
    }

    if (videoUrl) {
      elements.mainVideo.src = videoUrl;
      
      if (autoResume) {
        const savedProgress = getVideoProgress(videoItem.key);
        if (savedProgress && savedProgress.currentTime > 2 && savedProgress.currentTime < (savedProgress.duration - 5)) {
          elements.mainVideo.currentTime = savedProgress.currentTime;
          showResumeToast(savedProgress.currentTime);
        }
      }
      
      elements.mainVideo.play().then(() => {
        setPlayingState(true);
      }).catch(() => {
        setPlayingState(false);
      });
    }

    renderUpNextList();
  }

  function updateWatchViewActions() {
    if (!state.activeVideo) return;
    const isLiked = state.likes.has(state.activeVideo.key);
    const isDisliked = state.dislikes.has(state.activeVideo.key);
    const isWatchLater = state.watchLater.has(state.activeVideo.key);

    // Segmented Like
    elements.watchLikeBtn.classList.toggle('is-active', isLiked);
    elements.watchLikeCount.textContent = isLiked ? 'Liked' : 'Like';

    // Segmented Dislike
    elements.watchDislikeBtn.classList.toggle('is-active', isDisliked);

    // Watch Later
    elements.watchLaterBtn.classList.toggle('is-active', isWatchLater);
    elements.watchLaterLabel.textContent = isWatchLater ? 'Saved to Watch Later' : 'Watch Later';
  }

  function renderWatchTagsRow(videoItem) {
    const container = elements.watchTagsContainer;
    if (!container) return;
    container.innerHTML = '';
    
    const tags = getVideoTags(videoItem.key);
    
    tags.forEach(tag => {
      const pill = document.createElement('div');
      pill.className = 'watch-tag-chip';
      pill.innerHTML = `
        <span class="watch-tag-name" title="Filter by #${tag}">#${tag}</span>
        <button class="watch-tag-remove-btn" data-tag="${tag}" title="Remove tag ${tag}" aria-label="Remove tag">&times;</button>
      `;
      
      pill.querySelector('.watch-tag-name').addEventListener('click', (e) => {
        e.stopPropagation();
        selectTagFilter(tag);
      });

      pill.querySelector('.watch-tag-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTagFromActiveVideo(tag);
      });

      container.appendChild(pill);
    });

    hideInlineTagInput();
  }

  function removeTagFromActiveVideo(tagName) {
    if (!state.activeVideo || !tagName) return;
    const existing = getVideoTags(state.activeVideo.key);
    const updated = existing.filter(t => t !== tagName);
    setVideoTags(state.activeVideo.key, updated);
    renderWatchTagsRow(state.activeVideo);
  }

  function addTagToActiveVideo(tagName) {
    if (!state.activeVideo || !tagName) return;
    const cleanTag = tagName.trim().replace(/^#+/, '');
    if (!cleanTag) return;

    const existing = getVideoTags(state.activeVideo.key);
    if (!existing.includes(cleanTag)) {
      existing.push(cleanTag);
      setVideoTags(state.activeVideo.key, existing);
      renderWatchTagsRow(state.activeVideo);
    }
    hideInlineTagInput();
  }

  function showInlineTagInput() {
    elements.inlineAddTagBtn.style.display = 'none';
    elements.inlineTagInputBox.style.display = 'inline-flex';
    elements.inlineTagInput.value = '';
    elements.inlineTagInput.focus();
  }

  function hideInlineTagInput() {
    if (elements.inlineAddTagBtn) elements.inlineAddTagBtn.style.display = 'inline-flex';
    if (elements.inlineTagInputBox) elements.inlineTagInputBox.style.display = 'none';
    if (elements.inlineTagInput) elements.inlineTagInput.value = '';
  }

  let playerInactivityTimeout = null;

  function resetPlayerInactivityTimer() {
    if (playerInactivityTimeout) {
      clearTimeout(playerInactivityTimeout);
      playerInactivityTimeout = null;
    }
    if (elements.player) {
      elements.player.classList.remove('is-user-inactive');
    }

    const v = elements.mainVideo;
    if (v && !v.paused && !v.ended) {
      playerInactivityTimeout = setTimeout(() => {
        if (elements.player && elements.mainVideo && !elements.mainVideo.paused && !elements.mainVideo.ended) {
          elements.player.classList.add('is-user-inactive');
        }
      }, 5000);
    }
  }

  function clearPlayerInactivityTimer() {
    if (playerInactivityTimeout) {
      clearTimeout(playerInactivityTimeout);
      playerInactivityTimeout = null;
    }
    if (elements.player) {
      elements.player.classList.remove('is-user-inactive');
    }
  }

  let seekToastTimeout = null;
  function seekVideoBy(seconds) {
    const v = elements.mainVideo;
    if (!v || !v.src) return;
    resetPlayerInactivityTimer();
    const dur = v.duration || 0;
    const targetTime = Math.min(Math.max(0, v.currentTime + seconds), dur);
    v.currentTime = targetTime;

    if (elements.resumeToastText && elements.resumeToast) {
      if (seekToastTimeout) clearTimeout(seekToastTimeout);
      const direction = seconds < 0 ? 'Rewound 10s' : 'Forward 10s';
      elements.resumeToastText.textContent = `${direction} (${formatDuration(targetTime)})`;
      elements.resumeToast.style.display = 'flex';
      seekToastTimeout = setTimeout(() => {
        elements.resumeToast.style.display = 'none';
      }, 1500);
    }
  }

  function showResumeToast(time) {
    elements.resumeToastText.textContent = `Resumed from ${formatDuration(time)}`;
    elements.resumeToast.style.display = 'flex';
    setTimeout(() => {
      elements.resumeToast.style.display = 'none';
    }, 3200);
  }

  function returnToBrowseView() {
    clearPlayerInactivityTimer();
    if (elements.mainVideo && !elements.mainVideo.paused) {
      elements.mainVideo.pause();
    }
    setPlayingState(false);

    if (state.activeVideo && elements.mainVideo) {
      saveVideoProgress(state.activeVideo.key, elements.mainVideo.currentTime, elements.mainVideo.duration);
    }

    elements.watchView.style.display = 'none';
    elements.browseView.style.display = 'block';
    if (elements.topbarBackBtn) elements.topbarBackBtn.style.display = 'none';
    if (elements.topbarShuffleBtn) elements.topbarShuffleBtn.style.display = 'inline-flex';
    
    applyFiltersAndRender();
  }

  function mixUpNext() {
    let pool = state.videos.filter(v => v.key !== state.activeVideo?.key);
    if (pool.length > 0) {
      state.upNextQueue = shuffleArray([...pool]);
    } else {
      state.upNextQueue = [];
    }
    renderUpNextList();

    const svg = elements.upNextMixBtn?.querySelector('svg');
    if (svg) {
      svg.classList.remove('is-spinning');
      void svg.offsetWidth;
      svg.classList.add('is-spinning');
      setTimeout(() => svg.classList.remove('is-spinning'), 400);
    }
  }

  // ================= UP NEXT RECOMMENDATIONS =================
  function renderUpNextList() {
    const listContainer = elements.upNextList;
    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (state.videos.length === 0) {
      elements.upNextCount.textContent = '0 videos';
      return;
    }

    if (!state.upNextQueue || state.upNextQueue.length === 0) {
      let pool = state.videos.filter(v => v.key !== state.activeVideo?.key);
      if (state.isShuffled) {
        pool = shuffleArray([...pool]);
      }
      state.upNextQueue = pool;
    } else {
      state.upNextQueue = state.upNextQueue.filter(v => v.key !== state.activeVideo?.key);
    }

    elements.upNextCount.textContent = `${state.upNextQueue.length} videos`;

    state.upNextQueue.forEach(item => {
      const card = document.createElement('div');
      card.className = 'up-next-card';
      const progress = getVideoProgress(item.key);
      let progressPercent = 0;
      if (progress && progress.duration > 0 && progress.currentTime > 2) {
        progressPercent = Math.min(100, Math.max(0, (progress.currentTime / progress.duration) * 100));
      }

      card.innerHTML = `
        <div class="up-next-card__thumb-wrap">
          <img class="up-next-card__thumb-img" data-thumb-key="${item.key}" src="${item.thumbnail || ''}" style="${item.thumbnail ? 'display:block;' : 'display:none;'}" alt="${item.title}">
          <div class="up-next-card__placeholder thumb-placeholder" style="${item.thumbnail ? 'display:none;' : 'display:flex;'}">
            <svg viewBox="0 0 24 24" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3" fill="currentColor"/></svg>
          </div>
          <span class="up-next-card__duration" data-dur-key="${item.key}">${item.formattedDuration || '0:00'}</span>
          
          ${progressPercent > 0 ? `
            <div class="up-next-card__progress">
              <div class="up-next-card__progress-fill" style="width: ${progressPercent}%"></div>
            </div>
          ` : ''}
        </div>

        <div class="up-next-card__info">
          <h4 class="up-next-card__title" title="${item.title}">${item.title}</h4>
          <div class="up-next-card__channel-row">
            <div class="up-next-card__channel-avatars">
              ${(() => {
                const allChs = getAllVideoChannels(item.key);
                if (allChs.length > 0) {
                  return allChs.map(c => `
                    <div class="up-next-card__channel-avatar" style="${c.logo ? '' : `background-color: ${c.color || '#ff0000'};`}" title="${escapeHtml(c.name)}">
                      ${c.logo ? `<img src="${c.logo}" alt="${escapeHtml(c.name)}">` : getInitials(c.name)}
                    </div>
                  `).join('');
                }
                return `<div class="up-next-card__channel-avatar" style="background-color: #444;" title="Local Video">L</div>`;
              })()}
            </div>
            <span class="up-next-card__channel">${(() => {
              const allChs = getAllVideoChannels(item.key);
              if (allChs.length > 1) return allChs.map(c => c.name).join(' × ');
              if (allChs.length === 1) return allChs[0].name;
              return item.channel || 'Local Video';
            })()}</span>
          </div>
          <span class="up-next-card__meta">${item.formattedSize}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        const targetIndex = state.videos.findIndex(v => v.key === item.key);
        if (targetIndex !== -1) {
          openWatchView(targetIndex, true);
        }
      });

      listContainer.appendChild(card);
    });

    observeCardsForThumbnails();
  }

  function playNextVideo() {
    if (state.videos.length === 0) return;

    if (state.upNextQueue && state.upNextQueue.length > 0) {
      const nextVid = state.upNextQueue[0];
      const targetIndex = state.videos.findIndex(v => v.key === nextVid.key);
      if (targetIndex !== -1) {
        openWatchView(targetIndex, true);
        return;
      }
    }

    let nextIndex = state.activeVideoIndex + 1;
    if (nextIndex >= state.videos.length) {
      nextIndex = 0;
    }
    openWatchView(nextIndex, true);
  }

  function playPrevVideo() {
    if (state.videos.length === 0) return;
    let prevIndex = state.activeVideoIndex - 1;
    if (prevIndex < 0) {
      prevIndex = state.videos.length - 1;
    }
    openWatchView(prevIndex, true);
  }

  function playShuffleNext() {
    if (state.videos.length <= 1) return;
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * state.videos.length);
    } while (randomIndex === state.activeVideoIndex);
    
    openWatchView(randomIndex, true);
  }

  // ================= VIDEO PLAYER CONTROLS & EVENTS =================
  function setPlayingState(isPlaying) {
    state.isPlaying = isPlaying;
    if (isPlaying) {
      elements.iconPlay.style.display = 'none';
      elements.iconPause.style.display = 'block';
      elements.centerPlayOverlay.style.opacity = '0';
      elements.centerPlayOverlay.style.pointerEvents = 'none';
    } else {
      elements.iconPlay.style.display = 'block';
      elements.iconPause.style.display = 'none';
      elements.centerPlayOverlay.style.opacity = '1';
      elements.centerPlayOverlay.style.pointerEvents = 'auto';
    }
  }

  function togglePlayPause() {
    const v = elements.mainVideo;
    if (!v.src) return;
    
    if (v.paused || v.ended) {
      v.play().catch(err => {
        if (err.name !== 'AbortError') console.error('Playback error:', err);
      });
      setPlayingState(true);
    } else {
      v.pause();
      setPlayingState(false);
      if (state.activeVideo) {
        saveVideoProgress(state.activeVideo.key, v.currentTime, v.duration);
      }
    }
  }

  function setupPlayerEvents() {
    const v = elements.mainVideo;

    v.addEventListener('error', (e) => {
      if (e && e.stopPropagation) e.stopPropagation();
      setPlayingState(false);
      console.warn('Video element playback notice:', v.error ? v.error.message : 'Media source unhandled');
    });

    if (elements.player) {
      elements.player.addEventListener('mousemove', resetPlayerInactivityTimer);
      elements.player.addEventListener('mouseenter', resetPlayerInactivityTimer);
      elements.player.addEventListener('click', resetPlayerInactivityTimer);
      elements.player.addEventListener('mouseleave', clearPlayerInactivityTimer);
    }

    elements.playPauseBtn.addEventListener('click', togglePlayPause);
    elements.centerPlayOverlay.addEventListener('click', togglePlayPause);
    v.addEventListener('click', togglePlayPause);

    v.addEventListener('play', () => {
      setPlayingState(true);
      resetPlayerInactivityTimer();
    });
    v.addEventListener('pause', () => {
      setPlayingState(false);
      clearPlayerInactivityTimer();
    });

    // Autoplay Next on Ended
    v.addEventListener('ended', () => {
      setPlayingState(false);
      clearPlayerInactivityTimer();
      
      if (state.activeVideo) {
        saveVideoProgress(state.activeVideo.key, v.duration, v.duration);
      }

      if (state.isLooping) {
        v.currentTime = 0;
        v.play().catch(err => {
          if (err.name !== 'AbortError') console.error('Playback error:', err);
        });
        setPlayingState(true);
        resetPlayerInactivityTimer();
      } else if (state.autoplayEnabled) {
        setTimeout(() => {
          playNextVideo();
        }, 500);
      }
    });

    // Time update & Scrubber throttling
    v.addEventListener('timeupdate', () => {
      const cur = v.currentTime || 0;
      const dur = v.duration || 0;
      
      elements.timeCurrent.textContent = formatDuration(cur);
      elements.timeDuration.textContent = formatDuration(dur);
      
      if (dur > 0) {
        elements.seekBar.value = (cur / dur) * 100;
      }

      const now = Date.now();
      if (now - lastProgressSaveTime > 1500 && state.activeVideo && dur > 0) {
        lastProgressSaveTime = now;
        saveVideoProgress(state.activeVideo.key, cur, dur);
      }
    });

    // Scrubber seeking
    elements.seekBar.addEventListener('input', () => {
      const dur = v.duration || 0;
      if (dur > 0) {
        v.currentTime = (elements.seekBar.value / 100) * dur;
      }
    });

    // Navigation & Seek buttons
    elements.nextVideoBtn.addEventListener('click', playNextVideo);
    elements.prevVideoBtn.addEventListener('click', playPrevVideo);
    if (elements.seekBackBtn) {
      elements.seekBackBtn.addEventListener('click', () => seekVideoBy(-10));
    }
    if (elements.seekForwardBtn) {
      elements.seekForwardBtn.addEventListener('click', () => seekVideoBy(10));
    }
    if (elements.watchShuffleBtn) {
      elements.watchShuffleBtn.addEventListener('click', playShuffleNext);
    }

    // Volume & Mute
    elements.muteBtn.addEventListener('click', () => {
      state.isMuted = !state.isMuted;
      v.muted = state.isMuted;
      elements.iconVolume.style.display = state.isMuted ? 'none' : 'block';
      elements.iconMuted.style.display = state.isMuted ? 'block' : 'none';
      elements.volumeBar.value = state.isMuted ? 0 : state.volume;
    });

    elements.volumeBar.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.volume = val;
      v.volume = val;
      state.isMuted = val === 0;
      v.muted = state.isMuted;
      elements.iconVolume.style.display = state.isMuted ? 'none' : 'block';
      elements.iconMuted.style.display = state.isMuted ? 'block' : 'none';
    });

    // Playback Speed Selector
    elements.speedBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      elements.speedMenu.classList.toggle('is-open');
    });

    elements.speedMenu.addEventListener('click', (e) => {
      const target = e.target.closest('button[data-speed]');
      if (!target) return;
      
      const speed = parseFloat(target.getAttribute('data-speed'));
      state.playbackSpeed = speed;
      v.playbackRate = speed;
      elements.speedBtn.textContent = `${speed}x`;
      
      elements.speedMenu.querySelectorAll('button').forEach(b => b.classList.remove('is-selected'));
      target.classList.add('is-selected');
      elements.speedMenu.classList.remove('is-open');
    });

    document.addEventListener('click', () => {
      elements.speedMenu.classList.remove('is-open');
    });

    // Loop toggle
    elements.loopBtn.addEventListener('click', () => {
      state.isLooping = !state.isLooping;
      elements.loopBtn.classList.toggle('is-active', state.isLooping);
      elements.loopBtn.style.color = state.isLooping ? 'var(--accent-blue)' : 'var(--text-primary)';
    });

    // Fullscreen
    elements.fullscreenBtn.addEventListener('click', () => {
      const player = elements.player;
      if (!document.fullscreenElement) {
        if (player.requestFullscreen) {
          player.requestFullscreen();
        } else if (v.webkitEnterFullscreen) {
          v.webkitEnterFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
    });

    // Autoplay toggle switch
    elements.autoplayToggle.addEventListener('change', (e) => {
      saveAutoplay(e.target.checked);
    });

    // Watch action buttons
    elements.watchLikeBtn.addEventListener('click', () => {
      if (state.activeVideo) {
        toggleLike(state.activeVideo.key);
      }
    });

    elements.watchDislikeBtn.addEventListener('click', () => {
      if (state.activeVideo) {
        toggleDislike(state.activeVideo.key);
      }
    });

    elements.watchLaterBtn.addEventListener('click', () => {
      if (state.activeVideo) {
        toggleWatchLater(state.activeVideo.key);
      }
    });

    elements.watchPlaylistBtn.addEventListener('click', () => {
      if (state.activeVideo) {
        openPlaylistModal(state.activeVideo);
      }
    });

    if (elements.watchTagBtn) {
      elements.watchTagBtn.addEventListener('click', () => {
        if (state.activeVideo) {
          openTagModal(state.activeVideo);
        }
      });
    }

    // Inline Tag Adder on Watch page
    elements.inlineAddTagBtn.addEventListener('click', () => {
      showInlineTagInput();
    });

    elements.inlineSaveTagBtn.addEventListener('click', () => {
      addTagToActiveVideo(elements.inlineTagInput.value);
    });

    elements.inlineCancelTagBtn.addEventListener('click', () => {
      hideInlineTagInput();
    });

    elements.inlineTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagToActiveVideo(elements.inlineTagInput.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideInlineTagInput();
      }
    });

    elements.watchBackBtn.addEventListener('click', returnToBrowseView);
    if (elements.topbarBackBtn) elements.topbarBackBtn.addEventListener('click', returnToBrowseView);
    elements.logoHomeBtn.addEventListener('click', returnToBrowseView);

    // Mix Up Next Button
    elements.upNextMixBtn.addEventListener('click', mixUpNext);

    // Global click to dismiss dropdowns
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.video-card__more-wrap')) {
        document.querySelectorAll('.video-card__more-wrap.is-open').forEach(w => {
          w.classList.remove('is-open');
        });
      }
    });
  }

  // ================= CUSTOM TAGGING MODAL =================
  function openTagModal(videoItem, batchKeys = null) {
    if (batchKeys && batchKeys.length > 0) {
      state.tagModalBatchKeys = [...batchKeys];
      state.tagModalVideoKey = null;
      elements.tagModalVideoTitle.textContent = `Batch Tagging: ${batchKeys.length} selected videos`;
    } else if (videoItem) {
      state.tagModalBatchKeys = null;
      state.tagModalVideoKey = videoItem.key;
      elements.tagModalVideoTitle.textContent = `Video: ${videoItem.title}`;
    } else {
      return;
    }
    elements.customTagInput.value = '';
    
    renderModalActiveTags();
    renderModalQuickSuggestions();
    elements.tagModal.style.display = 'flex';
    elements.customTagInput.focus();
  }

  function closeTagModal() {
    elements.tagModal.style.display = 'none';
    if (state.tagModalBatchKeys && state.tagModalBatchKeys.length > 0) {
      clearVideoSelection();
      state.tagModalBatchKeys = null;
    }
    state.tagModalVideoKey = null;
    
    if (state.activeVideo) {
      renderWatchTagsRow(state.activeVideo);
    }
    
    renderDynamicTagChips();
    applyFiltersAndRender();
  }

  function renderModalActiveTags() {
    const wrap = elements.modalActiveTags;
    wrap.innerHTML = '';
    
    if (state.tagModalBatchKeys && state.tagModalBatchKeys.length > 0) {
      const tagCounts = {};
      state.tagModalBatchKeys.forEach(k => {
        const tList = getVideoTags(k);
        tList.forEach(t => {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        });
      });
      const uniqueTags = Object.keys(tagCounts);
      if (uniqueTags.length === 0) {
        wrap.innerHTML = `<span class="tags-empty-hint">No tags assigned yet. Type a tag below or click suggestions to apply to all ${state.tagModalBatchKeys.length} selected videos.</span>`;
        return;
      }
      uniqueTags.forEach(tag => {
        const count = tagCounts[tag];
        const isAll = count === state.tagModalBatchKeys.length;
        const chip = document.createElement('div');
        chip.className = 'modal-tag-chip';
        chip.innerHTML = `
          <span>#${tag} ${isAll ? `(${count}/${count})` : `(${count}/${state.tagModalBatchKeys.length})`}</span>
          <button class="modal-tag-del" data-tag="${tag}" title="Remove tag #${tag} from selected videos" aria-label="Remove tag">&times;</button>
        `;
        chip.querySelector('.modal-tag-del').addEventListener('click', () => {
          removeTagFromModal(tag);
        });
        wrap.appendChild(chip);
      });
      return;
    }

    if (!state.tagModalVideoKey) return;
    const tags = getVideoTags(state.tagModalVideoKey);
    
    if (tags.length === 0) {
      wrap.innerHTML = '<span class="tags-empty-hint">No tags assigned yet. Add one below!</span>';
      return;
    }
    
    tags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'modal-tag-chip';
      chip.innerHTML = `
        <span>#${tag}</span>
        <button class="modal-tag-del" data-tag="${tag}" title="Remove tag" aria-label="Remove tag">&times;</button>
      `;
      chip.querySelector('.modal-tag-del').addEventListener('click', () => {
        removeTagFromModal(tag);
      });
      wrap.appendChild(chip);
    });
  }

  function renderModalQuickSuggestions() {
    const wrap = elements.modalQuickTags;
    if (!wrap) return;
    wrap.innerHTML = '';

    const suggestions = getAllQuickSuggestions();
    let assignedSet = new Set();
    if (state.tagModalBatchKeys && state.tagModalBatchKeys.length > 0) {
      const allAssigned = suggestions.filter(item => 
        state.tagModalBatchKeys.every(k => getVideoTags(k).some(t => t.toLowerCase() === item.tag.toLowerCase()))
      );
      assignedSet = new Set(allAssigned.map(i => i.tag.toLowerCase()));
    } else if (state.tagModalVideoKey) {
      const currentAssigned = getVideoTags(state.tagModalVideoKey);
      assignedSet = new Set(currentAssigned.map(t => t.toLowerCase()));
    }

    suggestions.forEach(item => {
      const isAssigned = assignedSet.has(item.tag.toLowerCase());
      const btn = document.createElement('button');
      btn.className = `quick-tag-btn ${isAssigned ? 'is-assigned' : ''}`;
      btn.setAttribute('data-tag', item.tag);
      btn.type = 'button';
      btn.innerHTML = `
        <span>${item.icon ? item.icon + ' ' : ''}${item.tag}</span>
        <span class="quick-tag-del-btn" title="Delete #${item.tag} tag permanently from library" aria-label="Delete tag">&times;</span>
      `;
      btn.title = isAssigned ? `Tag #${item.tag} is assigned (click to remove)` : `Add #${item.tag}`;
      wrap.appendChild(btn);
    });
  }

  function addTagToModal(tagName) {
    if (!tagName) return;
    const cleanTag = tagName.trim().replace(/^#+/, '');
    if (!cleanTag) return;
    
    addQuickSuggestion(cleanTag);

    if (state.tagModalBatchKeys && state.tagModalBatchKeys.length > 0) {
      state.tagModalBatchKeys.forEach(k => {
        const existing = getVideoTags(k);
        if (!existing.includes(cleanTag)) {
          existing.push(cleanTag);
          setVideoTags(k, existing);
        }
      });
      renderModalActiveTags();
      renderModalQuickSuggestions();
      elements.customTagInput.value = '';
      showToast(`Added #${cleanTag} to ${state.tagModalBatchKeys.length} videos`);
      return;
    }

    if (!state.tagModalVideoKey) return;
    const existing = getVideoTags(state.tagModalVideoKey);
    if (!existing.includes(cleanTag)) {
      existing.push(cleanTag);
      setVideoTags(state.tagModalVideoKey, existing);
      renderModalActiveTags();
      renderModalQuickSuggestions();
    }
    elements.customTagInput.value = '';
  }

  function removeTagFromModal(tagName) {
    if (!tagName) return;

    if (state.tagModalBatchKeys && state.tagModalBatchKeys.length > 0) {
      state.tagModalBatchKeys.forEach(k => {
        const existing = getVideoTags(k);
        const updated = existing.filter(t => t !== tagName);
        setVideoTags(k, updated);
      });
      renderModalActiveTags();
      renderModalQuickSuggestions();
      showToast(`Removed #${tagName} from selected videos`);
      return;
    }

    if (!state.tagModalVideoKey) return;
    const existing = getVideoTags(state.tagModalVideoKey);
    const updated = existing.filter(t => t !== tagName);
    setVideoTags(state.tagModalVideoKey, updated);
    renderModalActiveTags();
    renderModalQuickSuggestions();
  }

  function setupTagModalEvents() {
    elements.closeTagModalBtn.addEventListener('click', closeTagModal);
    elements.saveTagModalBtn.addEventListener('click', closeTagModal);
    
    elements.tagModal.addEventListener('click', (e) => {
      if (e.target === elements.tagModal) {
        closeTagModal();
      }
    });

    elements.addCustomTagBtn.addEventListener('click', () => {
      addTagToModal(elements.customTagInput.value);
    });

    elements.customTagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTagToModal(elements.customTagInput.value);
      }
    });

    elements.modalQuickTags.addEventListener('click', (e) => {
      const delBtn = e.target.closest('.quick-tag-del-btn');
      if (delBtn) {
        e.stopPropagation();
        e.preventDefault();
        const parentTagBtn = delBtn.closest('.quick-tag-btn');
        const tag = parentTagBtn ? parentTagBtn.getAttribute('data-tag') : null;
        if (tag && confirm(`Delete tag "#${tag}" from all videos and suggestions in your library?`)) {
          deleteTagGlobally(tag);
        }
        return;
      }

      const btn = e.target.closest('.quick-tag-btn');
      if (btn) {
        const tag = btn.getAttribute('data-tag');
        if (!tag) return;
        if (state.tagModalBatchKeys && state.tagModalBatchKeys.length > 0) {
          const allHaveTag = state.tagModalBatchKeys.every(k => getVideoTags(k).includes(tag));
          if (allHaveTag) {
            removeTagFromModal(tag);
          } else {
            addTagToModal(tag);
          }
        } else {
          const currentAssigned = state.tagModalVideoKey ? getVideoTags(state.tagModalVideoKey) : [];
          if (currentAssigned.includes(tag)) {
            removeTagFromModal(tag);
          } else {
            addTagToModal(tag);
          }
        }
      }
    });
  }

  function setupPlaylistModalEvents() {
    elements.closePlaylistModalBtn.addEventListener('click', closePlaylistModal);
    elements.donePlaylistModalBtn.addEventListener('click', closePlaylistModal);

    elements.playlistModal.addEventListener('click', (e) => {
      if (e.target === elements.playlistModal) {
        closePlaylistModal();
      }
    });

    elements.createNewPlaylistBtn.addEventListener('click', () => {
      const name = elements.newPlaylistInput.value.trim();
      if (name) {
        const newPl = createPlaylist(name);
        if (newPl && state.playlistModalVideoKey) {
          toggleVideoInPlaylist(newPl.id, state.playlistModalVideoKey);
        }
        elements.newPlaylistInput.value = '';
        renderPlaylistModalList();
      }
    });

    elements.newPlaylistInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        elements.createNewPlaylistBtn.click();
      }
    });

    // Sidebar new playlist button (+)
    if (elements.sidebarNewPlaylistBtn) {
      elements.sidebarNewPlaylistBtn.addEventListener('click', () => {
        const title = prompt('Enter a name for the new playlist:');
        if (title && title.trim()) {
          const pl = createPlaylist(title.trim());
          if (pl) {
            openPlaylistView(pl.id);
          }
        }
      });
    }
  }

  // ================= GLOBAL KEYBOARD SHORTCUTS =================
  function setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      if (elements.watchView && elements.watchView.style.display === 'block') {
        resetPlayerInactivityTimer();
      }

      const v = elements.mainVideo;
      
      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          if (elements.watchView.style.display === 'block') {
            e.preventDefault();
            togglePlayPause();
          }
          break;
        case 'j':
        case 'J':
        case 'ArrowLeft':
          if (elements.watchView.style.display === 'block' && v.src) {
            e.preventDefault();
            seekVideoBy(-10);
          } else if (state.currentView === 'shorts' && elements.shortsScrollViewport) {
            const vids = Array.from(elements.shortsScrollViewport.querySelectorAll('video'));
            const activeVid = vids.find(vid => {
              const rect = vid.getBoundingClientRect();
              return rect.top >= -50 && rect.bottom <= window.innerHeight + 100;
            }) || vids[0];
            if (activeVid && activeVid.src) {
              e.preventDefault();
              activeVid.currentTime = Math.max(0, activeVid.currentTime - 10);
            }
          }
          break;
        case 'l':
        case 'L':
        case 'ArrowRight':
          if (elements.watchView.style.display === 'block' && v.src) {
            e.preventDefault();
            seekVideoBy(10);
          } else if (state.currentView === 'shorts' && elements.shortsScrollViewport) {
            const vids = Array.from(elements.shortsScrollViewport.querySelectorAll('video'));
            const activeVid = vids.find(vid => {
              const rect = vid.getBoundingClientRect();
              return rect.top >= -50 && rect.bottom <= window.innerHeight + 100;
            }) || vids[0];
            if (activeVid && activeVid.src) {
              e.preventDefault();
              activeVid.currentTime = Math.min(activeVid.duration || 0, activeVid.currentTime + 10);
            }
          }
          break;
        case 'm':
        case 'M':
          if (elements.watchView.style.display === 'block') {
            e.preventDefault();
            elements.muteBtn.click();
          }
          break;
        case 'f':
        case 'F':
          if (elements.watchView.style.display === 'block') {
            e.preventDefault();
            elements.fullscreenBtn.click();
          }
          break;
        case 'n':
        case 'N':
          if (elements.watchView.style.display === 'block') {
            e.preventDefault();
            playNextVideo();
          }
          break;
        case 'p':
        case 'P':
          if (elements.watchView.style.display === 'block') {
            e.preventDefault();
            playPrevVideo();
          }
          break;
        case 'ArrowUp':
          if (state.currentView === 'shorts' && elements.shortsScrollViewport) {
            e.preventDefault();
            const cardHeight = elements.shortsScrollViewport.clientHeight;
            elements.shortsScrollViewport.scrollBy({ top: -cardHeight, behavior: 'smooth' });
          }
          break;
        case 'ArrowDown':
          if (state.currentView === 'shorts' && elements.shortsScrollViewport) {
            e.preventDefault();
            const cardHeight = elements.shortsScrollViewport.clientHeight;
            elements.shortsScrollViewport.scrollBy({ top: cardHeight, behavior: 'smooth' });
          }
          break;
        case 'Escape':
          if (elements.channelsChoiceModal && elements.channelsChoiceModal.style.display === 'flex') {
            closeChannelsChoiceModal();
          } else if (elements.createChannelModal && elements.createChannelModal.style.display === 'flex') {
            closeCreateChannelModal();
          } else if (elements.assignChannelModal && elements.assignChannelModal.style.display === 'flex') {
            closeAssignChannelModal();
          } else if (elements.channelAddVideosModal && elements.channelAddVideosModal.style.display === 'flex') {
            closeChannelAddVideosModal();
          } else if (elements.tagModal.style.display === 'flex') {
            closeTagModal();
          } else if (elements.playlistModal.style.display === 'flex') {
            closePlaylistModal();
          } else if (elements.watchView.style.display === 'block') {
            returnToBrowseView();
          }
          break;
      }
    });
  }

  // ================= EVENT LISTENERS =================
  function setupEventListeners() {
    // Folder selection
    elements.selectFolderBtn?.addEventListener('click', handleDirectorySelection);
    elements.emptySelectBtn?.addEventListener('click', handleDirectorySelection);
    elements.sidebarChangeFolderBtn?.addEventListener('click', handleDirectorySelection);
    elements.folderInput?.addEventListener('change', handleFileInputChange);

    // Reconnect banner
    elements.reconnectFolderBtn?.addEventListener('click', handleReconnectClick);
    elements.forgetFolderBtn?.addEventListener('click', handleForgetFolderClick);
    elements.sidebarForgetFolderBtn?.addEventListener('click', handleForgetFolderClick);
    elements.closeBannerBtn?.addEventListener('click', hideReconnectBanner);

    // Sidebar Navigation
    elements.navAllBtn?.addEventListener('click', () => {
      setActiveView('all');
    });

    elements.navLikedBtn?.addEventListener('click', () => {
      setActiveView('liked');
    });

    elements.navWatchLaterBtn?.addEventListener('click', () => {
      setActiveView('watch-later');
    });

    elements.navUntaggedBtn?.addEventListener('click', () => {
      setActiveView('untagged');
    });

    elements.navHistoryBtn?.addEventListener('click', () => {
      setActiveView('history');
    });

    elements.navShortsBtn?.addEventListener('click', () => {
      setActiveView('shorts');
    });

    // Multi-Select Bar Buttons (Batch Operations)
    elements.multiSelectSelectAllBtn?.addEventListener('click', selectAllVideosInView);
    elements.multiSelectTagBtn?.addEventListener('click', () => {
      if (state.selectedVideoKeys.size > 0) {
        openTagModal(null, Array.from(state.selectedVideoKeys));
      }
    });
    elements.multiSelectChannelBtn?.addEventListener('click', () => {
      if (state.selectedVideoKeys.size > 0) {
        openAssignChannelModal(null, Array.from(state.selectedVideoKeys));
      }
    });
    elements.multiSelectClearBtn?.addEventListener('click', clearVideoSelection);

    // Infinite scroll batch loading for large libraries (300+ videos)
    let isInfiniteScrollThrottled = false;
    window.addEventListener('scroll', () => {
      if (isInfiniteScrollThrottled) return;
      if (state.currentView === 'shorts' || state.currentView === 'all-channels') return;
      if (elements.watchView && elements.watchView.style.display === 'block') return;

      const scrollY = window.scrollY || window.pageYOffset;
      const innerHeight = window.innerHeight;
      const bodyHeight = document.documentElement.scrollHeight;

      if (scrollY + innerHeight >= bodyHeight - 600) {
        if (state.visibleVideoLimit < state.filteredVideos.length) {
          isInfiniteScrollThrottled = true;
          state.visibleVideoLimit += 36;
          renderVideoGrid();
          setTimeout(() => {
            isInfiniteScrollThrottled = false;
          }, 250);
        }
      }
    }, { passive: true });

    if (elements.shortsNavPrevBtn) {
      elements.shortsNavPrevBtn.addEventListener('click', () => {
        if (elements.shortsScrollViewport) {
          const cardHeight = elements.shortsScrollViewport.clientHeight;
          elements.shortsScrollViewport.scrollBy({ top: -cardHeight, behavior: 'smooth' });
        }
      });
    }

    if (elements.shortsNavNextBtn) {
      elements.shortsNavNextBtn.addEventListener('click', () => {
        if (elements.shortsScrollViewport) {
          const cardHeight = elements.shortsScrollViewport.clientHeight;
          elements.shortsScrollViewport.scrollBy({ top: cardHeight, behavior: 'smooth' });
        }
      });
    }

    // Clear History Button
    if (elements.clearHistoryBtn) {
      elements.clearHistoryBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all your watch history?')) {
          clearAllWatchHistory();
        }
      });
    }

    // Delete Active Tag Filter Button (Header)
    if (elements.deleteActiveTagBtn) {
      elements.deleteActiveTagBtn.addEventListener('click', () => {
        if (state.currentTagFilter && confirm(`Delete tag "#${state.currentTagFilter}" from all videos in your library?`)) {
          deleteTagGlobally(state.currentTagFilter);
        }
      });
    }

    // Delete Active Playlist Library Button (Header)
    if (elements.deleteActivePlaylistBtn) {
      elements.deleteActivePlaylistBtn.addEventListener('click', () => {
        if (state.activePlaylistId) {
          const pl = state.playlists.find(p => p.id === state.activePlaylistId);
          if (pl && confirm(`Delete playlist library "${pl.name}"? (Your video files on disk will not be deleted)`)) {
            deletePlaylist(pl.id);
          }
        }
      });
    }

    // Filter Chips
    if (elements.chipAll) {
      elements.chipAll.addEventListener('click', () => {
        state.currentTagFilter = null;
        setActiveView('all');
      });
    }

    if (elements.topbarShuffleBtn) {
      elements.topbarShuffleBtn.addEventListener('click', toggleShuffle);
    }

    // Sorting Chips
    if (elements.chipSortName) {
      elements.chipSortName.addEventListener('click', () => {
        if (state.currentSort === 'name') {
          state.currentSort = 'none';
          elements.chipSortName.classList.remove('is-active');
        } else {
          state.currentSort = 'name';
          state.isShuffled = false;
          state.shuffleWeights.clear();
          elements.chipSortName.classList.add('is-active');
          if (elements.chipSortSize) elements.chipSortSize.classList.remove('is-active');
          elements.topbarShuffleBtn?.classList.remove('is-active');
          elements.filterShuffleChip?.classList.remove('is-active');
          if (elements.shuffleStatusBadge) elements.shuffleStatusBadge.style.display = 'none';
        }
        applyFiltersAndRender();
      });
    }

    if (elements.chipSortSize) {
      elements.chipSortSize.addEventListener('click', () => {
        if (state.currentSort === 'size') {
          state.currentSort = 'none';
          elements.chipSortSize.classList.remove('is-active');
        } else {
          state.currentSort = 'size';
          state.isShuffled = false;
          state.shuffleWeights.clear();
          elements.chipSortSize.classList.add('is-active');
          if (elements.chipSortName) elements.chipSortName.classList.remove('is-active');
          elements.topbarShuffleBtn?.classList.remove('is-active');
          elements.filterShuffleChip?.classList.remove('is-active');
          if (elements.shuffleStatusBadge) elements.shuffleStatusBadge.style.display = 'none';
        }
        applyFiltersAndRender();
      });
    }

    // Search Input
    setupSearchEvents();

    // Sidebar Toggle
    if (elements.hamburgerBtn) {
      elements.hamburgerBtn.addEventListener('click', () => {
        elements.sidebar?.classList.toggle('is-collapsed');
      });
    }

    // Export and Import Metadata (Portability to other PCs)
    if (elements.sidebarExportDataBtn) {
      elements.sidebarExportDataBtn.addEventListener('click', exportLibraryMetadata);
    }
    if (elements.sidebarImportDataBtn && elements.importMetadataFileInput) {
      elements.sidebarImportDataBtn.addEventListener('click', () => {
        elements.importMetadataFileInput.value = '';
        elements.importMetadataFileInput.click();
      });
    }
    if (elements.importMetadataFileInput) {
      elements.importMetadataFileInput.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
          await importLibraryMetadata(file);
        }
      });
    }
  }

  // ================= EXPORT & IMPORT METADATA (PORTABILITY TO OTHER PCs) =================
  function exportLibraryMetadata() {
    try {
      const allTagsMap = getAllTagsMap();
      const quickSuggestions = getSavedQuickSuggestions();
      let progressData = {};
      try {
        const storedProg = localStorage.getItem(STORAGE_KEYS.PROGRESS);
        if (storedProg) progressData = JSON.parse(storedProg);
      } catch (e) {}

      // Build video index for seamless cross-PC filename matching
      const videoIndex = state.videos.map(v => ({
        key: v.key,
        fileName: v.name,
        title: v.title,
        size: v.size,
        formattedSize: v.formattedSize,
        duration: v.duration || 0,
        tags: getVideoTags(v.key),
        channelId: state.videoChannels[v.key] || null,
        collabIds: state.videoCollabs[v.key] || []
      }));

      const exportPayload = {
        app: 'LocalTube',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        summary: {
          totalChannels: state.channels.length,
          totalChannelConnections: Object.keys(state.videoChannels).length,
          totalCollabConnections: Object.keys(state.videoCollabs).length,
          totalTaggedVideos: Object.keys(allTagsMap).length,
          totalPlaylists: state.playlists.length,
          totalSubscriptions: state.subscriptions.size,
          totalLikes: state.likes.size,
          totalWatchLater: state.watchLater.size,
          activeVideosInSession: state.videos.length
        },
        channels: state.channels,
        videoChannels: state.videoChannels,
        videoCollabs: state.videoCollabs,
        tags: allTagsMap,
        quickSuggestions: quickSuggestions,
        playlists: state.playlists,
        subscriptions: Array.from(state.subscriptions),
        likes: Array.from(state.likes),
        dislikes: Array.from(state.dislikes),
        watchLater: Array.from(state.watchLater),
        watchProgress: progressData,
        watchHistory: getWatchHistoryList(),
        customThumbnails: Array.from(state.customThumbnails),
        videoIndex: videoIndex
      };

      const jsonStr = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const dateStamp = now.toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `localtube-connections-${dateStamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      const tagConns = Object.keys(allTagsMap).length;
      const chConns = Object.keys(state.videoChannels).length;
      showToast(`Exported ${state.channels.length} channels, ${chConns} video connections & ${tagConns} tag sets to JSON!`);
    } catch (err) {
      console.error('Export error:', err);
      showToast('Failed to export metadata: ' + (err.message || 'Unknown error'));
    }
  }

  async function importLibraryMetadata(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object') {
        throw new Error('Invalid JSON file format.');
      }

      let importedChannelsCount = 0;
      let importedVideoChannelsCount = 0;
      let importedTagsCount = 0;
      let importedPlaylistsCount = 0;

      // 1. Channels
      if (Array.isArray(data.channels)) {
        const existingIds = new Set(state.channels.map(c => c.id));
        data.channels.forEach(ch => {
          if (!ch || !ch.name) return;
          if (existingIds.has(ch.id)) {
            const idx = state.channels.findIndex(c => c.id === ch.id);
            if (idx >= 0) {
              state.channels[idx] = { ...state.channels[idx], ...ch };
            }
          } else {
            state.channels.push(ch);
            existingIds.add(ch.id);
            importedChannelsCount++;
          }
        });
        saveChannels();
      }

      // 2. Video Channels mapping
      if (data.videoChannels && typeof data.videoChannels === 'object') {
        Object.entries(data.videoChannels).forEach(([vKey, chId]) => {
          if (vKey && chId) {
            state.videoChannels[vKey] = chId;
            importedVideoChannelsCount++;
          }
        });
        saveVideoChannels();
      }

      // 2b. Video Collabs mapping
      if (data.videoCollabs && typeof data.videoCollabs === 'object') {
        Object.entries(data.videoCollabs).forEach(([vKey, collabIds]) => {
          if (vKey && Array.isArray(collabIds) && collabIds.length > 0) {
            state.videoCollabs[vKey] = collabIds;
          }
        });
        saveVideoCollabs();
      }

      // 3. Match from videoIndex if available (bridges files across different computers)
      if (Array.isArray(data.videoIndex) && state.videos.length > 0) {
        data.videoIndex.forEach(item => {
          if (!item) return;
          const match = state.videos.find(v => 
            v.key === item.key || 
            (v.name === item.fileName && (item.size == null || v.size === item.size)) ||
            (v.name.toLowerCase() === (item.fileName || '').toLowerCase())
          );
          if (match) {
            if (item.channelId) {
              state.videoChannels[match.key] = item.channelId;
            }
            if (Array.isArray(item.tags) && item.tags.length > 0) {
              setVideoTags(match.key, item.tags);
            }
          }
        });
        saveVideoChannels();
      }

      // 4. Tags
      if (data.tags && typeof data.tags === 'object') {
        const currentTagsMap = getAllTagsMap();
        Object.entries(data.tags).forEach(([vKey, tagList]) => {
          if (vKey && Array.isArray(tagList)) {
            const existing = currentTagsMap[vKey] || [];
            const merged = Array.from(new Set([...existing, ...tagList]));
            currentTagsMap[vKey] = merged;
            merged.forEach(t => addQuickSuggestion(t));
            importedTagsCount++;
          }
        });
        try {
          localStorage.setItem(STORAGE_KEYS.TAGS, JSON.stringify(currentTagsMap));
        } catch (e) {}
      }

      // 5. Quick Suggestions
      if (Array.isArray(data.quickSuggestions)) {
        data.quickSuggestions.forEach(t => addQuickSuggestion(t));
      }

      // 6. Playlists
      if (Array.isArray(data.playlists)) {
        data.playlists.forEach(pl => {
          if (!pl || !pl.name) return;
          const existing = state.playlists.find(p => p.id === pl.id || p.name.toLowerCase() === pl.name.toLowerCase());
          if (existing) {
            const mergedKeys = Array.from(new Set([...(existing.videoKeys || []), ...(pl.videoKeys || [])]));
            existing.videoKeys = mergedKeys;
          } else {
            state.playlists.push({
              id: pl.id || `pl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              name: pl.name,
              createdAt: pl.createdAt || Date.now(),
              videoKeys: Array.isArray(pl.videoKeys) ? pl.videoKeys : []
            });
            importedPlaylistsCount++;
          }
        });
        savePlaylists();
      }

      // 7. Subscriptions
      if (Array.isArray(data.subscriptions)) {
        data.subscriptions.forEach(sub => state.subscriptions.add(sub));
        saveSubscriptions();
      }

      // 8. Likes, Dislikes, Watch Later
      if (Array.isArray(data.likes)) {
        data.likes.forEach(k => state.likes.add(k));
        saveLikes();
      }
      if (Array.isArray(data.dislikes)) {
        data.dislikes.forEach(k => state.dislikes.add(k));
        saveDislikes();
      }
      if (Array.isArray(data.watchLater)) {
        data.watchLater.forEach(k => state.watchLater.add(k));
        saveWatchLater();
      }

      // 9. Watch Progress
      if (data.watchProgress && typeof data.watchProgress === 'object') {
        try {
          const currentProg = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS) || '{}');
          Object.assign(currentProg, data.watchProgress);
          localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(currentProg));
        } catch (e) {}
      }

      // Re-render UI
      renderDynamicTagChips();
      renderSidebarChannels();
      renderSidebarPlaylists();
      updateSidebarStats();
      updateChannelStats();
      applyFiltersAndRender();

      showToast(`Imported ${importedChannelsCount || data.channels?.length || 0} channels, ${importedVideoChannelsCount || Object.keys(data.videoChannels || {}).length} connections & playlists!`);
    } catch (err) {
      console.error('Import error:', err);
      showToast('Failed to import JSON: ' + (err.message || 'Invalid format'));
    }
  }

  // ================= SEARCH AUTO-SUGGESTIONS & HISTORY =================
  function loadSearchHistory() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
      state.searchHistory = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(state.searchHistory)) state.searchHistory = [];
    } catch (e) {
      state.searchHistory = [];
    }
  }

  function saveSearchHistory(query) {
    if (!query || query.trim().length < 2) return;
    const clean = query.trim();
    state.searchHistory = state.searchHistory.filter(q => q.toLowerCase() !== clean.toLowerCase());
    state.searchHistory.unshift(clean);
    if (state.searchHistory.length > 15) {
      state.searchHistory = state.searchHistory.slice(0, 15);
    }
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(state.searchHistory));
    } catch (e) {}
  }

  function removeSearchHistoryItem(query) {
    if (!query) return;
    state.searchHistory = state.searchHistory.filter(q => q.toLowerCase() !== query.toLowerCase());
    try {
      localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(state.searchHistory));
    } catch (e) {}
    renderSearchSuggestions();
  }

  function getSearchSuggestions(query) {
    const raw = (query || '').trim();
    const q = raw.toLowerCase();
    const qNoHash = q.replace(/^#+/, '').trim();
    const qNoAt = q.replace(/^@+/, '').trim();
    const suggestions = [];
    const seenTexts = new Set();

    // Collect all tags in library
    const allTags = new Set();
    state.videos.forEach(v => {
      getVideoTags(v.key).forEach(t => {
        if (t && t.trim()) {
          allTags.add(t.trim().replace(/^#+/, ''));
        }
      });
    });
    getAllUniqueTags().forEach(t => {
      if (t && t.trim()) {
        allTags.add(t.trim().replace(/^#+/, ''));
      }
    });

    if (!q) {
      // Empty input -> Show Recent Search History & Top Tags & Subscribed Channels
      state.searchHistory.slice(0, 5).forEach(term => {
        if (!seenTexts.has(term.toLowerCase())) {
          seenTexts.add(term.toLowerCase());
          suggestions.push({ type: 'history', text: term, query: '' });
        }
      });

      Array.from(allTags).slice(0, 4).forEach(tag => {
        const tagText = `#${tag}`;
        if (!seenTexts.has(tagText.toLowerCase())) {
          seenTexts.add(tagText.toLowerCase());
          suggestions.push({ type: 'tag', text: tagText, rawTag: tag, query: '' });
        }
      });

      state.channels.slice(0, 3).forEach(ch => {
        if (!seenTexts.has(ch.name.toLowerCase())) {
          seenTexts.add(ch.name.toLowerCase());
          suggestions.push({
            type: 'channel',
            text: ch.name,
            handle: ch.handle,
            channelId: ch.id,
            logo: ch.logo,
            color: ch.color,
            videoCount: getChannelVideos(ch.id).length,
            query: ''
          });
        }
      });
    } else {
      // Non-empty query -> Match Channels, Tags, History, and Video Titles

      // 1. Channels matching query
      state.channels.forEach(ch => {
        const chName = (ch.name || '').toLowerCase();
        const chHandle = (ch.handle || '').toLowerCase();
        const chHandleNoAt = chHandle.replace(/^@+/, '');
        if (
          (chName.includes(q) || (qNoHash && chName.includes(qNoHash)) || chHandle.includes(q) || (qNoAt && chHandleNoAt.includes(qNoAt))) &&
          !seenTexts.has(ch.name.toLowerCase())
        ) {
          seenTexts.add(ch.name.toLowerCase());
          suggestions.push({
            type: 'channel',
            text: ch.name,
            handle: ch.handle,
            channelId: ch.id,
            logo: ch.logo,
            color: ch.color,
            videoCount: getChannelVideos(ch.id).length,
            query: raw
          });
        }
      });

      // 2. Tags matching query or query without '#'
      allTags.forEach(tag => {
        const tagLower = tag.toLowerCase();
        const tagWithHash = `#${tagLower}`;
        if (
          (tagLower.includes(qNoHash) || tagWithHash.includes(q) || (q && tagLower.includes(q))) &&
          !seenTexts.has(tagWithHash)
        ) {
          seenTexts.add(tagWithHash);
          suggestions.push({
            type: 'tag',
            text: `#${tag}`,
            rawTag: tag,
            query: raw.startsWith('#') ? raw : (qNoHash || raw)
          });
        }
      });

      // 3. History
      state.searchHistory.forEach(term => {
        if (term.toLowerCase().includes(q) && !seenTexts.has(term.toLowerCase())) {
          seenTexts.add(term.toLowerCase());
          suggestions.push({ type: 'history', text: term, query: raw });
        }
      });

      // 4. Video Titles
      state.videos.forEach(v => {
        const titleLower = (v.title || '').toLowerCase();
        if (titleLower && (titleLower.includes(q) || (qNoHash && titleLower.includes(qNoHash))) && !seenTexts.has(v.title.toLowerCase())) {
          seenTexts.add(v.title.toLowerCase());
          suggestions.push({ type: 'title', text: v.title, query: raw });
        }
      });
    }

    return suggestions.slice(0, 8);
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMatchedText(text, query) {
    const escapedText = escapeHtml(text);
    if (!query) return escapedText;
    const escapedQuery = escapeHtml(query);
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapedText.replace(regex, '<b>$1</b>');
  }

  function renderSearchSuggestions() {
    const container = elements.searchSuggestions;
    if (!container || !elements.searchInput) return;

    const query = elements.searchInput.value;
    const suggestions = getSearchSuggestions(query);

    if (suggestions.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '';
    container.style.display = 'block';

    suggestions.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = `search-suggestion-item is-${item.type}`;
      if (index === state.suggestionSelectedIndex) {
        row.classList.add('is-selected');
      }

      let iconOrAvatarHtml = '';
      let textContentHtml = '';
      let badgeLabelHtml = '';

      if (item.type === 'channel') {
        iconOrAvatarHtml = `
          <div class="search-suggestion-channel-avatar" style="${item.logo ? '' : `background-color: ${item.color || '#ff0000'};`}">
            ${item.logo ? `<img src="${item.logo}" alt="${item.text}">` : getInitials(item.text)}
          </div>
        `;
        const formattedName = formatMatchedText(item.text, item.query);
        textContentHtml = `
          <div class="search-suggestion-channel-info">
            <span class="search-suggestion-channel-name">${formattedName}</span>
            <span class="search-suggestion-channel-handle">${item.handle || '@channel'}</span>
          </div>
        `;
        badgeLabelHtml = `<span class="search-suggestion-channel-pill">${item.videoCount} vid${item.videoCount === 1 ? '' : 's'}</span>`;
      } else if (item.type === 'history') {
        iconOrAvatarHtml = `<svg viewBox="0 0 24 24" width="16" height="16" class="search-suggestion-icon"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><polyline points="12 7 12 12 15 15" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
        textContentHtml = `<span class="search-suggestion-text">${formatMatchedText(item.text, item.query)}</span>`;
        badgeLabelHtml = `<span class="search-suggestion-type">Recent</span>`;
      } else if (item.type === 'tag') {
        iconOrAvatarHtml = `<svg viewBox="0 0 24 24" width="16" height="16" class="search-suggestion-icon"><line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4" y1="15" x2="20" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="3" x2="8" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="3" x2="14" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
        textContentHtml = `<span class="search-suggestion-text">${formatMatchedText(item.text, item.query)}</span>`;
        badgeLabelHtml = `<span class="search-suggestion-type">Tag</span>`;
      } else {
        iconOrAvatarHtml = `<svg viewBox="0 0 24 24" width="16" height="16" class="search-suggestion-icon"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" fill="none"/><line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
        textContentHtml = `<span class="search-suggestion-text">${formatMatchedText(item.text, item.query)}</span>`;
      }

      let removeBtnHtml = '';
      if (item.type === 'history') {
        removeBtnHtml = `<button class="search-suggestion-remove" title="Remove search from history">✕</button>`;
      }

      row.innerHTML = `
        <div class="search-suggestion-left">
          ${iconOrAvatarHtml}
          ${textContentHtml}
          ${badgeLabelHtml}
        </div>
        ${removeBtnHtml}
      `;

      const removeBtn = row.querySelector('.search-suggestion-remove');
      if (removeBtn) {
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          removeSearchHistoryItem(item.text);
        });
      }

      row.addEventListener('mousedown', (e) => {
        if (e.target.closest('.search-suggestion-remove')) return;
        e.preventDefault();
        if (item.type === 'tag') {
          selectTagFilter(item.rawTag || item.text);
        } else {
          executeSearch(item.text);
        }
      });

      container.appendChild(row);
    });
  }

  function hideSearchSuggestions() {
    if (elements.searchSuggestions) {
      elements.searchSuggestions.style.display = 'none';
    }
    state.suggestionSelectedIndex = -1;
    if (elements.searchWrap) {
      elements.searchWrap.classList.remove('is-focused');
    }
  }

  function executeSearch(query) {
    const clean = (query || '').trim();
    if (!clean) {
      state.searchQuery = '';
      if (elements.searchInput) elements.searchInput.value = '';
      if (elements.searchClearBtn) elements.searchClearBtn.style.display = 'none';
      hideSearchSuggestions();
      applyFiltersAndRender();
      return;
    }

    // Check if query is a hashtag (e.g. #Gaming, #Code, #shorts)
    if (clean.startsWith('#')) {
      const tagCandidate = clean.replace(/^#+/, '').trim();
      if (tagCandidate) {
        saveSearchHistory(clean);
        selectTagFilter(tagCandidate);
        return;
      }
    }

    if (elements.searchInput) {
      elements.searchInput.value = clean;
    }
    if (elements.searchClearBtn) {
      elements.searchClearBtn.style.display = 'flex';
    }

    saveSearchHistory(clean);
    state.searchQuery = clean;
    hideSearchSuggestions();

    if (elements.watchView && elements.watchView.style.display === 'block') {
      returnToBrowseView();
    }

    applyFiltersAndRender();
  }

  function setupSearchEvents() {
    const input = elements.searchInput;
    const clearBtn = elements.searchClearBtn;
    const searchBtn = elements.searchBtn;
    const wrap = elements.searchWrap;

    if (!input) return;

    let searchDebounceTimer = null;
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (clearBtn) {
        clearBtn.style.display = val.length > 0 ? 'flex' : 'none';
      }
      state.searchQuery = val.trim();
      state.suggestionSelectedIndex = -1;
      renderSearchSuggestions();

      if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        applyFiltersAndRender();
      }, 100);
    });

    input.addEventListener('focus', () => {
      if (wrap) wrap.classList.add('is-focused');
      if (clearBtn) {
        clearBtn.style.display = input.value.length > 0 ? 'flex' : 'none';
      }
      state.suggestionSelectedIndex = -1;
      renderSearchSuggestions();
    });

    input.addEventListener('keydown', (e) => {
      const currentSuggestions = getSearchSuggestions(input.value);

      if (e.key === 'ArrowDown') {
        if (currentSuggestions.length > 0) {
          e.preventDefault();
          state.suggestionSelectedIndex = (state.suggestionSelectedIndex + 1) % currentSuggestions.length;
          renderSearchSuggestions();
        }
      } else if (e.key === 'ArrowUp') {
        if (currentSuggestions.length > 0) {
          e.preventDefault();
          state.suggestionSelectedIndex = state.suggestionSelectedIndex <= 0 ? currentSuggestions.length - 1 : state.suggestionSelectedIndex - 1;
          renderSearchSuggestions();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (state.suggestionSelectedIndex >= 0 && state.suggestionSelectedIndex < currentSuggestions.length) {
          const selectedItem = currentSuggestions[state.suggestionSelectedIndex];
          if (selectedItem.type === 'tag') {
            selectTagFilter(selectedItem.rawTag || selectedItem.text);
          } else {
            executeSearch(selectedItem.text);
          }
        } else {
          executeSearch(input.value);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        hideSearchSuggestions();
        input.blur();
      }
    });

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        input.value = '';
        clearBtn.style.display = 'none';
        state.searchQuery = '';
        state.suggestionSelectedIndex = -1;
        applyFiltersAndRender();
        input.focus();
        renderSearchSuggestions();
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        executeSearch(input.value);
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchWrap')) {
        hideSearchSuggestions();
      }
    });
  }

  function setActiveView(view) {
    state.currentView = view;
    state.activePlaylistId = null;
    if (view !== 'channel') {
      state.activeChannelId = null;
    }
    
    // Clear multi-selection if moving to a view where multi-select is not active
    if (view !== 'untagged' && view !== 'videos-without-channel') {
      clearVideoSelection();
    } else {
      updateMultiSelectBar();
    }
    
    // Update sidebar active classes
    elements.navAllBtn?.classList.toggle('is-active', view === 'all');
    elements.navLikedBtn?.classList.toggle('is-active', view === 'liked');
    elements.navWatchLaterBtn?.classList.toggle('is-active', view === 'watch-later');
    elements.navUntaggedBtn?.classList.toggle('is-active', view === 'untagged');
    elements.navHistoryBtn?.classList.toggle('is-active', view === 'history');
    elements.navShortsBtn?.classList.toggle('is-active', view === 'shorts');
    elements.navSettingsBtn?.classList.toggle('is-active', view === 'settings');
    elements.navChannelsBtn?.classList.toggle('is-active', view === 'channel' || view === 'all-channels' || view === 'subscribed-channels' || view === 'videos-without-channel');

    if (elements.settingsView) {
      elements.settingsView.style.display = (view === 'settings') ? 'block' : 'none';
    }
    if (elements.browseView) {
      elements.browseView.style.display = (view === 'settings') ? 'none' : 'block';
    }

    // Update subnav active classes
    const allChSub = elements.sideSubAllChannels || elements.subnavAllChannelsBtn;
    allChSub?.classList.toggle('is-active', view === 'all-channels');
    const subChSub = elements.sideSubSubscribed || elements.subnavSubscribedBtn;
    subChSub?.classList.toggle('is-active', view === 'subscribed-channels');
    const noChSub = elements.sideSubNoChannel || elements.subnavWithoutChannelBtn;
    noChSub?.classList.toggle('is-active', view === 'videos-without-channel');

    // Update chips active classes
    elements.chipAll?.classList.toggle('is-active', view === 'all' && !state.currentTagFilter);

    renderSidebarPlaylists();
    renderSidebarChannels();

    if (elements.watchView.style.display === 'block') {
      returnToBrowseView();
    }

    if (view !== 'settings') {
      applyFiltersAndRender();
    }
  }

  // ================= SETTINGS & DUPLICATE DETECTOR =================
  function initSettingsState() {
    let loadCount = parseInt(localStorage.getItem('localtube_load_count') || '0', 10) + 1;
    if (loadCount <= 2) {
      localStorage.setItem('localtube_load_count', loadCount);
    }
    state.appLoadCount = loadCount;

    const savedTheme = localStorage.getItem('localtube_theme') || 'dark';
    if (savedTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
    if (elements.themeToggleLabel) {
      elements.themeToggleLabel.textContent = savedTheme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode';
    }

    const savedCols = parseInt(localStorage.getItem('localtube_cols') || '3', 10);
    state.videoGridCols = Math.max(1, Math.min(4, savedCols));
    applyVideoGridColumns(state.videoGridCols);

    const savedDupWords = parseInt(localStorage.getItem('localtube_dup_words') || '4', 10);
    state.duplicateWordThreshold = Math.max(3, Math.min(6, savedDupWords));
    applyDuplicateWordThreshold(state.duplicateWordThreshold);
  }

  function applyVideoGridColumns(cols) {
    state.videoGridCols = cols;
    localStorage.setItem('localtube_cols', cols);
    if (elements.videoGrid) {
      elements.videoGrid.style.setProperty('--video-grid-cols', cols);
      elements.videoGrid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    }
    document.querySelectorAll('.col-btn').forEach(btn => {
      const bCols = parseInt(btn.getAttribute('data-cols'), 10);
      btn.classList.toggle('is-active', bCols === cols);
    });
  }

  function applyDuplicateWordThreshold(wordsCount) {
    state.duplicateWordThreshold = wordsCount;
    localStorage.setItem('localtube_dup_words', wordsCount);
    document.querySelectorAll('.dup-word-btn').forEach(btn => {
      const bWords = parseInt(btn.getAttribute('data-words'), 10);
      btn.classList.toggle('is-active', bWords === wordsCount);
    });
    const headerTitle = document.getElementById('duplicateHeaderTitle');
    if (headerTitle) headerTitle.textContent = `Duplicate Video Detector (${wordsCount}+ Continuous Words)`;
    const scanLabel = document.getElementById('scanBtnLabel');
    if (scanLabel) scanLabel.textContent = `Scan for Duplicates (${wordsCount}+ Continuous Words)`;
  }

  function setupSettingsEvents() {
    elements.navSettingsBtn?.addEventListener('click', () => {
      setActiveView('settings');
    });

    elements.themeToggleBtn?.addEventListener('click', () => {
      const isLight = document.documentElement.classList.toggle('light-theme');
      const theme = isLight ? 'light' : 'dark';
      localStorage.setItem('localtube_theme', theme);
      if (elements.themeToggleLabel) {
        elements.themeToggleLabel.textContent = theme === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode';
      }
    });

    document.querySelectorAll('.col-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cols = parseInt(btn.getAttribute('data-cols'), 10);
        applyVideoGridColumns(cols);
      });
    });

    document.querySelectorAll('.dup-word-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const words = parseInt(btn.getAttribute('data-words'), 10);
        applyDuplicateWordThreshold(words);
      });
    });

    elements.scanDuplicatesBtn?.addEventListener('click', () => {
      scanDuplicateVideos();
    });

    elements.settingsExportDataBtn?.addEventListener('click', exportLibraryMetadata);
    elements.settingsImportDataBtn?.addEventListener('click', () => {
      if (elements.importMetadataFileInput) {
        elements.importMetadataFileInput.value = '';
        elements.importMetadataFileInput.click();
      }
    });
  }

  window.playDuplicateVideo = function(videoKey) {
    const idx = state.videos.findIndex(v => v.key === videoKey);
    if (idx !== -1) {
      openWatchView(idx);
    }
  };

  function scanDuplicateVideos() {
    const container = elements.duplicateResultsContainer;
    if (!container) return;
    container.style.display = 'block';

    if (!state.videos || state.videos.length === 0) {
      container.innerHTML = `<p class="setting-desc" style="color: var(--text-secondary); margin-top: 12px;">No videos in library to scan.</p>`;
      return;
    }

    const n = state.duplicateWordThreshold || 4;
    const nGramsMap = new Map();

    state.videos.forEach(video => {
      const cleanTitle = (video.title || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const words = cleanTitle.split(' ').filter(w => w.length > 1);

      if (words.length >= n) {
        for (let i = 0; i <= words.length - n; i++) {
          let gramParts = [];
          for (let k = 0; k < n; k++) {
            gramParts.push(words[i + k]);
          }
          const gramKey = gramParts.join(' ');
          if (!nGramsMap.has(gramKey)) {
            nGramsMap.set(gramKey, []);
          }
          const list = nGramsMap.get(gramKey);
          if (!list.some(v => v.key === video.key)) {
            list.push(video);
          }
        }
      }
    });

    const duplicates = [];
    for (const [gramKey, vList] of nGramsMap.entries()) {
      if (vList.length >= 2) {
        duplicates.push({ gramKey, videos: vList });
      }
    }

    if (duplicates.length === 0) {
      container.innerHTML = `
        <div style="margin-top: 16px; padding: 16px; background: var(--bg-surface); border-radius: 8px; border: 1px solid var(--border-color);">
          <p style="color: var(--text-primary); font-weight: 500;">No potential duplicates found!</p>
          <p style="color: var(--text-secondary); font-size: 13px; margin-top: 4px;">No videos share ${n} or more continuous words in their titles.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="margin-top: 16px;">
        <p style="color: var(--accent-amber); font-weight: 600; font-size: 13px; margin-bottom: 12px;">
          Found ${duplicates.length} shared ${n}-word phrase pattern(s) across potential duplicate videos:
        </p>
        <div style="display: flex; flex-direction: column; gap: 16px; max-height: 450px; overflow-y: auto; padding-right: 4px;">
    `;

    duplicates.forEach(group => {
      html += `
        <div style="background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px; padding: 12px;">
          <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">
            Shared phrase: <strong style="color: var(--text-primary); background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">"${group.gramKey}"</strong>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
      `;

      group.videos.forEach(v => {
        const sizeMb = (v.size ? (v.size / (1024 * 1024)).toFixed(1) + ' MB' : '');
        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-card); padding: 8px 12px; border-radius: 6px; gap: 12px;">
            <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
              <div style="font-weight: 500; font-size: 13px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis;" title="${v.title}">${v.title}</div>
              <div style="font-size: 11px; color: var(--text-secondary);">${sizeMb} • ${v.ext || ''}</div>
            </div>
            <button class="btn btn--secondary btn--sm" onclick="window.playDuplicateVideo('${v.key}')" style="white-space: nowrap;">
              Play Video
            </button>
          </div>
        `;
      });

      html += `
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  // ================= INITIALIZATION =================
  async function initApp() {
    initSettingsState();
    await loadAllThumbnailsFromIDB();
    loadLikesAndDislikes();
    loadPlaylists();
    loadChannels();
    loadSearchHistory();
    loadAutoplay();
    loadThumbnailCache();
    updateHistoryCounter();
    renderDynamicTagChips();
    setupFilterBarScrolling();
    
    setupPlayerEvents();
    setupTagModalEvents();
    setupPlaylistModalEvents();
    setupChannelModalEvents();
    setupKeyboardShortcuts();
    setupEventListeners();
    setupSettingsEvents();
    
    await checkSavedDirectoryMemory();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

})();
