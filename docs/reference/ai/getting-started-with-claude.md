# Getting Started with Claude Code

This guide introduces some key concepts of using Claude Code. It is not a definitive guide. Each engineer will use AI agentic tooling in their own way. This document details some of the most useful features of Claude Code and common ways in which people use these tools. It is intended as a starting point to get you going. You will need to use Claude, experiment with it and learn more yourself.

It is a fairly uncontroversial opinion to say that Anthropic models from versions 4.5 onwards are generally pretty good. This means if you are using these models and you are getting consistently poor results across a variety of problems, AI is probably not the problem. It may be the case that you are not prompting and using these models to the best of their ability. This is definitely a learning curve. It takes time to learn and understand how best to use these tools. If you are getting bad results, try to change your approach. Try ideas from this document. Try to reach out to others and to share what is or isn't working with you.

## Prompting

- Use plan mode. Review the plan, correct it then implement it.
- Don't use plan mode. Some people find it easier and better without bothering with plan mode at all.
- Give Claude the context it needs. Be specific. Tell it your thoughts. Tell it not just "what" but the "why".
- Give Claude a feedback loop. Give it a way to self-correct. This may be running tests, it may be something else.
- Review Claude's work as you go and at the end. Stop it before it goes off track. Sometimes it is easier to start again from scratch.

## Git Worktrees

- Git worktrees are an easy way to be able to run multiple Claude sessions on completely isolated copies of a repository at the same time.
- Each worktree is a separate branch.
- Each worktree is a copy of the repository. There are no overlapping files. You can work on two distinct tasks at the same time.
- If you Google "Claude session managers" you will find a lot of options of tooling which manage worktrees for you.
- The basic commands to run from a repository are:

```
# Create a worktree from an existing branch
git worktree add ../my-worktree existing-branch

# List all worktrees
git worktree list

# Remove a worktree
git worktree remove ../my-worktree
```

- Claude also has a built-in worktree flag. Running this will run Claude in a new worktree for you:

```
claude --worktree task-a
```

## Context

- Models have a limited context/window/memory before it gets full and you either need to `/compact` (manually or automatically) or start afresh.
  - Compacting condenses the current session to give you more context for carrying on.
  - In general it is advised to avoid compacting. A fresh session is sometimes easier.
  - If you are always hitting context limits, you probably need to re-evaluate how big the prompts you are giving are.
- When you start a new session, Claude only knows what is in your `CLAUDE.md` files and your prompt. Nothing else until Claude searches and finds out.
  - `CLAUDE.md` is read by Claude at the beginning of every session.
    - It contains project conventions, commands, architecture info and coding guidelines etc.
    - It helps Claude to know repository-specific information from the start.
  - You can also have a personal `~/.claude/CLAUDE.md`. See `Custom Setup` below.
- You can run `/context` to see what uses your context.
- You can tell Claude to run things in a subagent to preserve context. See Subagents section below.

## Thinking Mode

- Opus has different levels of effort for thinking mode.
- If you tell Claude `ultrathink` or phrases like `think harder`, it will use higher effort for that prompt.
- You probably want to default this to `high`.
  - Our limits are generally high enough so we don't hit them.
  - This will give you the best results.
  - You can add `"effortLevel": "high"` to your `~/.claude/settings.json` to do this.

## Permissions

- Start with using default modes of "approving every action" and "allow all edits".
- Use "always allow" to prevent Claude repeatedly asking for permission to run the same, safe command.
- You can specify allow (and deny) commands in `~/.claude/CLAUDE.md`. You can use wildcards for these.
  - These are not foolproof. Claude will use variants of commands which aren't in the allow list, or the wildcard won't quite match.
- When comfortable, try `--dangerously-skip-permissions`. Claude will not prompt for permission in this mode.
  - Only use this when you are comfortable with using Claude and know what Claude will do.
  - For day-to-day work, you will find this to be a lifesaver.
  - Avoid using it if you are doing potentially dangerous things. E.g. never let Claude near the production database with write access.
  - Be smart using it. Give Claude access to read-only accounts and limited permissions so that Claude cannot break things.
  - If doing something dangerous, watch Claude. Don't let it run in the background.

## Slash Commands and Keyboard Shortcuts

- Press escape twice to be able to go back and restore the conversation and code to a previous point.
- Discover slash commands by typing `/` into the terminal.
- There are lots already and you can create your own.
- `/review <pr number>` to create a local review of a PR.
- `/config` to alter config settings.
- `/model` to change model.
- `/insights` to get Claude to analyse and give you feedback on how you use it.
- `/plugins` to manage MCP servers/plugins.
- `/resume` to resume an old Claude session.

## Custom Setup

- You can put your own hooks, commands, `CLAUDE.md` etc in `~/.claude`.
- These settings will only work for you on your machine.
- `~/.claude/CLAUDE.md` is handy to update Claude to behave how you want it to.
  - e.g. you can put a line in which says: `When creating a PR, prefix the title with [TEAM]`
- If the change is valuable to others and fairly unopinionated, add it to the repository versions instead.
- Claude Code has an "auto memory" feature. Tell Claude to remember something and it will remember it just for you in just that repository.
- In `~/.claude/settings.json` you can configure all sorts. E.g. whether to always use `--dangerously-skip-permissions`, what release channel to use for Claude etc.
  - You can also configure a lot of this by running `/config` in a Claude session.

## Subagents

- Subagents are like nested Claude sessions.
- They use their own context instead of the main session.
- A subagent is given a prompt and returns a message. The main Claude session sees none of the work.
- Subagents are great for preserving context in your main Claude session.
- Claude will use subagents automatically. E.g. when exploring the codebase at the beginning of a session (most of the time).
- You can tell Claude to use a subagent.

## MCP/Plugins

- MCP/plugins allows you to easily extend the tools Claude has access to.
- Avoid adding MCP servers for things Claude can easily do in other ways.
  - e.g. don't use the GitHub MCP server. Tell Claude to use `gh`.
- Every MCP server you add uses up some context. Only add what you need and find useful.

## AI Psychosis/How Do You Keep Up to Date

- These tools are constantly evolving and changing.
- There is a degree of effort required to stay up to date with the latest features available.
- You don't need to stay up to date with the latest features. You can do a lot with just Claude and not using any of the custom commands and features.
- If you want to keep up to date, find a good YouTuber, blogger etc that you vibe with.
