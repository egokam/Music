import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LrcCheckerRow, type LrcCheckState } from '../components/library/LrcCheckerRow';
import type { Track } from '../types';

const hasTimedLyrics = (track: Track) => Boolean(
  track.syncedLyrics?.match(/^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*\S/m)
  || track.lyrics?.some((line) => line.timeMs !== null && line.text.trim()),
);

const isTimedLrc = (value: string | undefined) => Boolean(
  value?.match(/^\s*\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*\S/m),
);

const LRC_TIMESTAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
const LRC_PREFIX = /^\s*((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*)+)(.*)$/;
const LRC_METADATA = /^\s*(?:\[(?:ar|al|ti|au|by|re|ve|length|offset|kana|la|id):[^\]]*\]\s*)+$/i;

const getDurationSeconds = (track: Track) => {
  if (track.durationSeconds && Number.isFinite(track.durationSeconds) && track.durationSeconds > 0) return track.durationSeconds;
  if (!track.duration?.trim()) return undefined;
  const rawParts = track.duration.split(':');
  if (rawParts.some((part) => !/^\d+$/.test(part))) return undefined;
  const parts = rawParts.map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return undefined;
};

const validateCustomLrc = (value: string, durationSeconds?: number) => {
  const lines = value.replace(/^\uFEFF/, '').split(/\r?\n/);
  let timedLyricLines = 0;
  let previousTimestamp = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (!line || LRC_METADATA.test(line)) continue;

    const match = line.match(LRC_PREFIX);
    if (!match) {
      return `Line ${index + 1} needs a time tag such as [00:12.34].`;
    }

    const lyricText = match[2].replace(/\[[^\]]+\]/g, '').trim();
    const timestamps = [...match[1].matchAll(LRC_TIMESTAMP)];
    for (const timestamp of timestamps) {
      const minutes = Number(timestamp[1]);
      const seconds = Number(timestamp[2]);
      const fraction = timestamp[3] ?? '';
      if (seconds > 59) return `Line ${index + 1} has invalid seconds. Use 00–59.`;
      const fractionMs = fraction.length === 1 ? Number(fraction) * 100 : fraction.length === 2 ? Number(fraction) * 10 : Number(fraction);
      const timestampMs = (minutes * 60 + seconds) * 1000 + fractionMs;
      if (timestampMs < previousTimestamp) return 'Put lyric lines in time order before previewing.';
      if (durationSeconds && timestampMs > (durationSeconds + 15) * 1000) {
        return `Line ${index + 1} is more than 15 seconds past this track’s duration.`;
      }
      previousTimestamp = timestampMs;
    }
    if (lyricText) timedLyricLines += 1;
  }

  return timedLyricLines ? null : 'Add at least one lyric line with a time tag and text.';
};

export const LrcCheckerScreen = ({
  onBack,
  onConnect,
  tracks,
  apiConnected,
  isLoadingTracks,
  onLoadAllTracks,
  onCheckTrack,
  onSaveTrackLyrics,
}: {
  onBack: () => void;
  onConnect: () => void;
  tracks: Track[];
  apiConnected: boolean;
  isLoadingTracks: boolean;
  onLoadAllTracks: () => Promise<Track[]>;
  onCheckTrack: (track: Track) => Promise<Track>;
  onSaveTrackLyrics: (track: Track, syncedLyrics: string) => Promise<Track>;
}) => {
  const [states, setStates] = useState<Record<string, LrcCheckState>>({});
  const [results, setResults] = useState<Record<string, Track>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [reviewTrack, setReviewTrack] = useState<Track | null>(null);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [customLrcTrack, setCustomLrcTrack] = useState<Track | null>(null);
  const [customLrcText, setCustomLrcText] = useState('');
  const [customLrcPreview, setCustomLrcPreview] = useState(false);
  const [customLrcError, setCustomLrcError] = useState<string | null>(null);
  const [isSavingCustomLrc, setIsSavingCustomLrc] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const scanGeneration = useRef(0);
  const stopRequested = useRef(false);
  const scanRunning = useRef(false);

  useEffect(() => () => {
    scanGeneration.current += 1;
    stopRequested.current = true;
  }, []);

  const stateFor = (track: Track): LrcCheckState => states[track.id] ?? (
    hasTimedLyrics(track) || track.hasSyncedLyrics
      ? 'synced'
      : track.hasPlainLyrics || track.plainLyrics?.trim()
        ? 'plain'
        : 'unchecked'
  );
  const syncedCount = tracks.reduce((count, track) => count + (stateFor(track) === 'synced' ? 1 : 0), 0);
  const checkedCount = tracks.reduce((count, track) => count + (['synced', 'plain', 'missing', 'candidate'].includes(stateFor(track)) ? 1 : 0), 0);
  const filteredTracks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLocaleLowerCase().includes(query));
  }, [search, tracks]);

  const checkTrack = async (track: Track, generation?: number, openPreview = false) => {
    setStates((current) => ({ ...current, [track.id]: 'checking' }));
    setErrors((current) => ({ ...current, [track.id]: '' }));
    try {
      const result = await onCheckTrack(track);
      if (generation !== undefined && generation !== scanGeneration.current) return result;
      setResults((current) => ({ ...current, [track.id]: result }));
      const nextState: LrcCheckState = isTimedLrc(result.syncedLyrics)
        ? result.lyricsSource === 'local_lrc' || result.lyricsSource === 'embedded_lrc' ? 'synced' : 'candidate'
        : result.plainLyrics?.trim() ? 'plain' : 'missing';
      setStates((current) => ({ ...current, [track.id]: nextState }));
      if (openPreview && nextState === 'candidate') setReviewTrack(result);
      return result;
    } catch (error) {
      if (generation === undefined || generation === scanGeneration.current) {
        setStates((current) => ({ ...current, [track.id]: 'error' }));
        setErrors((current) => ({
          ...current,
          [track.id]: error instanceof Error ? error.message : 'The lyrics service request failed. Try again later.',
        }));
      }
      throw error;
    }
  };

  const scanAll = async () => {
    if (scanRunning.current) return;
    if (!apiConnected) {
      onConnect();
      return;
    }

    const generation = ++scanGeneration.current;
    scanRunning.current = true;
    stopRequested.current = false;
    setIsStopping(false);
    setIsScanning(true);
    setScanError(null);
    setProgress({ completed: 0, total: tracks.length });
    let libraryTracks = tracks;
    try {
      setIsLoadingCatalog(true);
      libraryTracks = await onLoadAllTracks();
      if (generation !== scanGeneration.current || stopRequested.current) return;
      setIsLoadingCatalog(false);
      setProgress({ completed: 0, total: libraryTracks.length });

      for (let index = 0; index < libraryTracks.length; index += 1) {
        if (generation !== scanGeneration.current || stopRequested.current) break;
        const track = libraryTracks[index];
        if (stateFor(track) === 'synced' || hasTimedLyrics(track)) {
          if (track.hasSyncedLyrics && !hasTimedLyrics(track) && !results[track.id]?.syncedLyrics) {
            try {
              await checkTrack(track, generation);
            } catch {
              // Keep the lookup error visible if embedded lyrics could not be loaded.
            }
          } else {
            setStates((current) => ({ ...current, [track.id]: 'synced' }));
          }
        } else {
          try {
            await checkTrack(track, generation);
          } catch {
            // Keep the error on this row and continue checking the rest of the library.
          }
        }
        setProgress({ completed: index + 1, total: libraryTracks.length });
        if (index < libraryTracks.length - 1 && generation === scanGeneration.current && !stopRequested.current) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }
    } catch (error) {
      setScanError(error instanceof Error ? error.message : 'Could not load the whole music library.');
    } finally {
      if (generation === scanGeneration.current) {
        setIsLoadingCatalog(false);
        setIsScanning(false);
        setIsStopping(false);
      }
      scanRunning.current = false;
    }
  };

  const stopScan = () => {
    stopRequested.current = true;
    setIsStopping(true);
  };

  const saveReview = async () => {
    if (!reviewTrack?.syncedLyrics) return;
    setIsSavingReview(true);
    try {
      const saved = await onSaveTrackLyrics(reviewTrack, reviewTrack.syncedLyrics);
      setResults((current) => ({ ...current, [reviewTrack.id]: saved }));
      setStates((current) => ({ ...current, [reviewTrack.id]: 'synced' }));
      setErrors((current) => ({ ...current, [reviewTrack.id]: '' }));
      setReviewTrack(null);
    } catch (error) {
      Alert.alert('Could not save LRC', error instanceof Error ? error.message : 'Try saving this lyric file again.');
    } finally {
      setIsSavingReview(false);
    }
  };

  const discardReview = () => {
    if (!reviewTrack) return;
    const trackId = reviewTrack.id;
    setStates((current) => ({
      ...current,
      [trackId]: reviewTrack.plainLyrics?.trim() ? 'plain' : 'missing',
    }));
    setResults((current) => {
      const next = { ...current };
      delete next[trackId];
      return next;
    });
    setReviewTrack(null);
  };

  const openCustomLrc = (track: Track) => {
    if (!apiConnected) {
      onConnect();
      return;
    }
    if (track.provider !== 'local' || !track.providerId) {
      Alert.alert('VPS track required', 'Custom LRC files are saved beside audio files in your VPS library.');
      return;
    }
    setCustomLrcTrack(track);
    setCustomLrcText(track.syncedLyrics ?? '');
    setCustomLrcPreview(false);
    setCustomLrcError(null);
  };

  const previewCustomLrc = () => {
    if (!customLrcTrack) return;
    const error = validateCustomLrc(customLrcText, getDurationSeconds(customLrcTrack));
    setCustomLrcError(error);
    if (!error) setCustomLrcPreview(true);
  };

  const applyCustomLrc = async () => {
    if (!customLrcTrack) return;
    if (customLrcTrack.provider !== 'local' || !customLrcTrack.providerId) {
      setCustomLrcError('This song is not a VPS library file, so its LRC cannot be saved beside the audio.');
      setCustomLrcPreview(false);
      return;
    }
    const error = validateCustomLrc(customLrcText, getDurationSeconds(customLrcTrack));
    if (error) {
      setCustomLrcError(error);
      setCustomLrcPreview(false);
      return;
    }

    setIsSavingCustomLrc(true);
    try {
      const saved = await onSaveTrackLyrics(customLrcTrack, customLrcText.trim());
      setResults((current) => ({ ...current, [customLrcTrack.id]: saved }));
      setStates((current) => ({ ...current, [customLrcTrack.id]: 'synced' }));
      setErrors((current) => ({ ...current, [customLrcTrack.id]: '' }));
      setCustomLrcTrack(null);
      setCustomLrcText('');
      setCustomLrcPreview(false);
    } catch (error) {
      setCustomLrcError(error instanceof Error ? error.message : 'Could not save this LRC beside the VPS track.');
      setCustomLrcPreview(false);
    } finally {
      setIsSavingCustomLrc(false);
    }
  };

  const closeCustomLrc = () => {
    if (isSavingCustomLrc) return;
    setCustomLrcTrack(null);
    setCustomLrcText('');
    setCustomLrcPreview(false);
    setCustomLrcError(null);
  };

  const reviewLines = reviewTrack?.syncedLyrics?.split(/\r?\n/).filter((line) => line.trim()).slice(0, 8) ?? [];
  const isBusy = isScanning || isLoadingCatalog;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <View style={{ flex: 1 }}>
        <View style={{ height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Back to Library"
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={27} color="white" />
          </TouchableOpacity>
          <View style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#1C1C1E', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="time-outline" size={19} color="#FA5265" />
            <Text style={{ color: 'white', fontSize: 13, fontWeight: '700' }}>LYRICS</Text>
          </View>
        </View>

        <FlatList
          data={filteredTracks}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 190 }}
          ListHeaderComponent={(
            <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
              <Text style={{ color: 'white', fontSize: 36, lineHeight: 42, fontWeight: '800' }}>LRC Checker</Text>
              <Text style={{ color: '#A1A1A6', fontSize: 15, lineHeight: 21, marginTop: 7 }}>
              Search LRCLIB, Musixmatch, NetEase, and Megalobiz. Review alternate matches before saving; synced lyrics are embedded in VPS audio files and kept with offline downloads.
              </Text>

              <View style={{ marginTop: 18, padding: 15, borderRadius: 18, backgroundColor: '#1C1C1E' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(250,36,60,0.16)', alignItems: 'center', justifyContent: 'center', marginRight: 11 }}>
                      <Ionicons name="musical-notes" size={18} color="#FA5265" />
                    </View>
                    <View>
                      <Text style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>{syncedCount} with synced lyrics</Text>
                      <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 3 }}>{checkedCount} of {tracks.length} checked</Text>
                    </View>
                  </View>
                  <Text style={{ color: '#A1A1A6', fontSize: 12, fontWeight: '600' }}>
                    {isBusy ? `${progress.completed}/${progress.total || tracks.length}` : 'LRC'}
                  </Text>
                </View>

                {isBusy ? (
                  <View style={{ height: 3, borderRadius: 2, backgroundColor: '#3A3A3C', marginTop: 13, overflow: 'hidden' }}>
                    <View style={{ width: `${progress.total ? Math.max(4, (progress.completed / progress.total) * 100) : 4}%`, height: '100%', backgroundColor: '#FA243C' }} />
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={() => isScanning ? stopScan() : void scanAll()}
                  disabled={isLoadingTracks}
                  accessibilityRole="button"
                  accessibilityLabel={isScanning ? 'Stop library scan' : 'Scan all tracks for synced lyrics'}
                  style={{ height: 48, borderRadius: 24, backgroundColor: isScanning ? '#303033' : '#28282B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, opacity: isLoadingTracks ? 0.6 : 1 }}
                >
                  {isBusy ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="scan-outline" size={19} color="#FA5265" />}
                  <Text style={{ color: 'white', fontSize: 15, fontWeight: '700', marginLeft: 9 }}>
                    {isLoadingCatalog ? (isStopping ? 'Stopping…' : 'Loading your full library…') : isScanning ? (isStopping ? 'Finishing current track…' : 'Stop scan') : apiConnected ? 'Scan all tracks' : 'Connect library to scan'}
                  </Text>
                </TouchableOpacity>
              </View>

              {!apiConnected ? (
                <TouchableOpacity onPress={onConnect} style={{ marginTop: 13, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, backgroundColor: '#161618', flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="cloud-outline" size={18} color="#FA5265" />
                  <Text style={{ color: '#B8B8BD', fontSize: 13, lineHeight: 18, marginLeft: 9, flex: 1 }}>Connect the VPS library to search lyrics databases and save LRC files with your tracks.</Text>
                  <Ionicons name="chevron-forward" size={17} color="#77777C" />
                </TouchableOpacity>
              ) : null}

              <View style={{ height: 48, marginTop: 20, paddingHorizontal: 14, borderRadius: 24, backgroundColor: '#1C1C1E', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="search" size={20} color="#A1A1A6" />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Filter songs or artists"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  returnKeyType="search"
                  style={{ flex: 1, color: 'white', fontSize: 16, marginLeft: 10, padding: 0 }}
                />
                {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color="#8E8E93" /></TouchableOpacity> : null}
              </View>

              <Text style={{ color: '#8E8E93', fontSize: 12, fontWeight: '700', letterSpacing: 0.7, marginTop: 24, marginBottom: 5 }}>
                YOUR SONGS
              </Text>
              {scanError ? <Text style={{ color: '#FF6B5E', fontSize: 13, marginTop: 6 }}>{scanError}</Text> : null}
            </View>
          )}
          renderItem={({ item }) => {
            const state = stateFor(item);
            const result = results[item.id];
            return (
              <LrcCheckerRow
                track={item}
                state={state}
                errorMessage={errors[item.id]}
                disabled={isScanning && state !== 'candidate'}
                onCheck={() => apiConnected ? void checkTrack(item, undefined, true).catch(() => undefined) : onConnect()}
                onReview={() => result && setReviewTrack(result)}
                onPaste={() => openCustomLrc(item)}
              />
            );
          }}
          ListEmptyComponent={(
            <View style={{ alignItems: 'center', paddingHorizontal: 35, paddingTop: 48 }}>
              {isLoadingTracks ? <ActivityIndicator color="#FA5265" /> : <Ionicons name="musical-notes-outline" size={34} color="#66666B" />}
              <Text style={{ color: '#A1A1A6', fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 12 }}>
                {isLoadingTracks ? 'Loading tracks…' : search ? 'No songs match this filter.' : 'Your library tracks will appear here.'}
              </Text>
            </View>
          )}
        />
      </View>

      <Modal visible={Boolean(reviewTrack)} transparent animationType="fade" onRequestClose={discardReview}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: '#1C1C1E', borderRadius: 22, padding: 20, maxHeight: '76%' }}>
            <Text style={{ color: 'white', fontSize: 21, lineHeight: 26, fontWeight: '800' }} numberOfLines={2}>{reviewTrack?.title}</Text>
            <Text style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>{reviewTrack?.artist}</Text>
            <Text style={{ color: '#FA5265', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 20, marginBottom: 9 }}>SYNCED LYRICS PREVIEW</Text>
            <View style={{ maxHeight: 290 }}>
              {reviewLines.map((line, index) => (
                <Text key={`${reviewTrack?.id}-preview-${index}`} numberOfLines={1} style={{ color: 'white', fontSize: 14, lineHeight: 23, fontWeight: '600' }}>{line}</Text>
              ))}
            </View>
            <Text style={{ color: '#8E8E93', fontSize: 12, lineHeight: 17, marginTop: 13 }}>
              Review the match before applying it. The synced LRC will be saved beside the audio and used in place of plain lyrics.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity onPress={discardReview} disabled={isSavingReview} style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: '#303033', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => void saveReview()} disabled={isSavingReview} style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: '#FA243C', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}>
                {isSavingReview ? <ActivityIndicator size="small" color="white" /> : null}
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '700', marginLeft: isSavingReview ? 7 : 0 }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(customLrcTrack)} transparent animationType="fade" onRequestClose={closeCustomLrc}>
        <KeyboardAvoidingView
          behavior="padding"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 18 }}
        >
          <View style={{ backgroundColor: '#1C1C1E', borderRadius: 22, padding: 19, maxHeight: '92%' }}>
            <Text style={{ color: 'white', fontSize: 21, lineHeight: 26, fontWeight: '800' }} numberOfLines={2}>{customLrcTrack?.title}</Text>
            <Text style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>{customLrcTrack?.artist}</Text>
            <Text style={{ color: '#FA5265', fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginTop: 17, marginBottom: 8 }}>
              {customLrcPreview ? 'PREVIEW · TIMED LYRICS' : 'PASTE CUSTOM LRC'}
            </Text>

            {customLrcPreview ? (
              <View style={{ maxHeight: 255, borderRadius: 13, backgroundColor: '#111113', padding: 12 }}>
                {customLrcText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim()).slice(0, 10).map((line, index) => (
                  <Text key={`custom-lrc-${index}`} numberOfLines={1} style={{ color: 'white', fontSize: 13, lineHeight: 21 }}>{line}</Text>
                ))}
                {customLrcText.split(/\r?\n/).filter((line) => line.trim()).length > 10 ? (
                  <Text style={{ color: '#8E8E93', fontSize: 12, marginTop: 5 }}>
                    +{customLrcText.split(/\r?\n/).filter((line) => line.trim()).length - 10} more lines
                  </Text>
                ) : null}
              </View>
            ) : (
              <TextInput
                value={customLrcText}
                onChangeText={(value) => {
                  setCustomLrcText(value);
                  setCustomLrcError(null);
                }}
                placeholder={'[00:12.34]First lyric line\n[00:16.80]Next lyric line'}
                placeholderTextColor="#747479"
                multiline
                scrollEnabled
                autoCorrect={false}
                autoCapitalize="none"
                textAlignVertical="top"
                selectionColor="#FA5265"
                style={{ minHeight: 190, maxHeight: 310, borderRadius: 13, backgroundColor: '#111113', color: 'white', fontSize: 14, lineHeight: 21, padding: 12 }}
              />
            )}

            <Text style={{ color: '#8E8E93', fontSize: 12, lineHeight: 17, marginTop: 12 }}>
              Paste LRC lines like [00:12.34]lyric text. Every lyric line must have a valid, ordered time tag. Applying embeds the synced lyrics in the audio file on your VPS.
            </Text>
            {customLrcError ? <Text style={{ color: '#FF6B5E', fontSize: 12, lineHeight: 17, marginTop: 9 }}>{customLrcError}</Text> : null}

            <View style={{ flexDirection: 'row', gap: 9, marginTop: 17 }}>
              {customLrcPreview ? (
                <TouchableOpacity
                  onPress={() => {
                    setCustomLrcPreview(false);
                    setCustomLrcError(null);
                  }}
                  disabled={isSavingCustomLrc}
                  style={{ flex: 0.9, height: 46, borderRadius: 23, backgroundColor: '#303033', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>Edit</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={closeCustomLrc}
                disabled={isSavingCustomLrc}
                style={{ flex: 1, height: 46, borderRadius: 23, backgroundColor: '#303033', alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>Discard</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => customLrcPreview ? void applyCustomLrc() : previewCustomLrc()}
                disabled={isSavingCustomLrc}
                style={{ flex: 1.15, height: 46, borderRadius: 23, backgroundColor: '#FA243C', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
              >
                {isSavingCustomLrc ? <ActivityIndicator size="small" color="white" /> : null}
                <Text style={{ color: 'white', fontSize: 14, fontWeight: '700', marginLeft: isSavingCustomLrc ? 7 : 0 }}>
                  {isSavingCustomLrc ? 'Saving…' : customLrcPreview ? 'Apply' : 'Preview'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};
