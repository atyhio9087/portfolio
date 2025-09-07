// src/App.jsx
import React, { useRef, useState, useEffect } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, useTexture, Text } from "@react-three/drei"
import * as THREE from "three"

/* ===== CONFIG ===== */
const EYE_HEIGHT = 1.6
const MOVE_SPEED = 3.5
const MOUSE_SENSITIVITY = 0.002

// One continuous hall (spawn + gallery)
const WORLD = { xMin: -6, xMax: 6, zMin: -16, zMax: 3, yMax: 6 }
// Visual partition that separates Room 1 and Room 2
const PARTITION_Z = -4
const DOOR_WIDTH = 2.6
const DOOR_HEIGHT = 2.6

/* ===== DISPLAY SIZES (tweak to taste) ===== */
const FRAME_INNER_W = 2.0   // image width
const FRAME_INNER_H = 1.2   // image height
const FRAME_BORDER  = 0.06  // extra around image for frame
const FRAME_DEPTH   = 0.05  // frame thickness
const PLAQUE_W      = 1.6
const PLAQUE_H      = 0.28
const PLAQUE_DEPTH  = 0.04
const LABEL_GAP     = 0.95  // distance below frame center to place plaque

/* ===== Intro Overlay (blocks controls until closed) ===== */
function IntroOverlay({ onClose }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-black/90 text-white p-6 rounded-xl max-w-md text-center border border-cyan-400 shadow-lg relative pointer-events-auto">
        <button onClick={onClose} className="absolute top-2 right-2 text-gray-300 hover:text-white">✕</button>
        <h1 className="text-xl font-bold mb-2">Hey Stranger 👋</h1>
        <p className="leading-relaxed text-sm">
          I'm Ayan, the creator of this site. This site acts as my portfolio to record everything I’ve ever managed to do.
          Do have a look around and have fun!
        </p>
        <div className="mt-4 text-xs text-slate-300">Close this to enable movement. Click the canvas to lock pointer.</div>
      </div>
    </div>
  )
}

/* ===== Room shell: white floor, walls & ceiling (thick walls) ===== */
function RoomMesh({ xMin, xMax, zMin, zMax, yMax }) {
  const width = xMax - xMin
  const depth = zMax - zMin
  const wallColor = "#ffffff"
  const floorColor = "#f3f3f3"
  const wallT = 0.3 // thickness of walls

  return (
    <group>
      {/* floor */}
      <mesh
        position={[(xMin + xMax) / 2, 0, (zMin + zMax) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>

      {/* ceiling */}
      <mesh
        position={[(xMin + xMax) / 2, yMax, (zMin + zMax) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* front wall */}
      <mesh position={[(xMin + xMax) / 2, yMax / 2, zMax + wallT / 2]}>
        <boxGeometry args={[width, yMax, wallT]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* back wall */}
      <mesh position={[(xMin + xMax) / 2, yMax / 2, zMin - wallT / 2]}>
        <boxGeometry args={[width, yMax, wallT]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* left wall */}
      <mesh position={[xMin - wallT / 2, yMax / 2, (zMin + zMax) / 2]}>
        <boxGeometry args={[wallT, yMax, depth]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* right wall */}
      <mesh position={[xMax + wallT / 2, yMax / 2, (zMin + zMax) / 2]}>
        <boxGeometry args={[wallT, yMax, depth]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
    </group>
  )
}

/* ===== Partition wall with doorway, now thick ===== */
function PartitionWall({ xMin, xMax, yMax, z = PARTITION_Z }) {
  const wallColor = "#ffffff"
  const wallT = 0.3
  const width = xMax - xMin
  const sideW = (width - DOOR_WIDTH) / 2

  return (
    <group>
      {/* Left segment */}
      <mesh position={[xMin + sideW / 2, yMax / 2, z]}>
        <boxGeometry args={[sideW, yMax, wallT]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Right segment */}
      <mesh position={[xMax - sideW / 2, yMax / 2, z]}>
        <boxGeometry args={[sideW, yMax, wallT]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Lintel above doorway */}
      <mesh position={[(xMin + xMax) / 2, (yMax + DOOR_HEIGHT) / 2, z]}>
        <boxGeometry args={[DOOR_WIDTH, yMax - DOOR_HEIGHT, wallT]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>
    </group>
  )
}


/* ===== Ceiling Lights ===== */
function CeilingLights({ room }) {
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
        <pointLight key={i} position={p} intensity={1.0} distance={14} color={"#ffffff"} />
      ))}
    </>
  )
}

/* ===== Wall-mounted frame with museum plaque ===== */
function WallFrame({ image, position, rotation, title, subtitle, onSelect }) {
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
      {/* Frame */}
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

      {/* Image */}
      <mesh position={[0, 0, FRAME_DEPTH / 2 + 0.002]}>
        <planeGeometry args={[FRAME_INNER_W, FRAME_INNER_H]} />
        <meshStandardMaterial map={tex} />
      </mesh>

      {/* Plaque below frame */}
      <group position={[0, -(OUT_H / 2) - LABEL_GAP / 2, 0]}>
        {/* Plaque plate */}
        <mesh position={[0, 0, PLAQUE_DEPTH / 2 + 0.002]}>
          <boxGeometry args={[PLAQUE_W, PLAQUE_H, PLAQUE_DEPTH]} />
          <meshStandardMaterial color="#f5f5f5" />
        </mesh>
        {/* Plaque text */}
        <group position={[0, 0, PLAQUE_DEPTH + 0.01]}>
          <Text fontSize={0.09} color="#111" anchorX="center" anchorY="middle" maxWidth={PLAQUE_W * 0.9} lineHeight={1.1}>
            {title}
          </Text>
          {subtitle && (
            <Text position={[0, -0.11, 0]} fontSize={0.06} color="#555" anchorX="center" anchorY="middle" maxWidth={PLAQUE_W * 0.9}>
              {subtitle}
            </Text>
          )}
        </group>
      </group>
    </group>
  )
}

// /* ===== Gallery: frames mounted flush on room-2 walls, with centered Experience/Education ===== */
// function Gallery({ onSelect }) {
//   const sec = [
//     { title: "About",      src: "/images/about.jpg" },
//     { title: "Skills",     src: "/images/skills.jpg" },
//     { title: "Experience", src: "/images/experience.jpg" },
//     { title: "Education",  src: "/images/education.jpg" },
//     { title: "Projects",   src: "/images/projects.jpg" },
//     { title: "Contact",    src: "/images/contact.jpg" },
//   ]

//   const eps = 0.02
//   const y   = 1.7

//   // Front (partition) wall, gallery side
//   const frontZ = PARTITION_Z - eps
//   // Back wall
//   const backZ  = WORLD.zMin + eps
//   // Left & Right walls
//   const leftX  = WORLD.xMin + eps   // face +X => rot -PI/2
//   const rightX = WORLD.xMax - eps   // face -X => rot +PI/2
//   const sideZ  = (WORLD.zMin + PARTITION_Z) / 2 // centered along z on side walls

//   const frames = [
//     // Front wall (two)
//     { title: sec[0].title, src: sec[0].src, pos: [-3.0, y, frontZ], rot: [0, Math.PI, 0] }, // About
//     { title: sec[1].title, src: sec[1].src, pos: [ 3.0, y, frontZ], rot: [0, Math.PI, 0] }, // Skills

//     // LEFT wall centered (Experience)
//     { title: sec[2].title, src: sec[2].src, pos: [leftX,  y, sideZ], rot: [0, Math.PI/2, 0] },

//     // RIGHT wall centered (Education)
//     { title: sec[3].title, src: sec[3].src, pos: [rightX, y, sideZ], rot: [0, -Math.PI/2, 0] },

//     // Back wall (two)
//     { title: sec[4].title, src: sec[4].src, pos: [-3.0, y, backZ], rot: [0, 0, 0] }, // Projects
//     { title: sec[5].title, src: sec[5].src, pos: [ 3.0, y, backZ], rot: [0, 0, 0] }, // Contact
//   ]

//   return (
//     <>
//       {frames.map((f, i) => (
//         <WallFrame
//           key={i}
//           image={f.src}
//           title={f.title}
//           // subtitle example: f.title === "Projects" ? "Selected Works" : undefined
//           position={f.pos}
//           rotation={f.rot}
//           onSelect={onSelect}
//         />
//       ))}
//     </>
//   )
// }

function Gallery({ onSelect }) {
  const sec = [
    { title: "About",      src: "/images/about.jpg" },
    { title: "Skills",     src: "/images/skills.jpg" },
    { title: "Experience", src: "/images/experience.jpg" },
    { title: "Education",  src: "/images/education.jpg" },
    { title: "Projects",   src: "/images/projects.jpg" },
    { title: "Contact",    src: "/images/contact.jpg" },
  ]

  const eps = 0.02
  const y   = 1.7

  // Back wall z position (slightly inset)
  const backZ  = WORLD.zMin + eps

  // Left and right wall x positions (slightly inset)
  const leftX  = WORLD.xMin + eps   // faces +X, rotation = -PI/2
  const rightX = WORLD.xMax - eps   // faces -X, rotation = +PI/2

  // Z positions to stack two frames on side walls (top, bottom)
  const sideZTop = (PARTITION_Z + WORLD.zMin) / 2 - 2   // a bit closer to partition
  const sideZBot = (PARTITION_Z + WORLD.zMin) / 2 + 2   // a bit further back

  // X positions for two frames on back wall
  const backXL = -3.0
  const backXR =  3.0

  const frames = [
    // LEFT wall (two frames: top, bottom)
    { title: sec[2].title, src: sec[2].src, pos: [leftX,  y, sideZTop], rot: [0, Math.PI/2, 0] }, // Experience (top)
    { title: sec[3].title, src: sec[3].src, pos: [leftX,  y, sideZBot], rot: [0, Math.PI/2, 0] }, // Education (bottom)

    // RIGHT wall (two frames: top, bottom)
    { title: sec[0].title, src: sec[0].src, pos: [rightX, y, sideZTop], rot: [0,  -Math.PI/2, 0] }, // About (top)
    { title: sec[1].title, src: sec[1].src, pos: [rightX, y, sideZBot], rot: [0,  -Math.PI/2, 0] }, // Skills (bottom)

    // BACK wall (two frames: left, right)
    { title: sec[4].title, src: sec[4].src, pos: [backXL, y, backZ], rot: [0, 0, 0] }, // Projects (left)
    { title: sec[5].title, src: sec[5].src, pos: [backXR, y, backZ], rot: [0, 0, 0] }, // Contact  (right)
  ]

  return (
    <>
      {frames.map((f, i) => (
        <WallFrame
          key={i}
          image={f.src}
          title={f.title}
          position={f.pos}
          rotation={f.rot}
          onSelect={onSelect}
        />
      ))}
    </>
  )
}



/* ===== Player Controls: pointer-lock mouselook + WASD, clamped to WORLD ===== */
function PlayerControls({ enabled }) {
  const { camera, gl } = useThree()
  const yawRef = useRef(0)
  const pitchRef = useRef(0)
  const keys = useRef({})

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
    const handleClick = () => { if (document.pointerLockElement !== el) el.requestPointerLock?.() }
    el.addEventListener("click", handleClick)
    return () => { el.removeEventListener("click", handleClick) }
  }, [gl.domElement, enabled])

  useEffect(() => {
    const onMove = (e) => {
      if (!document.pointerLockElement) return
      yawRef.current -= e.movementX * MOUSE_SENSITIVITY
      pitchRef.current -= e.movementY * MOUSE_SENSITIVITY
      const limit = Math.PI / 2 - 0.05
      pitchRef.current = Math.max(-limit, Math.min(limit, pitchRef.current))
    }
    document.addEventListener("mousemove", onMove)
    return () => document.removeEventListener("mousemove", onMove)
  }, [])

  useFrame((_, delta) => {
    if (!enabled) return

    camera.rotation.order = "YXZ"
    camera.rotation.y = yawRef.current
    camera.rotation.x = pitchRef.current

    const forward = new THREE.Vector3()
    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    const right = new THREE.Vector3()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    const move = new THREE.Vector3()
    const speed = MOVE_SPEED * delta
    if (keys.current["KeyW"]) move.add(forward)
    if (keys.current["KeyS"]) move.sub(forward)
    if (keys.current["KeyA"]) move.sub(right)
    if (keys.current["KeyD"]) move.add(right)

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed)
      const newPos = camera.position.clone().add(move)
      newPos.y = EYE_HEIGHT
      newPos.x = THREE.MathUtils.clamp(newPos.x, WORLD.xMin + 0.3, WORLD.xMax - 0.3)
      newPos.z = THREE.MathUtils.clamp(newPos.z, WORLD.zMin + 0.3, WORLD.zMax - 0.3)
      camera.position.copy(newPos)
    }
  })

  return null
}

/* ===== Main App ===== */
export default function App() {
  const [selected, setSelected] = useState(null)
  const [showIntro, setShowIntro] = useState(true)

  return (
    <div className="w-screen h-screen relative bg-white">
      <Canvas shadows camera={{ position: [0, EYE_HEIGHT, 2], fov: 75 }}>
        {/* clean museum lighting */}
        <ambientLight intensity={0.55} />
        <directionalLight position={[8, 12, 6]} intensity={0.6} />
        <directionalLight position={[-8, 12, -6]} intensity={0.5} />

        {/* Room shell (one continuous hall) */}
        <RoomMesh {...WORLD} />

        {/* Visual partition with doorway at z = -4 */}
        <PartitionWall xMin={WORLD.xMin} xMax={WORLD.xMax} yMax={WORLD.yMax} z={PARTITION_Z} />

        {/* Ceiling lights */}
        <CeilingLights room={WORLD} />

        {/* Gallery frames mounted to walls in room 2 */}
        <Gallery onSelect={setSelected} />

        {/* Controls */}
        <PlayerControls enabled={!showIntro} />
      </Canvas>

      {showIntro && <IntroOverlay onClose={() => setShowIntro(false)} />}

      {selected && (
        <div className="absolute top-6 right-6 bg-black/80 text-white p-6 rounded-lg w-80 shadow-lg border border-cyan-400">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-cyan-400">{selected}</h2>
            <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-white">✕</button>
          </div>
          <div className="text-sm space-y-2">
            {selected === "About" && <p>👋 Hey, I’m Ayan...</p>}
            {selected === "Skills" && <p>⚡ Python, ML, Viz, React, 3JS...</p>}
            {selected === "Experience" && <p>📊 Analyst at LatentView...</p>}
            {selected === "Education" && <p>🎓 Your education here...</p>}
            {selected === "Projects" && <p>🚀 Selected Works...</p>}
            {selected === "Contact" && <p>📧 your@email.com</p>}
          </div>
        </div>
      )}
    </div>
  )
}
