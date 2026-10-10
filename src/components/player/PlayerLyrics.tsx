import { useCallback, useEffect, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import type { LyricLine } from '../../types';

type PlayerLyricsProps = {
  trackId: string;
  lyrics: LyricLine[];
  activeLineIndex: number;
  viewportHeight: number;
  scrollGesture: NativeGesture;
  onSeek: (seconds: number) => void;
};

export const PlayerLyrics = ({
  trackId,
  lyrics,
  activeLineIndex,
  viewportHeight,
  scrollGesture,
  onSeek,
}: PlayerLyricsProps) => {
  const scrollRef = useRef<ScrollView>(null);
  const lineLayouts = useRef(new Map<number, { y: number; height: number }>());
  const activeLineRef = useRef(activeLineIndex);
  const viewportHeightRef = useRef(viewportHeight);
  const isManuallyScrolling = useRef(false);
  const recenterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeLineRef.current = activeLineIndex;
    viewportHeightRef.current = viewportHeight;
  }, [activeLineIndex, viewportHeight]);

  const clearRecenterTimer = useCallback(() => {
    if (recenterTimer.current) {
      clearTimeout(recenterTimer.current);
      recenterTimer.current = null;
    }
  }, []);

  const centerLine = useCallback((lineIndex: number, animated: boolean) => {
    const layout = lineLayouts.current.get(lineIndex);
    const visibleHeight = viewportHeightRef.current;
    if (!layout || lineIndex < 0 || visibleHeight <= 0) return;

    scrollRef.current?.scrollTo({
      y: Math.max(0, layout.y + layout.height / 2 - visibleHeight / 2),
      animated,
    });
  }, []);

  const recenterAfterManualScroll = useCallback(() => {
    clearRecenterTimer();
    recenterTimer.current = setTimeout(() => {
      isManuallyScrolling.current = false;
      centerLine(activeLineRef.current, true);
    }, 2000);
  }, [centerLine, clearRecenterTimer]);

  useEffect(() => {
    if (!isManuallyScrolling.current && activeLineIndex >= 0) {
      requestAnimationFrame(() => centerLine(activeLineIndex, true));
    }
  }, [activeLineIndex, centerLine, viewportHeight]);

  useEffect(() => () => clearRecenterTimer(), [clearRecenterTimer, trackId]);

  return (
    <GestureDetector gesture={scrollGesture}>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: Math.max(0, viewportHeight / 2) }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          clearRecenterTimer();
          isManuallyScrolling.current = true;
        }}
        onScrollEndDrag={recenterAfterManualScroll}
        onMomentumScrollBegin={clearRecenterTimer}
        onMomentumScrollEnd={recenterAfterManualScroll}
      >
        {lyrics.map((line, index) =>
          line.text.trim().length === 0 ? (
            <View
              key={`${trackId}-lyric-gap-${index}`}
              onLayout={(event) => lineLayouts.current.set(index, event.nativeEvent.layout)}
              style={{ height: 40 }}
            />
          ) : (
            <View
              key={`${trackId}-lyric-${index}`}
              onLayout={(event) => {
                lineLayouts.current.set(index, event.nativeEvent.layout);
                if (index === activeLineRef.current && !isManuallyScrolling.current) {
                  centerLine(index, false);
                }
              }}
              style={{ marginBottom: 12 }}
            >
              <TouchableOpacity
                disabled={line.timeMs === null}
                onPress={() => {
                  if (line.timeMs !== null) onSeek(line.timeMs / 1000);
                }}
                activeOpacity={0.72}
                accessibilityRole={line.timeMs === null ? undefined : 'button'}
                accessibilityLabel={line.timeMs === null ? line.text : `Seek to ${line.text}`}
                style={{ alignSelf: 'stretch' }}
              >
                <Text
                  style={{
                    color: index === activeLineIndex ? '#FFFFFF' : 'rgba(255,255,255,0.52)',
                    fontSize: 22,
                    lineHeight: 32,
                    fontWeight: '700',
                  }}
                >
                  {line.text}
                </Text>
              </TouchableOpacity>
            </View>
          ),
        )}
      </ScrollView>
    </GestureDetector>
  );
};
