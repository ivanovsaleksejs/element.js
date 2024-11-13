class Element
{
  constructor(obj)
  {
    const defaults = {
      props: {},
      data: {},
      children: {},
      listeners: {},
      preRender: {},
      postRender: {},
    }

    Object.assign(this, {...defaults, ...obj, ...this})

    return new Proxy(this, {
      get: (obj, key, proxy) =>
        key in obj
          ? obj[key]
          : key in obj.children
            ? obj.children[key]
            : Reflect.get(obj, key, proxy)
      }
    )
  }

  lookup(name, ret = [])
  {
    const pattern = typeof name == 'string' ? (new RegExp(`^${name.replace('*', '.*')}$`)) : name
    for (let [n, prop] of Object.entries(this.children)) {
      if (pattern.test(n) || (prop.name && pattern.test(prop.name))) {
        ret.push(prop)
      }
      else {
        ret = this.children[n].lookup(name, ret)
      }
    }
    return ret
  }

  assignProps()
  {
    Object.assign(this.node, this.props)
    if (this.props.style) {
      Object.assign(this.node.style, this.props.style)
    }
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
    for (let [name, child] of Object.entries(this.children)) {
      child.name = child.name ? child.name : (isNaN(name) ? name : child.constructor.name)
      if (!(child instanceof Element)) {
        this.children[name] = new Element({ ...{ parent: this }, ...child})
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
        this.node.removeChild(this.node.firstChild);
      }
    }
    else {
      this.node = await this.createElement()
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
    if (!this.node || rerender) {
      for (let pre of Object.values(this.preRender)) {
        pre(this)
      }
      await this.render(rerender)
      for (let [name, child] of Object.entries(this.children)) {
        child.appendTo(this.node, name)
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
      parent.children = {...parent.children, [name]: this}
      if (parent.node) {
        await this.prepareNode()
        parent.node.appendChild(this.node)
      }
    }
    return this
  }
}

export default Element
