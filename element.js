/*
 * element.js — lightweight DOM component library
 *
 * ─── CREATING AN ELEMENT ────────────────────────────────────────────────────
 *
 * 1. Plain object — creates a new DOM node
 *
 *    new Element({ name: 'div', props: { className: 'card' } })
 *
 *    The `name` field determines the tag. All other recognised fields are
 *    listed in the reserved set below. Any non-reserved field that holds a
 *    valid child value (see CHILDREN) is treated as a named child.
 *
 * 2. CSS selector string — wraps an existing DOM node
 *
 *    new Element('.my-container')
 *    new Element('#app > .sidebar')
 *
 *    The node is looked up with document.querySelector. Its existing DOM
 *    children are parsed and attached as named properties (tag+index, e.g.
 *    div0, span1). Sets reassign=true so prepareNode always re-renders.
 *
 * 3. HTML string — creates a node from markup
 *
 *    new Element('<button class="primary">OK</button>')
 *    new Element('<input type="text" placeholder="name">')
 *
 *    Parsed via a <template> element. The first child element is used.
 *    Sets reassign=true.
 *
 * 4. HTMLElement — wraps an existing DOM node directly
 *
 *    new Element(document.getElementById('app'))
 *    new Element(someHTMLElement)
 *
 *    Existing DOM children are parsed and attached as named properties
 *    (tag+index). The original node is preserved as this.node.
 *
 * ─── RESERVED FIELDS ────────────────────────────────────────────────────────
 *
 *   name          — tag name used by createElement (e.g. 'div', 'button')
 *   node          — the underlying HTMLElement; set automatically on render
 *   props         — object of properties/attributes to assign to the node
 *   data          — object mapped to node.dataset
 *   listeners     — event listeners (see LISTENERS)
 *   bindings      — reactive properties (see BINDINGS)
 *   preRender     — hooks called before render (see HOOKS)
 *   postRender    — hooks called after render (see HOOKS)
 *   elementClass  — custom element class or path string (see CUSTOM ELEMENTS)
 *   elementProps  — options passed to customElements.define
 *   parent        — reference to the parent Element, set automatically
 *   reassign      — if true, prepareNode always re-renders
 *
 * ─── PROPS ──────────────────────────────────────────────────────────────────
 *
 *   new Element({
 *     name: 'div',
 *     props: {
 *       id: 'main',               // node.id = 'main'
 *       className: 'foo bar',     // node.className = 'foo bar'
 *       textContent: 'hello',     // node.textContent = 'hello'
 *       style: { color: 'red' },  // Object.assign(node.style, { color: 'red' })
 *       'aria-label': 'close',    // node.setAttribute('aria-label', 'close')
 *                                 //   (any key not present as a DOM property
 *                                 //    is set as an attribute)
 *     },
 *     data: { userId: '42' }      // node.dataset.userId = '42'
 *   })
 *
 * ─── CHILDREN ────────────────────────────────────────────────────────────────
 *
 *   Any non-reserved property on an Element instance (or in the constructor
 *   object) whose value is a valid child is treated as a named child.
 *   Valid child values are:
 *     - Element instance
 *     - HTMLElement / Node instance
 *     - HTML string (must parse to at least one element node)
 *     - plain object {} (auto-wrapped into an Element)
 *
 *   Children are accessible directly by their property name:
 *
 *   // in constructor object
 *   new Element({
 *     name: 'div',
 *     header: new Element({ name: 'header' }),
 *     nav:    '<nav id="main-nav"></nav>',
 *     body:   { name: 'main', props: { id: 'content' } }
 *   })
 *   // → el.header, el.nav, el.body
 *
 *   // as class fields in a subclass
 *   class Card extends Element {
 *     name    = 'div'
 *     heading = new Element({ name: 'h2' })
 *     body    = '<p class="body"></p>'
 *   }
 *   // → card.heading, card.body
 *
 *   // assigned after construction
 *   el.sidebar = new Element({ name: 'aside' })
 *
 *   // appended dynamically
 *   new Element({ name: 'span' }).appendTo(el, 'badge')
 *   // → el.badge
 *
 *   When wrapping an HTMLElement or using a selector/HTML-string constructor,
 *   existing DOM children are auto-named as tag+index:
 *   <ul><li/><li/><li/></ul>  →  el.li0, el.li1, el.li2
 *
 * ─── LISTENERS ───────────────────────────────────────────────────────────────
 *
 *   listeners: {
 *     click:      () => console.log('clicked'),
 *     mouseenter: function() { this.node.classList.add('hover') },
 *     //          ^ `this` is always the Element instance
 *
 *     // pass addEventListener options as a second element in an array:
 *     scroll: [handler, { passive: true }]
 *   }
 *
 * ─── BINDINGS (reactive properties) ─────────────────────────────────────────
 *
 *   bindings: {
 *     value: {
 *       get() { return this._value },
 *       set(v) {
 *         this._value = v
 *         this.node.textContent = v   // side-effects go here
 *       }
 *     }
 *   }
 *   // el.value = 'foo'  →  triggers set, el.value  →  triggers get
 *
 * ─── HOOKS ───────────────────────────────────────────────────────────────────
 *
 *   preRender and postRender are named maps of functions called with the
 *   Element instance just before / just after the node is rendered.
 *   postRender is a good place to set initial reactive property values.
 *
 *   preRender:  { setup:    (el) => el.node.dataset.ready = 'false' }
 *   postRender: { init:     (el) => { el.value = 'default' } }
 *
 *   The node also emits CustomEvents:
 *     'rendered'   — after first render
 *     'rerendered' — after a rerender
 *
 * ─── CUSTOM ELEMENTS ─────────────────────────────────────────────────────────
 *
 *   Set elementClass to register a custom element. The tag name is derived
 *   from `name`; if it contains no hyphen, '-element' is appended.
 *
 *   // inline class
 *   new Element({
 *     name: 'my-widget',
 *     elementClass: class extends HTMLElement { ... }
 *   })
 *   // registers <my-widget>, creates document.createElement('my-widget')
 *
 *   // path string — the .js file is imported dynamically
 *   new Element({ name: 'my-widget', elementClass: './widgets/my-widget' })
 *
 *   // elementProps is passed as the third argument to customElements.define
 *   new Element({ name: 'item', elementClass: MyClass, elementProps: { extends: 'li' } })
 *
 * ─── SUBCLASSING ─────────────────────────────────────────────────────────────
 *
 *   class Card extends Element {
 *     name  = 'div'
 *     props = { className: 'card' }
 *
 *     heading = new Element({ name: 'h2' })
 *     body    = '<p></p>'
 *
 *     bindings = {
 *       title: {
 *         get()  { return this._title },
 *         set(v) { this._title = v; this.heading.node.textContent = v }
 *       }
 *     }
 *
 *     postRender = { init: (el) => { el.title = 'Untitled' } }
 *   }
 *
 *   const card = new Card()
 *   await card.appendTo(document.body)
 *   card.title = 'Hello'   // updates heading DOM node immediately
 *
 * ─── RENDERING ───────────────────────────────────────────────────────────────
 *
 *   // append to a raw DOM node (renders automatically)
 *   await el.appendTo(document.body)
 *   await el.appendTo(document.body, 'myName')
 *
 *   // append to another Element (stored as named property + rendered)
 *   await child.appendTo(parentEl, 'sidebar')
 *   // → parentEl.sidebar === child
 *
 *   // get the rendered node or HTML string
 *   const node = await el.toNode()
 *   const html = await el.toString()
 *
 *   // force a full rerender (clears and rebuilds all child DOM)
 *   await el.prepareNode(true)
 *
 * ─── LOOKUP ──────────────────────────────────────────────────────────────────
 *
 *   Recursively searches the element tree by name or regex.
 *
 *   el.lookup('sidebar')        // exact match on key or .name
 *   el.lookup('btn*')           // glob-style wildcard
 *   el.lookup(/^icon-/)         // regex
 *
 *   Returns an array of matching Element instances.
 *
 * ─── node.component ──────────────────────────────────────────────────────────
 *
 *   After rendering, el.node.component === el, giving access to the Element
 *   instance from any raw DOM reference.
 */

class Element
{
  static reserved = new Set([
    'name',
    'node',
    'props',
    'data',
    'listeners',
    'bindings',
    'preRender',
    'postRender',
    'elementClass',
    'elementProps',
    'parent',
    'reassign'
  ])

  static parseHTML(str)
  {
    try {
      const t = document.createElement('template')
      t.innerHTML = str
      return t.content.children[0] ?? null
    } catch(e) {
      return null
    }
  }

  static isValidChild(key, value)
  {
    return (
      !Element.reserved.has(key) &&
      value !== null &&
      value !== undefined &&
      typeof value !== 'function' &&
      (
        value instanceof Node ||
        value instanceof Element ||
        (typeof value === 'string' && Element.parseHTML(value) !== null) ||
        (typeof value === 'object' &&
          (
            Object.getPrototypeOf(value) === Object.prototype ||
            Object.getPrototypeOf(value) === null
          )
        )
      )
    )
  }

  getChildren()
  {
    const own = {}
    for (const key of Object.keys(this)) {
      if (Element.isValidChild(key, this[key])) {
        own[key] = this[key]
      }
    }
    return own
  }

  constructor(obj, extend = {})
  {
    if (typeof obj === 'string') {
      const node = Element.parseHTML(obj)
      if (node) {
        obj = node
      } else {
        obj = document.querySelector(obj)
      }
      this.reassign = true
    }

    if (obj instanceof HTMLElement) {
      const children = {}
      const tagCount = {}
      for (const child of obj.children) {
        const tag = child.tagName.toLowerCase()
        tagCount[tag] = (tagCount[tag] ?? 0)
        const key = tag + tagCount[tag]++
        children[key] = new Element(child)
      }
      obj = { node: obj, ...children }
    }

    const defaults = {
      props: {},
      data: {},
      listeners: {},
      preRender: {},
      postRender: {},
      ...extend
    }

    Object.assign(this, {...defaults, ...obj, ...this})
  }

  lookup(name, ret = [])
  {
    const pattern = typeof name == 'string' ? (new RegExp(`^${name.replace('*', '.*')}$`)) : name
    for (let [n, prop] of Object.entries(this.getChildren())) {
      if (pattern.test(n) || (prop.name && pattern.test(prop.name))) {
        ret.push(prop)
      }
      else {
        ret = prop.lookup(name, ret)
      }
    }
    return ret
  }

  assignProps()
  {
    const props = this.props

    Object.entries(props).forEach(([key, value]) => {
      if (typeof this.node[key] === 'undefined') {
        this.node.setAttribute(key, value)
        delete props[key]
      }
      if (typeof value == 'object') {
        Object.assign(this.node[key], value)
        delete props[key]
      }
    })

    Object.assign(this.node, props)

    Object.entries(this.data).forEach(([n, d]) => this.node.dataset[n] = d)
  }

  attachListeners()
  {
    for (let [event, listener] of Object.entries(this.listeners)) {
      let options = {}
      if (listener instanceof Array) {
        [listener, options] = listener
      }
      this.node.addEventListener(event, listener.bind(this), options)
    }
  }

  bindProps()
  {
    Object.entries(this.bindings ?? {}).forEach(([prop, { get, set }]) => {
      Object.defineProperty(this, prop, {
        get: get,
        set: set,
      })
    })
  }

  prepareChildren()
  {
    for (let [name, child] of Object.entries(this.getChildren())) {
      if (!(child instanceof Element)) {
        this[name] = new Element({
          ...{ parent: this },
          ...(typeof child === 'string' ? { node: Element.parseHTML(child) } : child)
        })
        child = this[name]
      }
      child.name = child.name ? child.name : name
    }
  }

  async toString()
  {
    await this.prepareNode()
    return this.node.outerHTML
  }

  async toNode()
  {
    await this.prepareNode()
    return this.node
  }

  async createElement()
  {
    let name = this.name.toLowerCase()
    if (this.elementClass) {
      name += name.indexOf('-') == -1 ? '-element' : ''
      if (!customElements.get(name)) {
        if (typeof this.elementClass == 'string') {
          const importedClass = (await import(`${this.elementClass}.js`)).default
          this.elementClass = (importedClass => class extends importedClass{})(importedClass)
        }
        customElements.define(name, this.elementClass, this.elementProps ?? {})
      }
    }
    return document.createElement(name)
  }

  async render(rerender = false)
  {
    if (rerender && this.node) {
      while (this.node.firstChild) {
        await this.node.removeChild(this.node.firstChild)
      }
    }
    else {
      if (!this.node) {
        this.node = await this.createElement()
      }
      this.assignProps()
      this.bindProps()
      this.attachListeners()
      this.node.component = this
    }

    this.prepareChildren()

    this.node.dispatchEvent((new CustomEvent(rerender ? 'rerendered' : 'rendered')))
  }

  async prepareNode(rerender = false)
  {
    if (!this.node || rerender || this.reassign) {
      for (let pre of Object.values(this.preRender)) {
        pre(this)
      }
      await this.render(rerender)
      for (let [name, child] of Object.entries(this.getChildren())) {
        await child.appendTo(this.node, name)
      }
      for (let post of Object.values(this.postRender)) {
        post(this)
      }
    }
  }

  async appendTo(parent, name = '')
  {
    this.name = this.name ? this.name : name
    if (parent instanceof Node) {
      await this.prepareNode()
      parent.appendChild(this.node)
    }
    if (parent instanceof Element) {
      parent[name] = this
      if (parent.node) {
        await this.prepareNode()
        parent.node.appendChild(this.node)
      }
    }
    return this
  }
}

export default Element
