// Trimmed from real WEB-client answers recorded on 12 Nov 2026 (a channel search, a channel's
// Videos tab and its next page), keeping only the nesting each field is read through.

export const searchAnswer = (...channels: { channelId: string; title: string }[]) => ({
  contents: {
    twoColumnSearchResultsRenderer: {
      primaryContents: {
        sectionListRenderer: {
          contents: [
            {
              itemSectionRenderer: {
                contents: channels.map(({ channelId, title }) => ({ channelRenderer: { channelId, title: { simpleText: title } } })),
              },
            },
          ],
        },
      },
    },
  },
});

export interface UploadRow {
  videoId: string;
  title: string;
  length: string;
  age: string;
}

const lockup = ({ videoId, title, length, age }: UploadRow) => ({
  richItemRenderer: {
    content: {
      lockupViewModel: {
        contentId: videoId,
        contentImage: {
          thumbnailViewModel: {
            overlays: [{ thumbnailBottomOverlayViewModel: { badges: [{ thumbnailBadgeViewModel: { text: length } }] } }],
          },
        },
        metadata: {
          lockupMetadataViewModel: {
            title: { content: title },
            metadata: {
              contentMetadataViewModel: {
                metadataRows: [{ metadataParts: [{ text: { content: "59K views" } }, { text: { content: age } }] }],
              },
            },
          },
        },
      },
    },
  },
});

const more = (token: string | null) =>
  token === null ? [] : [{ continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token } } } }];

export const videosTabAnswer = (rows: readonly UploadRow[], continuation: string | null = null) => ({
  contents: {
    twoColumnBrowseResultsRenderer: {
      tabs: [{ tabRenderer: { content: { richGridRenderer: { contents: [...rows.map(lockup), ...more(continuation)] } } } }],
    },
  },
});

export const nextPageAnswer = (rows: readonly UploadRow[], continuation: string | null = null) => ({
  onResponseReceivedActions: [{ appendContinuationItemsAction: { continuationItems: [...rows.map(lockup), ...more(continuation)] } }],
});
