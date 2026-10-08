import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const SongsHeader = ({
  onBack,
  onToggleSort,
}: {
  onBack: () => void;
  onToggleSort: () => void;
}) => (
  <View
    style={{
      position: 'absolute',
      top: 16,
      left: 0,
      right: 0,
      height: 58,
      zIndex: 20,
      elevation: 20,
      backgroundColor: 'transparent',
    }}
  >
    <View
      style={{
        flex: 1,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <TouchableOpacity
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to Library"
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(28,28,30,0.84)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="chevron-back" size={27} color="white" />
      </TouchableOpacity>

      <View
        style={{
          height: 44,
          paddingHorizontal: 18,
          borderRadius: 24,
          backgroundColor: 'rgba(28,28,30,0.84)',
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.10)',
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TouchableOpacity
          onPress={onToggleSort}
          accessibilityRole="button"
          accessibilityLabel="Toggle song sort order"
          style={{ paddingVertical: 6 }}
        >
          <Ionicons name="list" size={25} color="white" />
        </TouchableOpacity>
        <View style={{ width: 22 }} />
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="More song options">
          <Ionicons name="ellipsis-horizontal" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  </View>
);
