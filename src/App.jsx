// src/App.jsx
import React, { useRef, useState, useEffect, useMemo } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { useTexture, Html, Text } from "@react-three/drei"
import * as THREE from "three"

/* ===== CONFIG ===== */
const EYE_HEIGHT = 1.6
const MOVE_SPEED = 3.5
const MOUSE_SENSITIVITY = 0.002
const WALL_T = 0.35

/* ===== ROOM LAYOUT ===== */
const MAIN_ROOM = { xMin: -4, xMax: 4, zMin: -18, zMax: 5, yMax: 6 }

// RIGHT hobby/exploration room (existing)
const RIGHT_ROOM = {
  xMin: MAIN_ROOM.xMax + WALL_T,
  xMax: MAIN_ROOM.xMax + WALL_T + 6.0,
  zMin: -10,
  zMax: -2,
  yMax: 6,
}

// LEFT room: mirrored copy of the right room
const LEFT_ROOM = {
  xMax: MAIN_ROOM.xMin - WALL_T,
  xMin: MAIN_ROOM.xMin - WALL_T - 8.0,
  zMin: RIGHT_ROOM.zMin,
  zMax: RIGHT_ROOM.zMax,
  yMax: RIGHT_ROOM.yMax,
}

const WORLD = {
  xMin: Math.min(MAIN_ROOM.xMin, RIGHT_ROOM.xMin, LEFT_ROOM.xMin),
  xMax: Math.max(MAIN_ROOM.xMax, RIGHT_ROOM.xMax, LEFT_ROOM.xMax),
  zMin: Math.min(MAIN_ROOM.zMin, RIGHT_ROOM.zMin, LEFT_ROOM.zMin),
  zMax: Math.max(MAIN_ROOM.zMax, RIGHT_ROOM.zMax, LEFT_ROOM.zMax),
  yMax: Math.max(MAIN_ROOM.yMax, RIGHT_ROOM.yMax, LEFT_ROOM.yMax),
}

/* ===== DOORS / PARTITION ===== */
const PARTITION_Z = -4
const PARTITION_DOOR_WIDTH = 2.4
const PARTITION_DOOR_HEIGHT = 3
const SIDE_DOOR_Z_CENTER = (RIGHT_ROOM.zMin + RIGHT_ROOM.zMax) / 2
const SIDE_DOOR_WIDTH = 2.6
const SIDE_DOOR_HEIGHT = 3

/* ===== FRAME / PLAQUE SIZING ===== */
const FRAME_INNER_W = 2.0
const FRAME_INNER_H = 1.2
const FRAME_BORDER = 0.06
const FRAME_DEPTH = 0.05

const PLAQUE_W = 1.6
const PLAQUE_H = 0.28
const PLAQUE_DEPTH = 0.04
const LABEL_GAP = 0.95

const FLOOR_COLOR = "#f3f3f3"

/* ===== Intro overlay ===== */
function IntroOverlay({ onClose }) {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ position: "relative", background: "rgba(0,0,0,0.92)", color: "white", padding: 20, borderRadius: 12, maxWidth: 560, textAlign: "center", pointerEvents: "auto" }}>
        <button
          onClick={onClose}
          style={{ position: "absolute", right: 12, top: 10, background: "transparent", border: "none", color: "#ccc", fontSize: 18, cursor: "pointer" }}
          aria-label="Close intro"
        >
          ✕
        </button>
        <h2 style={{ margin: "0 0 8px 0" }}>Hey Stranger 👋</h2>
        <div style={{ fontSize: 14, lineHeight: "20px" }}>
          I'm Ayan — welcome. Close this to enable movement, click the canvas to lock pointer and use WASD to walk.
        </div>
      </div>
    </div>
  )
}

function DoorFloorStrip({ pos = [0, 0.01, 0], size = [0.6, 0.02, 0.6], color = FLOOR_COLOR, receiveShadow = false }) {
  return (
    <mesh position={pos} receiveShadow={receiveShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  )
}



/* ===== RoomMesh (thick walls) ===== */
function RoomMesh({ xMin, xMax, zMin, zMax, yMax, wallT = WALL_T, wallColor = "#ffffff", floorColor = "#f3f3f3", skipLeftWall = false, skipRightWall = false }) {
  const width = xMax - xMin
  const depth = zMax - zMin

  return (
    <group>
      {/* floor */}
      {/* floor (replace existing floor mesh inside RoomMesh) */}
      <mesh position={[ (xMin + xMax) / 2, 0, (zMin + zMax) / 2 ]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>

      {/* ceiling */}
      <mesh position={[ (xMin + xMax) / 2, yMax, (zMin + zMax) / 2 ]} rotation={[Math.PI/2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* front wall (zMax) */}
      <mesh position={[ (xMin + xMax) / 2, yMax / 2, zMax + wallT / 2 ]}>
        <boxGeometry args={[width, yMax, wallT]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* back wall (zMin) */}
      <mesh position={[ (xMin + xMax) / 2, yMax / 2, zMin - wallT / 2 ]}>
        <boxGeometry args={[width, yMax, wallT]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* left wall */}
      {!skipLeftWall && (
        <mesh position={[ xMin - wallT / 2, yMax / 2, (zMin + zMax) / 2 ]}>
          <boxGeometry args={[wallT, yMax, depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {/* right wall */}
      {!skipRightWall && (
        <mesh position={[ xMax + wallT / 2, yMax / 2, (zMin + zMax) / 2 ]}>
          <boxGeometry args={[wallT, yMax, depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
    </group>
  )
}

/* ===== Partition wall with door ===== */
function PartitionWallWithDoor({ xMin, xMax, yMax, z = PARTITION_Z, doorWidth = PARTITION_DOOR_WIDTH, doorHeight = PARTITION_DOOR_HEIGHT, doorCenterX = 0, wallT = WALL_T }) {
  const wallColor = "#ffffff"

  const doorXMin = doorCenterX - doorWidth / 2
  const doorXMax = doorCenterX + doorWidth / 2

  const leftSegW = Math.max(0.01, doorXMin - xMin)
  const rightSegW = Math.max(0.01, xMax - doorXMax)
  const leftCenterX = xMin + leftSegW / 2
  const rightCenterX = doorXMax + rightSegW / 2

  const lintelHeight = Math.max(0.01, yMax - doorHeight)
  const lintelY = (yMax + doorHeight) / 2

  return (
    <group>
      {leftSegW > 0.01 && (
        <mesh position={[leftCenterX, yMax / 2, z + wallT / 2]}>
          <boxGeometry args={[leftSegW, yMax, wallT]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {rightSegW > 0.01 && (
        <mesh position={[rightCenterX, yMax / 2, z + wallT / 2]}>
          <boxGeometry args={[rightSegW, yMax, wallT]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {lintelHeight > 0.01 && (
        <mesh position={[ doorCenterX, lintelY, z + wallT / 2 ]}>
          <boxGeometry args={[doorWidth, lintelHeight, wallT]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
    </group>
  )
}

/* ===== Right wall with door (MAIN_ROOM -> RIGHT_ROOM) ===== */
function RightWallWithDoor({ room, doorCenterZ, doorWidth = SIDE_DOOR_WIDTH, doorHeight = SIDE_DOOR_HEIGHT, wallT = WALL_T }) {
  const { zMin, zMax, yMax, xMax } = room
  const wallColor = "#ffffff"

  const doorZMin = doorCenterZ - doorWidth / 2
  const doorZMax = doorCenterZ + doorWidth / 2

  const seg1Depth = Math.max(0.01, doorZMin - zMin)
  const seg2Depth = Math.max(0.01, zMax - doorZMax)
  const seg1CenterZ = zMin + seg1Depth / 2
  const seg2CenterZ = doorZMax + seg2Depth / 2

  const lintelHeight = Math.max(0.01, yMax - doorHeight)
  const lintelY = (yMax + doorHeight) / 2
  const wallX = xMax + wallT / 2

  return (
    <group>
      {seg1Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg1CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg1Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {seg2Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg2CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg2Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {lintelHeight > 0.01 && (
        <mesh position={[wallX, lintelY, doorCenterZ]}>
          <boxGeometry args={[wallT, lintelHeight, doorWidth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
    </group>
  )
}

/* ===== Left wall with door (MAIN_ROOM -> LEFT_ROOM) mirrored ===== */
function LeftWallWithDoorMain({ room, doorCenterZ, doorWidth = SIDE_DOOR_WIDTH, doorHeight = SIDE_DOOR_HEIGHT, wallT = WALL_T }) {
  const { zMin, zMax, yMax, xMin } = room
  const wallColor = "#ffffff"

  const doorZMin = doorCenterZ - doorWidth / 2
  const doorZMax = doorCenterZ + doorWidth / 2

  const seg1Depth = Math.max(0.01, doorZMin - zMin)
  const seg2Depth = Math.max(0.01, zMax - doorZMax)
  const seg1CenterZ = zMin + seg1Depth / 2
  const seg2CenterZ = doorZMax + seg2Depth / 2

  const lintelHeight = Math.max(0.01, yMax - doorHeight)
  const lintelY = (yMax + doorHeight) / 2
  const wallX = xMin - wallT / 2

  return (
    <group>
      {seg1Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg1CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg1Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {seg2Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg2CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg2Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {lintelHeight > 0.01 && (
        <mesh position={[wallX, lintelY, doorCenterZ]}>
          <boxGeometry args={[wallT, lintelHeight, doorWidth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
    </group>
  )
}

/* ===== Left wall for RIGHT_ROOM (matching door) ===== */
function LeftWallWithDoorRoom({ room, doorCenterZ, doorWidth = SIDE_DOOR_WIDTH, doorHeight = SIDE_DOOR_HEIGHT, wallT = WALL_T }) {
  const { zMin, zMax, yMax, xMin } = room
  const wallColor = "#ffffff"

  const doorZMin = doorCenterZ - doorWidth / 2
  const doorZMax = doorCenterZ + doorWidth / 2

  const seg1Depth = Math.max(0.01, doorZMin - zMin)
  const seg2Depth = Math.max(0.01, zMax - doorZMax)
  const seg1CenterZ = zMin + seg1Depth / 2
  const seg2CenterZ = doorZMax + seg2Depth / 2

  const lintelHeight = Math.max(0.01, yMax - doorHeight)
  const lintelY = (yMax + doorHeight) / 2
  const wallX = xMin - wallT / 2

  return (
    <group>
      {seg1Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg1CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg1Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {seg2Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg2CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg2Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {lintelHeight > 0.01 && (
        <mesh position={[wallX, lintelY, doorCenterZ]}>
          <boxGeometry args={[wallT, lintelHeight, doorWidth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
    </group>
  )
}

/* ===== Right wall for LEFT_ROOM (matching door) ===== */
function RightWallWithDoorLeftRoom({ room, doorCenterZ, doorWidth = SIDE_DOOR_WIDTH, doorHeight = SIDE_DOOR_HEIGHT, wallT = WALL_T }) {
  const { zMin, zMax, yMax, xMax } = room
  const wallColor = "#ffffff"

  const doorZMin = doorCenterZ - doorWidth / 2
  const doorZMax = doorCenterZ + doorWidth / 2

  const seg1Depth = Math.max(0.01, doorZMin - zMin)
  const seg2Depth = Math.max(0.01, zMax - doorZMax)
  const seg1CenterZ = zMin + seg1Depth / 2
  const seg2CenterZ = doorZMax + seg2Depth / 2

  const lintelHeight = Math.max(0.01, yMax - doorHeight)
  const lintelY = (yMax + doorHeight) / 2
  const wallX = xMax + wallT / 2

  return (
    <group>
      {seg1Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg1CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg1Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {seg2Depth > 0.01 && (
        <mesh position={[wallX, yMax / 2, seg2CenterZ]}>
          <boxGeometry args={[wallT, yMax, seg2Depth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}

      {lintelHeight > 0.01 && (
        <mesh position={[wallX, lintelY, doorCenterZ]}>
          <boxGeometry args={[wallT, lintelHeight, doorWidth]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      )}
    </group>
  )
}

/* ===== Ceiling lights helper ===== */
function CeilingLights({ room, intensity = 1.0 }) {
  const { xMin, xMax, zMin, zMax, yMax } = room
  const positions = [
    [xMin + 2, yMax - 0.15, (zMin + zMax) / 2],
    [xMax - 2, yMax - 0.15, (zMin + zMax) / 2],
    [(xMin + xMax) / 2, yMax - 0.15, zMin + 2],
    [(xMin + xMax) / 2, yMax - 0.15, zMax - 2],
  ]
  return (
    <>
      {positions.map((p, i) => (
        <pointLight key={i} position={p} intensity={intensity} distance={14} color={"#ffffff"} />
      ))}
    </>
  )
}

/* ===== WallFrame (museum plaque) ===== */
function WallFrame({
  image,
  position = [0, 1.7, 0],
  rotation = [0, 0, 0],
  title = "Title",
  subtitle = "",
  onSelect = () => {},
  useHtmlPlaque = false,
}) {
  const tex = useTexture(image)
  const [hovered, setHovered] = useState(false)

  const OUT_W = FRAME_INNER_W + FRAME_BORDER
  const OUT_H = FRAME_INNER_H + FRAME_BORDER

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={() => onSelect(title)}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh>
        <boxGeometry args={[OUT_W, OUT_H, FRAME_DEPTH]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive={hovered ? "#ff00ff" : "#00ffff"}
          emissiveIntensity={hovered ? 0.7 : 0.25}
          metalness={0.2}
          roughness={0.35}
        />
      </mesh>

      <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.002]}>
        <planeGeometry args={[FRAME_INNER_W, FRAME_INNER_H]} />
        <meshStandardMaterial map={tex} />
      </mesh>

      <group position={[0, -(OUT_H / 2) - LABEL_GAP / 2, 0]}>
        <mesh position={[0, 0, PLAQUE_DEPTH / 2 + 0.002]}>
          <boxGeometry args={[PLAQUE_W, PLAQUE_H, PLAQUE_DEPTH]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>

        {useHtmlPlaque ? (
          <Html position={[0, 0, PLAQUE_DEPTH + 0.01]} transform={false} occlude distanceFactor={8} zIndexRange={[100, 0]}>
            <div style={{ background: "transparent", color: "#111", fontFamily: "Inter, Arial, sans-serif", fontSize: 13, textAlign: "center", padding: "0px 6px" }}>
              <div style={{ fontWeight: 700 }}>{title}</div>
              {subtitle ? <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>{subtitle}</div> : null}
            </div>
          </Html>
        ) : (
          <group position={[0, 0, PLAQUE_DEPTH + 0.01]}>
            <Text fontSize={0.09} color="#111" maxWidth={PLAQUE_W * 0.9} anchorX="center" anchorY="middle" lineHeight={1.1}>
              {title}
            </Text>
            {subtitle && (
              <Text position={[0, -0.11, 0]} fontSize={0.06} color="#555" maxWidth={PLAQUE_W * 0.9} anchorX="center" anchorY="middle">
                {subtitle}
              </Text>
            )}
          </group>
        )}
      </group>
    </group>
  )
}

/* ===== Polaroid (3D plaque text like WallFrame) ===== */
function Polaroid({ image, position = [0,0,0], rotation = [0,0,0], title = "", subtitle = "" }) {
  const tex = useTexture(image)
  const ref = useRef()
  const hoverRef = useRef(false)
  const instanceTilt = useMemo(() => (Math.random() - 0.5) * 2, [])

  const P_W = 0.52
  const P_H = 0.12
  const P_D = 0.01

  useFrame((state) => {
    if (!ref.current) return
    ref.current.rotation.z = rotation[2] + Math.sin(state.clock.elapsedTime + position[0]) * 0.01
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.6 + position[0]) * 0.005
    const target = hoverRef.current ? 1.08 : 1.0
    ref.current.scale.lerp(new THREE.Vector3(target, target, target), 0.08)
  })

  return (
    <group
      ref={ref}
      position={position}
      rotation={rotation}
      onPointerOver={() => (hoverRef.current = true)}
      onPointerOut={() => (hoverRef.current = false)}
    >
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.54, 0.64, 0.02]} />
        <meshStandardMaterial color={"#fcfbf6"} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.06, 0.011]}>
        <planeGeometry args={[0.46, 0.46]} />
        <meshStandardMaterial map={tex} />
      </mesh>

      <mesh position={[-0.18, 0.26, 0.015]}>
        <sphereGeometry args={[0.015, 12, 8]} />
        <meshStandardMaterial color={"#d99b6c"} metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[0, -0.28, P_D / 2 + 0.002]}>
        <boxGeometry args={[P_W, P_H, P_D]} />
        <meshStandardMaterial color={"#fbf6ef"} roughness={0.9} />
      </mesh>

      <group position={[0, -0.28, P_D + 0.01]}>
        <Text fontSize={0.045} color="#111" maxWidth={P_W * 0.9} anchorX="center" anchorY="middle" lineHeight={1.05}>
          {title}
        </Text>

        {subtitle && (
          <Text position={[0, -0.065, 0]} fontSize={0.035} color="#555" maxWidth={P_W * 0.9} anchorX="center" anchorY="middle">
            {subtitle}
          </Text>
        )}
      </group>

      <group rotation={[0, 0, THREE.MathUtils.degToRad(instanceTilt)]} />
    </group>
  )
}

/* ===== Room content (polaroid wall) shared for both sides ===== */
function PolaroidWall({ room }) {
  // use same images & captions as the previous exploration wall
  const images = [
    "/images/about.jpg",
    "/images/skills.jpg",
    "/images/experience.jpg",
    "/images/education.jpg",
    "/images/projects.jpg",
    "/images/contact.jpg",
  ]
  const zWall = room.zMin + 0.02
  const xCenter = (room.xMin + room.xMax) / 2
  const topY = 1.3

  const placements = useMemo(() => {
    const out = []
    const cols = 3
    const spacingX = 1.2
    const startX = xCenter - spacingX
    const captions = [
      { t: "Goa '21", s: "Beach trip" },
      { t: "Himalayas", s: "Trekking" },
      { t: "Bangalore", s: "Work trip" },
      { t: "Coorg", s: "Coffee" },
      { t: "Delhi", s: "City" },
      { t: "Mumbai", s: "Friends" },
    ]
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const jitter = (Math.random() - 0.5) * 0.12
        const rx = (Math.random() - 0.5) * 0.12
        out.push({
          img: images[i % images.length],
          pos: [startX + c * spacingX + jitter, topY - r * 0.9, zWall + 0.02],
          rot: [0, 0, rx],
          title: captions[i % captions.length].t,
          subtitle: captions[i % captions.length].s,
        })
      }
    }
    return out
  }, [room.xMin, room.xMax, room.zMin])

  return (
    <group>
      {/* corkboard backdrop */}
      <mesh position={[ (room.xMin + room.xMax)/2, topY - 0.4, room.zMin - 0.01 ]}>
        <planeGeometry args={[3.8, 2.2]} />
        <meshStandardMaterial color={"#f6efe6"} />
      </mesh>

      {placements.map((p, i) => (
        <Polaroid key={i} image={p.img} position={p.pos} rotation={p.rot} title={p.title} subtitle={p.subtitle} />
      ))}
    </group>
  )
}

/* ===== Collision helpers & builder (includes both left and right rooms) ===== */
function makeBoxCollider(center, size) {
  const half = new THREE.Vector3(size[0] / 2, size[1] / 2, size[2] / 2)
  const c = new THREE.Vector3(...center)
  return { min: c.clone().sub(half), max: c.clone().add(half) }
}

function buildColliders() {
  const coll = []

  // MAIN_ROOM front/back
  const widthMain = MAIN_ROOM.xMax - MAIN_ROOM.xMin
  coll.push(makeBoxCollider([(MAIN_ROOM.xMin + MAIN_ROOM.xMax) / 2, MAIN_ROOM.yMax / 2, MAIN_ROOM.zMax + WALL_T / 2], [widthMain, MAIN_ROOM.yMax, WALL_T]))
  coll.push(makeBoxCollider([(MAIN_ROOM.xMin + MAIN_ROOM.xMax) / 2, MAIN_ROOM.yMax / 2, MAIN_ROOM.zMin - WALL_T / 2], [widthMain, MAIN_ROOM.yMax, WALL_T]))

  // MAIN_ROOM left/right split by side doors
  {
    const doorCenterZ = SIDE_DOOR_Z_CENTER
    const doorZMin = doorCenterZ - SIDE_DOOR_WIDTH / 2
    const doorZMax = doorCenterZ + SIDE_DOOR_WIDTH / 2

    // right wall pieces (toward RIGHT_ROOM)
    const seg1DepthR = Math.max(0.01, doorZMin - MAIN_ROOM.zMin)
    const seg2DepthR = Math.max(0.01, MAIN_ROOM.zMax - doorZMax)
    if (seg1DepthR > 0.01) coll.push(makeBoxCollider([MAIN_ROOM.xMax + WALL_T / 2, MAIN_ROOM.yMax / 2, MAIN_ROOM.zMin + seg1DepthR / 2], [WALL_T, MAIN_ROOM.yMax, seg1DepthR]))
    if (seg2DepthR > 0.01) coll.push(makeBoxCollider([MAIN_ROOM.xMax + WALL_T / 2, MAIN_ROOM.yMax / 2, doorZMax + seg2DepthR / 2], [WALL_T, MAIN_ROOM.yMax, seg2DepthR]))
    const lintelHeightR = Math.max(0.01, MAIN_ROOM.yMax - SIDE_DOOR_HEIGHT)
    if (lintelHeightR > 0.01) coll.push(makeBoxCollider([MAIN_ROOM.xMax + WALL_T / 2, (MAIN_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2, doorCenterZ], [WALL_T, lintelHeightR, SIDE_DOOR_WIDTH]))

    // left wall pieces (toward LEFT_ROOM)
    const seg1DepthL = Math.max(0.01, doorZMin - MAIN_ROOM.zMin)
    const seg2DepthL = Math.max(0.01, MAIN_ROOM.zMax - doorZMax)
    if (seg1DepthL > 0.01) coll.push(makeBoxCollider([MAIN_ROOM.xMin - WALL_T / 2, MAIN_ROOM.yMax / 2, MAIN_ROOM.zMin + seg1DepthL / 2], [WALL_T, MAIN_ROOM.yMax, seg1DepthL]))
    if (seg2DepthL > 0.01) coll.push(makeBoxCollider([MAIN_ROOM.xMin - WALL_T / 2, MAIN_ROOM.yMax / 2, doorZMax + seg2DepthL / 2], [WALL_T, MAIN_ROOM.yMax, seg2DepthL]))
    const lintelHeightL = Math.max(0.01, MAIN_ROOM.yMax - SIDE_DOOR_HEIGHT)
    if (lintelHeightL > 0.01) coll.push(makeBoxCollider([MAIN_ROOM.xMin - WALL_T / 2, (MAIN_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2, doorCenterZ], [WALL_T, lintelHeightL, SIDE_DOOR_WIDTH]))
  }

  // Partition wall at PARTITION_Z with central door
  {
    const xMin = MAIN_ROOM.xMin, xMax = MAIN_ROOM.xMax, yMax = MAIN_ROOM.yMax, z = PARTITION_Z
    const doorWidth = PARTITION_DOOR_WIDTH, doorHeight = PARTITION_DOOR_HEIGHT, doorCenterX = 0
    const doorXMin = doorCenterX - doorWidth / 2
    const doorXMax = doorCenterX + doorWidth / 2

    const leftSegW = Math.max(0.01, doorXMin - xMin)
    const rightSegW = Math.max(0.01, xMax - doorXMax)
    const leftCenterX = xMin + leftSegW / 2
    const rightCenterX = doorXMax + rightSegW / 2
    const lintelHeight = Math.max(0.01, yMax - doorHeight)
    const lintelY = (yMax + doorHeight) / 2

    if (leftSegW > 0.01) coll.push(makeBoxCollider([leftCenterX, yMax / 2, z + WALL_T / 2], [leftSegW, yMax, WALL_T]))
    if (rightSegW > 0.01) coll.push(makeBoxCollider([rightCenterX, yMax / 2, z + WALL_T / 2], [rightSegW, yMax, WALL_T]))
    if (lintelHeight > 0.01) coll.push(makeBoxCollider([doorCenterX, lintelY, z + WALL_T / 2], [doorWidth, lintelHeight, WALL_T]))
  }

  // RIGHT_ROOM colliders
  {
    const width = RIGHT_ROOM.xMax - RIGHT_ROOM.xMin
    const depth = RIGHT_ROOM.zMax - RIGHT_ROOM.zMin
    coll.push(makeBoxCollider([(RIGHT_ROOM.xMin + RIGHT_ROOM.xMax)/2, RIGHT_ROOM.yMax/2, RIGHT_ROOM.zMax + WALL_T/2], [width, RIGHT_ROOM.yMax, WALL_T]))
    coll.push(makeBoxCollider([(RIGHT_ROOM.xMin + RIGHT_ROOM.xMax)/2, RIGHT_ROOM.yMax/2, RIGHT_ROOM.zMin - WALL_T/2], [width, RIGHT_ROOM.yMax, WALL_T]))
    coll.push(makeBoxCollider([RIGHT_ROOM.xMax + WALL_T/2, RIGHT_ROOM.yMax/2, (RIGHT_ROOM.zMin + RIGHT_ROOM.zMax)/2], [WALL_T, RIGHT_ROOM.yMax, depth]))
    // left side door splits already handled by MAIN_ROOM lintel; add left wall segments of RIGHT_ROOM:
    const doorCenterZ = SIDE_DOOR_Z_CENTER
    const doorZMin = doorCenterZ - SIDE_DOOR_WIDTH / 2
    const doorZMax = doorCenterZ + SIDE_DOOR_WIDTH / 2
    const seg1Depth = Math.max(0.01, doorZMin - RIGHT_ROOM.zMin)
    const seg2Depth = Math.max(0.01, RIGHT_ROOM.zMax - doorZMax)
    const seg1CenterZ = RIGHT_ROOM.zMin + seg1Depth / 2
    const seg2CenterZ = doorZMax + seg2Depth / 2
    const lintelHeight = Math.max(0.01, RIGHT_ROOM.yMax - SIDE_DOOR_HEIGHT)
    const lintelY = (RIGHT_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2
    const wallX = RIGHT_ROOM.xMin - WALL_T / 2
    if (seg1Depth > 0.01) coll.push(makeBoxCollider([wallX, RIGHT_ROOM.yMax / 2, seg1CenterZ], [WALL_T, RIGHT_ROOM.yMax, seg1Depth]))
    if (seg2Depth > 0.01) coll.push(makeBoxCollider([wallX, RIGHT_ROOM.yMax / 2, seg2CenterZ], [WALL_T, RIGHT_ROOM.yMax, seg2Depth]))
    if (lintelHeight > 0.01) coll.push(makeBoxCollider([wallX, lintelY, doorCenterZ], [WALL_T, lintelHeight, SIDE_DOOR_WIDTH]))
  }

  // LEFT_ROOM colliders (mirror)
  {
    const width = LEFT_ROOM.xMax - LEFT_ROOM.xMin
    const depth = LEFT_ROOM.zMax - LEFT_ROOM.zMin
    coll.push(makeBoxCollider([(LEFT_ROOM.xMin + LEFT_ROOM.xMax)/2, LEFT_ROOM.yMax/2, LEFT_ROOM.zMax + WALL_T/2], [width, LEFT_ROOM.yMax, WALL_T]))
    coll.push(makeBoxCollider([(LEFT_ROOM.xMin + LEFT_ROOM.xMax)/2, LEFT_ROOM.yMax/2, LEFT_ROOM.zMin - WALL_T/2], [width, LEFT_ROOM.yMax, WALL_T]))
    coll.push(makeBoxCollider([LEFT_ROOM.xMin - WALL_T/2, LEFT_ROOM.yMax/2, (LEFT_ROOM.zMin + LEFT_ROOM.zMax)/2], [WALL_T, LEFT_ROOM.yMax, depth]))
    // right side (door area)
    {
      const doorCenterZ = SIDE_DOOR_Z_CENTER
      const doorZMin = doorCenterZ - SIDE_DOOR_WIDTH / 2
      const doorZMax = doorCenterZ + SIDE_DOOR_WIDTH / 2
      const seg1Depth = Math.max(0.01, doorZMin - LEFT_ROOM.zMin)
      const seg2Depth = Math.max(0.01, LEFT_ROOM.zMax - doorZMax)
      const seg1CenterZ = LEFT_ROOM.zMin + seg1Depth / 2
      const seg2CenterZ = doorZMax + seg2Depth / 2
      if (seg1Depth > 0.01) coll.push(makeBoxCollider([LEFT_ROOM.xMax + WALL_T / 2, LEFT_ROOM.yMax / 2, LEFT_ROOM.zMin + seg1Depth / 2], [WALL_T, LEFT_ROOM.yMax, seg1Depth]))
      if (seg2Depth > 0.01) coll.push(makeBoxCollider([LEFT_ROOM.xMax + WALL_T / 2, LEFT_ROOM.yMax / 2, doorZMax + seg2Depth / 2], [WALL_T, LEFT_ROOM.yMax, seg2Depth]))
      const lintelHeight = Math.max(0.01, LEFT_ROOM.yMax - SIDE_DOOR_HEIGHT)
      if (lintelHeight > 0.01) coll.push(makeBoxCollider([LEFT_ROOM.xMax + WALL_T / 2, (LEFT_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2, doorCenterZ], [WALL_T, lintelHeight, SIDE_DOOR_WIDTH]))
    }
  }

  return coll
}

/* ===== Collision test: sphere vs AABB ===== */
function sphereIntersectsAABB(spherePos, radius, aabb) {
  const x = Math.max(aabb.min.x, Math.min(spherePos.x, aabb.max.x))
  const y = Math.max(aabb.min.y, Math.min(spherePos.y, aabb.max.y))
  const z = Math.max(aabb.min.z, Math.min(spherePos.z, aabb.max.z))
  const dx = x - spherePos.x, dy = y - spherePos.y, dz = z - spherePos.z
  return (dx*dx + dy*dy + dz*dz) <= (radius * radius)
}

/* ===== Player Controls (pointer lock + WASD) with collisions ===== */
function PlayerControls({ enabled, colliders = [] }) {
  const { camera, gl } = useThree()
  const yaw = useRef(0)
  const pitch = useRef(0)
  const keys = useRef({})
  const radius = 0.25 // player collision radius

  useEffect(() => { camera.position.y = EYE_HEIGHT }, [camera])

  useEffect(() => {
    const down = (e) => (keys.current[e.code] = true)
    const up = (e) => (keys.current[e.code] = false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    const el = gl.domElement
    const onClick = () => { if (document.pointerLockElement !== el) el.requestPointerLock?.() }
    el.addEventListener("click", onClick)
    return () => el.removeEventListener("click", onClick)
  }, [gl.domElement, enabled])

  useEffect(() => {
    const onMove = (e) => {
      if (!document.pointerLockElement) return
      yaw.current -= e.movementX * MOUSE_SENSITIVITY
      pitch.current -= e.movementY * MOUSE_SENSITIVITY
      const limit = Math.PI / 2 - 0.05
      pitch.current = Math.max(-limit, Math.min(limit, pitch.current))
    }
    document.addEventListener("mousemove", onMove)
    return () => document.removeEventListener("mousemove", onMove)
  }, [])

  useFrame((_, delta) => {
    if (!enabled) return
    camera.rotation.order = "YXZ"
    camera.rotation.y = yaw.current
    camera.rotation.x = pitch.current

    const forward = new THREE.Vector3(); camera.getWorldDirection(forward); forward.y = 0; forward.normalize()
    const right = new THREE.Vector3(); right.crossVectors(forward, new THREE.Vector3(0,1,0)).normalize()

    const move = new THREE.Vector3()
    const speed = MOVE_SPEED * delta
    if (keys.current["KeyW"]) move.add(forward)
    if (keys.current["KeyS"]) move.sub(forward)
    if (keys.current["KeyA"]) move.sub(right)
    if (keys.current["KeyD"]) move.add(right)

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed)

      // try X then Z separately for sliding
      const curPos = camera.position.clone()
      const attemptX = curPos.clone().add(new THREE.Vector3(move.x, 0, 0)); attemptX.y = EYE_HEIGHT
      let blockedX = false
      for (let aabb of colliders) {
        if (sphereIntersectsAABB(attemptX, radius, aabb)) { blockedX = true; break }
      }
      if (!blockedX) camera.position.x = attemptX.x

      const attemptZ = camera.position.clone().add(new THREE.Vector3(0, 0, move.z)); attemptZ.y = EYE_HEIGHT
      let blockedZ = false
      for (let aabb of colliders) {
        if (sphereIntersectsAABB(attemptZ, radius, aabb)) { blockedZ = true; break }
      }
      if (!blockedZ) camera.position.z = attemptZ.z

      camera.position.x = THREE.MathUtils.clamp(camera.position.x, WORLD.xMin + 0.3, WORLD.xMax - 0.3)
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, WORLD.zMin + 0.3, WORLD.zMax - 0.3)
    }
  })

  return null
}

/* ===== App (assemble everything) ===== */
export default function App() {
  const [showIntro, setShowIntro] = useState(true)
  const [selected, setSelected] = useState(null)

  const colliders = useMemo(() => buildColliders(), [])

  // helpful: spawn camera in lobby area (just in front of main room) to avoid being inside geometry
  const spawnPos = [0, EYE_HEIGHT, 2.0]

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#ffffff" }}>
      <Canvas shadows camera={{ position: spawnPos, fov: 75 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[8, 12, 6]} intensity={0.6} />
        <directionalLight position={[-8, 12, -6]} intensity={0.45} />

        {/* Lobby */}
        <RoomMesh {...{ xMin: MAIN_ROOM.xMin, xMax: MAIN_ROOM.xMax, zMin: MAIN_ROOM.zMax + 0.5, zMax: MAIN_ROOM.zMax + 4, yMax: 3 }} />

        {/* Partition wall with door */}
        <PartitionWallWithDoor xMin={MAIN_ROOM.xMin} xMax={MAIN_ROOM.xMax} yMax={MAIN_ROOM.yMax} z={PARTITION_Z} doorWidth={PARTITION_DOOR_WIDTH} doorHeight={PARTITION_DOOR_HEIGHT} doorCenterX={0} wallT={WALL_T} />

        {/* MAIN ROOM (skip side walls so we draw door-split walls separately) */}
        <RoomMesh {...MAIN_ROOM} skipLeftWall skipRightWall />

        {/* Right side door / wall */}
        <RightWallWithDoor room={MAIN_ROOM} doorCenterZ={SIDE_DOOR_Z_CENTER} doorWidth={SIDE_DOOR_WIDTH} doorHeight={SIDE_DOOR_HEIGHT} wallT={WALL_T} />
        <mesh position={[ MAIN_ROOM.xMax + WALL_T / 2, (MAIN_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2, SIDE_DOOR_Z_CENTER ]}>
          <boxGeometry args={[WALL_T, MAIN_ROOM.yMax - SIDE_DOOR_HEIGHT, SIDE_DOOR_WIDTH]} />
          <meshStandardMaterial color={"#ffffff"} />
        </mesh>

        {/* Left side door / wall */}
        <LeftWallWithDoorMain room={MAIN_ROOM} doorCenterZ={SIDE_DOOR_Z_CENTER} doorWidth={SIDE_DOOR_WIDTH} doorHeight={SIDE_DOOR_HEIGHT} wallT={WALL_T} />
        <mesh position={[ MAIN_ROOM.xMin - WALL_T / 2, (MAIN_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2, SIDE_DOOR_Z_CENTER ]}>
          <boxGeometry args={[WALL_T, MAIN_ROOM.yMax - SIDE_DOOR_HEIGHT, SIDE_DOOR_WIDTH]} />
          <meshStandardMaterial color={"#ffffff"} />
        </mesh>

        {/* RIGHT ROOM (polaroid hobby room) */}
        <RoomMesh {...RIGHT_ROOM} skipLeftWall />
        <LeftWallWithDoorRoom room={RIGHT_ROOM} doorCenterZ={SIDE_DOOR_Z_CENTER} doorWidth={SIDE_DOOR_WIDTH} doorHeight={SIDE_DOOR_HEIGHT} wallT={WALL_T} />
        <mesh position={[ RIGHT_ROOM.xMin - WALL_T / 2, (RIGHT_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2, SIDE_DOOR_Z_CENTER ]}>
          <boxGeometry args={[WALL_T, RIGHT_ROOM.yMax - SIDE_DOOR_HEIGHT, SIDE_DOOR_WIDTH]} />
          <meshStandardMaterial color={"#ffffff"} />
        </mesh>

        {/* LEFT ROOM (mirror of right) */}
        <RoomMesh {...LEFT_ROOM} skipRightWall />
        <RightWallWithDoorLeftRoom room={LEFT_ROOM} doorCenterZ={SIDE_DOOR_Z_CENTER} doorWidth={SIDE_DOOR_WIDTH} doorHeight={SIDE_DOOR_HEIGHT} wallT={WALL_T} />
        <mesh position={[ LEFT_ROOM.xMax + WALL_T / 2, (LEFT_ROOM.yMax + SIDE_DOOR_HEIGHT) / 2, SIDE_DOOR_Z_CENTER ]}>
          <boxGeometry args={[WALL_T, LEFT_ROOM.yMax - SIDE_DOOR_HEIGHT, SIDE_DOOR_WIDTH]} />
          <meshStandardMaterial color={"#ffffff"} />
        </mesh>

        {/* Door floor strip: partition (center partition door) */}
        <DoorFloorStrip
          pos={[
            (MAIN_ROOM.xMin + MAIN_ROOM.xMax) / 2,          // center X of main room
            0.01,                                           // tiny lift above floor to avoid z-fighting
            PARTITION_Z + WALL_T / 2                        // line up with partition wall plane
          ]}
          size={[PARTITION_DOOR_WIDTH + 0.04, 0.02, WALL_T + 0.04]} // cover door width along X, small thickness Y, overlap wallT in Z
          color={FLOOR_COLOR}
        />

        {/* Door floor strip: right door (MAIN -> RIGHT_ROOM) */}
        <DoorFloorStrip
          pos={[
            MAIN_ROOM.xMax + WALL_T / 2,                    // center inside wall-thickness area on X
            0.01,
            SIDE_DOOR_Z_CENTER                              // door center along Z
          ]}
          size={[WALL_T + 0.04, 0.02, SIDE_DOOR_WIDTH + 0.04]}   // thin on X (wall thickness), full width on Z
          color={FLOOR_COLOR}
        />

        {/* Door floor strip: left door (MAIN -> LEFT_ROOM) */}
        <DoorFloorStrip
          pos={[
            MAIN_ROOM.xMin - WALL_T / 2,
            0.01,
            SIDE_DOOR_Z_CENTER
          ]}
          size={[WALL_T + 0.04, 0.02, SIDE_DOOR_WIDTH + 0.04]}
          color={FLOOR_COLOR}
        />


        {/* Ceiling lights for main & side rooms */}
        <CeilingLights room={MAIN_ROOM} intensity={1.0} />
        <CeilingLights room={RIGHT_ROOM} intensity={0.9} />
        <CeilingLights room={LEFT_ROOM} intensity={0.9} />

        {/* Main-room wall frames */}
        <WallFrame image={"/images/experience.jpg"} position={[ MAIN_ROOM.xMin + 0.02, 1.7, -11 ]} rotation={[0, Math.PI/2, 0]} title="Experience" subtitle="Analyst — LatentView" onSelect={() => setSelected("Experience")} useHtmlPlaque={false} />
        <WallFrame image={"/images/education.jpg"} position={[ MAIN_ROOM.xMin + 0.02, 1.7, -15.5 ]} rotation={[0, Math.PI/2, 0]} title="Education" subtitle="B.Tech — College" onSelect={() => setSelected("Education")} useHtmlPlaque={false} />
        <WallFrame image={"/images/about.jpg"} position={[ MAIN_ROOM.xMax - 0.02, 1.7, -13 ]} rotation={[0, -Math.PI/2, 0]} title="About" subtitle="Short bio" onSelect={() => setSelected("About")} useHtmlPlaque={false} />
        {/*<WallFrame image={"/images/skills.jpg"} position={[ MAIN_ROOM.xMax - 0.02, 1.7, -12 ]} rotation={[0, -Math.PI/2, 0]} title="Skills" subtitle="Python · React · 3D" onSelect={() => setSelected("Skills")} useHtmlPlaque={false} />*/}
        <WallFrame image={"/images/skills.jpg"} position={[-2.0, 1.7, MAIN_ROOM.zMin + 0.02]} rotation={[0, 0, 0]} title="Skills" subtitle="Python · React · 3D" onSelect={() => setSelected("Skills")} useHtmlPlaque={false} />
        <WallFrame image={"/images/contact.jpg"} position={[2.0, 1.7, MAIN_ROOM.zMin + 0.02]} rotation={[0, 0, 0]} title="Contact" subtitle="your@email.com" onSelect={() => setSelected("Contact")} useHtmlPlaque={false} />

        {/* Polaroid walls: both sides use the same PolaroidWall component */}
        <PolaroidWall room={RIGHT_ROOM} />
        <PolaroidWall room={LEFT_ROOM} />

        {/* Player */}
        <PlayerControls enabled={!showIntro} colliders={colliders} />
      </Canvas>

      {showIntro && <IntroOverlay onClose={() => setShowIntro(false)} />}

      {selected && (
        <div style={{ position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.88)", color: "white", padding: 14, borderRadius: 8, width: 340 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ color: "#67e8f9" }}>{selected}</strong>
            <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ marginTop: 10, fontSize: 13 }}>
            {selected === "About" && <div>👋 Hey, I’m Ayan — short bio & links.</div>}
            {selected === "Skills" && <div>⚡ Python, SQL, ML, React, Three.js.</div>}
            {selected === "Experience" && <div>📊 Analyst — dashboards, analytics.</div>}
            {selected === "Education" && <div>🎓 B.Tech — details & achievements.</div>}
            {selected === "Projects" && <div>🚀 Selected projects: 3D portfolio, bots, viz.</div>}
            {selected === "Contact" && <div>📧 your@email.com — LinkedIn /in/yourname</div>}
          </div>
        </div>
      )}
    </div>
  )
}
