import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LibraryList } from '../components/library/LibraryList';
import { TopBar } from '../components/library/TopBar';
import { usePlaybackActions } from '../contexts/PlaybackContext';
import type { PlaylistSummary, Track } from '../types';
import type { TrackEditChanges } from '../services/MusicCatalogService';
import { DownloaderScreen } from './DownloaderScreen';
import { LrcCheckerScreen } from './LrcCheckerScreen';
import { PlaylistsScreen } from './PlaylistsScreen';
import { SongsScreen } from './SongsScreen';
import { AlbumsScreen } from './AlbumsScreen';
import { ArtistsScreen } from './ArtistsScreen';

type LibraryStackParamList = {
  LibraryHome: undefined;
  Songs: undefined;
  Albums: undefined;
  Artists: undefined;
  AlbumTracks: { album: string; artist: string };
  ArtistTracks: { artist: string };
  Downloaded: undefined;
  Favorites: undefined;
  Playlists: undefined;
  PlaylistTracks: { playlistId: string; title: string };
  AddSongsToPlaylist: { playlistId: string; title: string };
  Downloader: undefined;
  LrcChecker: undefined;
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

const LibraryHomeScreen = ({
  navigation,
}: NativeStackScreenProps<LibraryStackParamList, 'LibraryHome'>) => (
  <SafeAreaView className="flex-1 bg-black" edges={['top']}>
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 190 }}>
      <TopBar />
      <LibraryList
        onSelectCategory={(title) => {
          if (title === 'Songs') navigation.navigate('Songs');
          if (title === 'Albums') navigation.navigate('Albums');
          if (title === 'Artists') navigation.navigate('Artists');
          if (title === 'Downloaded') navigation.navigate('Downloaded');
          if (title === 'Favorites') navigation.navigate('Favorites');
          if (title === 'Playlists') navigation.navigate('Playlists');
          if (title === 'Downloader') navigation.navigate('Downloader');
          if (title === 'LRC Checker') navigation.navigate('LrcChecker');
        }}
      />
      <View className="px-5 mt-6 mb-4">
        <Text className="text-white text-[22px] font-bold">Recently Added</Text>
      </View>
    </ScrollView>
  </SafeAreaView>
);

const SongCatalogRoute = ({
  navigation,
  title,
  tracks,
  apiConnected,
  apiInitializing,
  isLoadingTracks,
  loadError,
  onTrackUpdated,
  onTrackRemoved,
  offlineMode = false,
  showTrackActions = true,
  emptyMessage,
  onDeleteDownloadedTracks,
  onOpenAddSongs,
  addToPlaylistMode = false,
  addedPlaylistTrackIds,
  addingPlaylistTrackIds,
  onAddPlaylistTrack,
  playlistMode = false,
  onRemoveFromPlaylist,
  onSearchOverride,
}: {
  navigation: { goBack: () => void };
  title: string;
  tracks: Track[];
  apiConnected: boolean;
  apiInitializing: boolean;
  isLoadingTracks: boolean;
  loadError: string | null;
  onTrackUpdated?: (track: Track) => void;
  onTrackRemoved?: (trackId: string) => void;
  offlineMode?: boolean;
  showTrackActions?: boolean;
  emptyMessage?: string;
  onDeleteDownloadedTracks?: (trackIds: string[]) => Promise<number>;
  onOpenAddSongs?: () => void;
  addToPlaylistMode?: boolean;
  addedPlaylistTrackIds?: string[];
  addingPlaylistTrackIds?: string[];
  onAddPlaylistTrack?: (track: Track) => Promise<void>;
  playlistMode?: boolean;
  onRemoveFromPlaylist?: (track: Track) => Promise<void>;
  onSearchOverride?: (query?: string) => Promise<void>;
}) => {
  const actions = usePlaybackActions();
  const { loadPlaylists } = actions;
  const favoriteTrackIds = useMemo(() => new Set([
    ...actions.favoriteTracks.map((track) => track.id),
    ...actions.tracks.filter((track) => track.isFavorite).map((track) => track.id),
  ]), [actions.favoriteTracks, actions.tracks]);
  const tracksWithFavoriteState = useMemo(() => tracks.map((track) => ({
    ...track,
    isFavorite: favoriteTrackIds.has(track.id),
  })), [favoriteTrackIds, tracks]);

  useEffect(() => {
    if (apiConnected && showTrackActions) void loadPlaylists().catch(() => undefined);
  }, [loadPlaylists, apiConnected, showTrackActions]);

  return (
    <SongsScreen
      title={title}
      onBack={navigation.goBack}
      onSelectTrack={actions.playTrack}
      onPlayAll={actions.playAllSongs}
      onShuffle={actions.shuffleSongs}
      tracks={tracksWithFavoriteState}
      apiConnected={apiConnected}
      apiInitializing={apiInitializing}
      isLoadingTracks={isLoadingTracks}
      loadError={loadError}
      downloadedTrackIds={actions.downloadedTrackIds}
      downloadingTrackIds={actions.downloadingTrackIds}
      onSearch={onSearchOverride ?? (title === 'Songs' ? actions.searchTracks : async () => undefined)}
      onConnect={actions.connectToLibrary}
      onDownload={actions.downloadTrack}
      onPlayNext={actions.playNext}
      onToggleFavorite={async (track) => {
        const updated = await actions.toggleFavorite(track);
        onTrackUpdated?.(updated);
        return updated;
      }}
      onAddToPlaylist={actions.addTrackToPlaylist}
      onCreatePlaylist={actions.createPlaylist}
      onSaveTrack={async (track: Track, changes: TrackEditChanges) => {
        const updated = await actions.updateTrack(track, changes);
        onTrackUpdated?.(updated);
      }}
      onDeleteTrack={async (track) => {
        await actions.deleteTrack(track);
        onTrackRemoved?.(track.id);
      }}
      playlists={actions.playlists}
      hasActiveTrack={actions.hasActiveTrack}
      offlineMode={offlineMode}
      showTrackActions={showTrackActions}
      emptyMessage={emptyMessage}
      onDeleteDownloadedTracks={onDeleteDownloadedTracks}
      onOpenAddSongs={onOpenAddSongs}
      addToPlaylistMode={addToPlaylistMode}
      addedPlaylistTrackIds={addedPlaylistTrackIds}
      addingPlaylistTrackIds={addingPlaylistTrackIds}
      onAddPlaylistTrack={onAddPlaylistTrack}
      playlistMode={playlistMode}
      onRemoveFromPlaylist={onRemoveFromPlaylist}
    />
  );
};

const useLoadFullCatalog = (apiConnected: boolean, loadAllTracks: () => Promise<Track[]>) => {
  const [loadingFullCatalog, setLoadingFullCatalog] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!apiConnected) {
      setLoadingFullCatalog(false);
      return;
    }
    let mounted = true;
    setLoadingFullCatalog(true);
    void loadAllTracks().catch(() => undefined).finally(() => {
      if (mounted) setLoadingFullCatalog(false);
    });
    return () => {
      mounted = false;
    };
  }, [apiConnected, loadAllTracks]));

  return loadingFullCatalog;
};

const SongsRoute = ({ navigation }: NativeStackScreenProps<LibraryStackParamList, 'Songs'>) => {
  const actions = usePlaybackActions();
  const loadingFullCatalog = useLoadFullCatalog(actions.apiConnected, actions.loadAllTracks);
  const skipRemoteSearch = useCallback(async () => undefined, []);
  return (
    <SongCatalogRoute
      navigation={navigation}
      title="Songs"
      tracks={actions.tracks}
      apiConnected={actions.apiConnected}
      apiInitializing={actions.apiInitializing}
      isLoadingTracks={actions.isLoadingTracks || loadingFullCatalog}
      loadError={actions.loadError}
      onSearchOverride={skipRemoteSearch}
    />
  );
};

const AlbumsRoute = ({ navigation }: NativeStackScreenProps<LibraryStackParamList, 'Albums'>) => {
  const actions = usePlaybackActions();
  const loadingFullCatalog = useLoadFullCatalog(actions.apiConnected, actions.loadAllTracks);
  return (
    <AlbumsScreen
      tracks={actions.tracks}
      loading={actions.apiInitializing || loadingFullCatalog}
      onBack={navigation.goBack}
      onOpenAlbum={(album, artist) => navigation.navigate('AlbumTracks', { album, artist })}
      onPlayAll={actions.playAllSongs}
      onShuffle={actions.shuffleSongs}
    />
  );
};

const ArtistsRoute = ({ navigation }: NativeStackScreenProps<LibraryStackParamList, 'Artists'>) => {
  const actions = usePlaybackActions();
  const loadingFullCatalog = useLoadFullCatalog(actions.apiConnected, actions.loadAllTracks);
  return (
    <ArtistsScreen
      tracks={actions.tracks}
      loading={actions.apiInitializing || loadingFullCatalog}
      onBack={navigation.goBack}
      onOpenArtist={(artist) => navigation.navigate('ArtistTracks', { artist })}
    />
  );
};

const AlbumTracksRoute = ({
  navigation,
  route,
}: NativeStackScreenProps<LibraryStackParamList, 'AlbumTracks'>) => {
  const actions = usePlaybackActions();
  const albumTracks = actions.tracks.filter((track) =>
    (track.album.trim() || 'Unknown Album').toLocaleLowerCase() === route.params.album.toLocaleLowerCase() &&
    (track.artist.trim() || 'Unknown Artist').toLocaleLowerCase() === route.params.artist.toLocaleLowerCase(),
  );
  return (
    <SongCatalogRoute
      navigation={navigation}
      title={route.params.album}
      tracks={albumTracks}
      apiConnected={actions.apiConnected}
      apiInitializing={actions.apiInitializing}
      isLoadingTracks={actions.isLoadingTracks}
      loadError={actions.loadError}
    />
  );
};

const ArtistTracksRoute = ({
  navigation,
  route,
}: NativeStackScreenProps<LibraryStackParamList, 'ArtistTracks'>) => {
  const actions = usePlaybackActions();
  const artistTracks = actions.tracks.filter((track) =>
    (track.artist.trim() || 'Unknown Artist').toLocaleLowerCase() === route.params.artist.toLocaleLowerCase(),
  );
  return (
    <SongCatalogRoute
      navigation={navigation}
      title={route.params.artist}
      tracks={artistTracks}
      apiConnected={actions.apiConnected}
      apiInitializing={actions.apiInitializing}
      isLoadingTracks={actions.isLoadingTracks}
      loadError={actions.loadError}
    />
  );
};

const DownloadedRoute = ({ navigation }: NativeStackScreenProps<LibraryStackParamList, 'Downloaded'>) => {
  const actions = usePlaybackActions();
  return (
    <SongCatalogRoute
      navigation={navigation}
      title="Downloaded"
      tracks={actions.downloadedTracks}
      apiConnected={actions.apiConnected}
      apiInitializing={actions.apiInitializing}
      isLoadingTracks={false}
      loadError={null}
      offlineMode
      showTrackActions={false}
      onDeleteDownloadedTracks={actions.deleteDownloadedTracks}
      emptyMessage="Songs you download from your VPS library will appear here for offline listening."
    />
  );
};

const FavoritesRoute = ({ navigation }: NativeStackScreenProps<LibraryStackParamList, 'Favorites'>) => {
  const actions = usePlaybackActions();
  const { apiConnected, loadFavoriteTracks, favoriteTracks } = actions;
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!apiConnected) return;
    void loadFavoriteTracks().catch((reason) => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Could not load favorites.');
    }).finally(() => {
      if (mounted) setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [apiConnected, loadFavoriteTracks]);

  return (
    <SongCatalogRoute
      navigation={navigation}
      title="Favorites"
      tracks={favoriteTracks}
      apiConnected={apiConnected}
      apiInitializing={actions.apiInitializing}
      isLoadingTracks={apiConnected && !loaded && !error}
      loadError={error}
    />
  );
};

const PlaylistsRoute = ({ navigation }: NativeStackScreenProps<LibraryStackParamList, 'Playlists'>) => {
  const actions = usePlaybackActions();
  const { apiConnected, loadPlaylists } = actions;
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!apiConnected) return;
    void loadPlaylists().catch((error) => {
      if (mounted) Alert.alert('Could not load playlists', error instanceof Error ? error.message : 'Try again.');
    }).finally(() => {
      if (mounted) setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [apiConnected, loadPlaylists]);

  return (
    <PlaylistsScreen
      onBack={navigation.goBack}
      playlists={actions.playlists}
      loading={apiConnected && !loaded}
      onCreate={actions.createPlaylist}
      onOpen={(playlist: PlaylistSummary) => navigation.navigate('PlaylistTracks', { playlistId: playlist.id, title: playlist.name })}
      onDelete={actions.deletePlaylist}
    />
  );
};

const PlaylistTracksRoute = ({
  navigation,
  route,
}: NativeStackScreenProps<LibraryStackParamList, 'PlaylistTracks'>) => {
  const actions = usePlaybackActions();
  const { apiConnected, loadPlaylistTracks } = actions;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    setLoaded(false);
    setError(null);
    void loadPlaylistTracks(route.params.playlistId).then((items) => {
      if (mounted) setTracks(items);
    }).catch((reason) => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Could not load this playlist.');
    }).finally(() => {
      if (mounted) setLoaded(true);
    });
    return () => {
      mounted = false;
    };
  }, [loadPlaylistTracks, route.params.playlistId]));

  return (
    <SongCatalogRoute
      navigation={navigation}
      title={route.params.title}
      tracks={tracks}
      apiConnected={apiConnected}
      apiInitializing={actions.apiInitializing}
      isLoadingTracks={apiConnected && !loaded && !error}
      loadError={error}
      onTrackUpdated={(updated) => setTracks((current) => current.map((track) => track.id === updated.id ? updated : track))}
      onTrackRemoved={(trackId) => setTracks((current) => current.filter((track) => track.id !== trackId))}
      playlistMode
      onRemoveFromPlaylist={async (track) => {
        await actions.removeTrackFromPlaylist(route.params.playlistId, track);
        setTracks((current) => current.filter((item) => item.id !== track.id));
      }}
      onOpenAddSongs={() => navigation.navigate('AddSongsToPlaylist', {
        playlistId: route.params.playlistId,
        title: route.params.title,
      })}
    />
  );
};

const AddSongsToPlaylistRoute = ({
  navigation,
  route,
}: NativeStackScreenProps<LibraryStackParamList, 'AddSongsToPlaylist'>) => {
  const actions = usePlaybackActions();
  const { apiConnected, loadAllTracks, loadPlaylistTracks } = actions;
  const [tracks, setTracks] = useState<Track[]>(actions.tracks);
  const [addedTrackIds, setAddedTrackIds] = useState<string[]>([]);
  const [addingTrackIds, setAddingTrackIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      loadAllTracks(),
      loadPlaylistTracks(route.params.playlistId),
    ]).then(([libraryTracks, playlistTracks]) => {
      if (!mounted) return;
      setTracks(libraryTracks);
      setAddedTrackIds(playlistTracks.map((track) => track.id));
      setError(null);
    }).catch((reason) => {
      if (mounted) setError(reason instanceof Error ? reason.message : 'Could not load songs for this playlist.');
    }).finally(() => {
      if (mounted) setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [apiConnected, loadAllTracks, loadPlaylistTracks, route.params.playlistId]);

  const toggleTrack = async (track: Track) => {
    if (addingTrackIds.includes(track.id)) return;
    const alreadyAdded = addedTrackIds.includes(track.id);
    setAddingTrackIds((current) => [...current, track.id]);
    try {
      if (alreadyAdded) {
        await actions.removeTrackFromPlaylist(route.params.playlistId, track);
        setAddedTrackIds((current) => current.filter((id) => id !== track.id));
      } else {
        await actions.addTrackToPlaylist(route.params.playlistId, track);
        setAddedTrackIds((current) => current.includes(track.id) ? current : [...current, track.id]);
      }
    } catch (reason) {
      Alert.alert(
        alreadyAdded ? 'Could not remove song' : 'Could not add song',
        reason instanceof Error ? reason.message : 'Please try again.',
      );
    } finally {
      setAddingTrackIds((current) => current.filter((id) => id !== track.id));
    }
  };

  return (
    <SongCatalogRoute
      navigation={navigation}
      title="Add Songs"
      tracks={tracks}
      apiConnected={actions.apiConnected}
      apiInitializing={actions.apiInitializing}
      isLoadingTracks={loading}
      loadError={error}
      addToPlaylistMode
      addedPlaylistTrackIds={addedTrackIds}
      addingPlaylistTrackIds={addingTrackIds}
      onAddPlaylistTrack={toggleTrack}
      onTrackUpdated={(updated) => setTracks((current) => current.map((track) => track.id === updated.id ? updated : track))}
    />
  );
};

const DownloaderRoute = ({
  navigation,
}: NativeStackScreenProps<LibraryStackParamList, 'Downloader'>) => {
  const {
    tracks,
    playlists,
    hasActiveTrack,
    apiConnected,
    isLoadingTracks,
    loadError,
    downloadedTrackIds,
    downloadingTrackIds,
    searchTracks,
    downloadTrack,
    importAudioToLibrary,
    playTrack,
    loadPlaylists,
    playNext,
    toggleFavorite,
    addTrackToPlaylist,
    createPlaylist,
    updateTrack,
    deleteTrack,
  } = usePlaybackActions();

  useEffect(() => {
    if (apiConnected) void loadPlaylists().catch(() => undefined);
  }, [apiConnected, loadPlaylists]);

  return (
    <DownloaderScreen
      onBack={() => navigation.goBack()}
      onConnectLibrary={() => navigation.navigate('Songs')}
      onSelectTrack={playTrack}
      tracks={tracks}
      apiConnected={apiConnected}
      isLoadingTracks={isLoadingTracks}
      loadError={loadError}
      downloadedTrackIds={downloadedTrackIds}
      downloadingTrackIds={downloadingTrackIds}
      onSearch={searchTracks}
      onDownload={downloadTrack}
      onImportAudioToLibrary={importAudioToLibrary}
      playlists={playlists}
      hasActiveTrack={hasActiveTrack}
      onPlayNext={playNext}
      onToggleFavorite={toggleFavorite}
      onAddToPlaylist={addTrackToPlaylist}
      onCreatePlaylist={createPlaylist}
      onSaveTrack={async (track, changes) => { await updateTrack(track, changes); }}
      onDeleteTrack={async (track) => { await deleteTrack(track); }}
    />
  );
};

const LrcCheckerRoute = ({
  navigation,
}: NativeStackScreenProps<LibraryStackParamList, 'LrcChecker'>) => {
  const {
    tracks,
    apiConnected,
    isLoadingTracks,
    loadAllTracks,
    checkTrackLyrics,
    saveTrackLyrics,
  } = usePlaybackActions();

  return (
    <LrcCheckerScreen
      onBack={() => navigation.goBack()}
      onConnect={() => navigation.navigate('Songs')}
      tracks={tracks}
      apiConnected={apiConnected}
      isLoadingTracks={isLoadingTracks}
      onLoadAllTracks={loadAllTracks}
      onCheckTrack={checkTrackLyrics}
      onSaveTrackLyrics={saveTrackLyrics}
    />
  );
};

export const LibraryScreen = () => (
  <Stack.Navigator
    initialRouteName="LibraryHome"
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: '#000000' },
      animation: 'simple_push',
      animationDuration: 280,
      gestureEnabled: true,
      gestureDirection: 'horizontal',
      fullScreenGestureEnabled: true,
      animationMatchesGesture: true,
    }}
  >
    <Stack.Screen name="LibraryHome" component={LibraryHomeScreen} />
    <Stack.Screen name="Songs" component={SongsRoute} />
    <Stack.Screen name="Albums" component={AlbumsRoute} />
    <Stack.Screen name="Artists" component={ArtistsRoute} />
    <Stack.Screen name="AlbumTracks" component={AlbumTracksRoute} />
    <Stack.Screen name="ArtistTracks" component={ArtistTracksRoute} />
    <Stack.Screen name="Downloaded" component={DownloadedRoute} />
    <Stack.Screen name="Favorites" component={FavoritesRoute} />
    <Stack.Screen name="Playlists" component={PlaylistsRoute} />
    <Stack.Screen name="PlaylistTracks" component={PlaylistTracksRoute} />
    <Stack.Screen name="AddSongsToPlaylist" component={AddSongsToPlaylistRoute} />
    <Stack.Screen name="Downloader" component={DownloaderRoute} />
    <Stack.Screen name="LrcChecker" component={LrcCheckerRoute} />
  </Stack.Navigator>
);
