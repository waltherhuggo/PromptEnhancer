import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const isBusy = atom({ plugin: 'improve-prompt', key: 'isBusy' } as const, false)

const ask = (draft: string) => `Rewrite the prompt below so a coding agent (Claude Code) can execute it better.
Use the context of this conversation and the project. Keep the author's intent and language.
When it makes sense, make explicit: the goal, the files/parts involved, constraints, and how to verify it is done.
Do not invent requirements or expand the scope. Be concise.
Reply ONLY with the rewritten prompt: no comments, no quotes, no code fence.

<prompt>
${draft}
</prompt>`

const clean = (text: string) => text.trim().replace(/^```\w*\n?|\n?```$/g, '').trim()

// Fork first: it sees the conversation + system prompt (CLAUDE.md, git status). New session → plain completion.
async function improve($: EngineInterface, draft: string): Promise<string | undefined> {
  let r = await $.model.fork({ prompt: ask(draft) })
  if (!r.isAnswered && r.reason === 'nothing-to-fork') {
    r = await $.model.complete({ model: 'sonnet', prompt: ask(draft), maxTokens: 2048, timeoutMs: 60000 })
  }
  return r.isAnswered ? clean(r.text) || undefined : undefined
}

async function run($: EngineInterface, draft: string): Promise<string> {
  if (!draft.trim()) return 'Nothing to improve: type a prompt first.'
  if (await read($, isBusy)) return 'Already improving a prompt.'
  await update($, isBusy, () => true)
  try {
    const better = await improve($, draft)
    if (!better) return 'Could not improve the prompt right now.'
    const { isFilled } = await $.prompt.fill({ text: better })
    return isFilled ? 'Prompt improved — review and send.' : better
  } finally {
    await update($, isBusy, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'improve', description: 'Improve a prompt using the session context: /improve <prompt>' })
    return next(e)
  })

  on('command.run', { command: 'improve' }, async ($, e) => {
    const draft = e.args || (await $.prompt.read()).text
    return { text: await run($, draft) }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking) return next(e)
    const { Box, Button, Text } = $.ui.resolve(e)
    if (await read($, isBusy)) return <Box><Text dimColor>✨ Improving prompt…</Text></Box>
    return (
      <Box>
        <Button
          key="improve"
          label="✨ Improve prompt"
          onPress={async () => $.ui.toast(await run($, (await $.prompt.read()).text))}
        />
      </Box>
    )
  })
}
