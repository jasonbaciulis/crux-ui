// @ts-check
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import alpinejs from '@astrojs/alpinejs'

// https://astro.build/config
export default defineConfig({
  site: 'https://crux-ui.com',
  integrations: [
    alpinejs({ entrypoint: '/src/alpine' }),
    starlight({
      title: 'Crux UI',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/jasonbaciulis/crux-ui' },
      ],
      sidebar: [
        {
          label: 'Components',
          items: [{ label: 'Collapsible', slug: 'components/collapsible' }],
        },
      ],
    }),
  ],
})
