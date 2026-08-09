// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import starlightThemeBlack from 'starlight-theme-black'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://astro.build/config
export default defineConfig({
  site: 'https://crux-ui.com',
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // Resolve to package source instead of the exports-mapped dist/,
        // so demos pick up src edits without a package rebuild.
        'crux-ui': fileURLToPath(new URL('../packages/crux-ui/src/index.js', import.meta.url)),
      },
    },
  },
  integrations: [
    starlight({
      title: 'Crux UI',
      plugins: [
        starlightThemeBlack({
          navLinks: [{ label: 'Docs', link: '/components/collapsible' }],
        }),
      ],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/jasonbaciulis/crux-ui' },
      ],
      customCss: [
        '@fontsource-variable/geist',
        '@fontsource-variable/geist-mono',
        './src/styles/global.css',
      ],
      components: {
        Head: './src/components/Head.astro',
      },
      sidebar: [
        {
          label: 'Components',
          items: [{ label: 'Collapsible', slug: 'components/collapsible' }],
        },
      ],
    }),
  ],
})
