import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers'

export default {
  themes: ['github-dark', 'github-light'],
  plugins: [pluginLineNumbers()],
  // Match shadcn/ui docs code blocks; values reference the Tailwind theme vars from global.css
  // Font settings are absent on purpose: starlight-theme-black's CSS wins over them,
  // so the type styles are enforced in global.css instead
  styleOverrides: {
    uiFontFamily: 'var(--font-sans)',
    codePaddingBlock: 'calc(var(--spacing) * 3.5)',
    codePaddingInline: 'calc(var(--spacing) * 4)',
    codeBackground: 'var(--color-code)',
    borderWidth: '0px',
    borderRadius: 'var(--radius-2xl)',
    gutterForeground: 'var(--color-code-number)',
    gutterBorderWidth: '0px',
    frames: {
      editorBackground: 'var(--color-code)',
    },
  },
  defaultProps: {
    showLineNumbers: true,
    overridesByLang: {
      'bash,sh,shell': { showLineNumbers: false },
    },
  },
}
