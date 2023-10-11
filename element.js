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

  render() {
    this.node = document.createElement(this.name)
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

  prepareNode() {
    if (!this.node) {
      this.render()
      for (const child of Object.values(this.children)) {
        child.appendTo(this.node)
      }
      for (const p of Object.values(this.postRender)) {
        p(this)
      }
    }
  }

  toString() {
    this.prepareNode()
    return this.node.outerHTML
  }

  toNode() {
    this.prepareNode()
    return this.node
  }

  appendTo(parent, name = '') {
    if (parent instanceof Node) {
      this.prepareNode()
      parent.appendChild(this.node);
    }
    if (parent instanceof Element) {
      parent.children = {...parent.children, [name]: this}
      if (parent.node) {
        this.prepareNode()
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
          : Reflect.get(...arguments)
  }
}

const element = data => {
  let el = new Element(data)
  return new Proxy(el, elementHandler)
}

export default element
