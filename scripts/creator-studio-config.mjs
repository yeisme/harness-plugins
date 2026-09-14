import { parseArgs } from 'node:util'
import { readFile } from 'node:fs/promises'
import { localStudioConfigPath, localStudioConfigSchema, saveLocalStudioConfig } from '../packages/host/creator-studio/lib/index.js'

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  workspace: { type: 'string' }, eikona: { type: 'string' }, scaena: { type: 'string' },
  'eikona-config': { type: 'string' }, 'scaena-config': { type: 'string' }, 'eikona-project': { type: 'string' },
  'auctra-connection': { type: 'string' }, 'auctra-unit': { type: 'string' }, 'auctra-write': { type: 'boolean' },
} })
const path = localStudioConfigPath()
if (!['show', 'set'].includes(positionals[0]) || positionals.length !== 1) {
  process.stderr.write('Usage: node scripts/creator-studio-config.mjs show|set [--workspace DIR] [--eikona EXECUTABLE] [--scaena EXECUTABLE] [--eikona-project ID] [--auctra-connection FILE] [--auctra-unit REF] [--auctra-write]\n')
  process.exitCode = 2
} else {
  try {
    let settings = { version: 1 }
    try { settings = localStudioConfigSchema.parse(JSON.parse(await readFile(path, 'utf8'))) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
    if (positionals[0] === 'set') {
      if (values.workspace) settings.workingDirectory = values.workspace
      for (const owner of ['eikona', 'scaena']) {
        if (values[owner] || values[`${owner}-config`] || (owner === 'eikona' && values['eikona-project'])) {
          settings[owner] = { executable: owner, ...settings[owner],
            ...(values[owner] ? { executable: values[owner] } : {}),
            ...(values[`${owner}-config`] ? { config: values[`${owner}-config`] } : {}),
            ...(owner === 'eikona' && values['eikona-project'] ? { project: values['eikona-project'] } : {}),
          }
        }
      }
      if (values['auctra-connection'] || values['auctra-unit'] || values['auctra-write'] === true) {
        settings.auctra = { ...settings.auctra,
          ...(values['auctra-connection'] ? { connectionFile: values['auctra-connection'] } : {}),
          ...(values['auctra-unit'] ? { unit: values['auctra-unit'] } : {}),
          ...(values['auctra-write'] === true ? { write: true } : {}),
        }
      }
      await saveLocalStudioConfig(settings)
    }
    process.stdout.write(`Creator Studio configuration: ${path}\nWorkspace: ${settings.workingDirectory ? 'configured' : 'DSH working directory'}\nEikona: ${settings.eikona ? 'configured' : 'PATH'}\nScaena: ${settings.scaena ? 'configured' : 'PATH'}\nAuctra: ${settings.auctra ? `${settings.auctra.unit ?? 'no unit'} (${settings.auctra.write === true ? 'read-write' : 'read-only'}${settings.auctra.connectionFile ? ', connection file' : ''})` : 'not configured'}\nRestart the local DSH preview to apply changes.\n`)
  } catch {
    process.stderr.write('Creator Studio configuration could not be read or saved. Check the supplied paths and user-level configuration.\n')
    process.exitCode = 1
  }
}
