class Element {
  constructor(obj) {
    const defaults = {
      name: '',
      props: {},
      children: {},
      listeners: {},
      preRender: {},
      postRender: {},
      proxies: {}
    }
    Object.assign(this, {...defaults, ...obj})
  }

  async createElement() {
    try {
      let name = this.name.toLowerCase()
      const element = document.createElement(name)

      if (element instanceof HTMLElement) {
        return element
      }

      const module = await import(`./elements/${name}.js`)

      customElements.define(name, module.default)

      const customElement = document.createElement(name)
      return customElement
    } catch (error) {
      console.error('Error creating element:', error)
      return null
    }
  }    

  async render() {
    this.node = await this.createElement(this.name)
    Object.assign(this.node, this.props)

    for (const [event, [listener, options]] of Object.entries(this.listeners)) {
      this.node.addEventListener(event, listener(this), options);
    }

    for (const [name, child] of Object.entries(this.children)) {
      if (!(child instanceof Element)) {
        this.children[name] = element({ ...{ parent: this }, ...child})
      }
    }

    this.proxy = new Proxy(this, {
      get(target, property) {
        if (target.proxies[property].get) {
          target.proxies[property].get(target, property)
        }
        return target[property]
      },
      set(target, property, value) {
        target[property] = value
        if (target.proxies[property].set) {
          target.proxies[property].set(target, property, value)
        }
        return true
      }
    })
  }

  async prepareNode() {
    if (!this.node) {
      await this.render()
      for (const child of Object.values(this.children)) {
        child.appendTo(this.node)
      }
      for (const p of Object.values(this.postRender)) {
        p(this)
      }
    }
  }

  async toString() {
    await this.prepareNode()
    return this.node.outerHTML
  }

  async toNode() {
    await this.prepareNode()
    return this.node
  }

  async appendTo(parent, name = '') {
    if (parent instanceof Node) {
      await this.prepareNode()
      parent.appendChild(this.node);
    }
    if (parent instanceof Element) {
      parent.children = {...parent.children, [name]: this}
      if (parent.node) {
        await this.prepareNode()
        parent.node.appendChild(this.node)
      }
    }
  }
}

const elementHandler = {
  get(target, prop, receiver) {
    return prop in target
      ? target[prop]
      : prop in target.children
        ? target.children[prop]
        : target.node && prop in target.node
          ? target.node[prop]
          : Reflect.get(target, prop, receiver)
  }
}

const element = data => {
  let el = new Element(data)
  return new Proxy(el, elementHandler)
}

export default element
