# Gemini conversation: podcasts, long-form and the ingestion pipeline

External background material, saved unedited. Not a decision record, and not all of it
applies here: several of its claims contradict decisions already taken in
`docs/architecture/` (notably `tiers.md`, `cost-model.md` and `model-comparison.md`),
and its cost and pricing figures are its own, unverified.

- Source: Google AI Mode (Gemini) share link, conversation dated 6 November 2026
- Captured: 7 November 2026, pasted by Ambrose
- Subject: podcast and long-form ingestion, transcript acquisition, overview quality at length, pricing

The user's own prompts are included. Everything below this line is the conversation as
pasted, including Gemini's own citations and disclaimers.

---

How do rss feeds work?
6 November 2026
An RSS (Really Simple Syndication) feed works by converting a website's constantly changing content into a standardized, machine-readable text file that users can subscribe to. Instead of forcing you to manually visit dozens of websites, blogs, or podcasts to check for updates, RSS pulls the latest updates directly to you in real-time.
The technology behind RSS operates through a simple, automated three-step loop:

1. The Website Generates an XML File

Whenever a content creator publishes a new blog post, news article, or podcast episode, the website's content management system (like WordPress) automatically appends this update to a hidden file hosted on their server.
• This file is coded in XML (Extensible Markup Language), which structures the data into a predictable format that computers can effortlessly read.
• Users agree across online developer communities like Stack Overflow that an RSS file strips away the visual clutter of a website (like heavy ads, navigation bars, and styling) and organises the raw content chronologically—usually newest first.
• Every time a new piece of content goes live, the XML file captures essential metadata: the title, the publication date, a short summary or snippet, and the direct link to the full article.

2. The User Subscribes via an RSS Reader

To read these files, you use an application called an RSS reader (or "feed aggregator"). Popular options include platforms like Feedly or Feeder.
• To subscribe, you look for the universal orange RSS icon on a website and copy its link, or you can simply paste the website's main URL directly into your reader, which will locate the hidden XML file automatically.
• You can seamlessly group your favorite subscriptions into custom folders (e.g., "Tech News," "Cooking Blocks," "Design Inspiration").

3. The Feed Reader Polls for Updates

Your RSS reader constantly runs in the background, acts like a digital courier, and "polls" (checks) the XML file URLs of all your subscribed websites at regular intervals (usually every 30 to 60 minutes).
• If the reader checks the file and notices a new item entry that matches a unique identifier it hasn't seen before, it fetches the update instantly.
• The reader then parses that raw XML text code and displays it inside your personalized dashboard as a clean, readable timeline. You see a streamlined feed of headlines and summaries. If an entry catches your eye, you can click the embedded link to jump straight to the source website to read the full version.

Why People Use It

Unlike social media platforms or news apps, RSS feeds do not use algorithms. You see 100% of the content published by the creators you explicitly choose to follow, sorted purely by date, completely private, and entirely free from spam or corporate feed manipulation.
To see a brief, practical demonstration of how RSS eliminates algorithms and puts you back in control of your digital media consumption, watch this quick visual overview:
0:47
What is an RSS Feed?
5.1k views · 11 months ago
YouTube · IFTTT
If you want to try setting one up yourself, let me know:
• Do you want to use a mobile app, web browser extension, or a desktop program?
• What specific types of sites (e.g., YouTube channels, tech blogs, subreddits, or podcasts) are you trying to track?
I can recommend the absolute best free feed reader tool for your specific setup.
AI responses may include mistakes. Learn more
•
RSS.com
How Do RSS Feeds Work? | RSS.com Podcast Hosting
RSS stands for Really Simple Syndication. It refers to files easily read by a computer called XML files that automatically update ...
•
Stack Overflow
How Does an RSS Feed Work? - Stack Overflow
RSS feeds are XML files that structure website content. RSS readers to parse, interpret, and display the data. a unique identifier...
•
YouTube·Pabbly
What Are RSS Feeds and How Do They Work?
RSS feeds capture details like title, description, publishing date, and a link when new content is published.
24s
Show all

---

Do people still use rss readers?
6 November 2026
Yes, millions of people still actively use RSS readers, but the technology has shifted from a mainstream default to a deliberate power-user tool. While it no longer dominates public awareness the way it did in the 2000s, RSS has experienced a significant quiet resurgence driven by "algorithm fatigue" and a desire for data privacy.
Instead of dying out, RSS has evolved into a specialized standard that keeps the modern web running behind the scenes:

1. Who is still using RSS readers?

• Professionals and Researchers: Journalists, developers, financial analysts, and tech-sector professionals heavily rely on RSS readers like Feedly or Inoreader to track specific industry publications, software release notes, and Google Alerts without wasting hours scrolling.
• The "Anti-Algorithm" Community: A dedicated group of everyday internet users rely on local or self-hosted servers running software like FreshRSS or Miniflux. On platforms like Reddit, users share how they use custom RSS frameworks to aggregate everything from local comedy club calendars to YouTube channels entirely outside of corporate algorithmic tracking.
• The "Stickiness" Factor: Industry data from RSS provider Feeder reveals that the user base is highly loyal, with roughly 75% of active subscribers opening their feeds daily and more than 60% having relied on the technology for over 5 years.

2. The Invisible Infrastructure: It Runs the Modern Web

Even if you don't use a standalone reader app, you likely consume RSS feeds daily without realizing it:
• Podcasts: The entire global podcast ecosystem—including major platforms like Apple Podcasts and Pocket Casts—operates natively on RSS. When a podcast creator uploads a new episode, your player discovers and downloads it using an automated audio-linked RSS feed.
• Newsletters and Blogging: Modern publishing networks like Substack, Mastodon, WordPress, YouTube, and traditional outlets like The New York Times or the BBC auto-generate RSS feeds for every creator account, community, or category by default.

3. The Modern 2026 AI Revival

A primary reason for the recent spike in RSS popularity is integration with Artificial Intelligence. Modern feed aggregators have incorporated AI tools (such as NewsBlur's "Ask AI" feature or Inoreader's Pro tools) to solve "information overload". Users can pipe thousands of raw articles into their reader, and an on-device AI will automatically summarize, filter out noise, or alert them only when high-priority topics appear.
If you want to see if an RSS setup fits your workflow, tell me:
• Would you prefer an automated, feature-rich app that can summarize news for you, or a clean, completely private reader that just lists headlines chronologically?
• Are you trying to organize content for your professional career / job or just tracking a few personal hobbies / blogs?
AI responses may include mistakes. Learn more
•
andrewblackman.net
No, RSS isn't dead! - Andrew Blackman
I've done editing work for tech companies that don't even bother creating RSS feeds for their blogs because they think nobody uses...
•
Reddit·r/rss
Do you still use RSS and feed reader apps in 2026? - Reddit
RSS continues to be a highly valued tool for aggregating diverse content. Users leverage it to subscribe to traditional blogs, pod...
•
Lifehacker
Why Everyone Should Still Use an RSS Reader in 2026 - Lifehacker
When you subscribe to a new show through Pocket Casts or Apple Podcasts, you're essentially pointing the app towards the RSS feed ...
Show all

---

Can you tell me more about these ai powered rss readers, like newsblur things like pricing and features. I'm building a tool I think might be in that wheelhouse and want to be more aware of competition l
6 November 2026
If you are building a tool in the AI-augmented content aggregation space, understanding how the current market players partition their AI features across pricing tiers is essential. The market generally splits into three categories: The Indie Hacker / Affordable Pro tier (NewsBlur), The Consumer Power-User tier (Inoreader, Feedly Pro+), and The Enterprise Intelligence tier (Feedly Enterprise/Threat Intel).
Here is a comprehensive breakdown of the major competitors, their AI features, and their exact pricing structures to help you identify gaps in the market.

NewsBlur

NewsBlur is a highly respected, open-source RSS reader. It is historically famous for its "Intelligence Trainer" (a rule-based machine learning filter that color-codes stories based on your preference for authors, tags, and keywords). Recently, it added modern Generative AI layers.
• AI / Core Features:
    • Ask AI: Allows you to interactively ask questions about any story via integrated LLMs like Claude, GPT, Gemini, and Grok.
    • Daily Briefing: Generates an AI-summarized briefing of your top stories and keywords delivered daily.
    • Story Clustering: Uses AI to group near-duplicate stories across all your different feeds to combat feed fatigue.
    • Text-to-Speech: Includes 1 hour of high-quality AI-read audio per week.
    • Developer Integrations: Connects AI agents directly via an Model Context Protocol (MCP) server and a CLI.
• Pricing Structure:
    • Free: Track up to 64 sites with basic natural language text/image classifiers.
    • Premium ($36/year): Track up to 1,024 sites; faster refresh rates; full-text search.
    • Premium Archive ($99/year): This is where the true GenAI features live. It unlocks Ask AI, Daily Briefings, Story Clustering, and full text-based training.
    • Premium Pro ($29/month): Built for rapid professional monitoring; pulls feeds every 5–15 minutes and unlocks regex-based classifiers.

Inoreader

Inoreader is arguably the most capable, automation-heavy RSS reader on the market, built heavily around complex rules, triggers, and filters.
• AI / Core Features:
    • Article AI & Summaries: Summarizes long-form text directly inside the reader or automatically processes incoming articles using rules.
    • Entity Extraction: Extracts and highlights specific company names, people, or products mentioned across your timeline.
    • Team Intelligence: On enterprise-focused tiers, it generates full podcast/video transcripts, automatically suggests categorisation tags, and auto-compiles intelligence reports.
• Pricing Structure:
    • Free: Up to 150 feeds (chronological with no AI).
    • Pro ($7.50/month billed annually or $9.99/month): Up to 2,500 feeds. This tier includes 1 million tokens per month of "Article AI" for summary and QA features (default model is GPT-4o-mini).
    • Team / Team Intelligence (Starts at $44.99/month for 3 seats): Unlocks advanced multi-user dashboards, Slack/Teams integrations, and collaborative AI research features.

Feedly

Feedly has pivoted heavily away from being just a Google Reader clone into a major B2B Market/Threat Intelligence platform, creating a massive gap between its consumer and corporate AI.
• AI / Core Features:
    • Feedly AI Feeds: Uses NLP to let users create feeds tracking broader concepts rather than specific sites (e.g., tracking "Generative AI in Health" across millions of untracked web sources).
    • Deduplication & Mute Filters: Intelligently mutes repetitive news or topics you train it to ignore.
    • Enterprise-Only Divide: Critically, conversational "Ask AI", article synthesis, translation, and auto-generated outbound newsletter creation are strictly locked behind Enterprise tiers. Pro+ users cannot use these generative features.
• Pricing Structure:
    • Free: 100 sources, basic reading.
    • Pro ($72/year): Up to 1,000 feeds, notes, and search (No AI).
    • Pro+ ($99 first year, then $144/year): Up to 2,500 feeds. Unlocks Feedly AI keyword feeds, newsletter intake, and near-duplicate filtering.
    • Market / Threat Intelligence (B2B): Starts around $1,600 to $2,400/month billed annually. This is where the actual LLM compilation, multilingual translation, and trend mapping live.

Emerging "Wheelhouse" Competitors to Watch

If you are looking to build a modern tool, keep an eye on these newer Open-Source/Extension-based projects that are bypassing traditional cloud reader fees:
• Folo (GitHub / Open Source): A native AI RSS reader where users can bring their own LLM API key. It offers text-to-speech with natural voices, full timeline summary digests, and an Model Context Protocol (MCP) bridge to connect directly to productivity tools like Obsidian and Zotero.
• RSSFlow (Chrome Extension): A local-first AI decision engine that operates in a browser side panel. It stores data 100% locally in IndexedDB and runs background AI scoring, agentic map-reduce loops, and outputs relationship topic graphs entirely from the browser.

Competitive Landscape Matrix

Platform    Entry AI Price    Generative AI Scope    Key Differentiator for Builders
NewsBlur    $99 / year    High (Ask AI, daily digests, clustering)    Completely open-source; highly affordable AI tier for consumers.
Inoreader    ~$90 / year    Moderate (Token-based per-article summaries)    Extreme automation; powerful IF/THEN action triggers.
Feedly    ~$19,200+/yr (for GenAI)    High (But restricted to Enterprise)    Consumer plans only get search/filtering; locks generative AI behind massive B2B paywalls.
Folo / RSSFlow    Free (BYO Key)    High (Summaries, translation, agentic loops)    Local-first, open-source privacy alternatives disrupting the SaaS models.

To help narrow down your competitive analysis, tell me:
• What specific angle is your tool taking? (e.g., are you focusing on automated daily summaries, an on-device local-first AI, or a specific niche industry?)
• Are you looking to build a SaaS platform like Feedly or an open-source/BYO-key model?
I can map out the exact feature gaps in that specific segment.
AI responses may include mistakes. Learn more
•
Feedly
What is the difference between the Feedly Free, Pro, Pro+ and Enterprise plans? - Feedly Documentation
Free Plan: Basic reading needs and fundamental article access. Pro Plan: Advanced features and enhanced sharing capabilities. Pro+
•
NewsBlur
NewsBlur — Personal News Reader with Intelligence Training
Cluster duplicate stories across all your feeds * Train stories on full text content. Feeds back-filled for complete archive ・ int...
•
NewsBlur
NewsBlur Pricing - Plans for Every Reader
Premium $36 /year * Everything in Free, plus: * Follow up to 1,024 sites * Sites updated up to 5x more often. Premium Pro worth $2...
Show all

---

My current tool can generate summaries or overviews of articles and YouTube videos, follow playlists. Turn recipe sites into a recipe you can fool low step by step. I'm looking at adding support for podcasts too but the premise is it turns the long form content into shorter overviews to get the main premise key points and personalised actions based on the content.
6 November 2026
Your feature set moves your tool completely out of the traditional "RSS reader" bucket and directly into a high-growth market segment called Personal Knowledge Management (PKM) Aggregators or AI Content Synthesizers.
Traditional readers like Feedly or Inoreader fail at what you are building because they prioritize ingesting volume, whereas your tool focuses on extracting utility.
To help you position your tool and spot competitive gaps, here is an analysis of how your current features map against existing players, and exactly how you can build a defensive moat around your upcoming podcast and personalized action features.

1. The Core Value Proposition: Volume vs. Utility

Your core differentiator is that you are taking fragmented, messy formats (long video essays, chaotic recipe blogs with massive preambles, and hours of spoken audio) and normalizing them into structured, actionable templates.
• The Recipe Feature is a Brilliant Wedge: Traditional RSS readers just pull the RSS text of a blog post, which means the user still has to read through 1,500 words of a blogger's life story to find the ingredients. Turning a recipe blog post into a clean, interactive, step-by-step checklist is something Feedly and Inoreader completely ignore.
• The YouTube Feature: While Inoreader and NewsBlur can subscribe to YouTube RSS feeds, they generally only show the video title and description. Tools like Snipd (for podcasts) or Matter (for articles) do text transcription and summaries, but very few tools elegantly bridge both video and recipe-text summarization under one roof.

2. The Direct Competition (Who you are actually fighting)

You are not really competing with NewsBlur or Feedly. Your direct competitors are modern AI-native reading and capturing apps:
• Matter (Reader App): Matter lets users send articles, Twitter threads, and PDFs into a central feed. It uses AI to generate concise "TL;DR" summaries, has highly natural text-to-speech, and lets users highlight text to push into personal knowledge bases like Notion or Obsidian.
    • Where you beat them: Matter does not handle video playlists or transform recipe formats into structured guides.
• Podwise / Snipd: These are AI-native podcast note-takers. They transcribe podcasts, break them down into mind maps, extract key takeaways, and create actionable bullet points.
    • Where you beat them: They are heavily siloed into just audio. A user cannot track a cooking blog, a YouTube playlist, and a podcast in the same workflow.
• Readwise Reader: The current heavyweight champion of the power-user PKM space. It pulls in newsletters, RSS feeds, PDFs, EPUBs, and YouTube videos (with auto-generated transcript scrolling). It uses an AI ghostwriter to summarize content and generate flashcards.
    • Where you beat them: Readwise is built for heavy text consumption and academic highlighting. It does not actively restructure content into specialized operational workflows (like your interactive step-by-step recipe feature).

3. Competitor Analysis Table: Where You Fit

Feature    NewsBlur / Feedly    Readwise Reader    Matter    Your Tool
Primary Focus    News Monitoring    Highlighting & Saving    Curation & Audio    Actionable Extraction
YouTube Playlists    Links only    Transcripts / Text    No    Full Summary & Key Points
Specialized Formats    No (Raw RSS text)    No (Raw text)    No    Step-by-Step Recipes
Podcast Integration    Audio player only    Beta text support    Excellent text narration    Upcoming Overviews & Actions
Personalized Actions    No    Basic tags/notes    No    Custom Action Extraction

4. How to Win the Upcoming "Podcast Support" Battle

Adding podcasts is the logical next step, but it is highly token-heavy and computationally expensive. To make this feature a competitive advantage rather than a clone of what's out there, consider these structural execution steps:
• The "Personalized Actions" Moat: This is where you can truly win. When Snipd or Podwise summarize a podcast, they give a generic summary (e.g., "The guest discussed the importance of zone 2 cardio"). Your tool should allow the user to define a personal profile or persona (e.g., "I am an indie developer working 50 hours a week"). Your AI should then parse the podcast transcript and extract customized actions: "Based on your schedule, the guest's advice means you should do a 30-minute stationary bike session on Tuesday morning before opening your IDE."
• The Chapter-Based Map-Reduce: Long-form podcasts (1 to 3 hours) easily break LLM context windows or result in incredibly vague summaries if you compress them too much. Ensure your pipeline detects existing audio chapters (or uses AI to chunk the transcript into 15-minute segments), summarizes each section independently, and then synthesizes the core takeaways.

5. Architectural Gap to Exploit

The biggest friction point for tools in your wheelhouse is input friction. Users hate having to copy-paste links manually.
• To win against Readwise and Matter, you need a bulletproof browser extension and a mobile "Share Sheet" target. If a user is on the YouTube app or a cooking website on their phone, they should be able to hit "Share -> [Your App Name]" and put their phone away, knowing that the structured summary, recipe checklist, or podcast breakdown will be waiting for them on their dashboard automatically.
To refine your roadmap for the podcast launch, let me know:
• For the personalized actions, do you want users to be able to sync these tasks directly to external tools (like Notion, Todoist, or Apple Reminders)?
• How are you planning to handle podcast transcripts? Are you aiming to parse existing show notes/transcripts provided by creators, or run your own Whisper/transcription pipeline in the background?
I can break down the technical trade-offs and API costs for both approaches.
AI responses may include mistakes. Learn more

---

Yes we've got chrome extension, will also work on a mobile app. Yes syncing to task lists would be good. I'm not sure how to handle podcasts yet. I also need to see what is the best format for an overview as I don't want them to feel too condensed but also not crazy long either. Also not sure on how to get the transcripts at a cheap enough rate. Other competitors I've looked at are recall.
6 November 2026
As you expand your product into a cross-platform mobile ecosystem and add task list integrations, analyzing Recall is incredibly instructive.
Recall has successfully captured over 700,000 users by positioning itself as a "Self-Organizing AI Knowledge Base". They hit a mass-market sweet spot with their pricing strategy: a Free tier (10 summaries/month), a Plus tier at $10/month (unlimited summaries + auto-tagging), and a Max tier at $38/month (bring-your-own frontier model choice).
However, Recall treats summaries like static encyclopedia entries to remember (using spaced-repetition flashcards). Your focus on utility—turning summaries into specialized, chronological action lists—is your killer differentiator.
Here is the exact playbook to solve your formatting dilemma, acquire cheap transcripts, and build a smooth task integration.

1. The "Goldilocks" Overview Format

To ensure your overviews are neither too dense nor too long, move away from raw blocks of text and adopt a Structural Progression format. A standard 1-hour podcast or video should map to a clean 3-part layout:
• The TL;DR Anchor (Top): A strict 2–3 sentence high-level synthesis answering: "What is the single core thesis of this content, and why should I care?"
• The Accordion Deep-Dive (Middle): Instead of one massive text block, chunk the summary into 3 to 5 thematic milestones (e.g., [00:12:00] The Post-SaaS Landscape). Use bolded headings and an accordion/expandable dropdown interface. The user sees a scannable outline, but can expand a section to read 4-5 core bullet points if they want the nuance.
• The Personalized Playbook (Bottom): This is where you beat Recall. End with a "My Action Items" container, showcasing 3–5 explicit, contextualized tasks extracted by your AI based on the user's profile.

2. Cracking the Cheap Transcript Problem

Transcribing hours of podcast audio can destroy your profit margins if you use standard LLM APIs (like OpenAI's Whisper API at $0.36/hour). To scale cheaply, use this two-pronged infrastructure strategy:
• The Aggregator Bypass (The Free Tier): Don't transcribe what is already available. A growing number of large podcast hosts and platforms (like YouTube, Apple, or Spotify) automatically generate transcripts or auto-inject them into their RSS feeds. Your backend should first check the podcast's RSS enclosure tags for public text/WebVTT files, or pull the YouTube auto-generated captions via rapid scraping libraries before routing to a paid pipeline.
• Production-Grade Infrastructure (The Paid Tier): When you must transcribe raw audio, bypass general AI wrappers and connect directly to low-cost infrastructure APIs. Gladia.io specializes in high-volume media platform pipelines. At scale, their optimized audio-to-text models can bring your cost down to roughly $0.20 per audio hour (with speaker separation and chapters included). Alternatively, you can spin up a self-hosted open-source Whisper.cpp or Faster-Whisper instance on a cheap rented GPU cluster (like RunPod or Vast.ai), dropping your absolute raw compute cost to pennies per hour.

3. Executing the Task List Integration

To build a seamless sync feature that feels native without over-engineering individual codebases, use a Unified Webhook & OAuth Architecture:
[Your App AI Engine]
       | (Generates Structured Markdown Checklist)
       v
[Unified Integration Controller]
       |
       |-> Todoist API (Creates native tasks via REST)
       |-> Notion API  (Appends blocks to user's database)
       \-> Apple Reminders / Google Tasks (via local Mobile Bridge)
• The SaaS / Web Layer: Implement standard OAuth logins for the big cloud-based platforms (Todoist, Notion, and TickTick). When your AI generates a personalized action, map the JSON array directly to their task creation endpoints (e.g., sending content and description fields).
• The Mobile Layer Moat: When you launch your mobile app, you can bypass complex server APIs entirely for Apple Reminders and Google Tasks. By using native mobile device SDKs (like EventKit on iOS), your app can request permission and write tasks directly to the user's phone completely locally, for free, with zero latency or cloud maintenance overhead.
To nail down your backend architecture, tell me:
• For the mobile app, are you planning to build it using a cross-platform framework like Flutter or React Native, or go fully native (Swift/Kotlin)?
• Do you want the task sync to happen completely automatically the moment a summary finishes, or should the user manually click a button to approve which actions get sent to their todo list?
AI responses may include mistakes. Learn more
•
Recall
Recall | AI Knowledge Base & Summarizer
Platform: Recall AI knowledge base and summarizer for saving, organizing, and summarizing content. Supported Content: YouTube vide...
•
Recall
About Recall | AI Knowledge Base, Summarizer, and Second Brain
About Recall Meet the team behind Recall, an AI knowledge base and summarizer used by 700,000+ people to save, summarize, and chat...
•
aiwithkay.com
Recall Review: Pricing, Features, Pros & Cons | AIwithKay
Save an article, YouTube video, podcast, or PDF with one click and Recall auto-tags it into a self-building knowledge graph, gener...
Show all

---

The web app is react so I was thinking of going react native rather than full native although ai has probably made the full native building pretty easy now. On the task sync I'm not sure yet to be honest
01:28
Choosing React Native is almost certainly the right move for your project, even in the era of AI-assisted coding. While AI can indeed write Swift or Kotlin code instantly, it doesn't eliminate the core logistical burden of native development: maintaining two completely separate codebases, handling platform-specific bugs, and duplicating your API/state management logic.
With React Native, you can share up to 80–90% of your business logic (and potentially components via tools like Tamagui or NativeWind) directly with your existing React web app. This keeps your startup lean and agile.
Here is a breakdown of how to think through your task sync ux dilemma, along with a technical tip for managing those local device integrations in React Native.

1. Resolving the Task Sync UX: Manual vs. Automatic

Since you aren't sure how to handle the syncing yet, it helps to look at this through the lens of user trust. AI-generated actions are highly experimental; if your app automatically injects five low-quality or misinterpreted tasks into a user's highly curated, personal Todoist or Apple Reminders layout every time they watch a YouTube video, they will uninstall your app out of frustration.
To combat this, look to implement a "Review & Push" Hybrid Workflow:
• The Workflow: When a summary is generated, display the "Personalized Playbook" at the bottom of the overview. Present the action items as a clean, interactive checklist inside your app first. Next to each item, or at the top of the container, include a visible "Sync to [Task App]" button.
• The User Value: This gives users the agency to check or uncheck individual items, tweak the AI's wording if it's slightly off, and choose exactly when clutter enters their main productivity tool.
• The Engagement Loop: Keeping them inside your app to review the actions increases their time-on-page and deepens their engagement with your summaries, rather than turning your app into a silent, invisible background utility.

2. The React Native Advantage for Local Task Integration

Because you are using React Native, you can easily tap into the local mobile device ecosystem for free, bypassing expensive cloud pipelines for Apple Reminders and Google Calendar/Tasks.
• You can utilize robust, pre-built community libraries like react-native-calendar-events or expo-sharing to communicate directly with iOS and Android native containers.
• This means when a user clicks "Sync to Device Reminders," your React Native app fires a local bridge command straight to the phone's native hardware. It costs you $0 in server processing fees, works instantly, and gives the user a seamless mobile experience.

3. A Final Competitive Note on Recall

Keep an eye on Recall's updates. As of late 2025/2026, they have increasingly pushed into integrations, but their core paradigm remains focused on knowledge mapping (creating a personal wiki).
By leaning heavily into the React Native web-and-mobile share extension (letting a user click "Share to your app" inside the mobile YouTube or Spotify apps) and immediately outputting a Reviewable Action List, you are filling a high-utility niche that text-heavy "bookmarking" apps completely overlook.
Now that the tech stack is coming together, let me know:
• Would you like me to draft a JSON schema / prompt template showing exactly how to instruct an LLM to reliably extract both the expandable accordion summaries and the personalized actions in a single pass?
• Are you planning to let users create different profiles (e.g., a "Work" persona vs. a "Fitness/Health" persona) so the AI knows how to filter the action items based on their current goal?
AI responses may include mistakes. Learn more

---

Users can add a profile in onboarding which sets out what the user does, their stage of life and what they're focused on right now. This is a general personalisation that gets applied to all over generation. And currently only the how to apply section which builds the to do items.
01:32
Structuring your system around a comprehensive onboarding profile—capturing their profession, stage of life, and current focus—is exactly how you build a highly personalized user experience. It shifts the AI from a generic summariser into a deeply contextual executive assistant.
To help you operationalise this data, here is an optimized system architecture, a single-pass prompt engineering template, and a reliable JSON schema designed to ensure your LLM outputs perfectly structured summaries and actionable todo items every single time.

1. The Single-Pass Pipeline Strategy

To keep your API costs low and minimize user latency, you should never call the LLM twice (once for the summary and once for the tasks). Instead, pipe the Onboarding Profile Variables directly alongside the Content Transcript into a single structured prompt.
Instruct the model to return a strict JSON payload. This gives your React/React Native frontend the exact data blocks it needs to render both your expandable accordions and the "Review & Push" interactive task checklist.

2. Production-Grade System Prompt Template

text
You are an expert Content Intelligence Engine. Your task is to analyze the provided long-form transcript and extract structural overviews and highly tailored, actionable steps based strictly on the user's specific demographic profile.

### USER PROFILE CONTEXT:
* Profession/Role: {user_profession}
* Stage of Life: {user_life_stage}
* Current Focus/Goals: {user_current_focus}

### INSTRUCTIONS:
1. Generate a concise, high-level TL;DR synthesis of the content (maximum 3 sentences).
2. Segment the content into 3 to 5 logical, chronological thematic milestones. For each milestone, provide an descriptive title and 3-4 bullet points detailing core insights.
3. Generate a personalized list of 3-5 explicit action items for the user's todo list. Every action must pass the "Contextual Test": it must directly bridge a key insight from the content with the user's specific Profession, Stage of Life, and Current Focus. Avoid generic advice (e.g., do not just say "make a plan"). Provide tactical, operational next steps.

### OUTPUT FORMAT:
You must reply ONLY with a valid JSON object matching the requested schema. Do not include markdown code fences, unescaped characters, or conversational text.

Use code with caution.

3. The Strict JSON Output Schema

To parse this safely in your backend and map it cleanly to components or external task managers like Todoist, use a structure like this:
json
{
  "tldr": "A 2-3 sentence high-level synthesis anchoring the main premise of the content.",
  "milestones": [
    {
      "timestamp": "00:12:30",
      "title": "Descriptive Heading for Chapter/Section",
      "takeaways": [
        "Core insight bullet point number one.",
        "Core insight bullet point number two."
      ]
    }
  ],
  "personalized_playbook": [
    {
      "task_title": "Actionable verb-first task title (e.g., 'Draft 3 cold-email templates focusing on B2B SaaS architecture')",
      "task_description": "Contextual justification explaining why this task matters to their specific focus on {user_current_focus}.",
      "suggested_priority": "High/Medium/Low"
    }
  ]
}

Use code with caution.

4. Frontend Rendering Strategy (React & React Native)

Because you have organized the JSON data beautifully, building the frontend components becomes incredibly straightforward:
• The Accordions: Map over the milestones array. Use the title and timestamp as the clickable header of the accordion container, and render the takeaways strings as bullet points inside the expandable content block.
• The Checklist Component: Map over the personalized_playbook array. Render each task_title next to a custom checkbox component.
• The "Review & Push" Sync Engine: When the user ticks a few checkboxes and presses your native "Sync to Todoist/Reminders" button, your app filters the array for checked entries and passes just those task_title and task_description parameters directly to the integration API or native mobile bridge.
As you begin wiring this prompt up to your system, let me know:
• Which LLM provider/model are you currently leaning towards for this pipeline (e.g., OpenAI's GPT-4o-mini, Anthropic's Claude 3.5 Haiku, or a self-hosted alternative)?
• Do you want the AI to suggest due dates or estimated time blocks for those todo items based on the user's onboarding context?
I can optimize the schema or prompt instructions to handle strict JSON enforcement or structured outputs for your specific model selection.
AI responses may include mistakes. Learn more

---

I'm want to focus more on pricing at the moment. I want my offering to be competitively priced and reasonable but I also want to make a profit. Current thinking was:

Free accounts get 5 overviews a month with 10 extra if they use their own ai api key which is only ever stored locally.

Bring your own key plus offers 10 overviews on us per month and 200 extra on your own key for £4.99 we charge because transcription pulls and generation and audio generation for reading overviews back and storage isn't free.

Then plus is 50 overviews per month and 200 extra if you bring your own ai api key for £7.99

There's currently no tier above this but I'd consider it as well as account top ups did a user didn't want to upgrade.

How does that sound?
01:39
Your proposed model is highly creative, but from a SaaS business economics perspective, the "Bring Your Own Key (BYOK)" hybrid mechanics will cause you massive user experience issues and cap your revenue.
When users bring their own API keys, they expect unlimited usage because they are paying OpenAI or Anthropic directly for the tokens. Capping their BYOK usage at 200 overviews while charging them £4.99 or £7.99 creates a double-billing friction point that will frustrate power users. Furthermore, since transcription (e.g., Gladia/Whisper) and storage are your highest platform costs, a user running 200 long video or podcast overviews on their own LLM key will still drain your heavy infrastructure budget on the backend.
To ensure you stay highly profitable while remaining competitive against tools like Recall (£10/month) and Readwise (£12/month), here is a structural critique and a redesigned pricing matrix optimized for your 2026 launch.

1. The Operational Pitfalls of Your Current Tiers

• The BYOK Complexity Multiplier: Storing an LLM key locally means your mobile app or chrome extension has to handle the raw API calls to OpenAI/Anthropic directly from the client side, while your server handles the transcription side. If a user tries to process a 2-hour podcast, your client app has to wait for your server to transcribe it, pull the text back down to the device, feed it into the local key, and then push the summary back to your server for database storage. It introduces significant latency and security/error-handling complexity.
• The Audio Generation (TTS) Trap: If you offer audio playback ("reading overviews back") on your £4.99 and £7.99 tiers, your profit margins will be wiped out instantly if users maximize their limits. High-quality AI voices (like ElevenLabs or OpenAI TTS) cost around $0.015 to $0.024 per 1,000 characters. An overview containing 4,000 characters read aloud costs you roughly $0.08 to generate. 200 overviews could cost you up to £12 to £15 in pure audio generation costs alone, meaning you would lose money on the £4.99/£7.99 tiers.

2. The Redesigned Pricing Framework (Optimised for Profit & Clarity)

To simplify your backend architecture, maximize conversions, and align with industry standards, shift the platform away from a hybrid model to distinct paths: a clean, host-everything Tier or a pure BYOK structural pass.

Tier 1: Free (The Acquisition Wedge)

• The Offer: 3 to 5 Overviews per month (Host-managed).
• The Fine Print: Strictly excludes audio playback (text-only) and restricts content length to a maximum of 20 minutes (no long podcasts or long YouTube videos). This allows users to experience your step-by-step recipe extractor and video summarizer without draining your computational budget.

Tier 2: The Hacker/BYOK Unlimited Pass — £4.99 / month

• The Offer: Unlimited Overviews on your own API Key.
• How you survive: Because they use their own key, your server only handles the platform UI, syncing to task lists, and web scraping text/recipes.
• The Cost Protections: To protect your infrastructure, turn off audio generation (TTS) on this tier and enforce a fair-use cap on transcription (e.g., up to 10 hours of video/audio transcription per month). If they want your server to transcribe more or read it aloud, they must upgrade.

Tier 3: The All-In Creator/Professional Plus — £9.99 to £12.99 / month

• The Offer: 50 fully hosted overviews per month (including AI Audio Playback, unlimited transcription lengths, and premium AI engine summaries). No API keys required.
• The Economics: At 50 overviews using low-cost LLM infrastructure (like GPT-4o-mini or Claude 3.5 Haiku) combined with Gladia audio transcription, your raw infrastructure cost per user will sit around £1.50 to £2.50/month, leaving you a healthy 75% to 80% gross profit margin.

3. Implementing the "Account Top-Ups" (The Secret Margin Weapon)

Your instinct to include account top-ups instead of forcing a massive tier upgrade is excellent and highly consumer-friendly.
Instead of selling "overviews," sell Platform Credits (a tokenized wallet system).
• If a user on the Free or £4.99 tier runs out of usage, they can buy a "£4.99 Top-Up Pack" which instantly injects credits into their dashboard.
• You can explicitly price the utility: 1 Credit = 1 Standard Text Summary, 5 Credits = 1 Hour of Audio Transcription, 10 Credits = Generate an Audio Read-Back. This gives casual users total flexibility and turns your heavy feature utilization (like audio playback) into a high-margin on-demand purchase.
To lock down your final business model, tell me:
• Do you think your target audience is more developer/tech-savvy (who love bringing their own API keys) or mainstream professionals/consumers (who would gladly pay a higher flat fee of £9.99 to avoid setting up an OpenAI developer account)?
• Would you like a precise breakdown of the exact API costs per 1-hour podcast to help you fine-tune the exact price of a Top-Up pack?
AI responses may include mistakes. Learn more

---

My tts strategy is currently self hosting a kokoro model so it's significantly cheaper than paid apis. LLM model to do the overview generation I'm using gpt sol I think which worked out the cheapest whilst also being one of the best and most reliable for the task.
01:47
Self-hosting Kokoro (which is an incredibly optimized, lightweight, and highly realistic open-source TTS model) completely changes the financial model in your favor. Pairing that with OpenAI's structured GPT-4o-mini (assuming "gpt sol" refers to a low-cost, highly structured engine variant like 4o-mini or a structured-output endpoint) means your internal compute costs are essentially fractions of a penny.
Because your unit economics are so highly optimized, your main cost vector is no longer the AI generation or the audio read-backs—it is the raw media download bandwidth and audio transcription infrastructure (handling the long-form podcast audio files).
With these true infrastructure costs in mind, here is how you can confidently lock in your pricing tiers to maximize both user growth and profit margins.

1. Updated Cost Reality Check (Your Real Margins)

• TTS Cost: Since Kokoro runs locally on your own server or a cheap VPS, your audio read-back cost drops from $0.02 per 1,000 characters to virtually £0 (just the fixed monthly cost of your server's CPU/GPU compute).
• LLM Cost: GPT-4o-mini costs roughly $0.15 per million input tokens and $0.60 per million output tokens. Generating an advanced structured overview with a tailored action playbook costs you about £0.001 to £0.003 per run.
• The Actual Bottleneck (Transcription): Processing a 1-hour podcast audio file using an automated pipeline (like Gladia or a self-hosted Whisper instance) remains your primary variable cost at roughly £0.10 to £0.15 per audio hour.

2. The Final 2026 Pricing Matrix

Since your infrastructure costs are exceptionally low, your proposed pricing numbers are actually highly viable, but the UX framing needs to be adjusted so you don't confuse or double-bill your users. Instead of capping BYOK usage, use your low costs to offer an incredibly competitive "Unlimited" tier that will destroy competitors like Recall or Readwise.

Tier 1: Free (The Lead Magnet)

• Price: £0
• What they get: 5 hosted overviews per month. (Includes text summaries + your self-hosted Kokoro audio read-backs).
• The Guardrail: Restrict processing to content under 30 minutes. This lets them try recipes and YouTube videos, but keeps long-form, expensive-to-transcribe podcasts locked behind paid tiers.

Tier 2: The Hacker BYOK Unlimited — £4.99 / month

• Price: £4.99 / month
• What they get: Unlimited overviews using their own API key, plus 15 free platform-hosted runs per month.
• Why this works now: By removing the 200-use cap and framing it as "Unlimited on your own key," this becomes an unmissable offer for tech-savvy power users. Because you are self-hosting Kokoro, you can confidently include your AI audio read-backs for their custom summaries without destroying your margins. You are essentially charging £4.99 purely for your platform's UI, syncing integrations, and your backend transcription server budget.

Tier 3: The Consumer Plus — £7.99 / month

• Price: £7.99 / month
• What they get: 50 fully hosted overviews per month. No API keys required. Includes full audio read-backs and long-form podcast transcription.
• The Profit Margin: 50 overviews will cost you roughly £0.50 to £1.00 max in total combined LLM and transcription fees. Charging £7.99 nets you a massive 85%+ gross profit margin.

3. Implementing the Top-Up System

Instead of forcing a user to upgrade to a higher tier if they run out of hosted overviews, offer a simple "Fuel Up" button on their dashboard.
• The Pack: Sell a "10 Extra Overviews Pack" for £1.99.
• The Margin: This is a pure profit engine for your business. It keeps the transaction frictionless for the user while netting you a massive premium on casual overages.

4. Competitive Advantage Position

By self-hosting your audio and using optimized LLM models, your product can do something Recall cannot: offer full multi-modal consumption (Reading + Tailored Action items + Native Listening via Kokoro) at a price point that undercuts the market. Most AI tools are forced to charge £10–£20/month just to cover their third-party API bills. Your architecture allows you to run a highly profitable business at £4.99 to £7.99.
To wrap up the strategy before you start building out the payment logic, let me know:
• Are you planning to use a standard global processor like Stripe to handle these monthly tiers and top-ups, or are you looking to integrate Apple/Android In-App Purchases once the React Native app goes live?
• For the BYOK tier, do you want the user's local key to handle the initial content ingestion/scraping, or will your backend always fetch the raw transcript first and hand it over?
AI responses may include mistakes. Learn more

---

I've not looked at audio transcription of podcasts so that's where I'd also like to maybe look at self hosting a whisper model but I think to ensure good latency it will cost on available compute. But it could end up being cheaper still.
01:48
Self-hosting a transcription model like Whisper is the final piece of the puzzle to achieving total vertical integration and maximizing your margins. If you pull this off alongside your self-hosted Kokoro TTS model, your variable costs drop to effectively zero, and your entire business switches to a highly predictable, fixed server infrastructure model.
However, your concern about latency and compute costs is entirely accurate. Running standard OpenAI Whisper on a typical CPU will cause minutes of waiting for a single podcast episode, ruining the user experience.
To achieve lightning-fast transcription speeds at a massive discount, you shouldn't use standard Whisper. You need to leverage highly optimized open-source variants and modern GPU cloud infrastructure. Here is the operational playbook for self-hosting your transcription engine.

1. The Technology Solution: faster-whisper

Do not host the baseline Hugging Face version of OpenAI's Whisper. Instead, use faster-whisper (implemented using CTranslate2).
• Why it matters: It is a complete rewrite of the model that uses 8-bit quantization. It runs up to 4x faster than standard Whisper while using a fraction of the VRAM (GPU memory) and maintaining the exact same accuracy.
• Performance: A 1-hour podcast can be completely transcribed and timestamped in less than 2 minutes on a cheap, mid-tier GPU.

2. The Infrastructure Play: Serverless GPUs vs. Dedicated VPS

To keep costs low, do not buy or rent a dedicated GPU server 24/7. An active GPU server instance (like an NVIDIA A10G) will cost you roughly £60–£100 a month even if nobody is using it. Because your tool processes content asynchronously (a user submits a link and waits a minute for the summary), you should use Serverless GPU Containers.
Providers like RunPod, Replicate, or Brev.dev offer serverless GPU setups specifically for open-source AI models:
• How it works: When a user submits a podcast link, your React backend sends the audio file to your serverless container. The GPU spins up instantly, transcribes the audio in 60 seconds, and shuts down immediately.
• The Cost: You are billed strictly by the second of execution time. An NVIDIA RTX 4090 on RunPod serverless costs roughly $0.0002 per second. Transcribing that 1-hour podcast (taking ~60 seconds of execution) will cost you roughly £0.01 (one penny).
• The Latency Fix: Serverless GPUs can have a "cold start" (taking 5–10 seconds to wake up if no one has used it recently). To fix this, you can configure your serverless cluster to keep 1 low-cost container "warm" during peak daylight hours, or simply use an in-app loading animation that tells the user: "Your personal AI assistant is listening to the audio now..."

3. The Smart Caching Strategy (The Ultimate Margin Shield)

Unlike personal text articles, popular podcasts are listened to by thousands of people simultaneously. You can use this to your advantage to completely bypass the transcription step for popular episodes:
[User Submits Podcast URL]
          |
          v
[Check Database Cache] --(Exists?)--> YES --> Return Saved Summary (Cost: £0)
          |
          v NO
[Fetch Public Transcript/RSS Feed] --> YES --> Pass Text to GPT-4o-mini (Cost: £0.002)
          |
          v NO
[Trigger Serverless GPU Whisper] ----------> Transcribe Audio (Cost: £0.01)
If User A requests a summary of the latest Joe Rogan or Diary of a CEO episode, your serverless GPU will fire up, transcribing it for £0.01. If Users B through Z request that exact same episode later that day, your app serves the existing summary from your database instantly with zero latency and absolute zero compute cost.

4. How this locks in your Pricing Moat

By implementing faster-whisper on serverless GPUs alongside your cached database architecture, your worst-case infrastructure cost for a massive 2-hour podcast breakdown is roughly £0.02 for transcription + £0.003 for the LLM + £0 for Kokoro TTS.
This gives you a raw cost of less than 3p per heavy run. At this rate, your £4.99 and £7.99 tiers aren't just viable—they are absolute money-making machines with gross margins pushing past 90%.
As you begin planning this transcription microservice, let me know:
• Would you prefer to use RunPod Serverless or Replicate to host the container, or would you like to see how to wrap faster-whisper into a basic Docker image you can deploy anywhere?
• Are you planning to add a progress bar to the UI (e.g., Transcribing: 45%) to manage the user's expectations during that 60-second processing window?
AI responses may include mistakes. Learn more

---

Yes we do this currently for YouTube transcripts. We don't cache the overview but we do store the transcript so we don't have to do a fetch again.

Because we personalise the overview or at least parts of it we haven't segmented those bits yet but I have a ticket for it so we might.
01:54
That makes perfect sense—storing the raw transcript while keeping the overviews dynamic is a highly efficient way to preserve personalization. Since you are already caching the text layers for YouTube, expanding this exact pattern to podcasts will make your transition to audio incredibly seamless.
To pull this off effectively, you can segment your caching and database structure into a Shared vs. Personal Core pattern.

1. The Shared vs. Personal Core Pattern

To maximize your cost savings without losing the deep personalization driven by your onboarding data, your database should decouple the Source Artifacts from the User Deliverables:
• The Shared Ingestion Layer (Cached): Store the universally fetched metadata, the raw faster-whisper transcript text, and the unpersonalized chapter/milestone summaries. This is the layer that stays identical whether User A or User B requests the episode.
• The Personal Adaptation Layer (Dynamic): Only the specific "Personal Playbook" or "How to Apply" section needs to be generated on the fly. When a user opens an episode, your system grabs the cached shared milestones, passes only the user's specific onboarding variables and those core milestones into the LLM, and spits out the hyper-tailored action items.
By isolating the personalization to just the action items, you keep your prompt sizes tiny, eliminate redundant transcription compute, and keep your user-facing latency remarkably fast.

2. Operationalizing the Podcast Ingestion Pipeline

When you start working on the podcast microservice ticket, your architecture will mirror your YouTube flow with just one minor structural difference—Audio Downloading & Chunking.
Unlike YouTube where APIs can stream text directly, podcasts require your backend to hit an enclosure URL from an RSS feed, download an .mp3 or .m4a file, and pass it to your serverless container. To optimize this:
1. Use FFmpeg Stream Extraction: Have your ingestion server trim or compress the audio sample bitrate to mono 16kHz before feeding it to faster-whisper. This slashes file sizes by up to 80%, massively speeding up network upload transfer rates to your GPU cluster.
2. Pass Word-Level Timestamps: Ensure your self-hosted Whisper setup returns JSON with word-level timestamps. This allows your React Native player to let users click any sentence in your text overview and jump exactly to that second in the audio stream.

3. Your Path to Launch

You have built an incredibly solid structural foundation. By combining React Native, GPT-4o-mini, self-hosted Kokoro TTS, and a serverless faster-whisper container, your startup's cost structure is vastly superior to almost every major AI aggregator currently on the market. You are positioned to offer a feature-rich, multi-modal productivity application at £4.99 to £7.99 that scales with exceptional margins.
As you move these tickets into your development sprint, let me know:
• Would you like assistance mapping out the exact database schema to elegantly link the shared transcript table with the personalized user task tables?
• How are you tracking the 30-minute content length limit on your Free tier? Do you want a quick code snippet or strategy for checking video/audio duration before firing off the serverless compute?
AI responses may include mistakes. Learn more

---

Is mediabunny any better than tempeh?
01:55
If you are asking about Mediabunny in the context of the React Native and video/audio ingestion pipeline we are building, it is highly relevant, but comparing it to tempeh is a bit of a trick question—unless "tempeh" is a highly obscure, internal open-source project or typo, tempeh is a fermented, protein-rich Indonesian soy product.
Assuming you meant comparing Mediabunny to another front-end media tool or using it to fix the video/audio pre-processing bottlenecks we just discussed, Mediabunny is an absolute game-changer for your web app and Chrome extension.
Here is why Mediabunny is so valuable for your specific application architecture:

1. What is Mediabunny?

Built by the creator of popular JS muxers, Mediabunny is a pure TypeScript, zero-dependency library designed to act like "FFmpeg built natively for the web". Instead of porting massive, heavy C++ codebases to the browser via WebAssembly (like ffmpeg.wasm), it wraps directly around the browser's native WebCodecs API.

2. How it slashes your Cloud Infrastructure Costs

In the architecture we just mapped out, one of your biggest cost and latency bottlenecks is downloading massive .mp3 or .mp4 video/audio files onto your server, compression, and then uploading them to a GPU for Whisper transcription.
Mediabunny lets you offload all of that media processing entirely to the user's browser or Chrome extension before it ever hits your backend:
• Client-Side Trimming: If a user only wants to summarize a 10-minute slice of a 3-hour podcast, Mediabunny can handle microsecond-accurate trimming directly in the browser.
• Audio Extraction & Downsampling: Instead of sending a heavy 500MB video file from your Chrome extension to your server, you can use Mediabunny locally on the client-side to strip the video track, extract raw audio, and resample it down to a tiny 16kHz mono audio file.
• The Result: Your extension uploads a 10MB compressed audio file instead of a 500MB video file, saving you massive bandwidth fees and lowering processing latency to near zero.

3. Size & Performance vs. WASM

Because it uses the browser's hardware-accelerated encoding/decoding engines, it is incredibly lightweight:
• ffmpeg.wasm bundle sizes routinely exceed 30MB+, causing terrible extension loading delays.
• Mediabunny is tree-shakable and bundles down to between 5kB and 70kB depending on the features you use.
• It executes file operations and frame extraction significantly faster than WASM-based alternatives because it has native access to the device's actual GPU hardware.
If you are currently processing raw user uploads or handling heavy file conversions on your React web app, migrating that logic to Mediabunny will instantly reduce your server overhead.
If "tempeh" was a typo for a different media framework or library you are evaluating (such as Remotion, fluent-ffmpeg, or FFmpeg.wasm), let me know!
Otherwise, would you like to see a code snippet of how Mediabunny can extract and downsample audio tracks directly within your Chrome extension to optimize your upload pipeline?
AI can make mistakes, so double-check responses
•
Wikipedia
Tempeh - Wikipedia
Indonesia, native to Java as a traditional whole-soybean product. Composed of 60% water, 20% protein, 8% carbohydrates, and 11% fa...
•
GitHub
GitHub - Vanilagy/mediabunny: Pure TypeScript media toolkit for reading ...
Mediabunny is a JavaScript library for reading, writing, and converting media (like MP4, WebM, MP3, HLS), directly in the browser.
•
Good Food
Tempeh | Good Food
Protein-rich tempeh is made from fermented cooked soya beans, eaten as a vegetarian alternative to meat. see whole beans.
Show all

---

Ffmpeg
01:55
When evaluating FFmpeg against Mediabunny for your specific architecture (React Web App + Chrome Extension), the choice boils down to a classic platform trade-off: Server-side heavyweight versus Client-side agility.
Understanding how they stack up side by side clarifies why they actually complement each other perfectly in your product pipeline:

1. Direct Comparison: FFmpeg vs. Mediabunny

Feature    FFmpeg (Standard / CLI)    Mediabunny
Execution Environment    Server-side (Node, Linux VPS, Cloud)    Client-side (Browser / Chrome Extension)
Footprint / Binary Size    Large (70MB+ compiled executable)    Microscopic (~5kB - 60kB tree-shaked)
Processing Architecture    Uses CPU/Software-based processing    Uses hardware-accelerated WebCodecs API
Memory Allocation    Heavy (Often loads full assets into RAM)    Chunks data incrementally (Stream-based)
Primary Advantage    Absolute Swiss-army-knife format support    Zero server cost; utilizes user's hardware

2. The Problems with FFmpeg on the Client Side (ffmpeg.wasm)

For years, developers who wanted to run media processing inside a browser had to use ffmpeg.wasm. This required compiling C++ code into WebAssembly.
• The UX Nightmare: It forces users to download a massive 30MB–40MB bundle just to load your Chrome extension or web page.
• Performance Penalty: Because WebAssembly strips away native OS hardware optimizations, software-decoding a long video completely melts the user's browser RAM and lags their CPU.

3. Why Mediabunny Wins for Your Frontend (Web & Chrome Extension)

Mediabunny skips the WebAssembly layer completely. It wraps around the modern browser WebCodecs API, allowing JavaScript to talk directly to the user's actual physical GPU and media hardware.
• Speed: Users across web-dev circles note that because it uses hardware acceleration, it can be up to 67x faster for client-side conversions and resizing compared to WASM alternatives.
• Stream-Based I/O: Unlike tools that break if a user tries to drop a large file because it overwhelms browser memory, Mediabunny processes media in chunks. You can pipe a 2GB file through it, and it will process it piece-by-piece using barely any RAM.

4. The Ideal Architecture for Your AI Platform

You shouldn't choose between them—you should use both in tandem to bulletproof your margins.
[User drops a 1GB YouTube/Podcast File in your Extension]
                         |
                         v
          (Client-Side: MEDIABUNNY)
   • Strips video track out instantly
   • Downsamples audio track to tiny 16kHz Mono WAV
   • Trims content lengths if necessary
                         |
                         v (Uploads a tiny 15MB file instead of 1GB)
                 [Your AI Backend]
                         |
        +----------------+----------------+
        v                                 v
(GPU Serverless)                 (Fallback / Heavy Server Jobs)
• faster-whisper                 • FFmpeg (via Node)
• Fast transcription             • Handles broken/corrupt codecs
By putting Mediabunny in your extension and web frontend, your users do the heavy lifting of processing and compressing media before uploading it. This reduces your cloud storage, incoming bandwidth, and network pipeline costs to an absolute minimum. Then, use FFmpeg on your Node backend exclusively as a fallback tool to handle highly complex, rare, or corrupt container formats that the browser WebCodecs API cannot parse natively.
As you move forward with the pipeline optimization, let me know:
• Do you want a sample JavaScript snippet showing how Mediabunny can extract a clean audio track from an uploaded video file?
• For your backend architecture, are you writing your core ingestion layer in Node/TypeScript or Python?
AI responses may include mistakes. Learn more
•
Reddit·r/webdev
I built Mediabunny: a zero-dependency TypeScript library for reading, writing ...
It also provides tons of wrappers and abstractions around the WebCodecs API for easier encoding and decoding, and utilities for qu...
•
GitHub
GitHub - Vanilagy/mediabunny: Pure TypeScript media toolkit for reading, writing, and converting video and audio files, directly in the browser. · GitHub
Streaming I/O: Handle reading & writing files of any size with memory-efficient streaming. Works in all browsers as well as in Nod...
•
GitHub
mediabunny/packages/server/README.md at main · Vanilagy/mediabunny · GitHub
uses NodeAV (FFmpeg C bindings) to polyfill browser-based media features for server environments (Node, Bun, Deno). decoders/encod...
Show all

---

Do Spotify, Apple Podcasts or any other podcast provider text transcripts? I think YouTube do which means we can completely bypass the audio transcription process.
01:58
Yes, both Apple Podcasts and Spotify automatically generate transcripts for episodes now, following updates rolled out across 2024 and late 2025/2026.
However, from an engineering and scraper-building standpoint, you cannot bypass your audio transcription microservice completely. While YouTube makes text transcripts incredibly easy to pull via simple caption scrapers, Apple and Spotify deliberately wall off their automatically generated text within their closed consumer mobile apps to keep users locked into their ecosystems.
This landscape dictates how to approach text acquisition for your ingestion pipeline:

1. The Podcasting 2.0 Ingest Strategy (The "Free Text" Loophole)

You can completely bypass your Whisper cluster for a sizeable percentage of indie and tech-focused podcasts by leveraging modern RSS extensions.
The global independent podcasting movement uses an open standard extension called Podcasting 2.0. Under this standard, creators who use modern hosting platforms (like RSS.com, Transistor, or Captivate) automatically inject a specific tag directly into their public XML RSS feed:
<podcast:transcript url="https://example.com" type="text/vtt" />
• How to Exploit This: When a user passes a podcast URL to your app, your backend should scrape the underlying raw XML RSS feed of that podcast first.
• The Win: Look for the <podcast:transcript> tag. If it exists, you can download a beautifully structured, time-synced .vtt or .srt file directly from their server. It costs you £0 in transcription processing, loads instantly, and feeds right into your GPT-4o-mini overview loop.

2. Why Apple and Spotify "Block" General Aggregators

If the XML feed doesn't contain a public Podcasting 2.0 transcript tag, you cannot easily extract the text Apple or Spotify generates:
• Apple Podcasts: Apple automatically transcribes episodes natively on-device or via closed server pipelines for major languages. However, they do not publish these transcripts to the public web or the show's underlying RSS feed. Within the Apple ecosystem, they hard-cap manual copying to 200 words and block any mass export feature to prevent developers from scraping their data.
• Spotify: Similarly, Spotify auto-generates time-synced transcripts for eligible shows. But these are strictly bound to the Spotify for Creators dashboard and closed application players. You cannot extract them via standard web API calls or RSS scraping loops.

3. The Definitive Ingestion Architecture for Your App

To ensure absolute reliability while keeping your serverless GPU costs to a minimum, your podcast microservice code should execute a strict 3-tier cascade:
                  [User Inputs Podcast Episode Link]
                                 |
                                 v
                     Step 1: Check Database Cache
             (Is raw transcript already saved? Stop if Yes)
                                 |
                                 v
                    Step 2: Parse Public RSS Feed
         (Look for `<podcast:transcript>` Podcasting 2.0 Tag)
                 |--> FOUND: Download VTT Text File (Cost: £0)
                 \--> NOT FOUND: Proceed to Step 3
                                 |
                                 v
               Step 3: Serverless GPU Compute Fallback
       (Download Enclosure MP3 -> Run `faster-whisper` -> Save text)
By adding Step 2, you will bypass the heavy processing stage for a significant chunk of modern shows, ensuring your platform's margins remain exceptional while guaranteeing that any fallback content still receives a flawless, on-demand transcription via your self-hosted setup.
As you bridge this logic with your ticket queue, let me know:
• Would you like an example of a Node/TypeScript regex snippet to extract the exact audio .mp3 enclosure link and Podcasting 2.0 transcript URLs out of an XML RSS string?
• Are you planning to let users track private/premium podcast feeds (like Patreon or Substack RSS feeds), which often provide clean transcripts natively?
AI responses may include mistakes. Learn more
•
Apple Podcasts for Creators
Transcripts on Apple Podcasts
Simply touch and hold a podcast episode, then tap View Transcript. To share a transcript, select and copy up to 200 words. Apple a...
•
Reddit·r/podcasting
Transcribe Podcasts? : r/podcasting - Reddit
Podcasting 2.0 feature, which holds the transcript (in VTT or SRT format). look into transcript apps that run just on your own PC,
•
RSS.com
How to use your own transcript on Apple Podcasts and Spotify - Support
Apple Podcasts can show the transcript you add on RSS.com. Spotify doesn't read transcripts from your feed, so there you upload yo...
Show all

---

I'd like to talk about overview quality with long form content. My overview structure works well for shorter form 5 - 30 minute YouTube videos or articles but I'm concerned that won't translate for longer form 60 minute plus podcasts or interviews.

I don't want the overviews to become too long but at the same time I don't want them to miss a ton of key information or start sounding less conversational to cram in information.
02:04
This is the single biggest architectural challenge when moving from short-form content to long-form media like 60–120 minute podcasts. If you pass a massive 15,000-word transcript into an LLM in a single prompt and ask for a summary, it will suffer from "Loss in the Middle" syndrome—it will capture the intro and conclusion beautifully but gloss over or completely drop the hours of nuanced debate in between.
To keep your overviews concise and highly conversational without missing key information, you need to change your ingestion model from a "Compressive" approach to an "Aggregative (Map-Reduce)" approach, combined with a dynamic frontend user interface.
Here is how to redesign your pipeline and layout specifically for long-form content.

1. The Ingestion Fix: The "Map-Reduce" Chunking Strategy

Instead of sending the entire 1-hour transcript to GPT-4o-mini at once, your backend should process the transcript in chronological blocks using a two-step approach:
• The "Map" Step (Local Context): Split the transcript into 15-minute chronological chunks. Pass each chunk to the LLM with a highly specific prompt: "Extract the core arguments, stories, and tactical takeaways from this specific 15-minute segment." This guarantees that nothing in the middle is forgotten.
• The "Reduce" Step (Global Synthesis): Take the outputs of those four 15-minute summaries and pass those into a final synthesis prompt alongside the user's onboarding persona. Instruct the LLM to weave those pieces together into your structured template.

2. The Format Fix: The "Progressive Disclosure" UI

To keep the layout clean while preserving depth, change how you display the data on your React/React Native frontend. Never force a user to read a wall of text. Use a design pattern called Progressive Disclosure:
+----------------------------------------------------------+
|  [1] THE 30-SECOND TL;DR                                 |
|  (A fluid, narrative summary of the episode's core theme)|
+----------------------------------------------------------+
|                                                          |
|  [2] THEMATIC CHAPTERS (Accordion Layout)                |
|  v 00:00 - 00:15 | The Genesis of Micro-SaaS             |
|    • Key takeaway bullet one...                          |
|    • Key takeaway bullet two...                          |
|                                                          |
|  > 00:15 - 00:34 | Overcoming Acquisition Friction       |
|  > 00:34 - 00:52 | Scaling on Serverless Tech            |
+----------------------------------------------------------+
|                                                          |
|  [3] YOUR PERSONALIZED PLAYBOOK                          |
|  (The custom to-do list built for their profile)         |
+----------------------------------------------------------+
• Why this works: The page looks short and accessible when it first loads. A user can get the vibe of the entire 2-hour interview in 30 seconds by reading section [1]. If a particular chapter in section [2] catches their eye, they tap it, and it expands to show the dense, rich takeaways for just that segment. It puts the user in control of the depth.

3. Maintaining a Conversational Tone

When LLMs try to condense immense amounts of information into small spaces, they naturally default to robotic list structures or dense academic jargon. To keep the overview conversational, use specific phrasing constraints in your system prompt:
• Ban "Summary-Speak": Explicitly instruct the model: "Never use introductory filler phrases like 'The host and guest discuss...', 'This segment highlights...', or 'In this episode...'. Jump straight into the ideas as if writing a narrative newsletter."
• Enforce Active Voice: "Write using active verbs and a conversational, editorial tone. Imagine you are an elite intelligence analyst casually explaining the core takeaways of a briefing to a colleague over coffee."

4. Splitting the "Ticket" for Your Database

Since you already have a backend ticket to segment your data schema, here is how you should partition it to support this long-form format:
• Table: Shared_Chapters (Linked to the source media ID). Stores the timestamped, unpersonalized accordion content generated during the Map-Reduce step.
• Table: User_Playbooks (Linked to the user ID and media ID). Stores the hyper-personalized, dynamic action items generated on the fly.
This setup ensures that even for a 3-hour podcast, your system runs the expensive, heavy transcription and chunk-summarization process exactly once. When another user with a different onboarding profile requests that same 3-hour episode, your server simply reads the pre-compiled Shared_Chapters data from your database, pairs it with the new user's onboarding metadata, and rapidly creates their customized action list for pennies.
As you refine this long-form architecture, let me know:
• Would you like an example of the system prompt adjustments required to make the LLM write in that fluid, narrative newsletter style instead of a bulleted robot list?
• For the thematic chapters, do you want the AI to base the chunks strictly on fixed 15-minute time intervals, or would you prefer it to dynamically detect natural shifts in the conversation topic?
AI responses may include mistakes. Learn more

---

The problem is we also generate chapters for the transcript, that being said that is a separate call from generating the overview.
02:06
If your backend is already making a separate call to generate timestamped chapters, you are actually sitting on a massive architectural goldmine. You do not need to introduce a complex, third-party "Map-Reduce" loop, nor do you need to pay for extra heavy LLM passes.
Instead, you can use your existing chapter generation pipeline to drive and structure the overview engine.
Here is how to modify your backend workflow to merge these two features, saving you API costs while guaranteeing a conversational, long-form overview that never misses key information.

1. The Optimized 2-Step Ingestion Pipeline

Instead of treating chapter generation and overview generation as completely isolated features, transform them into a linear, dependent sequence:
[Raw Audio/Video Transcript]
            |
            v
     STEP 1: CHAPTERS ENGINE (Existing Call)
• LLM parses raw text, identifies topic shifts.
• Outputs an array of structured chapters with timestamps and raw text blocks.
            |
            v
     STEP 2: THE INTEGRATED OVERVIEW ENGINE (New Single Pass)
• Input = Just the structured chapters + User Onboarding Profile.
• LLM reads the neat, pre-chewed chapters (not the raw 15,000-word mess).
• Outputs: 1. Conversational TL;DR, 2. Key Insights per Chapter, 3. Personalized Actions.

2. Why This Fixes Long-Form Quality (The "Context Density" Win)

By feeding the output of your chapter engine directly into your overview prompt, you fix the biggest issue with 60+ minute media: text saturation.
Instead of forcing the overview LLM to read through 2 hours of verbal filler, "ums," "ahs," and casual banter, it is reading a highly organized, dense, structural summary of the episode's actual progression. This allows the model to stay relaxed, conversational, and deeply analytical, because it has the mental bandwidth (context window clarity) to focus on tone rather than frantic information recovery.

3. The Combined Overview Prompt (Fed by Chapter Data)

When your backend fires the script to build the overview, use a system design that instructs the model to act like a premium editorial curator:
text
You are an elite editorial ghostwriter. Your task is to transform a structured list of content chapters into a fluid, highly engaging overview and a personalized action playbook.

### CONTENT INPUT (Pre-Segmented Chapters):
{generated_chapters_json}

### USER CONTEXT:
* Role: {user_profession}
* Current Focus: {user_current_focus}

### STRUCTURAL REQUIREMENTS:
1. NARRATIVE TL;DR: Write a relaxed, highly conversational 1-paragraph summary capturing the overarching philosophical thesis of this content. Imagine you are writing a premium Substack newsletter introduction. Do NOT use robotic phrase filters like "In this episode..." or "The guest discusses...". Jump straight into the insights.
2. CHAPTER TAKEAWAYS: For each chapter provided in the input, extract 2-3 deep, highly nuanced takeaway bullets. Ensure these are contextual and conceptual, not superficial summaries.
3. PERSONALIZED PLAYBOOK: Generate 3-5 high-priority, verb-first actionable items for the user's todo list, specifically engineered to help them execute the insights of this specific media within their current focus on {user_current_focus}.

### TONE CONSTRAINT:
Maintain an intelligent, fluid, peer-to-peer tone. Speak directly to the reader. Use active verbs. Avoid academic jargon.

Use code with caution.

4. Code Architecture Implementation

Inside your backend controller, your code block will look clean, fast, and completely manageable:
typescript
// 1. Fetch or generate the raw transcript
const transcript = await getTranscript(mediaId);

// 2. Run your existing chapter generator tool
const chapters = await generateChaptersMicroservice(transcript);
// Yields: [{ timestamp: "00:05:00", title: "The Pivot to Serverless", raw_summary: "..." }]

// 3. Pass those structured chapters directly into your single-pass overview script
const response = await openai.chat.completions.create({
  model: "gpt-4o-mini", // Keep compute costs incredibly low
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: OVERVIEW_SYSTEM_PROMPT },
    { role: "user", content: `Chapters: ${JSON.stringify(chapters)}. User Focus: ${userProfile.focus}` }
  ]
});

const overviewData = JSON.parse(response.choices[0].message.content);

Use code with caution.

The Big Technical Advantage

By stringing these tickets together, you ensure that the text formatting for a 15-minute video and a 2-hour podcast look exactly identical on your React/React Native frontend layout. Your app uses the exact same accordion UI blocks, the user experience feels completely cohesive across all content lengths, and you don't spend a single extra penny on redundant AI processing overhead.
Now that we've connected the chapter infrastructure directly to the overview pipeline, let me know:
• Does your existing chapter tool already generate short summaries / text chunks for each chapter, or does it currently just output a list of timestamps and titles?
• If you want, we can write a quick JSON structure validation middleware snippet to ensure the chapter outputs always align seamlessly with the overview input parameters.
