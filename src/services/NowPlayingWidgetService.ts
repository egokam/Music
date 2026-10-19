import { Directory, File, Paths } from 'expo-file-system';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getMusicApiHeaders } from './MusicCatalogService';
import type { Track } from '../types';
import type { NowPlayingWidgetProps } from '../widgets/NowPlayingWidget.ios';

type WidgetHandle = {
  updateSnapshot: (props: NowPlayingWidgetProps) => void;
};

const savedTrackFile = new File(Paths.document, 'musiqapp-last-played-track.json');
let widgetHandle: WidgetHandle | null = null;
let widgetDirectory = '';
let updateGeneration = 0;

const emptyWidgetSnapshot: NowPlayingWidgetProps = {
  trackId: '',
  title: '',
  artist: '',
  artworkUri: '',
  isPlaying: false,
};

const safeFileName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

const artworkHash = (value: string) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

const saveTrack = (track: Track) => {
  const persistedTrack: Track = {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    durationSeconds: track.durationSeconds,
    artwork: track.artwork,
    provider: track.provider,
    providerId: track.providerId,
    mixId: track.mixId,
    mixOffset: track.mixOffset,
    streamUrl: track.streamUrl,
    downloadUrl: track.downloadUrl,
    localUri: track.localUri,
  };

  if (savedTrackFile.exists) savedTrackFile.delete();
  savedTrackFile.create({ intermediates: true });
  savedTrackFile.write(JSON.stringify(persistedTrack));
};

const getWidget = (): WidgetHandle | null => {
  if (Platform.OS !== 'ios') return null;
  // expo-widgets is a native module and is not included in Expo Go.
  if (Constants.expoGoConfig) return null;
  if (widgetHandle) return widgetHandle;

  try {
    // Keep Expo Go working: it does not contain ExpoWidgets or the generated widget target.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const widgetApi = require('expo-widgets') as typeof import('expo-widgets');
    // The generic .ts fallback sorts before .ios.tsx in Metro's source extensions,
    // so target the iOS layout directly to register its real widget tree.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const widgetModule = require('../widgets/NowPlayingWidget.ios') as { default: WidgetHandle };
    widgetDirectory = widgetApi.widgetsDirectory;
    widgetHandle = widgetModule.default;
    return widgetHandle;
  } catch (error) {
    console.warn('[NowPlayingWidget] Could not load the native widget module:', error);
    return null;
  }
};

const getArtworkUri = async (track: Track): Promise<string> => {
  if (!track.artwork || !widgetDirectory) return '';

  const artworkName = `${safeFileName(track.id)}-${artworkHash(track.artwork)}.artwork`;
  const targetFile = new File(widgetDirectory, artworkName);
  if (targetFile.exists) return targetFile.uri;

  try {
    if (track.artwork.startsWith('file://')) {
      await new File(track.artwork).copy(targetFile);
    } else {
      await File.downloadFileAsync(track.artwork, targetFile, {
        headers: track.provider === 'local' ? getMusicApiHeaders() : undefined,
        idempotent: true,
      });
    }
    return targetFile.exists ? targetFile.uri : '';
  } catch {
    return '';
  }
};

const pruneArtworkCache = (currentArtworkUri: string) => {
  if (!widgetDirectory) return;
  try {
    const artworkFiles = new Directory(widgetDirectory).list()
      .filter((entry): entry is File => entry instanceof File && entry.name.endsWith('.artwork'))
      .sort((first, second) => (second.modificationTime ?? 0) - (first.modificationTime ?? 0));
    let retained = 0;
    artworkFiles.forEach((file) => {
      if (file.uri === currentArtworkUri || retained < 12) {
        retained += 1;
      } else {
        file.delete();
      }
    });
  } catch {
    // Artwork cache cleanup is best-effort and must never interrupt playback.
  }
};

const publishTrack = async (track: Track, isPlaying: boolean, generation: number) => {
  const widget = getWidget();
  if (!widget) return;

  const artworkUri = await getArtworkUri(track);
  if (generation !== updateGeneration) return;

  widget.updateSnapshot({
    trackId: track.id,
    title: track.title,
    artist: track.artist,
    artworkUri,
    isPlaying,
  });
  pruneArtworkCache(artworkUri);
};

export const NowPlayingWidgetService = {
  async initialize() {
    const widget = getWidget();
    if (!widget) return;

    const generation = ++updateGeneration;
    const savedTrack = await NowPlayingWidgetService.getSavedTrack();
    if (generation !== updateGeneration) return;
    if (savedTrack) {
      await publishTrack(savedTrack, false, generation);
    } else {
      widget.updateSnapshot(emptyWidgetSnapshot);
    }
  },

  async update(track: Track, isPlaying: boolean) {
    try {
      saveTrack(track);
    } catch {
      // Keep audio playback working if persisting widget metadata fails.
    }

    const generation = ++updateGeneration;
    await publishTrack(track, isPlaying, generation);
  },

  async getSavedTrack(): Promise<Track | null> {
    if (!savedTrackFile.exists) return null;
    try {
      const track = JSON.parse(await savedTrackFile.text()) as Track;
      if (
        typeof track.id !== 'string' ||
        typeof track.title !== 'string' ||
        typeof track.artist !== 'string' ||
        typeof track.artwork !== 'string'
      ) {
        return null;
      }
      return track;
    } catch {
      return null;
    }
  },
};
