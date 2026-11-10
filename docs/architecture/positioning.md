# Positioning: how the product is explained

OV-270. Captured on 10 Nov 2026 from the owner's answer to a family member, who asked the
question that will come up more than any other:

> How is your app different from putting a transcript into Claude or ChatGPT?

This is raw material for marketing, onboarding copy and the store listing. **It is not finished
copy, and nothing here is decided.** The store's own words are in `store-listing.md`. The
product's direction, which this explains without changing, is in `product-direction.md`.

## The one-liner

> It's a tool I'm building to scratch my own itch: save anything you meant to watch or read,
> and it pulls out the good bits, tells you straight whether it's worth your time, and builds
> them into a library you or your AI assistant can use later.

## The answer as given

In the owner's words, lightly cleaned:

> That's a good question.
>
> Currently it's a tool I'm building to scratch my own itch. Instead of saving a bunch of stuff
> to a collection or playlist and never coming back, I can quickly save it to The Overview. It
> pulls out the good bits, tells me straight whether it's worth my time, and builds them into a
> library that I, or Claude or ChatGPT, can use later as context.
>
> So for example, I've been saving a bunch of videos and articles on app building and using AI,
> as well as finance articles, and they all go in. I get to read the main bits quickly, or
> listen to them while I'm doing something else, in far less time. Or I can get Claude to pull
> them all in as evidence and context for something I'm doing.
>
> But with how fast AI is moving it's a bit of a minefield. Honestly, for a single source like
> one video or podcast, not much: you could grab the transcript or text, paste it into your AI
> assistant and get a decent summary.
>
> Where it could be better for some people:
>
> - **Convenience:** no digging around for transcripts. You just save the link, and there's a
>   web app and a Chrome extension (maybe a phone app later) to make saving to your library
>   quick and easy. You can also follow a YouTube playlist, so anything you add to it gets
>   picked up automatically, at a pace you choose.
> - **Honesty:** each overview is short and easy to read or listen to, and it tells you
>   straight whether the source is worth your time, whether it's new or rehashed, and what it's
>   trying to sell you.
> - **A library that builds up:** everything you save becomes your own knowledge library,
>   which you or your AI assistant can search and pull from.
> - **Personal:** it all gets personalised to you if you want it to be. How to apply, for one,
>   is written for you.
>
> Where it's heading:
>
> - **Projects:** group what you've saved around something you're working on, like a kitchen
>   renovation or a new job, so you or your AI assistant can pull together everything relevant
>   in one go.
> - **Connections:** spot when things you've saved are about the same idea, even if they use
>   completely different words, and say why they're linked. Eventually it could flag when one
>   source contradicts another.
> - **Asking questions:** suggested follow-up questions to dig deeper into a source, and
>   possibly chatting with it inside the app.
> - **Your assistant doing the saving:** asking Claude or ChatGPT to save something for you,
>   at a pace you control.
>
> All of that's planned rather than built, and I want to see how people actually use it before
> deciding what comes next. For now it handles YouTube videos (including podcasts on YouTube),
> articles and recipes, but not PDFs or podcasts outside YouTube.

## What to take from it for copy

- **Lead with the concession.** "For a single source, honestly not much" earns trust, and it
  moves the conversation to what a chatbot doesn't do. Don't claim a better summary: the next
  model release closes that gap for free.
- **The three things a chatbot doesn't do:**
  1. capture with no effort: save a link, or follow a playlist;
  2. a straight verdict: worth your time, new or rehashed, what it's selling;
  3. a library that builds up, which the reader's own assistant can use (`mcp-connector.md`).
- **The concrete example does the selling.** Saving videos on app building and finance, then
  getting Claude to pull them in as evidence for something you're doing, makes the library real
  in a way a feature list doesn't.
- **"Scratching my own itch" is a credible origin story**, for the first release at least.
- **Lines worth keeping:**
  - "Pull out the good bits without sitting through hours of it."
  - "Tells you straight whether it's worth your time."
  - "A library you or your AI assistant can use later."
  - "Your library, with the weak material labelled", from `product-direction.md`.

## Who it's for, as a hypothesis

People who save more than they watch. They learn from YouTube and articles (business,
productivity, health, cooking), their Watch Later list keeps growing, and they want the good
bits without sitting through hours. `README.md` says it first: "Saving a video feels like
learning something. It isn't."

A strong fit is someone who already uses Claude or ChatGPT. That's where the library is worth
more than a reading list, and where the paste-it-into-Claude question has its best answer.

It isn't for:
- students cramming for exams, who are better served by study tools with quizzes and flashcards;
- heavy highlighters, who are better served by Readwise;
- someone who wants an occasional summary, where pasting into an assistant is fine;
- people watching for fun, for whom a verdict saying "skip it" is no help.

**This is the owner's hypothesis, not evidence.** The friends-and-family release asks testers
"Would you have got this from pasting the transcript into ChatGPT or Claude?" If most say yes,
the verdict and the library aren't landing, and this page needs rethinking.

## Caveats any copy has to keep

- The verdicts are AI judgement and will sometimes be wrong.
- There's no saving from a phone yet.
- Only public or unlisted playlists can be followed. Private playlists need the reader's own
  Google sign-in, which isn't built. Watch Later can't be read by any app at all
  (`playlists.md`).
- PDFs and podcasts outside YouTube aren't handled yet.
- Anything under "where it's heading" is planned, not built.
