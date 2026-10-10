import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';
import { CustomTabBar } from './src/components/navigation/CustomTabBar';
import { PlayerOverlay } from './src/components/player/PlayerOverlay';
import { PlaybackContext } from './src/contexts/PlaybackContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { RadioScreen } from './src/screens/RadioScreen';
import { SearchScreen } from './src/screens/SearchScreen';
import { MusicCatalogService, getMusicApiHeaders, parseLyrics, setMusicApiToken, type TrackEditChanges } from './src/services/MusicCatalogService';
import { OfflineMusicService } from './src/services/OfflineMusicService';
import { PlaylistStorageService } from './src/services/PlaylistStorageService';
import type { PlaylistCoverSelection, PlaylistSummary, Track } from './src/types';
import './styles.css';

const Tab = createBottomTabNavigator();

const mergeOfflineTrack = (remoteTrack: Track, offlineTrack?: Track): Track => {
  if (!offlineTrack) return remoteTrack;
  return {
    ...remoteTrack,
    ...offlineTrack,
    lyricsAvailable: Boolean(remoteTrack.lyricsAvailable || offlineTrack.lyricsAvailable),
    hasSyncedLyrics: Boolean(remoteTrack.hasSyncedLyrics || offlineTrack.hasSyncedLyrics || offlineTrack.syncedLyrics?.trim()),
    hasPlainLyrics: Boolean(remoteTrack.hasPlainLyrics || offlineTrack.hasPlainLyrics || offlineTrack.plainLyrics?.trim()),
  };
};

export default function App() {
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const playerStatus = useAudioPlayerStatus(player);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [favoriteTracks, setFavoriteTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [downloadedTracks, setDownloadedTracks] = useState<Track[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [apiInitializing, setApiInitializing] = useState(true);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [isLoadingTracks, setIsLoadingTracks] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadingTrackIds, setDownloadingTrackIds] = useState<string[]>([]);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [playbackQueue, setPlaybackQueue] = useState<Track[]>([]);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const tracksRef = useRef<Track[]>([]);
  const downloadsRef = useRef<Track[]>([]);
  const favoriteIdsRef = useRef<Set<string>>(new Set());
  const favoriteStateLoaded = useRef(false);
  const queueRef = useRef<Track[]>([]);
  const activeTrackRef = useRef<Track | null>(null);
  const searchGeneration = useRef(0);
  const handledFinishedTrack = useRef<string | null>(null);

  const updatePlaybackQueue = useCallback((nextQueue: Track[]) => {
    queueRef.current = nextQueue;
    setPlaybackQueue(nextQueue);
  }, []);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    downloadsRef.current = downloadedTracks;
  }, [downloadedTracks]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => undefined);
  }, []);

  const searchTracks = useCallback(async (query = '') => {
    const generation = ++searchGeneration.current;
    setIsLoadingTracks(true);
    setLoadError(null);
    try {
      const remoteTracks = query.trim()
        ? await MusicCatalogService.searchTracks(query)
        : await MusicCatalogService.searchAllTracks();
      if (generation !== searchGeneration.current) return;
      const offlineById = new Map(downloadsRef.current.map((track) => [track.id, track]));
      const merged = remoteTracks.map((track) => ({
        ...mergeOfflineTrack(track, offlineById.get(track.id)),
        isFavorite: favoriteIdsRef.current.has(track.id),
      }));
      if (!query.trim()) {
        const presentIds = new Set(merged.map((track) => track.id));
        merged.push(...downloadsRef.current
          .filter((track) => !presentIds.has(track.id))
          .map((track) => ({ ...track, isFavorite: favoriteIdsRef.current.has(track.id) })));
      }
      tracksRef.current = merged;
      setTracks(merged);
    } catch (error) {
      if (generation === searchGeneration.current) {
        setLoadError(error instanceof Error ? error.message : 'Could not reach your music server.');
      }
    } finally {
      if (generation === searchGeneration.current) setIsLoadingTracks(false);
    }
  }, []);

  const loadAllTracks = useCallback(async () => {
    if (!apiConnected) return tracksRef.current;
    const remoteTracks = await MusicCatalogService.searchAllTracks();
    const offlineById = new Map(downloadsRef.current.map((track) => [track.id, track]));
    const merged = remoteTracks.map((track) => ({
      ...mergeOfflineTrack(track, offlineById.get(track.id)),
      isFavorite: favoriteIdsRef.current.has(track.id),
    }));
    const presentIds = new Set(merged.map((track) => track.id));
    merged.push(...downloadsRef.current
      .filter((track) => !presentIds.has(track.id))
      .map((track) => ({ ...track, isFavorite: favoriteIdsRef.current.has(track.id) })));
    tracksRef.current = merged;
    setTracks(merged);
    return merged;
  }, [apiConnected]);

  const loadFavoriteTracks = useCallback(async () => {
    const remoteFavorites = await MusicCatalogService.getFavoriteTracks();
    const favorites = remoteFavorites.map((track) => ({
      ...mergeOfflineTrack(track, downloadsRef.current.find((saved) => saved.id === track.id)),
      isFavorite: true,
    }));
    const favoriteIds = new Set(favorites.map((track) => track.id));
    favoriteIdsRef.current = favoriteIds;
    favoriteStateLoaded.current = true;
    const nextTracks = tracksRef.current.map((track) => ({
      ...track,
      isFavorite: favoriteIds.has(track.id),
    }));
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    downloadsRef.current = downloadsRef.current.map((track) => ({
      ...track,
      isFavorite: favoriteIds.has(track.id),
    }));
    setDownloadedTracks(downloadsRef.current);
    updatePlaybackQueue(queueRef.current.map((track) => ({
      ...track,
      isFavorite: favoriteIds.has(track.id),
    })));
    if (activeTrackRef.current) {
      const active = { ...activeTrackRef.current, isFavorite: favoriteIds.has(activeTrackRef.current.id) };
      activeTrackRef.current = active;
      setActiveTrack(active);
    }
    setFavoriteTracks(favorites);
    return favorites;
  }, [updatePlaybackQueue]);

  const loadPlaylists = useCallback(async () => {
    try {
      const remotePlaylists = await MusicCatalogService.getPlaylists();
      const nextPlaylists = await PlaylistStorageService.mergeRemotePlaylists(remotePlaylists, getMusicApiHeaders());
      setPlaylists(nextPlaylists);
      return nextPlaylists;
    } catch {
      const cachedPlaylists = await PlaylistStorageService.getPlaylists();
      setPlaylists(cachedPlaylists);
      return cachedPlaylists;
    }
  }, []);

  const loadPlaylistTracks = useCallback(async (playlistId: string) => {
    if (!apiConnected) {
      const cachedTracks = await PlaylistStorageService.getPlaylistTracks(playlistId);
      const offlineById = new Map(downloadsRef.current.map((track) => [track.id, track]));
      return cachedTracks.map((track) => ({
        ...mergeOfflineTrack(track, offlineById.get(track.id)),
        isFavorite: favoriteIdsRef.current.has(track.id),
      }));
    }
    try {
      const remoteTracks = await MusicCatalogService.getPlaylistTracks(playlistId);
      const offlineById = new Map(downloadsRef.current.map((track) => [track.id, track]));
      const tracksWithOfflineFiles = remoteTracks.map((track) => mergeOfflineTrack(track, offlineById.get(track.id)));
      await PlaylistStorageService.savePlaylistTracks(playlistId, tracksWithOfflineFiles);
      return tracksWithOfflineFiles.map((track) => ({
        ...track,
        isFavorite: favoriteIdsRef.current.has(track.id),
      }));
    } catch {
      const cachedTracks = await PlaylistStorageService.getPlaylistTracks(playlistId);
      const offlineById = new Map(downloadsRef.current.map((track) => [track.id, track]));
      return cachedTracks.map((track) => ({
        ...mergeOfflineTrack(track, offlineById.get(track.id)),
        isFavorite: favoriteIdsRef.current.has(track.id),
      }));
    }
  }, [apiConnected]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      OfflineMusicService.getDownloadedTracks(),
      PlaylistStorageService.getPlaylists(),
      SecureStore.getItemAsync('musiqapp_api_token'),
    ]).then(([savedTracks, savedPlaylists, savedToken]) => {
      if (!mounted) return;
      downloadsRef.current = savedTracks;
      setDownloadedTracks(savedTracks);
      favoriteIdsRef.current = new Set(savedTracks.filter((track) => track.isFavorite).map((track) => track.id));
      setTracks(savedTracks);
      setPlaylists(savedPlaylists);
      if (savedToken) {
        setMusicApiToken(savedToken);
        setApiConnected(true);
        void searchTracks();
        void loadFavoriteTracks().catch(() => undefined);
        void loadPlaylists();
      } else {
        favoriteStateLoaded.current = true;
        setIsLoadingTracks(false);
      }
      setApiInitializing(false);
    }).catch(() => {
      if (mounted) {
        setIsLoadingTracks(false);
        setApiInitializing(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadFavoriteTracks, loadPlaylists, searchTracks]);

  const connectToLibrary = useCallback(async (value: string) => {
    const token = value.trim();
    if (!token) throw new Error('Paste the library pairing code to connect.');
    setMusicApiToken(token);
    try {
      const remoteTracks = await MusicCatalogService.searchTracks();
      await SecureStore.setItemAsync('musiqapp_api_token', token);
      setApiConnected(true);
      setLoadError(null);
      setIsLoadingTracks(false);
      const offlineById = new Map(downloadsRef.current.map((track) => [track.id, track]));
      const merged = remoteTracks.map((track) => ({
        ...mergeOfflineTrack(track, offlineById.get(track.id)),
        isFavorite: favoriteIdsRef.current.has(track.id),
      }));
      const presentIds = new Set(merged.map((track) => track.id));
      merged.push(...downloadsRef.current
        .filter((track) => !presentIds.has(track.id))
        .map((track) => ({ ...track, isFavorite: favoriteIdsRef.current.has(track.id) })));
      tracksRef.current = merged;
      setTracks(merged);
      void loadFavoriteTracks().catch(() => undefined);
      void loadPlaylists();
    } catch (error) {
      setMusicApiToken('');
      throw error;
    }
  }, [loadFavoriteTracks, loadPlaylists]);

  const disconnectFromLibrary = useCallback(async () => {
    await SecureStore.deleteItemAsync('musiqapp_api_token');
    setMusicApiToken('');
    setApiConnected(false);
    setTracks(downloadsRef.current);
  }, []);

  const playSelectedTrack = useCallback((track: Track, nextQueue: Track[]) => {
    const offlineTrack = downloadsRef.current.find((saved) => saved.id === track.id);
    const selectedTrack = offlineTrack ?? track;
    const audioUri = selectedTrack.localUri ?? selectedTrack.streamUrl;
    if (!audioUri) {
      Alert.alert('Track unavailable', 'This file does not have a playable audio source.');
      return;
    }

    updatePlaybackQueue(nextQueue);
    activeTrackRef.current = selectedTrack;
    setActiveTrack(selectedTrack);
    handledFinishedTrack.current = null;
    player.replace(
      selectedTrack.localUri
        ? selectedTrack.localUri
        : { uri: audioUri, headers: getMusicApiHeaders(), name: selectedTrack.title },
    );
    player.play();

    if (!selectedTrack.lyrics?.length) {
      void MusicCatalogService.getLyrics(selectedTrack)
        .then((trackWithLyrics) => {
          if (activeTrackRef.current?.id !== selectedTrack.id) return;
          activeTrackRef.current = trackWithLyrics;
          setActiveTrack(trackWithLyrics);
          downloadsRef.current = downloadsRef.current.map((saved) =>
            saved.id === trackWithLyrics.id ? { ...saved, ...trackWithLyrics, localUri: saved.localUri } : saved,
          );
          setDownloadedTracks(downloadsRef.current);
        })
        .catch(() => undefined);
    }
  }, [player, updatePlaybackQueue]);

  const playTrack = useCallback((track: Track, queue = tracksRef.current) => {
    playSelectedTrack(track, queue);
  }, [playSelectedTrack]);

  const playAllSongs = useCallback((queue = tracksRef.current) => {
    const currentQueue = queue;
    if (currentQueue.length > 0) playSelectedTrack(currentQueue[0], currentQueue);
  }, [playSelectedTrack]);

  const shuffleSongs = useCallback((queue = tracksRef.current) => {
    const shuffled = [...queue].sort(() => Math.random() - 0.5);
    if (shuffled.length > 0) {
      setShuffleEnabled(true);
      playSelectedTrack(shuffled[0], shuffled);
    }
  }, [playSelectedTrack]);

  const playNext = useCallback((track: Track) => {
    const active = activeTrackRef.current;
    if (!active || active.id === track.id) return;
    const currentQueue = queueRef.current.length > 0 ? queueRef.current : tracksRef.current;
    const nextQueue = currentQueue.filter((item) => item.id !== track.id);
    const activeIndex = nextQueue.findIndex((item) => item.id === active.id);
    nextQueue.splice(activeIndex < 0 ? 0 : activeIndex + 1, 0, track);
    updatePlaybackQueue(nextQueue);
  }, [updatePlaybackQueue]);

  const advanceQueue = useCallback((trackFinished = false) => {
    if (trackFinished && repeatMode === 'one' && activeTrackRef.current) {
      void player.seekTo(0);
      player.play();
      return;
    }

    const currentQueue = queueRef.current.length > 0 ? queueRef.current : tracksRef.current;
    const currentIndex = currentQueue.findIndex((track) => track.id === activeTrackRef.current?.id);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= 0 && nextIndex < currentQueue.length) {
      playSelectedTrack(currentQueue[nextIndex], currentQueue);
      return;
    }

    if (currentQueue.length === 0) return;

    if (repeatMode === 'all') {
      playSelectedTrack(currentQueue[0], currentQueue);
      return;
    }

    if (trackFinished && autoplayEnabled) {
      const active = activeTrackRef.current;
      const otherTracks = tracksRef.current.filter((item) => item.id !== active?.id);
      const similarTracks = otherTracks.filter((item) =>
        item.artist.toLocaleLowerCase() === active?.artist.toLocaleLowerCase() ||
        item.album.toLocaleLowerCase() === active?.album.toLocaleLowerCase(),
      );
      const candidates = similarTracks.length > 0 ? similarTracks : otherTracks;
      if (candidates.length > 0) {
        const nextTrack = candidates[Math.floor(Math.random() * candidates.length)];
        playSelectedTrack(nextTrack, [...currentQueue, nextTrack]);
      }
    }
  }, [autoplayEnabled, player, playSelectedTrack, repeatMode]);

  const skipNext = useCallback(() => advanceQueue(false), [advanceQueue]);

  const toggleQueueShuffle = useCallback(() => {
    const currentQueue = queueRef.current;
    if (!shuffleEnabled && currentQueue.length > 1) {
      const currentIndex = currentQueue.findIndex((item) => item.id === activeTrackRef.current?.id);
      const currentAndPast = currentQueue.slice(0, Math.max(0, currentIndex) + 1);
      const upcoming = currentQueue.slice(currentAndPast.length);
      for (let index = upcoming.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [upcoming[index], upcoming[swapIndex]] = [upcoming[swapIndex], upcoming[index]];
      }
      updatePlaybackQueue([...currentAndPast, ...upcoming]);
    }
    setShuffleEnabled((enabled) => !enabled);
  }, [shuffleEnabled, updatePlaybackQueue]);

  const toggleRepeatMode = useCallback(() => {
    setRepeatMode((mode) => mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off');
  }, []);

  const clearUpcomingQueue = useCallback(() => {
    updatePlaybackQueue(activeTrackRef.current ? [activeTrackRef.current] : []);
    setShuffleEnabled(false);
  }, [updatePlaybackQueue]);

  const playQueueTrack = useCallback((track: Track) => {
    const currentQueue = queueRef.current.length > 0 ? queueRef.current : tracksRef.current;
    playSelectedTrack(track, currentQueue);
  }, [playSelectedTrack]);

  const skipPrevious = useCallback(() => {
    if (playerStatus.currentTime > 3) {
      void player.seekTo(0);
      return;
    }
    const currentQueue = queueRef.current.length > 0 ? queueRef.current : tracksRef.current;
    const currentIndex = currentQueue.findIndex((track) => track.id === activeTrackRef.current?.id);
    if (currentQueue.length > 0) {
      const previousIndex = (currentIndex - 1 + currentQueue.length) % currentQueue.length;
      playSelectedTrack(currentQueue[previousIndex], currentQueue);
    }
  }, [playSelectedTrack, player, playerStatus.currentTime]);

  const seekTo = useCallback((seconds: number) => {
    void player.seekTo(Math.max(0, seconds));
  }, [player]);

  const setPlayerVolume = useCallback((volume: number) => {
    player.volume = Math.max(0, Math.min(1, volume));
  }, [player]);

  const updateTrackWithLyrics = useCallback(async (track: Track, syncedLyrics: string) => {
    const updated = await OfflineMusicService.saveSyncedLyrics({
      ...track,
      syncedLyrics,
      lyrics: parseLyrics(syncedLyrics),
      lyricsAvailable: true,
      hasSyncedLyrics: true,
    }, syncedLyrics);
    const trackWithFavoriteState = {
      ...updated,
      isFavorite: favoriteIdsRef.current.has(updated.id),
    };
    const nextTracks = tracksRef.current.map((item) => item.id === updated.id ? trackWithFavoriteState : item);
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    downloadsRef.current = downloadsRef.current.map((item) => item.id === updated.id ? trackWithFavoriteState : item);
    setDownloadedTracks(downloadsRef.current);
    await PlaylistStorageService.updateTrack(trackWithFavoriteState);
    updatePlaybackQueue(queueRef.current.map((item) => item.id === updated.id ? trackWithFavoriteState : item));
    if (activeTrackRef.current?.id === updated.id) {
      activeTrackRef.current = trackWithFavoriteState;
      setActiveTrack(trackWithFavoriteState);
    }
    return trackWithFavoriteState;
  }, [updatePlaybackQueue]);

  const updateTrackEverywhere = useCallback(async (updated: Track) => {
    const matchesTrack = (item: Track) => item.id === updated.id;
    const trackWithFavoriteState = {
      ...updated,
      isFavorite: favoriteIdsRef.current.has(updated.id),
    };
    const nextTracks = tracksRef.current.map((item) => matchesTrack(item) ? { ...item, ...trackWithFavoriteState } : item);
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    updatePlaybackQueue(queueRef.current.map((item) => matchesTrack(item) ? { ...item, ...trackWithFavoriteState } : item));
    downloadsRef.current = downloadsRef.current.map((item) => matchesTrack(item)
      ? { ...item, ...trackWithFavoriteState, localUri: item.localUri }
      : item,
    );
    setDownloadedTracks(downloadsRef.current);
    await OfflineMusicService.updateTrack(trackWithFavoriteState);
    await PlaylistStorageService.updateTrack(trackWithFavoriteState);
    setFavoriteTracks((current) => {
      if (trackWithFavoriteState.isFavorite) {
        return [trackWithFavoriteState, ...current.filter((item) => !matchesTrack(item))];
      }
      return current.filter((item) => !matchesTrack(item));
    });
    if (activeTrackRef.current && matchesTrack(activeTrackRef.current)) {
      const active = { ...activeTrackRef.current, ...trackWithFavoriteState, localUri: activeTrackRef.current.localUri };
      activeTrackRef.current = active;
      setActiveTrack(active);
    }
    return trackWithFavoriteState;
  }, [updatePlaybackQueue]);

  const toggleFavorite = useCallback(async (track: Track) => {
    const currentFavorite = favoriteStateLoaded.current
      ? favoriteIdsRef.current.has(track.id)
      : Boolean(track.isFavorite ?? favoriteIdsRef.current.has(track.id));
    const isFavorite = !currentFavorite;
    if (isFavorite) favoriteIdsRef.current.add(track.id);
    else favoriteIdsRef.current.delete(track.id);
    try {
      await MusicCatalogService.setFavorite(track, isFavorite);
      return await updateTrackEverywhere({ ...track, isFavorite });
    } catch (error) {
      if (currentFavorite) favoriteIdsRef.current.add(track.id);
      else favoriteIdsRef.current.delete(track.id);
      throw error;
    }
  }, [updateTrackEverywhere]);

  const updateTrack = useCallback(async (track: Track, changes: TrackEditChanges) => {
    const updated = await MusicCatalogService.updateTrack(track, changes);
    return updateTrackEverywhere(updated);
  }, [updateTrackEverywhere]);

  const deleteTrack = useCallback(async (track: Track) => {
    await MusicCatalogService.deleteTrack(track);
    const nextTracks = tracksRef.current.filter((item) => item.id !== track.id);
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    setFavoriteTracks((current) => current.filter((item) => item.id !== track.id));
    favoriteIdsRef.current.delete(track.id);
    await PlaylistStorageService.deleteTrack(track.id);
    updatePlaybackQueue(queueRef.current.filter((item) => item.id !== track.id));
    if (activeTrackRef.current?.id === track.id && !activeTrackRef.current.localUri) {
      player.pause();
      activeTrackRef.current = null;
      setActiveTrack(null);
    }
  }, [player, updatePlaybackQueue]);

  const createPlaylist = useCallback(async (name: string, cover?: PlaylistCoverSelection) => {
    const remotePlaylist = await MusicCatalogService.createPlaylist(name);
    let coverUri: string | undefined;
    try {
      const coverUrl = cover
        ? await MusicCatalogService.uploadPlaylistCover(remotePlaylist.id, cover.uri, cover.mimeType)
        : undefined;
      coverUri = cover
        ? await PlaylistStorageService.cacheCover(remotePlaylist.id, cover.uri, cover.mimeType)
        : undefined;
      const playlist: PlaylistSummary = { ...remotePlaylist, coverUrl, coverUri, coverCachedUrl: coverUrl, trackCount: 0 };
      await PlaylistStorageService.savePlaylist(playlist);
      setPlaylists((current) => [playlist, ...current.filter((item) => item.id !== playlist.id)]);
      return playlist;
    } catch (error) {
      if (coverUri) await PlaylistStorageService.removeCachedCover(coverUri);
      await MusicCatalogService.deletePlaylist(remotePlaylist.id).catch(() => undefined);
      throw error;
    }
  }, []);

  const addTrackToPlaylist = useCallback(async (playlistId: string, track: Track) => {
    const added = await MusicCatalogService.addTrackToPlaylist(playlistId, track);
    if (!added) return;
    const cachedAdded = await PlaylistStorageService.addTrack(playlistId, track);
    if (!cachedAdded) return;
    setPlaylists((current) => current.map((playlist) => playlist.id === playlistId
      ? { ...playlist, trackCount: playlist.trackCount + 1 }
      : playlist,
    ));
  }, []);

  const removeTrackFromPlaylist = useCallback(async (playlistId: string, track: Track) => {
    const removed = await MusicCatalogService.removeTrackFromPlaylist(playlistId, track);
    const cachedRemoved = await PlaylistStorageService.removeTrack(playlistId, track.id);
    if (!removed && !cachedRemoved) return;
    setPlaylists((current) => current.map((playlist) => playlist.id === playlistId
      ? { ...playlist, trackCount: Math.max(0, playlist.trackCount - 1) }
      : playlist,
    ));
  }, []);

  const deletePlaylist = useCallback(async (playlistId: string) => {
    await MusicCatalogService.deletePlaylist(playlistId);
    await PlaylistStorageService.deletePlaylist(playlistId);
    setPlaylists((current) => current.filter((playlist) => playlist.id !== playlistId));
  }, []);

  const saveTrackLyrics = useCallback(async (track: Track, syncedLyrics: string) => {
    const timedLines = parseLyrics(syncedLyrics).filter((line) => line.timeMs !== null && line.text.trim());
    if (timedLines.length === 0) throw new Error('This result does not contain valid synced LRC lines.');

    if (track.provider === 'local' && track.providerId) {
      await MusicCatalogService.saveSyncedLyrics(track, syncedLyrics);
    }
    return updateTrackWithLyrics({ ...track, lyricsSource: 'saved_lrc' }, syncedLyrics);
  }, [updateTrackWithLyrics]);

  const checkTrackLyrics = useCallback(async (track: Track) => {
    const result = await MusicCatalogService.getLyrics(track, true);
    if (!result.syncedLyrics?.trim()) return result;

    if (result.lyricsSource === 'local_lrc' || result.lyricsSource === 'embedded_lrc') {
      return updateTrackWithLyrics(result, result.syncedLyrics);
    }
    return result;
  }, [updateTrackWithLyrics]);

  useEffect(() => {
    if (!playerStatus.didJustFinish || !activeTrackRef.current) {
      handledFinishedTrack.current = null;
      return;
    }
    if (handledFinishedTrack.current !== activeTrackRef.current.id) {
      handledFinishedTrack.current = activeTrackRef.current.id;
      advanceQueue(true);
    }
  }, [advanceQueue, playerStatus.didJustFinish]);

  const downloadTrack = useCallback(async (track: Track) => {
    setDownloadingTrackIds((current) => current.includes(track.id) ? current : [...current, track.id]);
    try {
      let trackWithLyrics = track;
      try {
        trackWithLyrics = await MusicCatalogService.getLyrics(track, true);
      } catch {
        try {
          trackWithLyrics = await MusicCatalogService.getLyrics(track);
        } catch {
          // Lyrics are optional; the audio can still be saved for offline playback.
        }
      }
      const savedTrack = await OfflineMusicService.downloadTrack(trackWithLyrics);
      await PlaylistStorageService.updateTrack(savedTrack);
      downloadsRef.current = [...downloadsRef.current.filter((item) => item.id !== savedTrack.id), savedTrack];
      setDownloadedTracks(downloadsRef.current);
      setTracks((current) => current.map((item) => item.id === savedTrack.id ? savedTrack : item));
      return savedTrack;
    } finally {
      setDownloadingTrackIds((current) => current.filter((id) => id !== track.id));
    }
  }, []);

  const deleteDownloadedTracks = useCallback(async (trackIds: string[]) => {
    const result = await OfflineMusicService.removeDownloadedTracks(trackIds);
    const removedIds = new Set(result.removedTrackIds);
    if (removedIds.size === 0) return result.freedBytes;

    const removedTracks = downloadsRef.current.filter((track) => removedIds.has(track.id));
    downloadsRef.current = downloadsRef.current.filter((track) => !removedIds.has(track.id));
    setDownloadedTracks(downloadsRef.current);

    const clearOfflineSource = (track: Track): Track => ({ ...track, localUri: undefined, lyricsFileUri: undefined });
    const nextTracks = tracksRef.current.flatMap((track) => {
      if (!removedIds.has(track.id)) return [track];
      if (!track.streamUrl) return [];
      return [clearOfflineSource(track)];
    });
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    setFavoriteTracks((current) => current.map((track) => removedIds.has(track.id) ? clearOfflineSource(track) : track));
    updatePlaybackQueue(queueRef.current.flatMap((track) => {
      if (!removedIds.has(track.id)) return [track];
      if (!track.streamUrl) return [];
      return [clearOfflineSource(track)];
    }));

    await Promise.all(removedTracks.map((track) =>
      PlaylistStorageService.updateTrack(clearOfflineSource(track)).catch(() => undefined),
    ));

    if (activeTrackRef.current && removedIds.has(activeTrackRef.current.id)) {
      player.pause();
      activeTrackRef.current = null;
      setActiveTrack(null);
    }
    return result.freedBytes;
  }, [player, updatePlaybackQueue]);

  const importAudioToLibrary = useCallback(async (
    url: string,
    title: string,
    artist: string,
    sourceUrl: string,
    onProgress: Parameters<typeof MusicCatalogService.importAudioUrl>[4],
  ) => {
    const importedTrack = await MusicCatalogService.importAudioUrl(url, title, artist, sourceUrl, onProgress);
    const nextTracks = [importedTrack, ...tracksRef.current.filter((track) => track.id !== importedTrack.id)];
    tracksRef.current = nextTracks;
    setTracks(nextTracks);
    return importedTrack;
  }, []);

  const playbackActions = useMemo(() => ({
    tracks,
    downloadedTracks,
    hasActiveTrack: Boolean(activeTrack),
    favoriteTracks,
    playlists,
    apiConnected,
    apiInitializing,
    isLoadingTracks,
    loadError,
    downloadedTrackIds: downloadedTracks.map((track) => track.id),
    downloadingTrackIds,
    searchTracks,
    loadAllTracks,
    loadFavoriteTracks,
    loadPlaylists,
    loadPlaylistTracks,
    checkTrackLyrics,
    saveTrackLyrics,
    connectToLibrary,
    disconnectFromLibrary,
    downloadTrack,
    deleteDownloadedTracks,
    importAudioToLibrary,
    updateTrack,
    deleteTrack,
    toggleFavorite,
    createPlaylist,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
    playNext,
    playTrack,
    playAllSongs,
    shuffleSongs,
  }), [
    downloadTrack,
    deleteDownloadedTracks,
    addTrackToPlaylist,
    removeTrackFromPlaylist,
    createPlaylist,
    deletePlaylist,
    deleteTrack,
    importAudioToLibrary,
    downloadedTracks,
    favoriteTracks,
    checkTrackLyrics,
    downloadingTrackIds,
    isLoadingTracks,
    apiConnected,
    apiInitializing,
    loadError,
    playAllSongs,
    playTrack,
    searchTracks,
    loadAllTracks,
    saveTrackLyrics,
    shuffleSongs,
    connectToLibrary,
    disconnectFromLibrary,
    tracks,
    activeTrack,
    playlists,
    loadFavoriteTracks,
    loadPlaylists,
    loadPlaylistTracks,
    playNext,
    toggleFavorite,
    updateTrack,
  ]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PlaybackContext.Provider value={playbackActions}>
        <NavigationContainer>
          <Tab.Navigator
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{ headerShown: false }}
            initialRouteName="Library"
          >
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Radio" component={RadioScreen} />
            <Tab.Screen name="Library" component={LibraryScreen} />
            <Tab.Screen name="Search" component={SearchScreen} />
          </Tab.Navigator>
        </NavigationContainer>
      </PlaybackContext.Provider>
      {activeTrack ? (
        <PlayerOverlay
          visible={playerVisible}
          track={activeTrack}
          isFavorite={Boolean(activeTrack.isFavorite)}
          isPlaying={playerStatus.playing}
          currentTime={playerStatus.currentTime}
          durationSeconds={playerStatus.duration || activeTrack.durationSeconds || 0}
          volume={player.volume}
          queue={playbackQueue}
          shuffleEnabled={shuffleEnabled}
          repeatMode={repeatMode}
          autoplayEnabled={autoplayEnabled}
          onOpen={() => setPlayerVisible(true)}
          onClose={() => setPlayerVisible(false)}
          onTogglePlayback={() => playerStatus.playing ? player.pause() : player.play()}
          onSkipPrevious={skipPrevious}
          onSkipNext={skipNext}
          onSeek={seekTo}
          onVolumeChange={setPlayerVolume}
          onToggleFavorite={() => void toggleFavorite(activeTrack).catch((error) => {
            Alert.alert('Could not update favorite', error instanceof Error ? error.message : 'Try again.');
          })}
          onPlayQueueTrack={playQueueTrack}
          onToggleShuffle={toggleQueueShuffle}
          onToggleRepeat={toggleRepeatMode}
          onToggleAutoplay={() => setAutoplayEnabled((enabled) => !enabled)}
          onClearQueue={clearUpcomingQueue}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}
