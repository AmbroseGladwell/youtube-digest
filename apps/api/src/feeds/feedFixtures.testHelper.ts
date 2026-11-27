export const rssOf = (...items: string[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>A Letter &amp; More</title>
    <link>https://letter.example/</link>
    <atom:link href="https://letter.example/feed" rel="self" type="application/rss+xml"/>
    <image><url>https://letter.example/logo.png</url><title>A Letter</title><link>https://letter.example/</link></image>
    ${items.join("\n")}
  </channel>
</rss>`;

export const NEWSLETTER_POST = `
    <item>
      <title><![CDATA[Why the “middle” matters]]></title>
      <description><![CDATA[A short <b>teaser</b> for the post.]]></description>
      <link>https://letter.example/p/why-the-middle-matters</link>
      <guid isPermaLink="false">https://letter.example/p/why-the-middle-matters</guid>
      <pubDate>Wed, 26 Nov 2026 12:00:00 GMT</pubDate>
      <enclosure url="https://cdn.letter.example/header.jpg" length="0" type="image/jpeg"/>
      <content:encoded><![CDATA[<p>The whole post, which is long.</p>]]></content:encoded>
    </item>`;

export const NEWSLETTER_EPISODE = `
    <item>
      <title>Episode 12: an interview</title>
      <description>We talk.</description>
      <link>https://letter.example/p/episode-12</link>
      <guid isPermaLink="false">episode-12</guid>
      <pubDate>Mon, 24 Nov 2026 08:00:00 GMT</pubDate>
      <enclosure url="https://cdn.letter.example/ep12.mp3" length="1" type="audio/mpeg"/>
      <itunes:duration>45:10</itunes:duration>
      <itunes:image href="https://cdn.letter.example/ep12.jpg"/>
    </item>`;

export const atomOf = (...entries: string[]): string => `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Some Blog</title>
  <link rel="alternate" type="text/html" href="https://blog.example/"/>
  <link rel="self" type="application/atom+xml" href="https://blog.example/atom.xml"/>
  <id>https://blog.example/</id>
  <icon>/favicon.png</icon>
  <updated>2026-11-26T10:00:00Z</updated>
  ${entries.join("\n")}
</feed>`;

export const BLOG_ENTRY = `
  <entry>
    <title type="html">Notes on &lt;em&gt;tidying&lt;/em&gt;</title>
    <link rel="alternate" type="text/html" href="/2026/11/tidying"/>
    <link rel="replies" type="text/html" href="/2026/11/tidying#comments"/>
    <id>tag:blog.example,2026:tidying</id>
    <published>2026-11-25T09:30:00Z</published>
    <updated>2026-11-26T10:00:00Z</updated>
    <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>First <b>paragraph</b>.</p><p>Second.</p></div></content>
  </entry>`;

export const youTubeChannelFeedOf = (...entries: string[]): string => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
 <link rel="self" href="http://www.youtube.com/feeds/videos.xml?channel_id=UCabc"/>
 <id>yt:channel:abc</id>
 <yt:channelId>abc</yt:channelId>
 <title>A Channel</title>
 <link rel="alternate" href="https://www.youtube.com/channel/UCabc"/>
 <author><name>A Channel</name><uri>https://www.youtube.com/channel/UCabc</uri></author>
 <published>2015-01-01T00:00:00+00:00</published>
 ${entries.join("\n")}
</feed>`;

export const youTubeEntry = (videoId: string, published: string): string => `
 <entry>
  <id>yt:video:${videoId}</id>
  <yt:videoId>${videoId}</yt:videoId>
  <yt:channelId>UCabc</yt:channelId>
  <title>Video ${videoId}</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=${videoId}"/>
  <author><name>A Channel</name></author>
  <published>${published}</published>
  <updated>${published}</updated>
  <media:group>
   <media:title>Video ${videoId}</media:title>
   <media:content url="https://www.youtube.com/v/${videoId}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
   <media:thumbnail url="https://i1.ytimg.com/vi/${videoId}/hqdefault.jpg" width="480" height="360"/>
   <media:description>What video ${videoId} is about.</media:description>
  </media:group>
 </entry>`;

export const datedItem = (index: number, date: string): string =>
  `<item><title>Post ${index}</title><link>https://letter.example/p/${index}</link><guid>p${index}</guid><pubDate>${date}</pubDate><description>Post ${index} teaser</description></item>`;
