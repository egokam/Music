const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

const nativeWidgetSource = `import WidgetKit
import SwiftUI
import UIKit

private let musiqAppGroup = "group.site.egokam.musiqapp"
private let musiqTimelineKey = "__expo_widgets_MusiqNowPlaying_timeline"

struct MusiqNowPlayingEntry: TimelineEntry {
  let date: Date
  let trackId: String
  let title: String
  let artist: String
  let artworkUri: String
  let isPlaying: Bool
}

struct MusiqNowPlayingProvider: TimelineProvider {
  func placeholder(in context: Context) -> MusiqNowPlayingEntry {
    MusiqNowPlayingEntry(
      date: Date(),
      trackId: "",
      title: "No Recently Played Music",
      artist: "",
      artworkUri: "",
      isPlaying: false
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (MusiqNowPlayingEntry) -> Void) {
    completion(loadEntry() ?? placeholder(in: context))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<MusiqNowPlayingEntry>) -> Void) {
    let entry = loadEntry() ?? placeholder(in: context)
    completion(Timeline(entries: [entry], policy: .never))
  }

  private func loadEntry() -> MusiqNowPlayingEntry? {
    guard
      let defaults = UserDefaults(suiteName: musiqAppGroup),
      let records = defaults.array(forKey: musiqTimelineKey) as? [[String: Any]],
      let record = records.max(by: { timestamp($0) < timestamp($1) }),
      let props = record["props"] as? [String: Any]
    else {
      return nil
    }

    let timestampValue = timestamp(record)
    return MusiqNowPlayingEntry(
      date: Date(timeIntervalSince1970: Double(timestampValue) / 1000),
      trackId: props["trackId"] as? String ?? "",
      title: props["title"] as? String ?? "Unknown Track",
      artist: props["artist"] as? String ?? "Unknown Artist",
      artworkUri: props["artworkUri"] as? String ?? "",
      isPlaying: props["isPlaying"] as? Bool ?? false
    )
  }

  private func timestamp(_ record: [String: Any]) -> Int {
    if let value = record["timestamp"] as? Int { return value }
    if let value = record["timestamp"] as? NSNumber { return value.intValue }
    return 0
  }
}

struct MusiqNowPlayingView: View {
  let entry: MusiqNowPlayingEntry

  private var artwork: UIImage? {
    guard let url = URL(string: entry.artworkUri), url.isFileURL else { return nil }
    return UIImage(contentsOfFile: url.path)
  }

  private var launchURL: URL? {
    guard !entry.trackId.isEmpty,
          let encoded = entry.trackId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed)
    else { return URL(string: "musiqapp://widget") }
    return URL(string: "musiqapp://widget/play?trackId=\\(encoded)")
  }

  var body: some View {
    if #available(iOS 17.0, *) {
      content
        .containerBackground(for: .widget) {
          Color(red: 0.13, green: 0.11, blue: 0.13)
        }
    } else {
      content.background(Color(red: 0.13, green: 0.11, blue: 0.13))
    }
  }

  private var content: some View {
    ZStack {
      if let artwork {
        Image(uiImage: artwork)
          .resizable()
          .scaledToFill()
          .blur(radius: 24)
          .scaleEffect(1.22)
          .opacity(0.86)
        Color.black.opacity(0.42)
      } else {
        Color(red: 0.13, green: 0.11, blue: 0.13)
      }

      if entry.trackId.isEmpty {
        VStack(spacing: 10) {
          Image(systemName: "music.note")
            .font(.system(size: 28, weight: .semibold))
            .foregroundStyle(Color(red: 0.96, green: 0.25, blue: 0.37))
          Text("No Recently Played Music")
            .font(.headline.weight(.bold))
            .foregroundStyle(.white)
            .lineLimit(1)
        }
      } else {
        HStack(spacing: 14) {
          artworkView

          VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
              Text("NOW PLAYING")
                .font(.caption2.weight(.bold))
                .foregroundStyle(.white.opacity(0.78))
                .lineLimit(1)
              Spacer(minLength: 0)
              Image(systemName: "music.note")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)
            }

            Text(entry.title.isEmpty ? "Unknown Track" : entry.title)
              .font(.headline.weight(.bold))
              .foregroundStyle(.white)
              .lineLimit(1)

            Text(entry.artist.isEmpty ? "Unknown Artist" : entry.artist)
              .font(.subheadline.weight(.medium))
              .foregroundStyle(.white.opacity(0.78))
              .lineLimit(1)

            HStack(spacing: 7) {
              Image(systemName: entry.isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 11, weight: .bold))
              Text(entry.isPlaying ? "Pause" : "Play")
                .font(.caption.weight(.semibold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(.thinMaterial, in: Capsule())
          }
        }
        .padding(14)
      }
    }
    .widgetURL(launchURL)
    .clipShape(RoundedRectangle(cornerRadius: 26, style: .continuous))
  }

  @ViewBuilder
  private var artworkView: some View {
    if let artwork {
      Image(uiImage: artwork)
        .resizable()
        .scaledToFill()
        .frame(width: 104, height: 104)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
    } else {
      ZStack {
        RoundedRectangle(cornerRadius: 14, style: .continuous)
          .fill(Color(red: 0.23, green: 0.19, blue: 0.22))
        Image(systemName: "music.note")
          .font(.system(size: 36, weight: .medium))
          .foregroundStyle(.white)
      }
      .frame(width: 104, height: 104)
    }
  }
}

struct MusiqNowPlaying: Widget {
  let name = "MusiqNowPlaying"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: MusiqNowPlayingProvider()) { entry in
      MusiqNowPlayingView(entry: entry)
    }
    .configurationDisplayName("Musiqapp")
    .description("See and play the track currently on Musiqapp.")
    .supportedFamilies([.systemMedium])
    .contentMarginsDisabled()
  }
}
`;

module.exports = function withMusiqNativeWidget(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const widgetPath = path.join(
        config.modRequest.platformProjectRoot,
        'ExpoWidgetsTarget',
        'MusiqNowPlaying.swift'
      );

      if (!fs.existsSync(path.dirname(widgetPath))) {
        throw new Error('ExpoWidgetsTarget was not generated before withMusiqNativeWidget ran.');
      }

      fs.writeFileSync(widgetPath, nativeWidgetSource);
      return config;
    },
  ]);
};
