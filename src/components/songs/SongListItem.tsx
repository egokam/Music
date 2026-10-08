import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Track } from '../../types';

export const SongListItem = ({
  track,
  onPress,
  isLast,
}: {
  track: Track;
  onPress: () => void;
  isLast: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`Play ${track.title} by ${track.artist}`}
    style={{
      minHeight: 64,
      paddingLeft: 20,
      flexDirection: 'row',
      alignItems: 'center',
    }}
  >
    <Image
      source={{ uri: track.artwork }}
      resizeMode="cover"
      style={{ width: 50, height: 50, borderRadius: 7, backgroundColor: '#2C2C2E' }}
    />
    <View
      style={{
        flex: 1,
        minWidth: 0,
        height: 64,
        marginLeft: 12,
        paddingRight: 18,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: '#2C2C2E',
        flexDirection: 'row',
        alignItems: 'center',
      }}
    >
      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <Text numberOfLines={1} style={{ color: 'white', fontSize: 17, fontWeight: '500' }}>
          {track.title}
        </Text>
        <Text
          numberOfLines={1}
          style={{ color: '#8E8E93', fontSize: 14, fontWeight: '500', marginTop: 3 }}
        >
          {track.artist}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View
          accessible
          accessibilityLabel={`Download ${track.title}`}
          style={{
            width: 19,
            height: 19,
            borderRadius: 10,
            backgroundColor: '#2C2C2E',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-down" size={12} color="#8E8E93" />
        </View>
        <Ionicons name="ellipsis-horizontal" size={23} color="white" />
      </View>
    </View>
  </TouchableOpacity>
);
