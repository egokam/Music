import { useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlphabetIndex } from '../components/songs/AlphabetIndex';
import { SongListItem } from '../components/songs/SongListItem';
import { SongsControls } from '../components/songs/SongsControls';
import { SongsHeader } from '../components/songs/SongsHeader';
import { tracks } from '../data/tracks';
import type { Track } from '../types';

type SongSection = { title: string; data: Track[] };

export const SongsScreen = ({
  onBack,
  onSelectTrack,
  onPlayAll,
  onShuffle,
}: {
  onBack: () => void;
  onSelectTrack: (track: Track) => void;
  onPlayAll: () => void;
  onShuffle: () => void;
}) => {
  const listRef = useRef<Animated.SectionList<Track, SongSection>>(null);
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const insets = useSafeAreaInsets();
  const topInsetCompensation = Math.max(0, insets.top - 24);
  const [search, setSearch] = useState('');
  const [ascending, setAscending] = useState(true);

  const sections = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filteredTracks = tracks.filter((track) =>
      `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(normalizedSearch),
    );
    filteredTracks.sort((first, second) => {
      const order = first.title.toLowerCase().localeCompare(second.title.toLowerCase());
      return ascending ? order : -order;
    });

    const groups = new Map<string, Track[]>();
    filteredTracks.forEach((track) => {
      const firstCharacter = track.title.trim().charAt(0).toUpperCase();
      const sectionTitle = /^[A-Z]$/.test(firstCharacter) ? firstCharacter : '#';
      const currentSongs = groups.get(sectionTitle) ?? [];
      currentSongs.push(track);
      groups.set(sectionTitle, currentSongs);
    });

    return Array.from(groups, ([title, data]) => ({ title, data }));
  }, [ascending, search]);

  const jumpToLetter = (letter: string) => {
    if (sections.length === 0) return;

    const exactSection = sections.findIndex((section) => section.title === letter);
    const nextSection = sections.findIndex((section) =>
      ascending ? section.title >= letter : section.title <= letter,
    );
    const sectionIndex = exactSection >= 0 ? exactSection : nextSection >= 0 ? nextSection : sections.length - 1;

    listRef.current?.scrollToLocation({ sectionIndex, itemIndex: 0, animated: true, viewPosition: 0 });
  };

  const scrollHandler = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY],
  );
  const songsBannerOffset = scrollY.interpolate({
    inputRange: [0, 22, 72, 204],
    outputRange: [22, 0, 0, -132],
    extrapolate: 'clamp',
  });
  const topFadeOpacity = scrollY.interpolate({
    inputRange: [0, 10, 26],
    outputRange: [0, 0.75, 1],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }} edges={['top']}>
      <View style={{ flex: 1, marginTop: -topInsetCompensation }}>
        <Animated.SectionList
          ref={listRef}
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index, section }) => (
            <SongListItem
              track={item}
              onPress={() => onSelectTrack(item)}
              isLast={index === section.data.length - 1}
            />
          )}
          renderSectionHeader={({ section }) => (
            <Text
              style={{
                color: 'white',
                fontSize: 20,
                lineHeight: 26,
                fontWeight: '700',
                marginTop: 20,
                marginBottom: 1,
                paddingHorizontal: 20,
              }}
            >
              {section.title}
            </Text>
          )}
          ListHeaderComponent={
            <SongsControls
              search={search}
              onSearchChange={setSearch}
              onPlay={onPlayAll}
              onShuffle={onShuffle}
            />
          }
          ListEmptyComponent={
            <View style={{ paddingHorizontal: 20, paddingTop: 22 }}>
              <Text style={{ color: '#8E8E93', fontSize: 16 }}>No songs found</Text>
            </View>
          }
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
          contentContainerStyle={{ paddingTop: 58, paddingBottom: 190 }}
          initialNumToRender={12}
          windowSize={7}
        />

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -24,
            left: 0,
            right: 0,
            height: 170,
            zIndex: 15,
            elevation: 15,
            opacity: topFadeOpacity,
          }}
        >
          <LinearGradient
            colors={['#000000', '#000000', 'rgba(0,0,0,0.62)', 'rgba(0,0,0,0)']}
            locations={[0, 0.32, 0.68, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 58,
            left: 0,
            right: 0,
            height: 46,
            zIndex: 16,
            elevation: 16,
            transform: [{ translateY: songsBannerOffset }],
          }}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: 20,
              backgroundColor: '#000000',
            }}
          >
            <Text style={{ color: 'white', fontSize: 38, lineHeight: 46, fontWeight: '800' }}>
              Songs
            </Text>
          </View>
        </Animated.View>

        <SongsHeader
          onBack={onBack}
          onToggleSort={() => setAscending((value) => !value)}
        />
        <AlphabetIndex onSelectLetter={jumpToLetter} />
      </View>
    </SafeAreaView>
  );
};
