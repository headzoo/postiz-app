# Features

Post++ is a social media scheduling workspace for people and teams who need to plan, create, queue, publish, and measure content across many channels without turning every post into a manual checklist.

This page describes the product from a non-technical perspective. The implementation details are covered elsewhere in these internal docs.

## Multi-Channel Scheduling

Post++ lets users prepare posts once and schedule them across supported social and community channels. Instead of jumping between platform dashboards, users can manage upcoming content from one calendar and keep publishing plans visible to the whole team.

The calendar view is the central planning surface. It helps users see what is scheduled, spot gaps, adjust timing, and coordinate campaigns before they go live.

![Calendar view for multi-channel scheduling](/images/features/calendar.png)

## Pipelines

Pipelines turn recurring publishing plans into repeatable workflows. A team can define recurring slots, keep a queue of ready content, and let Post++ pull from that queue when the right publishing window arrives.

This is useful for teams that publish steadily: daily tips, weekly announcements, recurring community updates, content repurposing, or always-on campaigns. Rather than scheduling every item one by one, users can build a system that keeps moving.

![Pipelines overview](/images/features/pipelines.png)

## Autopost

Autopost builds on pipelines by automatically publishing queued content into configured slots. It helps maintain consistency when a team already has approved content waiting to go out.

For users, the value is simple: build the queue, configure the rhythm, and avoid empty calendar slots.

![Autopost schedule configuration](/images/features/autopost.png)

## Rules

Rules let teams automate post lifecycle actions based on engagement signals and timing windows. Instead of manually checking every post after publication, users can define conditions and follow-up actions that run automatically.

Examples include reposting high-performing content, removing underperforming items, and publishing follow-up or reply content when engagement thresholds are met.

![Rules automation configuration](/images/features/rules.png)

## Agents And Assisted Creation

Post++ includes agent-driven workflows for helping users create, refine, and adapt content. These features are meant to reduce blank-page work and help teams move faster from idea to scheduled post.

Agents can work with context documents, media, and channel-specific constraints so users can generate content that fits both the campaign and the destination platform.

![Agents and assisted creation](/images/features/agents.png)

## Analytics

Analytics help users understand what happened after publishing. Users can review performance across connected channels, compare posts, and use platform-specific snapshots to learn which content is resonating.

The goal is practical decision-making: publish, measure, learn, and improve the next round of content.

![Analytics dashboard](/images/features/analytics.png)

## Followers And Audience Tools

Post++ includes audience tooling for understanding and organizing follower relationships. Users can review audience members, triage interactions, keep notes, maintain lists, and use relationship grades to prioritize who needs attention.

This turns social activity into a lightweight relationship workflow, especially for creators, founders, sales teams, and community managers who need to remember context over time.

AI-assisted lead generation helps teams identify high-intent prospects from audience and interaction signals, then prioritize who to engage next.

![Followers and audience tools](/images/features/followers.png)

## Channel Interaction Tracking

Post++ can track interaction events such as likes, replies, quotes, and reposts for supported channels. These events help users see who is engaging and where conversations are happening.

Combined with follower tools, interaction tracking gives teams a better sense of audience momentum and follow-up opportunities.

## Team Management

Teams can collaborate inside Post++ instead of sharing passwords or coordinating through scattered documents. Team features help multiple users plan, review, comment, schedule, and manage content together.

This is especially useful for organizations where content moves through several people before it is published.

## Media Library

The media library gives users a central place to upload, reuse, and manage creative assets. Images, videos, and generated media can be attached to posts without hunting through local folders or old chat threads.

For content teams, this keeps reusable campaign assets close to the publishing workflow.

![Media library](/images/features/media-library.png)

## Context Documents

Context documents let users store background material that can guide AI-assisted work. Examples include brand voice, product notes, campaign briefs, positioning, audience descriptions, FAQs, or reusable talking points.

The same library also supports AI skills: upload a Markdown file named like `campaign-review.skill.md`, and agents can load that procedure on demand with a slash command such as `/campaign-review`. Skills are organization-authored guides for repeatable agent workflows, separate from pipeline brand or tone context.

This helps generated content stay grounded in the team’s own knowledge instead of starting from generic prompts each time.

![Context documents](/images/features/context-documents.png)

## Automation And API Access

Post++ supports automation through API access and integrations. Users can connect external tools and workflows for scheduling, media upload, post management, analytics, and integration-triggered behavior.

This makes Post++ useful not only as a web app, but also as part of a larger content operations system.

## Self-Hosted And Hosted Usage

Post++ supports self-hosted deployments as well as hosted usage. That gives teams flexibility over infrastructure, data ownership, and operating model while keeping the core scheduling and automation workflow consistent.
