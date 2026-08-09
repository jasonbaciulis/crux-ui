import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'

export default {
  themes: ['github-dark', 'github-light'],
  plugins: [pluginLineNumbers()],
  defaultProps: {
    showLineNumbers: true,
    overridesByLang: {
      'bash,sh,shell': { showLineNumbers: false },
    },
  },
}
