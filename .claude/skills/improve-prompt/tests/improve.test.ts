import { expect, test } from 'claude-code/testing'

const usage = { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }

test('/improve rewrites and fills the prompt box', async ($, on) => {
  let filled = ''
  on('model.fork', () => ({ value: { isAnswered: false, reason: 'nothing-to-fork', usage } }))
  on('model.complete', ($, e) => {
    expect(e.prompt).toContain('fix the bug')
    return { value: { isAnswered: true, text: '```\nFix bug X in a.ts and run the tests.\n```', usage } }
  })
  on('prompt.fill', ($, e) => {
    filled = e.text
    return { isFilled: true, text: e.text }
  })

  const r = await $.command.run({ command: 'improve', args: 'fix the bug' })
  expect(filled).toBe('Fix bug X in a.ts and run the tests.')
  expect(r.text).toContain('review and send')
})

test('empty prompt does not call the model', async ($, on) => {
  on('model.fork', () => { throw new Error('should not be called') })
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  const r = await $.command.run({ command: 'improve', args: '' })
  expect(r.text).toContain('Nothing to improve')
})
