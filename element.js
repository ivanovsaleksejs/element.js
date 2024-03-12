class Element {
  constructor(obj)
  {
    const defaults = {
      name: '',
      props: {},
      data: {},
      children: {},
      listeners: {},
      preRender: {},
      postRender: {},
    }

    Object.assign(this, {...defaults, ...obj})
    Object.entries(obj.bindings ?? {}).forEach(([prop, { get, set }]) => {
      Object.defineProperty(this, prop, {
        get: get,
        set: set,
      })
    })
  }

  lookup(name, ret = [])
  {
    for (let [n, prop] of Object.entries(this.children)) {
      if ((s => typeof s == 'string' ? (new RegExp(`^${s.replace('*', '.*')}$`)) : s)(name).test(n)) {
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

  prepareChildren()
  {
    for (let [name, child] of Object.entries(this.children)) {
      if (!(child instanceof Element)) {
        child.name = child.name ? child.name : name
        this.children[name] = element({ ...{ parent: this }, ...child})
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
        customElements.define(name, this.elementClass)
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
        child.name = child.name ? child.name : name
        child.appendTo(this.node, name)
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
      parent.children = {...parent.children, [name]: this}
      if (parent.node) {
        await this.prepareNode()
        parent.node.appendChild(this.node)
      }
    }
    return this
  }
}

const elementHandler = {
  get(target, prop, receiver) {
    return prop in target
      ? target[prop]
      : prop in target.children
        ? target.children[prop]
        : Reflect.get(target, prop, receiver)
  }
}

const element = data =>
{
  let el = new Element(data)
  return new Proxy(el, elementHandler)
}

export default element
