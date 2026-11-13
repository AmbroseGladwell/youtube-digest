export const FEED_ITEM_NEWEST = `
    <item>
      <title>Episode 2</title>
      <guid isPermaLink="false">newest-guid</guid>
      <pubDate>Wed, 12 Nov 2026 10:00:00 +0000</pubDate>
      <itunes:duration>1800</itunes:duration>
      <enclosure url="https://media.example/ep2.mp3" length="1" type="audio/mpeg"/>
      <itunes:image href="https://cdn.example/ep2.jpg"/>
      <description>Second.</description>
    </item>`;

export const FEED_ITEM_OLDER = `
    <item>
      <title>Episode 1: The &#8220;Start&#8221;</title>
      <link>https://show.example/episodes/1</link>
      <guid>older-guid</guid>
      <pubDate>Sat, 01 Nov 2026 09:00:00 GMT</pubDate>
      <itunes:duration>01:02:05</itunes:duration>
      <description>Short summary.</description>
      <content:encoded><![CDATA[<p>We talk about beginnings.</p><p>Links &amp; more</p>]]></content:encoded>
      <enclosure url="https://media.example/ep1.mp3" length="1" type="audio/mpeg"/>
      <podcast:transcript url="https://show.example/ep1.vtt" type="text/vtt" language="en"/>
      <podcast:transcript url="https://show.example/ep1.srt" type="application/srt"/>
      <podcast:chapters url="https://show.example/ep1-chapters.json" type="application/json+chapters"/>
    </item>`;

export const feedOf = (...items: string[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>A Show &amp; Friends</title>
    <link>https://show.example</link>
    <itunes:image href="https://cdn.example/show.jpg"/>
    <image><url>https://cdn.example/other.jpg</url><title>A Show</title></image>
    ${items.join("\n")}
  </channel>
</rss>`;
