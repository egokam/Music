import { Ionicons } from '@expo/vector-icons';
import { GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { getMusicApiHeaders } from '../../services/MusicCatalogService';
import type { Track } from '../../types';

type RepeatMode = 'off' | 'all' | 'one';

type PlayerQueuePanelProps = {
  tracks: Track[];
  height: number;
  scrollGesture: NativeGesture;
  shuffleEnabled: boolean;
  repeatMode: RepeatMode;
  autoplayEnabled: boolean;
  onPlayTrack: (track: Track) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onToggleAutoplay: () => void;
  onClearQueue: () => void;
};

const QueueOption = ({
  icon,
  label,
  selected,
  disabled,
  accessibilityLabel,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    activeOpacity={0.72}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? label}
    accessibilityState={{ selected, disabled }}
    style={{
      flex: 1,
      minWidth: 0,
      height: 62,
      marginRight: 6,
      borderRadius: 14,
      backgroundColor: selected ? 'rgba(250, 55, 85, 0.18)' : 'rgba(255,255,255,0.09)',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.42 : 1,
    }}
  >
    <Ionicons name={icon} size={18} color={selected ? '#FA5265' : 'rgba(255,255,255,0.78)'} />
    <Text
      numberOfLines={1}
      style={{
        marginTop: 4,
        color: selected ? '#FA5265' : 'rgba(255,255,255,0.78)',
        fontSize: 10,
        fontWeight: '700',
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

export const PlayerQueuePanel = ({
  tracks,
  height,
  scrollGesture,
  shuffleEnabled,
  repeatMode,
  autoplayEnabled,
  onPlayTrack,
  onToggleShuffle,
  onToggleRepeat,
  onToggleAutoplay,
  onClearQueue,
}: PlayerQueuePanelProps) => (
  <View style={{ flex: 1, height }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <Text style={{ color: 'white', fontSize: 20, fontWeight: '800', flex: 1 }}>Up Next</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' }}>
        {tracks.length} {tracks.length === 1 ? 'song' : 'songs'}
      </Text>
    </View>

    <View style={{ flexDirection: 'row', marginBottom: 14 }}>
      <QueueOption icon="shuffle" label="Shuffle" selected={shuffleEnabled} onPress={onToggleShuffle} />
      <QueueOption
        icon={repeatMode === 'one' ? 'repeat' : 'repeat'}
        label={repeatMode === 'off' ? 'Repeat' : repeatMode === 'all' ? 'Repeat All' : 'Repeat 1'}
        selected={repeatMode !== 'off'}
        onPress={onToggleRepeat}
      />
      <QueueOption icon="infinite" label="Autoplay" selected={autoplayEnabled} onPress={onToggleAutoplay} />
      <QueueOption
        icon="trash-outline"
        label="Clear"
        accessibilityLabel="Clear queue"
        disabled={tracks.length === 0}
        onPress={onClearQueue}
      />
    </View>

    <GestureDetector gesture={scrollGesture}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {tracks.length > 0 ? tracks.map((track) => (
          <TouchableOpacity
            key={track.id}
            onPress={() => onPlayTrack(track)}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={`Play ${track.title} by ${track.artist}`}
            style={{
              minHeight: 62,
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 7,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.1)',
            }}
          >
            {track.artwork ? (
              <Image
                source={{ uri: track.artwork, headers: track.provider === 'local' ? getMusicApiHeaders() : undefined }}
                resizeMode="cover"
                style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#303034' }}
              />
            ) : (
              <View style={{ width: 46, height: 46, borderRadius: 8, backgroundColor: '#303034', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-note" size={20} color="rgba(255,255,255,0.6)" />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0, marginLeft: 12, marginRight: 12 }}>
              <Text numberOfLines={1} style={{ color: 'white', fontSize: 15, fontWeight: '700' }}>
                {track.title}
              </Text>
              <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 3 }}>
                {track.artist}
              </Text>
            </View>
            <Ionicons name="play" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )) : (
          <View style={{ flex: 1, minHeight: 100, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.52)', fontSize: 14, textAlign: 'center' }}>
              Nothing queued. Choose a song from your library to play next.
            </Text>
          </View>
        )}
      </ScrollView>
    </GestureDetector>
  </View>
);
