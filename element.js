class Element {
  constructor(obj) {
    const defaults = {
      name: '',
      props: {},
      data: {},
      children: {},
      listeners: {},
      preRender: {},
      postRender: {},
      proxies: {}
    }
    Object.assign(this, {...defaults, ...obj})
  }

  createElement() {
    let name = this.name.toLowerCase()
    if (this.elementClass) {
      if (!customElements.get(name)) {
        customElements.define(name, this.elementClass)
      }
    }

    return document.createElement(name)
  }

  render() {
    this.node = this.createElement()
    Object.assign(this.node, this.props)
    Object.entries(this.data).forEach(([n, d]) => this.node.dataset[n] = d)

    for (const [event, listener] of Object.entries(this.listeners)) {
      let options = {}
      if (listener instanceof Array) {
        [listener, options] = listener
      }
      this.node.addEventListener(event, listener.bind(this), options)
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
      for (const pre of Object.values(this.preRender)) {
        pre(this)
      }
      this.render()
      for (const child of Object.values(this.children)) {
        child.appendTo(this.node)
      }
      for (const post of Object.values(this.postRender)) {
        post(this)
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
    return this
  }

  lookup(name, ret = []) {
    for (let [n, prop] of Object.entries(this.children)) {
      if (n == name) {
        ret.push(prop)
      }
      else {
        ret = this.children[n].lookup(name, ret)
      }
    }
    return ret
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

const element = data => {
  let el = new Element(data)
  return new Proxy(el, elementHandler)
}

export default element
