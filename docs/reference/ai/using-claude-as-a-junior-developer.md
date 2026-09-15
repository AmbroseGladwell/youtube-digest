# Using Claude as a Junior Developer

This guide is intended to provide some ideas on how junior developers can use Claude (and AI in general) to support them in their work while building their skills and learning.

Some of these ideas may not suit you and that is fine. This guide is being written by a senior platform engineer who has researched this area a bit but who isn't encountering the same problems as junior developers are. If you are a junior developer please be proactive in updating this guide with ideas and things that worked for you.

## Self-Discipline

Learning is hard. Using Claude makes things easier. Possibly the most important thing with using Claude as a junior developer is having the self-discipline to ensure you are not relying on Claude but rather using it to support, guide and teach you. Be conscious when using Claude and reflect on your usage often to ensure you aren't accidentally going into autopilot mode when using it. Don't just read what Claude says, process it and understand it. Question it.

## A Note on Models Being Wrong

Anthropic models are not perfect. They will get things wrong. This will be annoying and frustrating. Use this as a learning opportunity. Remember all humans get things wrong too. It is often when we make mistakes we learn the most. The models are however very good. Claude knows a lot and can help a lot. We need to work out together how best we can use Claude to support every engineer.

## When to Use Claude

This contains ideas of _when_ you may want to use Claude but not necessarily _how_. See the section below for ideas on how you can implement these methods.

### As a Teammate/Mentor/Tutor

Sometimes junior developers can feel like they're always pestering someone in the team. This is rarely the case but it can mean junior developers waste time stuck on a problem and making no progress. On a side note, being stuck but making progress, even if slow, is not a bad thing!

In situations like these you can use Claude to ask questions, get Claude to elaborate, rephrase, help guide etc.

### When You Are Confident

If you are confident in performing a task it may be a good idea to get Claude to help you out with these things to speed you up. This might give you more time for the more challenging aspects of your work. As a word of caution, skill atrophy is also a real issue with using AI. You may want to do these tasks manually from time to time to make sure you are still confident with them.

### As a Second Pass over Your Work

Do what you normally do without AI first. Then use Claude to verify/review/challenge/quiz you on this. Bounce back and forth with Claude. Question it and make sure you understand what it is saying. Remember it might not be correct. It may be entirely wrong, hallucinating or just missing a bit of nuance about the situation. Ask Claude for evidence of what it thinks.

Some ideas of when to use Claude as a second pass:

- To review your code changes.
- To review others' pull requests you are reviewing so you can compare.
- To verify or interrogate your plan or architecture for a piece of work.

## How to Use Claude

### Output Styles

Claude has three output styles. The default, explanatory and learning. Try experimenting with the following output styles to see if they help:

- Explanatory — provides insights into your work as you go to help you understand certain aspects or concepts.
- Learning — same as Explanatory but Claude will leave `TODO(human)` markers throughout the code which you are expected to complete.

You can change this for the current and new sessions by running `/config` and changing the `Output style` line.

### `CLAUDE.md` and Personas

You will often see advice online to start prompts with things like "You are a security engineer" or "You are a UK lawyer". This lets Claude adopt a persona and know how to respond and interact with you. You can use this method to get Claude to behave how you want rather than perhaps just Claude churning out code. Some ideas which may be helpful are:

- You are a mentor to a junior developer
- Don't write code, guide me on what changes to make
- Don't answer my questions directly, guide me to the answer for myself
- Ask me challenging and critical questions
- After each change, quiz me on it

Try different prompts and make a note of what you find effective and what you prefer.

You will need to add this prompt to every session. If you want to avoid this you can add it to your personal `~/.claude/CLAUDE.md` file. This file gets read by Claude at the start of every new session and applies just to you on your machine.

### Useful Prompts

These are some useful prompts or questions which might be handy to bear in mind when working:

- Explain this file to me.
- What does this line do?
- Why do we use this pattern?
- Explain this in super simple and small steps.
- Why is this approach better than the other?
- What am I missing?
- Show me evidence of why it does this
