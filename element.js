class Element
{
  static reserved = new Set(['name', 'node', 'props', 'data', 'children', 'listeners', 'bindings', 'preRender', 'postRender', 'elementClass', 'elementProps', 'parent', 'reassign'])

  getChildren()
  {
    const own = {}
    for (const key of Object.keys(this)) {
      if (!Element.reserved.has(key) && typeof this[key] !== 'function' && this[key] instanceof Element) {
        own[key] = this[key]
      }
    }
    return { ...this.children, ...own }
  }

  constructor(obj, extend = {})
  {
    if (typeof obj === 'string') {
      let node = null
      try {
        obj = document.querySelector(obj)
      }
      catch (e) {
        let t = document.createElement("template")
        t.innerHTML = obj
        obj = [...t.content.children][0]
      }
      this.reassign = true
    }

    if (obj instanceof HTMLElement) {
      obj = {
        node: obj,
        children: [...obj.children].map(e => new Element(e))
      }
    }

    const defaults = {
      ...{
        props: {},
        data: {},
        children: {},
        listeners: {},
        preRender: {},
        postRender: {},
      },
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
      child.name = child.name ? child.name : (isNaN(name) ? name : child.constructor.name)
      if (!(child instanceof Element)) {
        const wrapped = new Element({ ...{ parent: this }, ...child })
        if (name in this.children) {
          this.children[name] = wrapped
        } else {
          this[name] = wrapped
        }
      }
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
    this.name = this.name ? this.name : (isNaN(name) ? name : this.constructor.name)
    if (parent instanceof Node) {
      await this.prepareNode()
      parent.appendChild(this.node)
    }
    if (parent instanceof Element) {
      if (!isNaN(name) || Element.reserved.has(name)) {
        parent.children = {...parent.children, [name]: this}
      } else {
        parent[name] = this
      }
      if (parent.node) {
        await this.prepareNode()
        parent.node.appendChild(this.node)
      }
    }
    return this
  }
}

export default Element
