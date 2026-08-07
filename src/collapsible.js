// Collapsible — WAI-ARIA disclosure pattern.
//
//   <div x-collapsible default-open>
//     <button x-collapsible:trigger>Advanced options</button>
//     <div x-collapsible:panel hidden>…</div>
//   </div>
//
// Config attrs (root): default-open, disabled, hidden-until-found.
// x-model (boolean) overrides default-open. Event: `collapsible-change`
// with `detail.value` (the model value type — boolean here), bubbling from
// the root. Magic: $collapsible.

// Data-state styling contract (API.md): boolean presence attributes —
// present means empty string, absent means removed.
const openClosedBindings = {
  ':data-open'() {
    return this._collapsible.open ? '' : false;
  },
  ':data-closed'() {
    return this._collapsible.open ? false : '';
  },
};

const disabledBinding = {
  ':data-disabled'() {
    return this._collapsible.disabled ? '' : false;
  },
};

const noopApi = { isOpen: false, open() {}, close() {}, toggle() {} };
const magicApis = new WeakMap();

export default function collapsible(Alpine) {
  Alpine.directive(
    'collapsible',
    (el, { value }, { effect, cleanup, evaluate }) => {
      if (!value) root(el, Alpine);
      else if (value === 'trigger') trigger(el, Alpine);
      else if (value === 'panel')
        panel(el, Alpine, { effect, cleanup, evaluate });
      else console.warn(`[crux] Unknown part "x-collapsible:${value}"`, el);
    },
  );

  Alpine.magic('collapsible', (el) => {
    const state = Alpine.$data(el)._collapsible;
    if (!state) {
      console.warn('[crux] $collapsible was used outside of x-collapsible', el);
      return noopApi;
    }
    let api = magicApis.get(state);
    if (!api) {
      api = {
        get isOpen() {
          return state.open;
        },
        open() {
          state.setOpen(true);
        },
        close() {
          state.setOpen(false);
        },
        toggle() {
          state.toggle();
        },
      };
      magicApis.set(state, api);
    }
    return api;
  });
}

function root(el, Alpine) {
  Alpine.bind(el, {
    'x-data'() {
      return {
        _collapsible: {
          open: el.hasAttribute('default-open'),
          disabled: el.hasAttribute('disabled'),
          untilFound: el.hasAttribute('hidden-until-found'),
          panelId: null,
          setOpen(open) {
            if (this.disabled) return;
            this.open = open;
          },
          toggle() {
            this.setOpen(!this.open);
          },
        },
        init() {
          this.$watch('_collapsible.open', (open) => {
            this.$dispatch('collapsible-change', { value: open });
          });
        },
      };
    },
    // Scopes $id('crux-ui-collapsible-panel') calls so trigger and panel
    // agree on the same generated id, unique per root instance.
    'x-id'() {
      return ['crux-ui-collapsible-panel'];
    },
    // Without x-model on the element this is inert (Alpine only entangles
    // when el._x_model exists), so it's safe to bind unconditionally.
    'x-modelable': '_collapsible.open',
    ...openClosedBindings,
    ...disabledBinding,
  });
}

function trigger(el, Alpine) {
  const state = closestState(Alpine, el, 'trigger');
  if (!state) return;

  const isButton = el.tagName === 'BUTTON';
  if (isButton && !el.hasAttribute('type')) el.setAttribute('type', 'button');

  Alpine.bind(el, {
    ':aria-expanded'() {
      return this._collapsible.open ? 'true' : 'false';
    },
    ':aria-controls'() {
      return this._collapsible.panelId || false;
    },
    ':data-panel-open'() {
      return this._collapsible.open ? '' : false;
    },
    ...disabledBinding,
    '@click'() {
      this._collapsible.toggle();
    },
    ...(isButton
      ? {
          ':disabled'() {
            return this._collapsible.disabled;
          },
        }
      : {
          role: 'button',
          tabindex: '0',
          ':aria-disabled'() {
            return this._collapsible.disabled ? 'true' : false;
          },
          '@keydown.enter.prevent'() {
            this._collapsible.toggle();
          },
          '@keydown.space.prevent'() {
            this._collapsible.toggle();
          },
        }),
  });
}

function panel(el, Alpine, { effect, cleanup, evaluate }) {
  const state = closestState(Alpine, el, 'panel');
  if (!state) return;

  state.panelId = el.id || evaluate("$id('crux-ui-collapsible-panel')");
  el.id = state.panelId;

  Alpine.bind(el, {
    ...openClosedBindings,
    ...(state.untilFound
      ? {
          // hidden="until-found" keeps closed content findable by the
          // browser's find-in-page. Incompatible with display:none, so
          // visibility is managed through the hidden attribute alone —
          // no x-show, no JS transitions.
          ':hidden'() {
            return this._collapsible.open ? false : 'until-found';
          },
        }
      : {
          'x-show'() {
            return this._collapsible.open;
          },
        }),
  });

  if (state.untilFound) {
    const onMatch = () => {
      if (state.disabled) {
        // The browser strips `hidden` after beforematch; a disabled
        // collapsible must stay closed, so put it back on the next frame.
        requestAnimationFrame(() => el.setAttribute('hidden', 'until-found'));
        return;
      }
      state.setOpen(true);
    };
    el.addEventListener('beforematch', onMatch);
    cleanup(() => el.removeEventListener('beforematch', onMatch));
  } else {
    // Templates ship `hidden` to prevent pre-init flash; x-show has already
    // applied display:none synchronously if closed, so this is safe.
    el.removeAttribute('hidden');
  }

  // Base UI parity: expose the open panel's measured size.
  let sizeRaf;
  effect(() => {
    cancelAnimationFrame(sizeRaf);
    if (!state.open) return;
    sizeRaf = requestAnimationFrame(() => {
      // Read both dimensions before writing — a write between the two
      // reads would force a second layout pass.
      const { scrollHeight, scrollWidth } = el;
      el.style.setProperty('--collapsible-panel-height', `${scrollHeight}px`);
      el.style.setProperty('--collapsible-panel-width', `${scrollWidth}px`);
    });
  });
  cleanup(() => cancelAnimationFrame(sizeRaf));
}

function closestState(Alpine, el, part) {
  const state = Alpine.$data(el)._collapsible;
  if (!state) {
    console.warn(
      `[crux] x-collapsible:${part} must be inside x-collapsible`,
      el,
    );
  }
  return state;
}
