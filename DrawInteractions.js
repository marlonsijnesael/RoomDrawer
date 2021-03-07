import interact from 'interactjs'

export default class Drawer {
  constructor(svg, polygon) {
    this.root = document.getElementById(svg)
    this.polygon = document.getElementById(polygon)
    this.init()
  }

  init() {
    this.sns = 'http://www.w3.org/2000/svg'
    this.xns = 'http://www.w3.org/1999/xlink'
    this.rootMatrix
    this.originalPoints = []
    this.transformedPoints = []
    this.handles = []

    this.polygon.onclick = (e) => {
      this.mouseCoords = this.getPosXY(e)
      this.addPoint(this.mouseCoords[0], this.mouseCoords[1])
    }

    interact(this.root)
      .on('mousedown', this.applyTransforms)
      .on('touchstart', this.applyTransforms)

    let self = this
    interact('.point-handle')
      .draggable({
        onstart: () => this.root.setAttribute('class', 'dragging'),
        onmove: (event) => {
          let i = event.target.getAttribute('data-index') | 0
          if (this.polygon.points.length <= i) return
          let point = this.polygon.points.getItem(i)

          point.x += event.dx / self.rootMatrix.a
          point.y += event.dy / self.rootMatrix.d

          event.target.x.baseVal.value = point.x
          event.target.y.baseVal.value = point.y
        },
        onend: () => {
          let event = new Event('updateBuilding')
          window.dispatchEvent(event)
          this.root.setAttribute('class', '')
        },
        snap: {
          targets: [
            function(x, y) {
              console.log('snapping', x, y)
              var newX = Math.round(x / 50) * 50
              var newY = Math.round(y / 50) * 50
              // someFunction(newX, newY);
              return {
                x: newX,
                y: newY
              }
            }
          ],
          range: Infinity,
          relativePoints: [
            {
              x: 0,
              y: 0
            }
          ]
        },
        restrict: { restriction: document.rootElement }
      })
      .styleCursor(false)

    this.drawHandles()
    this.applyTransforms()
    document.addEventListener('dragstart', (event) => event.preventDefault())
  }

  dragMoveListener(event) {
    let target = event.target,
      // keep the dragged position in the data-x/data-y attributes
      x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx,
      y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy

    // translate the element
    target.style.webkitTransform = target.style.transform =
      'translate(' + x + 'px, ' + y + 'px)'

    // update the posiion attributes
    target.setAttribute('data-x', x)
    target.setAttribute('data-y', y)
  }

  //return the position of the polygon
  getPosXY(event) {
    let rect = event.target.getBoundingClientRect()
    let x = event.offsetX || event.pageX - rect.left - window.scrollX
    let y = event.offsetY || event.pageY - rect.top - window.scrollY
    return [x, y]
  }

  static getEl(id) {
    return document.getElementById(id)
  }

  applyTransforms() {
    if (this.root === null || this.root === undefined) {
      this.root = Drawer.getEl('mysvg')
    }
    if (this.originalPoints === null || this.originalPoints === undefined) {
      this.originalPoints = []
    }
    this.rootMatrix = this.root.getScreenCTM()
    this.transformedPoints = this.originalPoints.map((point) =>
      point.matrixTransform(this.rootMatrix)
    )

    interact('.point-handle').draggable({
      snap: {
        targets: this.transformedPoints,
        range: 20 * Math.max(this.rootMatrix.a, this.rootMatrix.d)
      }
    })
  }

  findIndex(x, y, sorted) {
    for (let i = 0; i < sorted.length; i++) {
      if (sorted.x === x && sorted.y === y) {
        return i
      }
    }
    return sorted.length
  }

  //correctly add a point to the SVG shape
  addPoint(x, y) {
    //get the root of the svg
    let point = this.root.createSVGPoint()
    point.x = x
    point.y = y

    //add point to our polygon
    this.polygon.points.appendItem(point)

    //sort all points based on distance to eachother
    let sorted = this.polySort(this.polygon.points)

    this.polygon.points.clear()

    //swap polygon's current points with our sorted points
    for (let p in sorted) {
      let point = this.root.createSVGPoint()
      point.x = sorted[p].x
      point.y = sorted[p].y

      this.polygon.points.appendItem(point)
    }

    this.drawHandles()
    this.applyTransforms()
  }

  //Create a draggable handle on each point in our polygon/svg
  drawHandles() {
    for (let i in this.handles) {
      this.handles[i].remove()
    }

    for (let i = 0, len = this.polygon.points.numberOfItems; i < len; i++) {
      let handle = document.createElementNS(this.sns, 'use')
      let point = this.polygon.points.getItem(i)
      let newPoint = this.root.createSVGPoint()

      handle.setAttributeNS(this.xns, 'href', '#point-handle')
      handle.setAttribute('class', 'point-handle')

      handle.x.baseVal.value = newPoint.x = point.x
      handle.y.baseVal.value = newPoint.y = point.y

      handle.setAttribute('data-index', i)
      handle.onclick = () => {}

      this.originalPoints.push(newPoint)
      this.root.appendChild(handle)
      this.handles.push(handle)
    }
  }

  getPoints() {
    return this.polygon.points
  }

  //get distance between two points
  simpleDist(pointA, pointB) {
    let x = pointA.x - pointB.x,
      y = pointA.y - pointB.y

    return Math.sqrt(x * x + y * y)
  }

  //vector magic from the internet
  squaredPolar(p, center) {
    return [
      Math.atan2(p.y - center[1], p.x - center[0]),
      (p.x - center[0]) ** 2 + (p.y - center[1]) ** 2 // Square of distance
    ]
  }

  /* Main algorithm:
  first calculate center of mess of the polygon
  Sort by polar angle and distance, centered at this center of mass.
  return the sorted points
  */
  polySort(points) {
    // Get "center of mass"
    points = Object.values(points)
    let center = [
      points.reduce((sum, p) => sum + p.x, 0) / points.length,
      points.reduce((sum, p) => sum + p.y, 0) / points.length
    ]

    // Sort by polar angle and distance, centered at this center of mass.
    let pointsArr = []
    for (let point of points) {
      let item = [point.x, point.y, ...this.squaredPolar(point, center), point]
      pointsArr.push(item)
    }

    pointsArr.sort((a, b) => a[2] - b[2] || a[3] - b[3])

    let sorted = []
    for (let point of pointsArr) {
      sorted.push(point[4])
    }
    return sorted
  }
}
