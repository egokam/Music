import { Directory, File, Paths } from 'expo-file-system';
import { getMusicApiHeaders, parseLyrics } from './MusicCatalogService';
import type { Track } from '../types';

const downloadsDirectory = new Directory(Paths.document, 'musiqapp-downloads');
const indexFile = new File(downloadsDirectory, 'downloads.json');

const ensureDirectory = () => {
  if (!downloadsDirectory.exists) {
    downloadsDirectory.create({ idempotent: true, intermediates: true });
  }
};

const safeName = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '_');

const writeTextFile = (file: File, text: string) => {
  if (file.exists) file.delete();
  file.create({ intermediates: true });
  file.write(text);
};

export const OfflineMusicService = {
  async getDownloadedTracks(): Promise<Track[]> {
    ensureDirectory();
    if (!indexFile.exists) return [];
    try {
      const tracks = JSON.parse(await indexFile.text()) as Track[];
      return tracks.filter((track) => track.localUri && new File(track.localUri).exists);
    } catch {
      return [];
    }
  },

  async downloadTrack(track: Track): Promise<Track> {
    if (!track.downloadAllowed || !track.downloadUrl) {
      throw new Error('This track is not available for download.');
    }
    ensureDirectory();
    const fileExtension = track.fileExtension || '.mp3';
    const fileName = `${safeName(track.id)}${fileExtension}`;
    const audioFile = new File(downloadsDirectory, fileName);
    await File.downloadFileAsync(track.downloadUrl, audioFile, {
      headers: getMusicApiHeaders(),
      idempotent: true,
    });

    let lyricsFileUri: string | undefined;
    if (track.syncedLyrics?.trim()) {
      const lyricsFile = new File(downloadsDirectory, `${safeName(track.id)}.lrc`);
      writeTextFile(lyricsFile, track.syncedLyrics);
      lyricsFileUri = lyricsFile.uri;
    } else if (track.plainLyrics?.trim()) {
      const lyricsFile = new File(downloadsDirectory, `${safeName(track.id)}.txt`);
      writeTextFile(lyricsFile, track.plainLyrics);
      lyricsFileUri = lyricsFile.uri;
    }

    const downloadedTrack: Track = { ...track, localUri: audioFile.uri, lyricsFileUri };
    const current = await this.getDownloadedTracks();
    const updated = [...current.filter((item) => item.id !== track.id), downloadedTrack];
    writeTextFile(indexFile, JSON.stringify(updated));
    return downloadedTrack;
  },

  async saveSyncedLyrics(track: Track, syncedLyrics: string): Promise<Track> {
    const trackWithLyrics: Track = {
      ...track,
      syncedLyrics,
      lyrics: parseLyrics(syncedLyrics),
      lyricsAvailable: true,
      hasSyncedLyrics: true,
    };
    const current = await this.getDownloadedTracks();
    const savedTrack = current.find((item) => item.id === track.id);
    if (!savedTrack) return trackWithLyrics;

    ensureDirectory();
    const lyricsFile = new File(downloadsDirectory, `${safeName(track.id)}.lrc`);
    writeTextFile(lyricsFile, syncedLyrics);
    const textFile = new File(downloadsDirectory, `${safeName(track.id)}.txt`);
    if (textFile.exists) textFile.delete();

    const updatedTrack: Track = {
      ...savedTrack,
      ...trackWithLyrics,
      localUri: savedTrack.localUri,
      lyricsFileUri: lyricsFile.uri,
    };
    const updatedTracks = [...current.filter((item) => item.id !== track.id), updatedTrack];
    writeTextFile(indexFile, JSON.stringify(updatedTracks));
    return updatedTrack;
  },

  async updateTrack(track: Track): Promise<void> {
    const current = await this.getDownloadedTracks();
    if (!current.some((item) => item.id === track.id)) return;
    const updatedTracks = current.map((item) => item.id === track.id
      ? { ...item, ...track, localUri: item.localUri }
      : item,
    );
    writeTextFile(indexFile, JSON.stringify(updatedTracks));
  },

  async removeDownloadedTracks(trackIds: string[]): Promise<{ removedTrackIds: string[]; freedBytes: number }> {
    const requestedIds = new Set(trackIds);
    const current = await this.getDownloadedTracks();
    const remaining: Track[] = [];
    const removedTrackIds: string[] = [];
    let freedBytes = 0;

    for (const track of current) {
      if (!requestedIds.has(track.id) || !track.localUri) {
        remaining.push(track);
        continue;
      }

      const audioFile = new File(track.localUri);
      if (audioFile.exists) {
        try {
          const audioBytes = audioFile.size;
          audioFile.delete();
          freedBytes += audioBytes;
        } catch {
          remaining.push(track);
          continue;
        }
      }

      if (track.lyricsFileUri) {
        const lyricsFile = new File(track.lyricsFileUri);
        if (lyricsFile.exists) {
          try {
            const lyricsBytes = lyricsFile.size;
            lyricsFile.delete();
            freedBytes += lyricsBytes;
          } catch {
            // The audio is already removed; keep the download removal successful.
          }
        }
      }
      removedTrackIds.push(track.id);
    }

    writeTextFile(indexFile, JSON.stringify(remaining));
    return { removedTrackIds, freedBytes };
  },

};
