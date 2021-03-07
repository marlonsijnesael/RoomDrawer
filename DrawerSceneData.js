//based on https://doc.babylonjs.com/guidedLearning/workshop/House_Use

let Babylon = require('babylonjs')
let earcut = require('earcut')

export class DrawerSceneData {
  constructor(canvas) {
    this.renderCanvas = canvas
    this.init()
  }

  init() {
    this._engine = new Babylon.Engine(this.renderCanvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    })
    this.Scene = new Babylon.Scene(this._engine, true)
    this.Scene.autoClearDepthAndStencil = false
    //layers
    this.utilLayer = new Babylon.UtilityLayerRenderer(this.Scene)
    this.utilLayer.utilityLayerScene.autoClearDepthAndStencil = false
    this.utilLayer.onlyCheckPointerDownEvents = true
    this.utilLayer.pickUtilitySceneFirst = false
    this.utilLayerNonOccluded = new Babylon.UtilityLayerRenderer(this.Scene)
    console.log('gizmo', this.utilLayer)
    window.addEventListener('resize', () => {
      this._engine.resize()
    })
    new Babylon.HemisphericLight(
      'hemiLight',
      new Babylon.Vector3(5, 5, 0),
      this.scene
    )

    //start renderloop
    this._engine.runRenderLoop(() => {
      if (this.Scene) {
        this.Scene.render()
      }
    })

    Babylon.MeshBuilder.CreateBox('box', {}, this.scene)
    // Parameters : name, position, scene
    var camera = new Babylon.ArcRotateCamera(
      'Camera',
      -Math.PI / 2,
      Math.PI / 3,
      25,
      new Babylon.Vector3(0, 0, 4.5),
      this.scene
    )
    camera.attachControl(this.renderCanvas, true)
  }

  createPolygon(points) {
    const corners = []
    for (let i in points) {
      let v = new Babylon.Vector2(points[i].x / 10, points[i].y / 10)
      corners.push(v)
    }

    const poly_tri = new Babylon.PolygonMeshBuilder(
      'polytri',
      corners,
      this.scene,
      require('earcut')
    )
    const polygon = poly_tri.build(true, 2)
    polygon.position.y = -20
    polygon.position.x = 10
    polygon.position.z = -10
    polygon.material = new Babylon.StandardMaterial('mat', this.scene)
    polygon.material.diffuseColor = new Babylon.Color3.Red()
  }

  createRoom(points) {
    if (this.building !== undefined && this.building !== null) {
      this.building.dispose()
    }
    var corner = function(x, y) {
      return new Babylon.Vector3(x, 0, y)
    }

    var wall = function(corner) {
      this.corner = corner
    }

    var buildFromPlan = function(walls, ply, height, scene) {
      var outerData = []
      var angle = 0
      var direction = 0
      var line = Babylon.Vector3.Zero()
      walls[1].corner.subtractToRef(walls[0].corner, line)
      var nextLine = Babylon.Vector3.Zero()
      walls[2].corner.subtractToRef(walls[1].corner, nextLine)
      var nbWalls = walls.length
      var w = 0
      for (w = 0; w <= nbWalls; w++) {
        angle = Math.acos(
          Babylon.Vector3.Dot(line, nextLine) /
            (line.length() * nextLine.length())
        )
        direction = Babylon.Vector3.Cross(nextLine, line).normalize().y
        let lineNormal = new Babylon.Vector3(line.z, 0, -1 * line.x).normalize()
        line.normalize()
        outerData[(w + 1) % nbWalls] = walls[(w + 1) % nbWalls].corner
          .add(lineNormal.scale(ply))
          .add(line.scale((direction * ply) / Math.tan(angle / 2)))
        line = nextLine.clone()
        walls[(w + 3) % nbWalls].corner.subtractToRef(
          walls[(w + 2) % nbWalls].corner,
          nextLine
        )
      }

      var positions = []
      var indices = []

      for (w = 0; w < nbWalls; w++) {
        positions.push(walls[w].corner.x, walls[w].corner.y, walls[w].corner.z) // inner corners base
      }

      for (w = 0; w < nbWalls; w++) {
        positions.push(outerData[w].x, outerData[w].y, outerData[w].z) // outer corners base
      }

      for (w = 0; w < nbWalls; w++) {
        indices.push(
          w,
          (w + 1) % nbWalls,
          nbWalls + ((w + 1) % nbWalls),
          w,
          nbWalls + ((w + 1) % nbWalls),
          w + nbWalls
        ) // base indices
      }

      var currentLength = positions.length // inner and outer top corners
      for (w = 0; w < currentLength / 3; w++) {
        positions.push(positions[3 * w])
        positions.push(height)
        positions.push(positions[3 * w + 2])
      }

      currentLength = indices.length
      for (let i = 0; i < currentLength / 3; i++) {
        indices.push(
          indices[3 * i + 2] + 2 * nbWalls,
          indices[3 * i + 1] + 2 * nbWalls,
          indices[3 * i] + 2 * nbWalls
        ) // top indices
      }

      for (w = 0; w < nbWalls; w++) {
        indices.push(
          w,
          w + 2 * nbWalls,
          ((w + 1) % nbWalls) + 2 * nbWalls,
          w,
          ((w + 1) % nbWalls) + 2 * nbWalls,
          (w + 1) % nbWalls
        ) // inner wall indices
        indices.push(
          ((w + 1) % nbWalls) + 3 * nbWalls,
          w + 3 * nbWalls,
          w + nbWalls,
          ((w + 1) % nbWalls) + nbWalls,
          ((w + 1) % nbWalls) + 3 * nbWalls,
          w + nbWalls
        ) // outer wall indices
      }

      var normals = []
      var uvs = []

      Babylon.VertexData.ComputeNormals(positions, indices, normals)
      Babylon.VertexData._ComputeSides(
        Babylon.Mesh.FRONTSIDE,
        positions,
        indices,
        normals,
        uvs
      )

      //Create a custom mesh
      var customMesh = new Babylon.Mesh('custom', scene)

      //Create a vertexData object
      var vertexData = new Babylon.VertexData()

      //Assign positions and indices to vertexData
      vertexData.positions = positions
      vertexData.indices = indices
      vertexData.normals = normals
      vertexData.uvs = uvs

      //Apply vertexData to custom mesh
      vertexData.applyToMesh(customMesh)

      return customMesh
    }

    const corners = []
    for (let i in points) {
      console.log('point', points)
      let v = new corner(points[i][0] / 20, points[i][1] / 20)
      corners.push(v)
    }

    console.log('corners', corners)

    var walls = []
    for (let c = 0; c < corners.length; c++) {
      walls.push(new wall(corners[c]))
    }

    var ply = 0.3
    var height = 5

    this.building = buildFromPlan(walls, ply, height, this.scene)
    this.building.position = new Babylon.Vector3(-15, 0, -15)
    this.building.material = new Babylon.StandardMaterial('mat', this.scene)
  }
}

Babylon.PolygonMeshBuilder.prototype.wallBuilder = function(w0, w1) {
  var positions = []
  var direction = w1.corner.subtract(w0.corner).normalize()
  var angle = Math.acos(direction.x)
  if (direction.z != 0) {
    angle *= direction.z / Math.abs(direction.z)
  }
  this._points.elements.forEach(function(p) {
    positions.push(
      p.x * Math.cos(angle) + w0.corner.x,
      p.y,
      p.x * Math.sin(angle) + w0.corner.z
    )
  })
  var indices = []
  var res = earcut(this._epoints, this._eholes, 2)
  for (var i = res.length; i > 0; i--) {
    indices.push(res[i - 1])
  }
  return { positions: positions, indices: indices }
}
