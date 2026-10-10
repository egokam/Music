import type { LyricLine, PlaylistSummary, Track } from '../types';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';

const API_BASE_URL = 'https://msc-api.egokam.site';
let apiToken = '';

export const setMusicApiToken = (token: string) => {
  apiToken = token.trim();
};

export const getMusicApiHeaders = (): Record<string, string> =>
  apiToken ? { Authorization: `Bearer ${apiToken}` } : {};

type TrackResponse = { items?: Track[]; hasMore?: boolean };
type PlaylistResponse = { items?: PlaylistSummary[] };
type LyricsResponse = {
  available?: boolean;
  source?: string | null;
  syncedLyrics?: string | null;
  plainLyrics?: string | null;
};

export type MediaLinkMetadata = {
  provider: 'Spotify' | 'SoundCloud';
  title: string;
  artist: string;
  artwork: string;
};

export type ImportProgress = {
  progress: number | null;
  message: string;
  bytesDownloaded: number;
  totalBytes: number | null;
};

export type TrackEditChanges = {
  title: string;
  artist: string;
  album: string;
  artworkUrl: string;
  lyrics?: string;
};

type ImportJobResponse = {
  jobId: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number | null;
  message: string;
  bytesDownloaded?: number;
  totalBytes?: number | null;
  track?: Track;
  error?: string;
};

const getJson = async <T,>(path: string): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: getMusicApiHeaders(),
  });
  if (!response.ok) {
    let message = `Music server returned ${response.status}.`;
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      // Keep the status based message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const sendJson = async <T,>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: { ...getMusicApiHeaders(), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    let message = `Music server returned ${response.status}.`;
    try {
      const result = await response.json();
      message = result.detail ?? message;
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

const getServerTrackId = (track: Track): string => {
  if (track.provider !== 'local' || !track.providerId) {
    throw new Error('This action is only available for tracks in the VPS library.');
  }
  return track.providerId;
};

export const parseLyrics = (syncedLyrics?: string | null, plainLyrics?: string | null): LyricLine[] => {
  if (syncedLyrics?.trim()) {
    const parsed: LyricLine[] = [];
    for (const rawLine of syncedLyrics.split(/\r?\n/)) {
      const timestamps = [...rawLine.matchAll(/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
      const text = rawLine.replace(/\[[^\]]+\]/g, '').trim();
      if (!text) {
        if (parsed.length > 0) parsed.push({ timeMs: null, text: '' });
        continue;
      }
      for (const timestamp of timestamps) {
        const fraction = timestamp[3] ?? '0';
        const millis = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction);
        parsed.push({
          timeMs: (Number(timestamp[1]) * 60 + Number(timestamp[2])) * 1000 + millis,
          text,
        });
      }
      if (timestamps.length === 0) parsed.push({ timeMs: null, text });
    }
    return parsed.sort((first, second) => (first.timeMs ?? Infinity) - (second.timeMs ?? Infinity));
  }
  return plainLyrics?.split(/\r?\n/).map((text) => ({ timeMs: null, text })) ?? [];
};

export const MusicCatalogService = {
  async searchTracks(query = '', page = 1): Promise<Track[]> {
    const params = new URLSearchParams({ q: query, page: String(page), limit: '100' });
    const result = await getJson<TrackResponse>(`/api/tracks?${params.toString()}`);
    return result.items ?? [];
  },

  async searchAllTracks(): Promise<Track[]> {
    const tracks: Track[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({ q: '', page: String(page), limit: '200' });
      const result = await getJson<TrackResponse>(`/api/tracks?${params.toString()}`);
      tracks.push(...(result.items ?? []));
      hasMore = Boolean(result.hasMore);
      page += 1;
    }

    return tracks;
  },

  async getFavoriteTracks(): Promise<Track[]> {
    const result = await getJson<TrackResponse>('/api/library/favorites');
    return result.items ?? [];
  },

  async setFavorite(track: Track, isFavorite: boolean): Promise<void> {
    await sendJson(`/api/library/favorites/${encodeURIComponent(getServerTrackId(track))}`, 'PUT', { isFavorite });
  },

  async getPlaylists(): Promise<PlaylistSummary[]> {
    const result = await getJson<PlaylistResponse>('/api/playlists');
    return result.items ?? [];
  },

  async getPlaylistTracks(playlistId: string): Promise<Track[]> {
    const result = await getJson<TrackResponse>(`/api/playlists/${encodeURIComponent(playlistId)}`);
    return result.items ?? [];
  },

  async createPlaylist(name: string): Promise<PlaylistSummary> {
    return sendJson<PlaylistSummary>('/api/playlists', 'POST', { name });
  },

  async uploadPlaylistCover(playlistId: string, uri: string, mimeType: string): Promise<string> {
    const image = new File(uri);
    const response = await expoFetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(playlistId)}/cover`, {
      method: 'PUT',
      headers: { ...getMusicApiHeaders(), 'Content-Type': mimeType },
      body: image,
    });
    if (!response.ok) {
      let message = `Music server returned ${response.status}.`;
      try {
        const result = await response.json() as { detail?: string };
        message = result.detail ?? message;
      } catch {
        // Keep the status-based message when the server did not return JSON.
      }
      throw new Error(message);
    }
    const result = await response.json() as { coverUrl: string };
    return result.coverUrl;
  },

  async addTrackToPlaylist(playlistId: string, track: Track): Promise<boolean> {
    const result = await sendJson<{ added: boolean }>(`/api/playlists/${encodeURIComponent(playlistId)}/tracks`, 'POST', {
      trackId: getServerTrackId(track),
    });
    return result.added;
  },

  async removeTrackFromPlaylist(playlistId: string, track: Track): Promise<boolean> {
    const result = await sendJson<{ removed: boolean }>(
      `/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(getServerTrackId(track))}`,
      'DELETE',
    );
    return result.removed;
  },

  async deletePlaylist(playlistId: string): Promise<void> {
    await sendJson(`/api/playlists/${encodeURIComponent(playlistId)}`, 'DELETE');
  },

  async updateTrack(track: Track, changes: TrackEditChanges): Promise<Track> {
    const updated = await sendJson<Track>(
      `/api/tracks/${encodeURIComponent(getServerTrackId(track))}`,
      'PUT',
      changes,
    );
    if (changes.lyrics === undefined) {
      return { ...track, ...updated, artwork: changes.artworkUrl || updated.artwork };
    }
    const lyrics = changes.lyrics.trim();
    const parsedLyrics = parseLyrics(lyrics);
    const hasSyncedLyrics = parsedLyrics.some((line) => line.timeMs !== null);
    const syncedLyrics = hasSyncedLyrics ? lyrics : undefined;
    const plainLyrics = lyrics && !hasSyncedLyrics ? lyrics : undefined;
    return {
      ...track,
      ...updated,
      syncedLyrics,
      plainLyrics,
      lyrics: parseLyrics(syncedLyrics, plainLyrics),
      lyricsAvailable: Boolean(lyrics),
      hasSyncedLyrics,
      hasPlainLyrics: Boolean(plainLyrics),
      artwork: changes.artworkUrl || updated.artwork,
    };
  },

  async deleteTrack(track: Track): Promise<void> {
    await sendJson(`/api/tracks/${encodeURIComponent(getServerTrackId(track))}`, 'DELETE');
  },

  async getLyrics(track: Track, syncedOnly = false): Promise<Track> {
    const params = new URLSearchParams();
    if (track.provider === 'local' && track.providerId) params.set('track_id', track.providerId);
    else {
      params.set('track_name', track.title);
      params.set('artist_name', track.artist);
      if (track.album) params.set('album_name', track.album);
      if (track.durationSeconds) params.set('duration', String(track.durationSeconds));
    }
    if (syncedOnly) params.set('synced_only', 'true');
    const result = await getJson<LyricsResponse>(`/api/lyrics?${params.toString()}`);
    return {
      ...track,
      syncedLyrics: result.syncedLyrics ?? undefined,
      plainLyrics: result.plainLyrics ?? undefined,
      lyrics: parseLyrics(result.syncedLyrics, result.plainLyrics),
      lyricsAvailable: Boolean(result.available),
      lyricsSource: result.source ?? undefined,
    };
  },

  async saveSyncedLyrics(track: Track, syncedLyrics: string): Promise<void> {
    if (track.provider !== 'local' || !track.providerId) {
      throw new Error('This track is not part of the VPS library.');
    }

    const response = await fetch(`${API_BASE_URL}/api/lyrics/${encodeURIComponent(track.providerId)}`, {
      method: 'PUT',
      headers: { ...getMusicApiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ syncedLyrics }),
    });
    if (!response.ok) {
      let message = `Music server returned ${response.status}.`;
      try {
        const body = await response.json();
        message = body.detail ?? message;
      } catch {
        // Keep the status-based message when the server did not return JSON.
      }
      throw new Error(message);
    }
  },

  async resolveMediaLink(url: string): Promise<MediaLinkMetadata> {
    const response = await fetch(`${API_BASE_URL}/api/link-preview`, {
      method: 'POST',
      headers: { ...getMusicApiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!response.ok) {
      let message = `Music server returned ${response.status}.`;
      try {
        const body = await response.json();
        message = body.detail ?? message;
      } catch {
        // Keep the status-based message when the server did not return JSON.
      }
      throw new Error(message);
    }
    return response.json() as Promise<MediaLinkMetadata>;
  },

  async importAudioUrl(
    url: string,
    title: string,
    artist: string,
    sourceUrl: string,
    onProgress: (progress: ImportProgress) => void,
  ): Promise<Track> {
    const response = await fetch(`${API_BASE_URL}/api/import-jobs`, {
      method: 'POST',
      headers: { ...getMusicApiHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, title, artist, sourceUrl }),
    });
    if (!response.ok) {
      let message = `Music server returned ${response.status}.`;
      try {
        const body = await response.json();
        message = body.detail ?? message;
      } catch {
        // Keep the status-based message when the server did not return JSON.
      }
      throw new Error(message);
    }

    const { jobId } = (await response.json()) as { jobId: string };
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 650));
      const statusResponse = await fetch(`${API_BASE_URL}/api/import-jobs/${encodeURIComponent(jobId)}`, {
        headers: getMusicApiHeaders(),
      });
      if (!statusResponse.ok) {
        let message = `Music server returned ${statusResponse.status}.`;
        try {
          const body = await statusResponse.json();
          message = body.detail ?? message;
        } catch {
          // Keep the status-based message when the server did not return JSON.
        }
        throw new Error(message);
      }

      const job = (await statusResponse.json()) as ImportJobResponse;
      onProgress({
        progress: job.progress,
        message: job.message,
        bytesDownloaded: job.bytesDownloaded ?? 0,
        totalBytes: job.totalBytes ?? null,
      });
      if (job.status === 'complete' && job.track) return job.track;
      if (job.status === 'failed') throw new Error(job.error ?? 'The VPS could not import this audio file.');
    }
  },
};
