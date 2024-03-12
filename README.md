A simple lightweight library for creating dynamic web pages.

## Components

```js
const popupComponent = {
  name: "popup",
  props: { className: "popup" },
  children: {
    close: {
      name: "button"
	   props: { 
        innerText: "X",
        className: "close-button"
      }
    }
  }
}

const popupElement = element(popupComponent)

popupElement.appendTo(document.body)
```


Components are simple JS objects, with properties corresponding the properties of a HTMLElement object. Thus, you don't need to learn a new language - if you know JavaScript then you can use this library right away.

## Structure of components

This is the default structure of a component:

```js
name: '', // The name of the node. Can be ommitted for children
props: {}, // Props of the tag
data: {}, // Data attributes
children: {}, // An object of named child components
listeners: {}, // Event listeners
preRender: {}, // Functions to run before rendering node
postRender: {} // Functions to run after rendering node
```

When component is rendered, it will have a `node` property which contains the reference to actual node. The node property in its turn contains the `component` property, which points to a component. Also, the child component will have a `parent` property.

You can create other properties and methods for a component if you wish. In the example below we add a method `close()` for a popup component, then we access the node, its component, its parent and call the close method:

```js
{
  name: "popup",
  close: target => {
    target.remove()
  },
  children: {
    closebutton: {
      listeners: {
        click: event => {
          event.target.component.parent.close(event.target)
        }
      }
    }
  }
}
```

## Accessing child comopnents and props

The component can have children components, and each of them can have its own children components. You don't need to specify the name of the node - it will be taken from the property name, for example:

```js
const component = {
  name: "div",
  children: {
    row: {
      props: { innerText: "First row" }
    }
  }
}

const div = element(component)

div.appendTo(document.body)
```

This component will generate a HTML:

```html
<div>
	<row>First row</row>
</div>
```

You can access to children components via `children` property or simply by using the child name. In the example above, both following lines will point to the same object:
```js
div.children.row
div.row
```

## Regenerating components

At any moment you can regenerate the component by calling `prepareNode` method, passing `true` as an argument. This will tell the method that the node should be regenerated, and not generated from scratch.

```js
div.children.newChild = {
  name: "row",
  props: {
    innerText: "New row"
  }
}

div.prepareNode(true)
```

## Binding properties

You can bind properties of a component, defining setter and getter to do whatever you want.

```js
const div = {
  bindings: {
    get: _ => {
      getDataFromServer()      
    },
    set: data => {
      sendDataToServer(data)
    }
  }
}
```

The following example demonstrates a bindong for a simple counter:

```js
const div = element({
  name: 'div',
  bindings: {
    counter: {
      set: val => { div.node.innerText = val },
      get: _ => +(div.node.innerText ?? 0)
    }
  }
})

const button = element({
  name: "button",
  props: { innerText: "+" },
  listeners: {
    click: e => { div.counter++ }
  }
})

div.appendTo(document.body)
button.appendTo(document.body)
```