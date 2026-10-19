import { HStack, Image, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  background,
  blur,
  brightness,
  clipShape,
  containerBackground,
  font,
  frame,
  lineLimit,
  opacity,
  padding,
  resizable,
  scaleEffect,
  shapes,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

export type NowPlayingWidgetProps = {
  trackId: string;
  title: string;
  artist: string;
  artworkUri: string;
  isPlaying: boolean;
};

const NowPlayingWidgetLayout = (props: NowPlayingWidgetProps) => {
  'widget';

  const hasTrack = Boolean(props.trackId);
  const launchUrl = hasTrack
    ? `musiqapp://widget/play?trackId=${encodeURIComponent(props.trackId)}`
    : 'musiqapp://widget';

  return (
    <ZStack
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000 }),
        containerBackground('#211D22', 'widget'),
        clipShape('roundedRectangle', 26),
        widgetURL(launchUrl),
      ]}
    >
      {props.artworkUri ? (
        <Image
          uiImage={props.artworkUri}
          modifiers={[
            resizable(),
            aspectRatio({ contentMode: 'fill' }),
            frame({ maxWidth: 10000, maxHeight: 10000 }),
            blur(26),
            brightness(-0.34),
            opacity(0.94),
            scaleEffect(1.2),
          ]}
        />
      ) : null}

      {hasTrack ? (
        <HStack
          spacing={14}
          modifiers={[padding({ all: 14 }), frame({ maxWidth: 10000, maxHeight: 10000 })]}
        >
          {props.artworkUri ? (
            <Image
              uiImage={props.artworkUri}
              modifiers={[
                resizable(),
                aspectRatio({ contentMode: 'fill' }),
                frame({ width: 104, height: 104 }),
                clipShape('roundedRectangle', 14),
              ]}
            />
          ) : (
            <ZStack
              modifiers={[
                frame({ width: 104, height: 104 }),
                background('#3A3038'),
                clipShape('roundedRectangle', 14),
              ]}
            >
              <Image systemName="music.note" size={36} color="#FFFFFF" />
            </ZStack>
          )}

          <VStack alignment="leading" spacing={5} modifiers={[frame({ maxWidth: 10000 })]}>
            <HStack spacing={6}>
              <Text
                modifiers={[
                  font({ size: 11, weight: 'bold' }),
                  opacity(0.78),
                  lineLimit(1),
                ]}
              >
                NOW PLAYING
              </Text>
              <Spacer />
              <Image systemName="music.note" size={20} color="#FFFFFF" />
            </HStack>

            <Text modifiers={[font({ size: 18, weight: 'bold' }), lineLimit(1)]}>
              {props.title || 'Unknown Track'}
            </Text>

            <Text modifiers={[font({ size: 15, weight: 'medium' }), opacity(0.78), lineLimit(1)]}>
              {props.artist || 'Unknown Artist'}
            </Text>

            <HStack
              spacing={7}
              modifiers={[
                padding({ horizontal: 12, vertical: 6 }),
                background({ type: 'material', material: 'thin' }, shapes.capsule()),
              ]}
            >
              <Image
                systemName={props.isPlaying ? 'pause.fill' : 'play.fill'}
                size={12}
                color="#FFFFFF"
              />
              <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>
                {props.isPlaying ? 'Pause' : 'Play'}
              </Text>
            </HStack>
          </VStack>
        </HStack>
      ) : (
        <VStack
          alignment="center"
          spacing={10}
          modifiers={[frame({ maxWidth: 10000, maxHeight: 10000 })]}
        >
          <Image systemName="music.note" size={28} color="#F43F5E" />
          <Text modifiers={[font({ size: 18, weight: 'bold' })]}>
            No Recently Played Music
          </Text>
        </VStack>
      )}
    </ZStack>
  );
};

export default createWidget('MusiqNowPlaying', NowPlayingWidgetLayout);
