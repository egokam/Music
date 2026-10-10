import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePlaybackActions } from '../contexts/PlaybackContext';
import { AUDIO_MIXES, AudiusCatalogService, type AudiusMixDefinition, type AudiusMixId } from '../services/AudiusCatalogService';
import type { Track } from '../types';

type HomeNavigation = BottomTabNavigationProp<{
  Home: undefined;
  Radio: undefined;
  Library: { screen: 'DeveloperProfile' } | undefined;
  Search: undefined;
}, 'Home'>;

type RadioStation = {
  stationuuid: string;
  name: string;
  url?: string;
  url_resolved?: string;
  favicon?: string;
  country?: string;
  language?: string;
  lastcheckok?: number | boolean;
};

type MixTracks = Record<AudiusMixId, Track[]>;

const RADIO_DIRECTORY_MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
];

const PAYPAL_DONATION_URL = 'https://paypal.me/kotmanii';
const PAYPAL_ME_SETUP_URL = 'https://www.paypal.com/paypalme/';

const emptyMixTracks = (): MixTracks => ({
  arabic: [],
  morocco: [],
  english: [],
  'mix-2026': [],
  'golden-2017': [],
});

const getStationStreamUrl = (station: RadioStation) => {
  const url = station.url_resolved?.trim() || station.url?.trim() || '';
  return url.startsWith('https://') ? url : '';
};

const loadHomeStations = async (): Promise<RadioStation[]> => {
  let lastError: unknown;

  for (const mirror of RADIO_DIRECTORY_MIRRORS) {
    try {
      const response = await fetch(`${mirror}/json/stations/topclick/24?hidebroken=true&is_https=true`, {
        headers: { Accept: 'application/json', 'User-Agent': 'Musiqapp/1.0' },
      });
      if (!response.ok) {
        lastError = new Error(`Radio directory returned ${response.status}.`);
        continue;
      }

      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error('Radio directory returned an invalid station list.');

      const seen = new Set<string>();
      return (payload as RadioStation[]).filter((station) => {
        if (!station.stationuuid || !station.name?.trim() || !getStationStreamUrl(station)) return false;
        if (station.lastcheckok === 0 || station.lastcheckok === false || seen.has(station.stationuuid)) return false;
        seen.add(station.stationuuid);
        return true;
      }).slice(0, 16);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Radio directory is unavailable.');
};

const reportStationClick = (stationId: string) => {
  void (async () => {
    for (const mirror of RADIO_DIRECTORY_MIRRORS) {
      try {
        const response = await fetch(`${mirror}/json/url/${encodeURIComponent(stationId)}`, {
          headers: { Accept: 'application/json', 'User-Agent': 'Musiqapp/1.0' },
        });
        if (response.ok) return;
      } catch {
        // Station click reporting is best effort and must not block playback.
      }
    }
  })();
};

const toStationTrack = (station: RadioStation): Track => ({
  id: `radio:${station.stationuuid}`,
  provider: 'radio',
  providerId: station.stationuuid,
  title: station.name.trim(),
  artist: station.country?.trim() || station.language?.split(',')[0]?.trim() || 'Live Radio',
  album: 'Live Radio',
  duration: 'LIVE',
  durationSeconds: 0,
  artwork: station.favicon?.startsWith('https://') ? station.favicon : '',
  streamUrl: getStationStreamUrl(station),
  downloadUrl: null,
  downloadAllowed: false,
});

const PressableCard = memo(({
  children,
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}) => {
  const [scale] = useState(() => new Animated.Value(1));

  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => Animated.spring(scale, { toValue: 0.975, damping: 18, stiffness: 300, mass: 0.65, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, damping: 16, stiffness: 260, mass: 0.65, useNativeDriver: true }).start()}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});
PressableCard.displayName = 'PressableCard';

const NonStopMixCard = memo(({
  mix,
  tracks,
  loading,
  width,
  onPress,
}: {
  mix: AudiusMixDefinition;
  tracks: Track[];
  loading: boolean;
  width: number;
  onPress: () => void;
}) => {
  const [failedArtwork, setFailedArtwork] = useState('');
  const artwork = tracks[0]?.artwork;
  const artworkFailed = Boolean(artwork) && failedArtwork === artwork;

  return (
    <PressableCard
      style={{ width, marginRight: 13 }}
      onPress={onPress}
      accessibilityLabel={tracks.length ? `Play the ${mix.title} non-stop mix` : `Refresh the ${mix.title} mix`}
    >
      <View style={{ width, height: width, borderRadius: 20, overflow: 'hidden', backgroundColor: '#161619', borderWidth: 1, borderColor: '#28282D', justifyContent: 'center', alignItems: 'center' }}>
        {artwork && !artworkFailed ? (
          <Image source={{ uri: artwork }} onError={() => setFailedArtwork(artwork ?? '')} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} />
        ) : (
          <LinearGradient colors={['#282027', '#111114', '#09090A']} style={{ position: 'absolute', width: '100%', height: '100%' }} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.54)', 'rgba(0,0,0,0.82)']}
          locations={[0, 0.52, 1]}
          style={{ position: 'absolute', width: '100%', height: '100%' }}
        />
        <View style={{ position: 'absolute', top: 13, flexDirection: 'row', alignItems: 'center', gap: 5, opacity: 0.92 }}>
          <Ionicons name="infinite" size={15} color="white" />
          <Text style={{ color: 'white', fontSize: 10, fontWeight: '800', letterSpacing: 1.15 }}>NON-STOP</Text>
        </View>
        <Text
          numberOfLines={2}
          style={{ color: 'white', fontSize: mix.id === 'golden-2017' ? 23 : 25, lineHeight: 29, fontWeight: '800', letterSpacing: -0.55, textAlign: 'center', paddingHorizontal: 13, textShadowColor: mix.glow, textShadowRadius: 17, textShadowOffset: { width: 0, height: 0 } }}
        >
          {mix.title}
        </Text>
        <View style={{ position: 'absolute', bottom: 12, right: 12, width: 31, height: 31, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.58)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}>
          {loading && tracks.length === 0 ? <ActivityIndicator size="small" color="white" /> : (
            <Ionicons name={tracks.length ? 'play' : 'refresh'} size={15} color="white" />
          )}
        </View>
      </View>
      <Text numberOfLines={1} style={{ color: 'white', fontSize: 15, fontWeight: '700', marginTop: 10 }}>{mix.title}</Text>
      <Text numberOfLines={1} style={{ color: '#8E8E93', fontSize: 12, fontWeight: '500', marginTop: 3 }}>
        {tracks.length ? `Audius · ${tracks.length} tracks` : loading ? 'Finding your mix…' : 'Tap to try again'}
      </Text>
    </PressableCard>
  );
});
NonStopMixCard.displayName = 'NonStopMixCard';

const LiveRadioCard = memo(({
  station,
  active,
  width,
  onPress,
}: {
  station: RadioStation;
  active: boolean;
  width: number;
  onPress: () => void;
}) => {
  const [failedArtwork, setFailedArtwork] = useState('');
  const artworkFailed = !station.favicon?.startsWith('https://') || failedArtwork === station.favicon;

  return (
    <PressableCard
      style={{ width, marginRight: 13 }}
      onPress={onPress}
      accessibilityLabel={`${active ? 'Tune in to' : 'Play'} ${station.name}, live radio`}
    >
      <View style={{ width, height: width, borderRadius: 20, overflow: 'hidden', backgroundColor: '#18181B', alignItems: 'center', justifyContent: 'center', borderWidth: active ? 1.5 : 1, borderColor: active ? '#FA5265' : '#27272A' }}>
        {!artworkFailed && station.favicon ? (
          <Image source={{ uri: station.favicon }} onError={() => setFailedArtwork(station.favicon ?? '')} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
        ) : (
          <LinearGradient colors={['#35151D', '#17171A']} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="radio" size={42} color="#FA5265" />
          </LinearGradient>
        )}
        <View style={{ position: 'absolute', left: 10, top: 10, height: 24, paddingHorizontal: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.68)', flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#FA5265' }} />
          <Text style={{ color: 'white', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 }}>LIVE</Text>
        </View>
        <View style={{ position: 'absolute', right: 11, bottom: 11, width: 32, height: 32, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={active ? 'volume-high' : 'play'} size={15} color="white" />
        </View>
      </View>
      <Text numberOfLines={1} style={{ color: 'white', fontSize: 15, fontWeight: '700', marginTop: 10 }}>{station.name.trim()}</Text>
      <Text numberOfLines={1} style={{ color: '#8E8E93', fontSize: 12, fontWeight: '500', marginTop: 3 }}>
        {station.country?.trim() || station.language?.split(',')[0]?.trim() || 'Live Radio'}
      </Text>
    </PressableCard>
  );
});
LiveRadioCard.displayName = 'LiveRadioCard';

export const HomeScreen = () => {
  const navigation = useNavigation<HomeNavigation>();
  const { width: screenWidth } = useWindowDimensions();
  const { activeTrack, playTrack, togglePlayback } = usePlaybackActions();
  const [mixTracks, setMixTracks] = useState<MixTracks>(emptyMixTracks);
  const [stations, setStations] = useState<RadioStation[]>([]);
  const [mixLoading, setMixLoading] = useState(true);
  const [radioLoading, setRadioLoading] = useState(true);
  const [mixUnavailable, setMixUnavailable] = useState(false);
  const [radioUnavailable, setRadioUnavailable] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [introOpacity] = useState(() => new Animated.Value(0));
  const [introY] = useState(() => new Animated.Value(12));
  const cardWidth = Math.min(174, Math.max(142, Math.floor((screenWidth - 64) / 2)));

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(introOpacity, { toValue: 1, duration: 460, useNativeDriver: true, isInteraction: false }),
      Animated.spring(introY, { toValue: 0, damping: 19, stiffness: 165, mass: 0.85, useNativeDriver: true, isInteraction: false }),
    ]);
    intro.start();
    return () => intro.stop();
  }, [introOpacity, introY]);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      Promise.all(AUDIO_MIXES.map(async (mix) => {
        try {
          return { id: mix.id, tracks: await AudiusCatalogService.getMixTracks(mix.id) };
        } catch {
          return { id: mix.id, tracks: [] as Track[] };
        }
      })),
      loadHomeStations().catch(() => null),
    ]).then(([results, radioStations]) => {
      if (!mounted) return;
      const nextMixes = emptyMixTracks();
      results.forEach(({ id, tracks }) => { nextMixes[id] = tracks; });
      setMixTracks(nextMixes);
      setMixUnavailable(!results.some(({ tracks }) => tracks.length > 0));
      setStations(radioStations ?? []);
      setRadioUnavailable(!radioStations);
    }).finally(() => {
      if (mounted) {
        setMixLoading(false);
        setRadioLoading(false);
      }
    });

    return () => { mounted = false; };
  }, [refreshKey]);

  const radioTracks = useMemo(() => stations.map(toStationTrack), [stations]);
  const refreshDiscovery = useCallback(() => {
    setMixLoading(true);
    setRadioLoading(true);
    setMixUnavailable(false);
    setRadioUnavailable(false);
    setRefreshKey((current) => current + 1);
  }, []);

  const playMix = useCallback((mixId: AudiusMixId) => {
    const queue = mixTracks[mixId];
    if (queue.length > 0) playTrack(queue[0], queue);
    else refreshDiscovery();
  }, [mixTracks, playTrack, refreshDiscovery]);

  const playStation = useCallback((station: RadioStation) => {
    const track = toStationTrack(station);
    if (activeTrack?.id === track.id) {
      togglePlayback();
      return;
    }

    playTrack(track, radioTracks.length > 0 ? radioTracks : [track]);
    reportStationClick(station.stationuuid);
  }, [activeTrack?.id, playTrack, radioTracks, togglePlayback]);

  const openDonationLink = useCallback(async () => {
    if (!PAYPAL_DONATION_URL) {
      Alert.alert(
        'Connect your PayPal account',
        'Create a PayPal.Me link for your account, then add that URL to PAYPAL_DONATION_URL in HomeScreen.tsx.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open PayPal.Me', onPress: () => void Linking.openURL(PAYPAL_ME_SETUP_URL).catch(() => undefined) },
        ],
      );
      return;
    }

    try {
      await Linking.openURL(PAYPAL_DONATION_URL);
    } catch {
      Alert.alert('Could not open PayPal', 'Please try again in a moment.');
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={mixLoading || radioLoading} onRefresh={refreshDiscovery} tintColor="#FA5265" colors={['#FA5265']} />}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 190 }}
      >
        <Animated.View style={{ opacity: introOpacity, transform: [{ translateY: introY }] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
            <Text style={{ color: 'white', fontSize: 40, lineHeight: 47, fontWeight: '800', letterSpacing: -1 }}>Home</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Library', { screen: 'DeveloperProfile' })}
              activeOpacity={0.78}
              accessibilityRole="button"
              accessibilityLabel="Open Kamal’s profile"
              style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden' }}
            >
              <LinearGradient colors={['#514A68', '#262331']} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="person" size={27} color="white" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: 'white', fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.45 }}>Non-Stop Music</Text>
              <Text style={{ color: '#8E8E93', fontSize: 12, fontWeight: '500', marginTop: 3 }}>Fresh independent mixes, ready to keep playing</Text>
            </View>
            {mixLoading ? <ActivityIndicator color="#FA5265" size="small" /> : (
              <TouchableOpacity onPress={refreshDiscovery} hitSlop={10} accessibilityRole="button" accessibilityLabel="Refresh Home music" style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#171719', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="refresh" size={17} color="#B7B7BC" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 7, paddingBottom: 2 }}>
            {AUDIO_MIXES.map((mix) => (
              <NonStopMixCard
                key={mix.id}
                mix={mix}
                tracks={mixTracks[mix.id]}
                loading={mixLoading}
                width={cardWidth}
                onPress={() => playMix(mix.id)}
              />
            ))}
          </ScrollView>

          {mixUnavailable && !mixLoading ? (
            <TouchableOpacity onPress={refreshDiscovery} activeOpacity={0.75} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 9, paddingVertical: 8 }}>
              <Ionicons name="cloud-offline-outline" size={16} color="#FA5265" />
              <Text style={{ color: '#A1A1A6', fontSize: 12, marginLeft: 7 }}>Couldn’t load mixes. Tap to retry.</Text>
            </TouchableOpacity>
          ) : null}

          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 37, marginBottom: 15 }}>
            <Text style={{ flex: 1, color: 'white', fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.45 }}>Live Radio Stations</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Radio')} hitSlop={8} accessibilityRole="button" accessibilityLabel="See all radio stations" style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingLeft: 7 }}>
              <Text style={{ color: '#FA5265', fontSize: 13, fontWeight: '700' }}>See all</Text>
              <Ionicons name="chevron-forward" size={15} color="#FA5265" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>

          {radioLoading && stations.length === 0 ? (
            <View style={{ height: cardWidth + 51, flexDirection: 'row', alignItems: 'flex-start', gap: 13 }}>
              {[0, 1].map((item) => (
                <View key={item} style={{ width: cardWidth, height: cardWidth, borderRadius: 20, backgroundColor: '#141416', alignItems: 'center', justifyContent: 'center' }}>
                  {item === 0 ? <ActivityIndicator size="small" color="#FA5265" /> : <Ionicons name="radio-outline" size={25} color="#343438" />}
                </View>
              ))}
            </View>
          ) : stations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 7, paddingBottom: 2 }}>
              {stations.map((station) => (
                <LiveRadioCard
                  key={station.stationuuid}
                  station={station}
                  active={activeTrack?.id === `radio:${station.stationuuid}`}
                  width={cardWidth}
                  onPress={() => playStation(station)}
                />
              ))}
            </ScrollView>
          ) : (
            <TouchableOpacity onPress={refreshDiscovery} activeOpacity={0.75} style={{ minHeight: 125, borderRadius: 20, backgroundColor: '#121214', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, paddingHorizontal: 20 }}>
              <Ionicons name={radioUnavailable ? 'cloud-offline-outline' : 'radio-outline'} size={20} color="#FA5265" />
              <Text style={{ color: '#A1A1A6', fontSize: 13, fontWeight: '600' }}>{radioUnavailable ? 'Couldn’t load stations · tap to retry' : 'No stations available right now'}</Text>
            </TouchableOpacity>
          )}

          <PressableCard
            style={{ width: '100%', marginTop: 34 }}
            onPress={() => void openDonationLink()}
            accessibilityLabel="Support Musiqapp with a PayPal donation"
          >
            <LinearGradient
              colors={['#123879', '#0757C8', '#087BBE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ minHeight: 348, borderRadius: 27, paddingHorizontal: 23, paddingVertical: 22, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(128,190,255,0.32)' }}
            >
              <View style={{ position: 'absolute', width: 185, height: 185, borderRadius: 93, right: -66, top: 73, backgroundColor: 'rgba(103,196,255,0.13)' }} />
              <View style={{ position: 'absolute', width: 118, height: 118, borderRadius: 59, left: -48, bottom: 24, backgroundColor: 'rgba(2,24,69,0.18)' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 17 }}>
                <FontAwesome name="paypal" size={18} color="white" />
                <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 12, fontWeight: '800', letterSpacing: 1.1, marginLeft: 8 }}>MUSIQAPP · SUPPORT</Text>
              </View>
              <Text style={{ color: 'white', fontSize: 27, lineHeight: 32, fontWeight: '800', letterSpacing: -0.65 }}>
                Help keep the{ '\n' }music going.
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, fontWeight: '500', marginTop: 8 }}>
                Enjoying Musiqapp? A voluntary donation helps support its development.
              </Text>
              <View style={{ flex: 1, minHeight: 115, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 130, height: 98, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-5deg' }] }}>
                  <FontAwesome name="paypal" size={61} color="white" />
                </View>
                <View style={{ position: 'absolute', right: '26%', bottom: 12, width: 42, height: 42, borderRadius: 21, backgroundColor: '#FA5265', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#1766B7' }}>
                  <Ionicons name="heart" size={20} color="white" />
                </View>
              </View>
              <View style={{ minHeight: 51, borderRadius: 26, paddingHorizontal: 18, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: '#123879', fontSize: 15, fontWeight: '800' }}>Donate with PayPal</Text>
                <View style={{ width: 31, height: 31, borderRadius: 16, backgroundColor: '#E8F1FF', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="arrow-forward" size={17} color="#0757C8" />
                </View>
              </View>
              <Text style={{ color: 'rgba(255,255,255,0.72)', fontSize: 11, fontWeight: '500', textAlign: 'center', marginTop: 10 }}>
                Payment is completed securely on PayPal
              </Text>
            </LinearGradient>
          </PressableCard>

          <View style={{ height: 18 }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};
