const vscode = require('vscode')
const { spawn } = require('child_process')

// Prompt goes through stdin: `claude` is a .cmd here and needs the shell, so no user text in argv.
// --continue --fork-session: sees the last session of this folder without writing to it.
function improve(draft, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn('claude -p --continue --fork-session', { cwd, shell: true })
    let out = '', err = ''
    p.stdout.on('data', d => (out += d))
    p.stderr.on('data', d => (err += d))
    p.on('error', reject)
    p.on('close', code => (code === 0 ? resolve(out.trim().replace(/^improve-prompt:\s*/, '')) : reject(new Error(err || `claude exited with ${code}`))))
    p.stdin.end(`/improve ${draft}`)
  })
}

exports.activate = ctx => {
  ctx.subscriptions.push(vscode.commands.registerCommand('improvePrompt.run', async () => {
    const ed = vscode.window.activeTextEditor
    const sel = ed && !ed.selection.isEmpty ? ed.document.getText(ed.selection) : ''
    const draft = await vscode.window.showInputBox({
      title: 'Improve prompt',
      prompt: 'Prompt to improve (Enter to send)',
      value: sel || (await vscode.env.clipboard.readText()),
    })
    if (!draft?.trim()) return
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    try {
      const better = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: '✨ Improving prompt…' },
        () => improve(draft, cwd),
      )
      await vscode.env.clipboard.writeText(better)
      const pick = await vscode.window.showInformationMessage('Prompt improved and copied. Paste it into the Claude chat with Ctrl+V.', 'View')
      if (pick === 'View') vscode.window.showTextDocument(await vscode.workspace.openTextDocument({ content: better, language: 'markdown' }))
    } catch (e) {
      vscode.window.showErrorMessage(`Improve prompt failed: ${e.message}`)
    }
  }))
}
