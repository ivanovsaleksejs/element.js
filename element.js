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
      proxies: {}
    }
    Object.assign(this, {...defaults, ...obj})
  }

  async createElement()
  {
    let name = this.name.toLowerCase()
    if (this.elementClass) {
      if (name.indexOf('-') == -1) {
        name += '-element'
      }
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

  async render()
  {
    this.node = await this.createElement()
    Object.assign(this.node, this.props)
    if (this.props.style) {
      Object.assign(this.node.style, this.props.style)
    }
    Object.entries(this.data).forEach(([n, d]) => this.node.dataset[n] = d)

    for (let [event, listener] of Object.entries(this.listeners)) {
      let options = {}
      if (listener instanceof Array) {
        [listener, options] = listener
      }
      this.node.addEventListener(event, listener.bind(this), options)
    }

    for (let [name, child] of Object.entries(this.children)) {
      if (!(child instanceof Element)) {
        child.name = child.name ? child.name : name
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

  async prepareNode() 
  {
    if (!this.node) {
      for (let pre of Object.values(this.preRender)) {
        pre(this)
      }
      await this.render()
      for (let [name, child] of Object.entries(this.children)) {
        child.name = child.name ? child.name : name
        child.appendTo(this.node, name)
      }
      for (let post of Object.values(this.postRender)) {
        post(this)
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
