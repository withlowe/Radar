"use client"

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { Pause } from "lucide-react"

interface RadarProps {
  score: number
  onPause: () => void
  onGameOver: () => void
  onScoreUpdate: (newScore: number) => void
}

// Define line type
type Line = {
  x: number
  y: number
  height: number
  speed: number
}

// Define radar beam type (each beam has 2 lines)
type RadarBeam = {
  lines: [
    { angle: number }, // First line
    { angle: number }, // Second line (40 degrees apart)
  ]
  speed: number
  direction: 1 | -1 // 1 for clockwise, -1 for counter-clockwise
  lastDirectionChange: number // timestamp of last direction change
  failing?: boolean // New property to indicate if this beam is failing
}

// Define radar target type (stationary targets that appear on radar)
type RadarTarget = {
  x: number
  y: number
  timeLeft: number // Time in ms before disappearing
  collected: boolean
  points: number
  id: string // Unique identifier
}

// Define flying triangle type (obstacles that cause collisions)
type FlyingTriangle = {
  x: number
  y: number
  size: number
  speed: number
  direction: number // angle in radians
  active: boolean
  id: string // Unique identifier
}

// Define difficulty level
type DifficultyLevel = {
  level: number
  radarSpeed: number
  lineSpeed: number
  lineFrequency: number
  targetFrequency: number
  triangleFrequency: number
  targetLifetime: number
  radarBeams: number
  name: string
  color: string
}

// Define collision data for debugging
type CollisionData = {
  playerX: number
  playerY: number
  objectX: number
  objectY: number
  distance: number
  threshold: number
  type: string
  time: number
}

export default function Radar({ score, onPause, onGameOver, onScoreUpdate }: RadarProps) {
  console.log("Radar component rendering", { score, onPause, onGameOver, onScoreUpdate })
  // Game state
  const [playerPosition, setPlayerPosition] = useState({ x: 0, y: 0 })
  const [lines, setLines] = useState<Line[]>([])
  const [radarBeams, setRadarBeams] = useState<RadarBeam[]>([])
  const [radarTargets, setRadarTargets] = useState<RadarTarget[]>([])
  const [flyingTriangles, setFlyingTriangles] = useState<FlyingTriangle[]>([])
  const [stars, setStars] = useState<{ x: number; y: number }[]>([])
  const [isInRadar, setIsInRadar] = useState(false)
  const [timeInRadar, setTimeInRadar] = useState(0)
  const [timeOutsideRadar, setTimeOutsideRadar] = useState(0)
  const [targetsCollected, setTargetsCollected] = useState(0)
  const [targetPoints, setTargetPoints] = useState(0) // Total points from targets
  const [debugMessage, setDebugMessage] = useState("")
  const [isGameEnding, setIsGameEnding] = useState(false) // Fixed: Initialize with false
  const [currentFlightLevel, setCurrentFlightLevel] = useState(1)
  const [difficultyLevel, setDifficultyLevel] = useState<DifficultyLevel>({
    level: 1,
    radarSpeed: 0.015,
    lineSpeed: 4,
    lineFrequency: 800,
    targetFrequency: 2000,
    triangleFrequency: 3000,
    targetLifetime: 3000,
    radarBeams: 2,
    name: "FLIGHT LEVEL 1",
    color: "green-400",
  })
  const [showLevelUp, setShowLevelUp] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [showTouchControls, setShowTouchControls] = useState(false)
  const [touchStartPosition, setTouchStartPosition] = useState({ x: 0, y: 0 })
  const [touchJoystickPosition, setTouchJoystickPosition] = useState({ x: 0, y: 0 })
  const [isJoystickActive, setIsJoystickActive] = useState(false)
  const [collisionDebug, setCollisionDebug] = useState("")
  const [showTargetCollected, setShowTargetCollected] = useState(false)
  const [lastCollectedPoints, setLastCollectedPoints] = useState(0)
  const [collisionHistory, setCollisionHistory] = useState<CollisionData[]>([])
  const [showDebug, setShowDebug] = useState(false) // Set to false to hide debug panel
  const [pointsAnimations, setPointsAnimations] = useState<
    { id: string; x: number; y: number; points: number; time: number }[]
  >([])
  const [targetCollectionEffect, setTargetCollectionEffect] = useState<{
    id: string
    x: number
    y: number
    time: number
  } | null>(null)
  const [triangleCollisionEffect, setTriangleCollisionEffect] = useState<{
    x: number
    y: number
    time: number
  } | null>(null)
  const [showTargetDetection, setShowTargetDetection] = useState<{
    id: string
    x: number
    y: number
    time: number
  } | null>(null)
  const [recentlyCollectedTargets, setRecentlyCollectedTargets] = useState<string[]>([])
  const [linePenaltyEffect, setLinePenaltyEffect] = useState<{
    x: number
    y: number
    time: number
  } | null>(null)
  const [isInvulnerable, setIsInvulnerable] = useState(false)
  const [hitEffect, setHitEffect] = useState<{ x: number; y: number; time: number } | null>(null)
  // New state for radar failure
  const [radarFailure, setRadarFailure] = useState(false)
  const [radarFailureEffect, setRadarFailureEffect] = useState<{
    time: number
    duration: number
    beamIndex: number // Added to track which beam is failing
  } | null>(null)

  // Constants
  const TARGET_SIZE = 30 // Reduced from 40 to 30 for slightly smaller targets
  const TARGET_POINTS = 10 // Fixed points for all targets
  const PLAYER_RADIUS = 16 // Half of player circle width
  const TRIANGLE_SIZE = 12.5 // Half of the original 25
  const RADAR_ANGLE_THRESHOLD = 0.15 // Threshold for being between radar lines (in radians)
  const TIME_DECAY_RATE = 0.5 // Rate at which time decreases when outside radar
  const TARGET_DETECTION_RANGE = PLAYER_RADIUS + TARGET_SIZE / 2 + 20 // Detection range is larger than collection range
  const LINE_PENALTY = 10 // Points deducted when hovering over falling lines
  const RADAR_BEAM_ANGLE = Math.PI / 4.5 // 40 degrees (π/4.5 radians)
  const DIRECTION_CHANGE_CHANCE = 0.005 // Chance per frame to change direction
  const DIRECTION_CHANGE_COOLDOWN = 2000 // Minimum time between direction changes (ms)
  const INVULNERABILITY_DURATION = 2000 // Duration of invulnerability after being hit in ms
  const TIME_SCORE_MULTIPLIER = 0.01 // Score multiplier for time in radar
  const RADAR_FAILURE_CHANCE = 0.005 // Increased chance to ensure beam failures occur (increased from 0.002)
  const RADAR_FAILURE_DURATION = 3000 // Changed to 3000 ms (3 seconds)
  const RADAR_FAILURE_MIN_INTERVAL = 10000 // Decreased from 20000 to 10000 ms to make failures more frequent
  const RADAR_TIME_REWARD = 10 // Time units needed to gain a point (changed from 500 to 10)
  const RADAR_TIME_PENALTY_THRESHOLD = 500 // Time threshold before applying penalty when outside radar

  // Refs
  const gameAreaRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLDivElement>(null)
  const joystickRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const lastLineTime = useRef<number>(0)
  const lastTargetTime = useRef<number>(0)
  const lastTriangleTime = useRef<number>(0)
  const scoreIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const gameStartTime = useRef<number>(Date.now())
  const scoreUpdateRef = useRef<(score: number) => void>(onScoreUpdate)
  const currentScoreRef = useRef<number>(score)
  const playerPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const nextTargetId = useRef(1)
  const nextTriangleId = useRef(1)
  const gameOverRef = useRef<() => void>(onGameOver)
  const isGameEndingRef = useRef<boolean>(false)
  const lastFrameTime = useRef<number>(0)
  const frameCount = useRef<number>(0)
  const collisionCheckRef = useRef<boolean>(false)
  const radarBeamsRef = useRef<RadarBeam[]>([])
  const timeInRadarRef = useRef<number>(0)
  const timeOutsideRadarRef = useRef<number>(0)
  const lastTimeUpdateRef = useRef<number>(0)
  const targetPointsRef = useRef<number>(0)
  const lastPenaltyTime = useRef<number>(0)
  const PENALTY_COOLDOWN = 500 // ms between penalties
  const lastLevelRef = useRef(1)
  const currentFlightLevelRef = useRef<number>(1)
  const lastHitTime = useRef<number>(0)
  const lastBeamUpdateLevel = useRef<number>(1)
  const lastRadarFailureTime = useRef<number>(0)
  const radarFailureRef = useRef<boolean>(false)
  const lastRadarFailureAttempt = useRef<number>(0)

  // Update refs when props/state change
  useEffect(() => {
    scoreUpdateRef.current = onScoreUpdate
    currentScoreRef.current = score
  }, [onScoreUpdate, score])

  useEffect(() => {
    gameOverRef.current = onGameOver
  }, [onGameOver])

  useEffect(() => {
    isGameEndingRef.current = isGameEnding
  }, [isGameEnding])

  useEffect(() => {
    playerPositionRef.current = playerPosition
  }, [playerPosition])

  useEffect(() => {
    radarBeamsRef.current = radarBeams
  }, [radarBeams])

  useEffect(() => {
    timeInRadarRef.current = timeInRadar
  }, [timeInRadar])

  useEffect(() => {
    timeOutsideRadarRef.current = timeOutsideRadar
  }, [timeOutsideRadar])

  useEffect(() => {
    targetPointsRef.current = targetPoints
  }, [targetPoints])

  useEffect(() => {
    currentFlightLevelRef.current = currentFlightLevel
  }, [currentFlightLevel])

  useEffect(() => {
    radarFailureRef.current = radarFailure
  }, [radarFailure])

  // Calculate radar elements
  const calculateRadarElements = () => {
    if (!gameAreaRef.current) return { radarRadius: 0, centerX: 0, centerY: 0 }

    const { width, height } = gameAreaRef.current.getBoundingClientRect()
    const centerX = width / 2
    const centerY = height / 2
    const radarRadius = Math.min(width, height) * 0.4 // 40% of the smaller dimension

    return { radarRadius, centerX, centerY }
  }

  // Difficulty levels - start with medium speed for easy level
  const difficultyLevels: DifficultyLevel[] = [
    {
      level: 1,
      radarSpeed: 0.015,
      lineSpeed: 4,
      lineFrequency: 800,
      targetFrequency: 2000,
      triangleFrequency: 3000,
      targetLifetime: 3000,
      radarBeams: 2,
      name: "FLIGHT LEVEL 1",
      color: "green-400",
    },
    {
      level: 10,
      radarSpeed: 0.018,
      lineSpeed: 4.5,
      lineFrequency: 750,
      targetFrequency: 1900,
      triangleFrequency: 2800,
      targetLifetime: 2900,
      radarBeams: 3,
      name: "FLIGHT LEVEL 10",
      color: "green-400",
    },
    {
      level: 20,
      radarSpeed: 0.02,
      lineSpeed: 5,
      lineFrequency: 700,
      targetFrequency: 1800,
      triangleFrequency: 2500,
      targetLifetime: 2800,
      radarBeams: 4,
      name: "FLIGHT LEVEL 20",
      color: "green-400",
    },
    {
      level: 40,
      radarSpeed: 0.025,
      lineSpeed: 6,
      lineFrequency: 600,
      targetFrequency: 1600,
      triangleFrequency: 2000,
      targetLifetime: 2600,
      radarBeams: 5,
      name: "FLIGHT LEVEL 40",
      color: "yellow-400",
    },
    {
      level: 60,
      radarSpeed: 0.03,
      lineSpeed: 7,
      lineFrequency: 500,
      targetFrequency: 1400,
      triangleFrequency: 1500,
      targetLifetime: 2400,
      radarBeams: 6,
      name: "FLIGHT LEVEL 60",
      color: "orange-400",
    },
    {
      level: 80,
      radarSpeed: 0.035,
      lineSpeed: 8,
      lineFrequency: 400,
      targetFrequency: 1200,
      triangleFrequency: 1000,
      targetLifetime: 2200,
      radarBeams: 7,
      name: "FLIGHT LEVEL 80",
      color: "red-500",
    },
    {
      level: 100,
      radarSpeed: 0.04,
      lineSpeed: 9,
      lineFrequency: 300,
      targetFrequency: 1000,
      triangleFrequency: 800,
      targetLifetime: 2000,
      radarBeams: 10,
      name: "FLIGHT LEVEL 100",
      color: "purple-500",
    },
  ]

  // Detect touch device
  useEffect(() => {
    const isTouchCapable =
      "ontouchstart" in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0

    setIsTouchDevice(isTouchCapable)
    setShowTouchControls(isTouchCapable)

    // For testing on desktop
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("touch") === "true") {
      setShowTouchControls(true)
    }

    // Enable debug with URL param
    if (urlParams.get("debug") === "true") {
      setShowDebug(true)
    }
  }, [])

  // Initialize game elements
  useEffect(() => {
    if (gameAreaRef.current) {
      const { width, height } = gameAreaRef.current.getBoundingClientRect()
      const centerX = width / 2
      const centerY = height / 2

      // Set player at center
      setPlayerPosition({ x: centerX, y: centerY })
      playerPositionRef.current = { x: centerX, y: centerY }

      // Reset time to zero at start of game
      setTimeInRadar(0)
      timeInRadarRef.current = 0
      setTimeOutsideRadar(0)
      timeOutsideRadarRef.current = 0
      setTargetPoints(0)
      targetPointsRef.current = 0
      setPointsAnimations([])

      // Set joystick position for touch devices
      if (showTouchControls) {
        setTouchJoystickPosition({
          x: width / 2,
          y: height - 100, // Position near bottom of screen
        })
      }

      // Initialize with some lines
      const initialLines: Line[] = Array.from({ length: 15 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        height: 50 + Math.random() * 150,
        speed: difficultyLevel.lineSpeed,
      }))

      // Create stars (+ symbols)
      const initialStars = Array.from({ length: 12 }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
      }))

      // Initialize radar beams (each beam has 2 lines 40 degrees apart)
      const initialBeams: RadarBeam[] = [
        {
          lines: [{ angle: 0 }, { angle: RADAR_BEAM_ANGLE }],
          speed: difficultyLevel.radarSpeed,
          direction: 1,
          lastDirectionChange: Date.now(),
        },
      ]
      setRadarBeams(initialBeams)
      radarBeamsRef.current = initialBeams

      setStars(initialStars)
      setLines(initialLines)
      gameStartTime.current = Date.now()

      // Reset all other game state
      setCurrentFlightLevel(1)
      currentFlightLevelRef.current = 1
      lastLevelRef.current = 1
      lastBeamUpdateLevel.current = 1
      setTargetsCollected(0)
      setCollisionHistory([])
      nextTargetId.current = 1
      nextTriangleId.current = 1
      setRadarTargets([])
      setFlyingTriangles([])
    }

    // Start game loop
    animationRef.current = requestAnimationFrame(gameLoop)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (scoreIntervalRef.current) {
        clearInterval(scoreIntervalRef.current)
      }
    }
  }, [showTouchControls])

  // Update radar beam speeds when difficulty changes
  useEffect(() => {
    // Update radar beam speeds based on current difficulty
    setRadarBeams((prev) =>
      prev.map((beam) => ({
        ...beam,
        speed: difficultyLevel.radarSpeed,
      })),
    )

    // Update existing line speeds
    setLines((prevLines) =>
      prevLines.map((line) => ({
        ...line,
        speed: difficultyLevel.lineSpeed,
      })),
    )
  }, [difficultyLevel])

  // Check for difficulty increase
  useEffect(() => {
    const checkDifficulty = () => {
      const gameTime = (Date.now() - gameStartTime.current) / 1000 // Game time in seconds

      // Calculate current flight level based on game time
      // Level up every 10 seconds, max level 100
      const newFlightLevel = Math.min(Math.floor(gameTime / 10) + 1, 100)

      // Update current flight level
      if (newFlightLevel !== currentFlightLevelRef.current) {
        setCurrentFlightLevel(newFlightLevel)

        // Clear collected targets when level changes
        setRadarTargets((prev) => prev.filter((target) => !target.collected))

        // Clear all point animations when level changes
        setPointsAnimations([])

        // Check if we need to add a new beam (every 5 levels)
        if (Math.floor(newFlightLevel / 5) > Math.floor(lastBeamUpdateLevel.current / 5)) {
          // Calculate how many beams we should have based on level
          const baseBeams = 2 // Start with 2 beams
          const additionalBeams = Math.floor(newFlightLevel / 5)
          const totalBeams = Math.min(baseBeams + additionalBeams, 4) // Cap at 4 beams

          console.log(`Adding beam at level ${newFlightLevel}, total beams: ${totalBeams}`)

          // Get current radar dimensions
          const { centerX, centerY } = calculateRadarElements()
          updateRadarBeams(totalBeams, centerX, centerY)

          // Show a notification about the new beam
          setShowLevelUp(true)
          setTimeout(() => {
            setShowLevelUp(false)
          }, 2000)
        }

        lastBeamUpdateLevel.current = newFlightLevel
      }

      // Find the appropriate difficulty level
      let newDifficultyIndex = 0
      for (let i = 0; i < difficultyLevels.length; i++) {
        if (newFlightLevel >= difficultyLevels[i].level) {
          newDifficultyIndex = i
        } else {
          break
        }
      }

      const newDifficulty = difficultyLevels[newDifficultyIndex]

      // Only update if the level has changed
      if (newDifficulty.level !== lastLevelRef.current) {
        console.log(`Increasing to ${newDifficulty.name}`)
        setDifficultyLevel(newDifficulty)
        lastLevelRef.current = newDifficulty.level

        setShowLevelUp(true)

        // Clear all point animations when difficulty changes
        setPointsAnimations([])

        // Hide level up notification after 2 seconds
        setTimeout(() => {
          setShowLevelUp(false)
        }, 2000)
      }
    }

    const difficultyInterval = setInterval(checkDifficulty, 1000)

    return () => clearInterval(difficultyInterval)
  }, [])

  // Direct score update function - more reliable
  const updateScore = (amount: number) => {
    scoreUpdateRef.current(amount)
    currentScoreRef.current = score
  }

  // Update time in radar and score
  const updateTimeAndScore = (isInRadar: boolean, deltaTime: number) => {
    // Only update every 100ms to avoid too frequent updates
    const now = Date.now()
    if (now - lastTimeUpdateRef.current < 100) return
    lastTimeUpdateRef.current = now

    if (isInRadar) {
      // Reset time outside radar when player is back in radar
      setTimeOutsideRadar(0)

      // Increase time when in radar
      setTimeInRadar((prev) => {
        const newTime = prev + deltaTime / 100 // Use deltaTime to ensure smooth time increase
        timeInRadarRef.current = newTime

        // Add 1 point for every RADAR_TIME_REWARD time in radar (now 10 units instead of 500)
        if (Math.floor(newTime / RADAR_TIME_REWARD) > Math.floor(prev / RADAR_TIME_REWARD)) {
          setTargetPoints((prevPoints) => {
            const newPoints = prevPoints + 1
            targetPointsRef.current = newPoints

            // Show points animation for radar time bonus
            setPointsAnimations((prev) => [
              ...prev,
              {
                id: `radar-time-${Date.now()}`,
                x: playerPositionRef.current.x,
                y: playerPositionRef.current.y,
                points: 1,
                time: Date.now(),
              },
            ])

            return newPoints
          })
        }

        return newTime
      })
    } else {
      // Increase time outside radar
      setTimeOutsideRadar((prev) => {
        const newTimeOutside = prev + deltaTime
        timeOutsideRadarRef.current = newTimeOutside

        // Apply penalty if player stays outside radar too long
        if (newTimeOutside > RADAR_TIME_PENALTY_THRESHOLD && targetPointsRef.current > 0) {
          // Reset the counter to apply penalty periodically
          setTimeout(() => {
            setTimeOutsideRadar(0)
          }, 0)

          setTargetPoints((prevPoints) => {
            const newPoints = Math.max(0, prevPoints - 1)
            targetPointsRef.current = newPoints

            // Show penalty effect
            setLinePenaltyEffect({
              x: playerPositionRef.current.x,
              y: playerPositionRef.current.y,
              time: now,
            })

            return newPoints
          })
        }

        return newTimeOutside
      })

      // Decrease time when outside radar
      setTimeInRadar((prev) => {
        const newTime = Math.max(0, prev - TIME_DECAY_RATE)
        timeInRadarRef.current = newTime
        return newTime
      })
    }

    // Update score based on current time and target points
    const totalScore = targetPointsRef.current
    updateScore(totalScore)
  }

  // Handle mouse events for player movement on desktop
  useEffect(() => {
    if (showTouchControls) return // Skip for touch devices

    const handleMouseMove = (e: MouseEvent) => {
      if (gameAreaRef.current && !isGameEnding) {
        const { left, top } = gameAreaRef.current.getBoundingClientRect()
        const mouseX = e.clientX - left
        const mouseY = e.clientY - top

        // Update player position
        const newPosition = {
          x: mouseX,
          y: mouseY,
        }
        setPlayerPosition(newPosition)
        playerPositionRef.current = newPosition

        // Check for triangle hover
        for (const triangle of flyingTriangles) {
          const distance = Math.sqrt(Math.pow(mouseX - triangle.x, 2) + Math.pow(mouseY - triangle.y, 2))
          const hoverThreshold = triangle.size * 1.5 // Slightly larger than the triangle for better hover detection

          if (distance < hoverThreshold) {
            triggerGameOver("TRIANGLE COLLISION", triangle.x, triangle.y)
            return
          }
        }

        // Check for target hover
        for (const target of radarTargets) {
          if (!target.collected) {
            const distance = Math.sqrt(Math.pow(mouseX - target.x, 2) + Math.pow(mouseY - target.y, 2))
            const hoverThreshold = TARGET_SIZE / 2 + 5 // Slightly larger than the target for better hover detection

            if (distance < hoverThreshold) {
              processTargetCollection(target.id, target.points, target.x, target.y)
              return
            }
          }
        }
      }
    }

    window.addEventListener("mousemove", handleMouseMove)

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [isGameEnding, showTouchControls, flyingTriangles, radarTargets])

  // Handle touch events for virtual joystick
  useEffect(() => {
    if (!showTouchControls) return

    const handleTouchStart = (e: TouchEvent) => {
      if (joystickRef.current && !isGameEnding) {
        const touch = e.touches[0]
        const joystickRect = joystickRef.current.getBoundingClientRect()

        // Check if touch is on joystick
        if (
          touch.clientX >= joystickRect.left &&
          touch.clientX <= joystickRect.right &&
          touch.clientY >= joystickRect.top &&
          touch.clientY <= joystickRect.bottom
        ) {
          setIsJoystickActive(true)
          setTouchStartPosition({
            x: touch.clientX,
            y: touch.clientY,
          })
          e.preventDefault() // Prevent scrolling
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isJoystickActive && gameAreaRef.current && !isGameEnding) {
        const touch = e.touches[0]
        const { left, top, width, height } = gameAreaRef.current.getBoundingClientRect()

        // Calculate joystick movement (with limits)
        const deltaX = touch.clientX - touchStartPosition.x
        const deltaY = touch.clientY - touchStartPosition.y
        const maxDistance = 50 // Maximum joystick movement

        // Normalize to get direction vector
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
        const normalizedX = distance > 0 ? deltaX / distance : 0
        const normalizedY = distance > 0 ? deltaY / distance : 0

        // Apply movement with speed factor
        const speed = Math.min(distance, maxDistance) / maxDistance // 0 to 1
        const movementSpeed = 10 // Adjust for sensitivity

        // Update player position based on joystick input
        setPlayerPosition((prev) => {
          const newX = Math.max(0, Math.min(width, prev.x + normalizedX * speed * movementSpeed))
          const newY = Math.max(0, Math.min(height, prev.y + normalizedY * speed * movementSpeed))
          const newPosition = { x: newX, y: newY }
          playerPositionRef.current = newPosition
          return newPosition
        })

        e.preventDefault() // Prevent scrolling
      }
    }

    const handleTouchEnd = () => {
      setIsJoystickActive(false)
    }

    // For direct touch control (alternative control method)
    const handleDirectTouch = (e: TouchEvent) => {
      if (gameAreaRef.current && !isGameEnding && !isJoystickActive) {
        const touch = e.touches[0]
        const { left, top } = gameAreaRef.current.getBoundingClientRect()

        // Move player directly to touch position
        const newPosition = {
          x: touch.clientX - left,
          y: touch.clientY - top,
        }
        setPlayerPosition(newPosition)
        playerPositionRef.current = newPosition
      }
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: false })
    window.addEventListener("touchmove", handleTouchMove, { passive: false })
    window.addEventListener("touchend", handleTouchEnd)

    // Add direct touch control to game area
    if (gameAreaRef.current) {
      gameAreaRef.current.addEventListener("touchstart", handleDirectTouch)
      gameAreaRef.current.addEventListener("touchmove", handleDirectTouch)
    }

    return () => {
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleTouchEnd)

      if (gameAreaRef.current) {
        gameAreaRef.current.removeEventListener("touchstart", handleDirectTouch)
        gameAreaRef.current.removeEventListener("touchmove", handleDirectTouch)
      }
    }
  }, [isGameEnding, isJoystickActive, touchStartPosition, showTouchControls])

  // Trigger game over immediately
  const triggerGameOver = (message: string, x?: number, y?: number) => {
    if (isGameEndingRef.current) return // Prevent multiple triggers

    console.log(`Game over: ${message}`)
    setIsGameEnding(true)
    isGameEndingRef.current = true
    setDebugMessage(message)

    // Show collision effect if coordinates are provided
    if (x !== undefined && y !== undefined) {
      setTriangleCollisionEffect({
        x,
        y,
        time: Date.now(),
      })
    }

    // End game after a short delay to show the collision effect
    setTimeout(() => {
      gameOverRef.current()
    }, 300)
  }

  // Create a new radar target (stationary target that appears on radar)
  const createRadarTarget = (centerX: number, centerY: number, radarRadius: number): RadarTarget => {
    // Random angle and distance from center (within radar)
    const angle = Math.random() * Math.PI * 2
    const distance = Math.random() * (radarRadius * 0.8) // Keep within 80% of radar radius

    // Calculate position
    const x = centerX + Math.cos(angle) * distance
    const y = centerY + Math.sin(angle) * distance

    return {
      x,
      y,
      timeLeft: difficultyLevel.targetLifetime, // Ensure this is set from difficulty level
      collected: false,
      points: TARGET_POINTS,
      id: `target-${nextTargetId.current++}`,
    }
  }

  // Create a new flying triangle (obstacle that causes collision)
  const createFlyingTriangle = (width: number, height: number): FlyingTriangle => {
    // Determine entry point (from one of the four sides)
    const side = Math.floor(Math.random() * 4) // 0: top, 1: right, 2: bottom, 3: left

    let x, y, direction

    switch (side) {
      case 0: // top
        x = Math.random() * width
        y = -30
        direction = Math.PI / 2 + (Math.random() * 0.5 - 0.25) // Downward with slight variation
        break
      case 1: // right
        x = width + 30
        y = Math.random() * height
        direction = Math.PI + (Math.random() * 0.5 - 0.25) // Leftward with slight variation
        break
      case 2: // bottom
        x = Math.random() * width
        y = height + 30
        direction = (3 * Math.PI) / 2 + (Math.random() * 0.5 - 0.25) // Upward with slight variation
        break
      case 3: // left
        x = -30
        y = Math.random() * height
        direction = 0 + (Math.random() * 0.5 - 0.25) // Rightward with slight variation
        break
      default:
        x = -30
        y = Math.random() * height
        direction = 0
    }

    return {
      x,
      y,
      size: TRIANGLE_SIZE,
      speed: 2 + Math.random() * 3, // Random speed
      direction,
      active: true,
      id: `triangle-${nextTriangleId.current++}`,
    }
  }

  // Trigger radar failure
  const triggerRadarFailure = () => {
    const now = Date.now()

    // Check if enough time has passed since last failure
    if (now - lastRadarFailureTime.current < RADAR_FAILURE_MIN_INTERVAL) {
      console.log("Radar failure attempted but cooldown not complete")
      return
    }

    // Check if we already have a failing beam
    if (radarFailureRef.current) {
      console.log("Radar failure attempted but already have a failing beam")
      return
    }

    console.log("Radar failure triggered successfully!")

    // If we have radar beams, select one to fail
    if (radarBeams.length > 0) {
      // Select a random beam to fail
      const failingBeamIndex = Math.floor(Math.random() * radarBeams.length)

      // Create a copy of the radar beams array
      const updatedBeams = [...radarBeams]

      // Mark the selected beam as failing
      updatedBeams[failingBeamIndex] = {
        ...updatedBeams[failingBeamIndex],
        failing: true,
      }

      // Set radar failure state to true
      setRadarFailure(true)
      radarFailureRef.current = true

      // Update the beams array
      setRadarBeams(updatedBeams)
      radarBeamsRef.current = updatedBeams

      // Set radar failure effect for visual indication
      setRadarFailureEffect({
        time: now,
        duration: RADAR_FAILURE_DURATION,
        beamIndex: failingBeamIndex,
      })

      // Update the last failure time
      lastRadarFailureTime.current = now

      // End radar failure after duration
      setTimeout(() => {
        console.log("Ending radar failure")
        setRadarBeams((prev) => {
          const restored = prev.map((beam, index) => (index === failingBeamIndex ? { ...beam, failing: false } : beam))
          radarBeamsRef.current = restored
          return restored
        })
        setRadarFailureEffect(null)
        setRadarFailure(false)
        radarFailureRef.current = false
      }, RADAR_FAILURE_DURATION)
    } else {
      console.log("No radar beams to fail")
    }
  }

  // ==================== COLLISION DETECTION SYSTEM ====================

  // Check if player is near a target (detection range)
  const checkTargetDetection = () => {
    if (isGameEndingRef.current) return

    const { x: playerX, y: playerY } = playerPositionRef.current

    // Check each target for detection
    for (const target of radarTargets) {
      if (!target.collected) {
        // Calculate distance between player and target centers
        const distance = Math.sqrt(Math.pow(playerX - target.x, 2) + Math.pow(playerY - target.y, 2))

        // Detection threshold (larger than collection threshold)
        const detectionThreshold = TARGET_DETECTION_RANGE

        if (distance < detectionThreshold) {
          // Show detection indicator
          setShowTargetDetection({
            id: target.id,
            x: target.x,
            y: target.y,
            time: Date.now(),
          })

          // Hide detection indicator after 500ms
          setTimeout(() => {
            setShowTargetDetection(null)
          }, 500)

          break
        }
      }
    }
  }

  // Check if player has collected a target
  const checkTargetCollection = () => {
    if (isGameEndingRef.current) return

    const { x: playerX, y: playerY } = playerPositionRef.current

    // Check each target for collection
    for (const target of radarTargets) {
      if (!target.collected) {
        // Calculate distance between player and target centers
        const distance = Math.sqrt(Math.pow(playerX - target.x, 2) + Math.pow(playerY - target.y, 2))

        // Collection threshold (player radius + target radius)
        const collectionThreshold = PLAYER_RADIUS + TARGET_SIZE / 2

        if (distance < collectionThreshold) {
          // Log collection data
          console.log(`Target collected: ${target.id}, distance: ${distance}, threshold: ${collectionThreshold}`)

          // Add to collision history
          setCollisionHistory((prev) =>
            [
              ...prev,
              {
                playerX,
                playerY,
                objectX: target.x,
                objectY: target.y,
                distance,
                threshold: collectionThreshold,
                type: "target-collection",
                time: Date.now(),
              },
            ].slice(-10),
          )

          // Process target collection immediately
          processTargetCollection(target.id, target.points, target.x, target.y)
          return
        }
      }
    }
  }

  // Check if player is between radar lines
  const checkRadarLineCollision = (centerX: number, centerY: number, radarRadius: number) => {
    if (isGameEndingRef.current) return false

    const { x: playerX, y: playerY } = playerPositionRef.current

    // Calculate distance from center
    const distanceFromCenter = Math.sqrt(Math.pow(playerX - centerX, 2) + Math.pow(playerY - centerY, 2))

    // Only check if player is in radar but not in center safe zone
    if (distanceFromCenter <= radarRadius && distanceFromCenter > 20) {
      // Calculate player angle from center
      const playerAngle = Math.atan2(playerY - centerY, playerX - centerX)
      const normalizedPlayerAngle = playerAngle < 0 ? playerAngle + Math.PI * 2 : playerAngle

      // Check each radar beam
      for (let i = 0; i < radarBeamsRef.current.length; i++) {
        const beam = radarBeamsRef.current[i]

        // Skip collision check for failing beams
        if (beam.failing) continue

        // Get the two radar line angles
        const line1Angle = beam.lines[0].angle % (Math.PI * 2)
        const line2Angle = beam.lines[1].angle % (Math.PI * 2)

        // Normalize angles to [0, 2π)
        const normLine1 = line1Angle < 0 ? line1Angle + Math.PI * 2 : line1Angle
        const normLine2 = line2Angle < 0 ? line2Angle + Math.PI * 2 : line2Angle % (Math.PI * 2)

        // Calculate the smaller angle between the two radar lines
        let angleBetweenLines = Math.abs(normLine1 - normLine2)
        if (angleBetweenLines > Math.PI) {
          angleBetweenLines = 2 * Math.PI - angleBetweenLines
        }

        // Determine if the player is between the two lines
        let isBetweenLines = false

        // Handle the case where the lines cross the 0/2π boundary
        if (Math.abs(normLine1 - normLine2) > Math.PI) {
          // Lines cross the boundary
          if (
            normalizedPlayerAngle >= Math.max(normLine1, normLine2) ||
            normalizedPlayerAngle <= Math.min(normLine1, normLine2)
          ) {
            isBetweenLines = true
          }
        } else {
          // Lines don't cross the boundary
          const minAngle = Math.min(normLine1, normLine2)
          const maxAngle = Math.max(normLine1, normLine2)
          if (normalizedPlayerAngle >= minAngle && normalizedPlayerAngle <= maxAngle) {
            isBetweenLines = true
          }
        }

        if (isBetweenLines) {
          console.log(
            `Player between radar lines: angles=${((normLine1 * 180) / Math.PI).toFixed(1)}° / ${((normLine2 * 180) / Math.PI).toFixed(1)}°`,
          )

          // Add to collision history
          setCollisionHistory((prev) =>
            [
              ...prev,
              {
                playerX,
                playerY,
                objectX: centerX,
                objectY: centerY,
                distance: 0,
                threshold: 0,
                type: "between-radar-lines",
                time: Date.now(),
              },
            ].slice(-10),
          )

          triggerGameOver("BETWEEN RADAR LINES", centerX, centerY)
          return true
        }
      }
    }

    return false
  }

  // Check for collision with falling lines
  const checkFallingLineCollision = () => {
    if (isGameEndingRef.current) return false

    const { x: playerX, y: playerY } = playerPositionRef.current
    const now = Date.now()

    for (const line of lines) {
      // Calculate horizontal distance between line and player center
      const horizontalDistance = Math.abs(line.x - playerX)

      // Horizontal collision threshold (player width + line width)
      const horizontalThreshold = PLAYER_RADIUS + 2 // Line width is approximately 4px

      if (horizontalDistance < horizontalThreshold) {
        // Check vertical overlap
        const playerTop = playerY - PLAYER_RADIUS
        const playerBottom = playerY + PLAYER_RADIUS
        const lineTop = line.y
        const lineBottom = line.y + line.height

        // Check if there's vertical overlap
        if (playerBottom >= lineTop && playerTop <= lineBottom) {
          // Only apply penalty if enough time has passed since last penalty
          if (now - lastPenaltyTime.current > PENALTY_COOLDOWN) {
            console.log(`Line collision detected! Applying -${LINE_PENALTY} point penalty`)

            // Apply penalty to target points
            setTargetPoints((prev) => {
              const newPoints = Math.max(0, prev - LINE_PENALTY)
              targetPointsRef.current = newPoints

              // If points drop to 0, trigger game over
              if (newPoints === 0) {
                triggerGameOver("OUT OF POINTS", line.x, playerY)
              }

              return newPoints
            })

            // Update total score immediately
            const totalScore = targetPointsRef.current
            updateScore(totalScore)

            // Show penalty effect
            setLinePenaltyEffect({
              x: line.x,
              y: playerY,
              time: now,
            })

            // Set last penalty time
            lastPenaltyTime.current = now

            // Hide penalty effect after 500ms
            setTimeout(() => {
              setLinePenaltyEffect(null)
            }, 500)
          }

          return true
        }
      }
    }

    return false
  }

  // Check for collision with flying triangles
  const checkTriangleCollision = () => {
    if (isGameEndingRef.current) return false

    const { x: playerX, y: playerY } = playerPositionRef.current

    for (const triangle of flyingTriangles) {
      // Calculate distance between player center and triangle center
      const distance = Math.sqrt(Math.pow(playerX - triangle.x, 2) + Math.pow(playerY - triangle.y, 2))

      // Collision threshold based on player radius and triangle size
      const collisionThreshold = PLAYER_RADIUS + triangle.size // Use full size for better detection

      if (distance < collisionThreshold) {
        console.log(
          `Triangle collision: distance=${distance}, threshold=${collisionThreshold}, triangle=${triangle.id}`,
        )

        // Add to collision history
        setCollisionHistory((prev) =>
          [
            ...prev,
            {
              playerX,
              playerY,
              objectX: triangle.x,
              objectY: triangle.y,
              distance,
              threshold: collisionThreshold,
              type: "triangle",
              time: Date.now(),
            },
          ].slice(-10),
        )

        triggerGameOver("TRIANGLE COLLISION", triangle.x, triangle.y)
        return true
      }
    }

    return false
  }

  // Process target collection
  const processTargetCollection = (targetId: string, points: number, x: number, y: number) => {
    // Update target points
    setTargetPoints((prev) => {
      const newPoints = prev + points
      targetPointsRef.current = newPoints
      return newPoints
    })

    // Update total score
    const totalScore = targetPointsRef.current + points
    updateScore(totalScore)

    // Mark target as collected
    setRadarTargets((prev) => prev.map((target) => (target.id === targetId ? { ...target, collected: true } : target)))

    // Increment counter
    setTargetsCollected((prev) => prev + 1)

    // Show target collection effect
    setTargetCollectionEffect({
      id: targetId,
      x,
      y,
      time: Date.now(),
    })

    // Add points animation
    setPointsAnimations((prev) => [
      ...prev,
      {
        id: `target-${targetId}-${Date.now()}`,
        x,
        y,
        points,
        time: Date.now(),
      },
    ])

    // Hide collection effect after 500ms
    setTimeout(() => {
      setTargetCollectionEffect(null)
    }, 500)
  }

  // Update points animations
  const updatePointsAnimations = (timestamp: number) => {
    // Remove animations older than 1.5 seconds
    setPointsAnimations((prev) => prev.filter((animation) => timestamp - animation.time < 1500))
  }

  // Add function to update radar beams - now accepts centerX and centerY as parameters
  const updateRadarBeams = (beamCount: number, centerX: number, centerY: number) => {
    console.log(`Updating radar beams to ${beamCount} beams`)

    // Limit to maximum 4 beams
    const actualBeamCount = Math.min(beamCount, 4)

    // Create new radar beams with evenly distributed starting angles
    const newRadarBeams: RadarBeam[] = []

    // Get player angle from center
    const playerAngle = Math.atan2(playerPositionRef.current.y - centerY, playerPositionRef.current.x - centerX)

    // Normalize to [0, 2π)
    const normalizedPlayerAngle = playerAngle < 0 ? playerAngle + Math.PI * 2 : playerAngle

    for (let i = 0; i < actualBeamCount; i++) {
      // Distribute beams evenly around the circle
      const baseAngle = (i * Math.PI * 2) / actualBeamCount

      // Add a small random offset for variation (±5%)
      const randomOffset = (Math.random() * 0.1 - 0.05) * ((Math.PI * 2) / actualBeamCount)
      let startAngle = baseAngle + randomOffset

      // Check if this beam would be too close to the player
      const angleDiff = Math.abs(normalizedPlayerAngle - startAngle)
      const minAngleDiff = Math.PI / 6 // Minimum 30 degrees away from player

      // If beam is too close to player, shift it away
      if (angleDiff < minAngleDiff || angleDiff > Math.PI * 2 - minAngleDiff) {
        // Shift the angle away from player by minAngleDiff
        startAngle = normalizedPlayerAngle + minAngleDiff * 1.5 + (Math.random() * Math.PI) / 2
        // Normalize to [0, 2π)
        startAngle = startAngle % (Math.PI * 2)
      }

      // Create a beam with two lines 40 degrees apart
      newRadarBeams.push({
        lines: [{ angle: startAngle }, { angle: (startAngle + RADAR_BEAM_ANGLE) % (Math.PI * 2) }],
        speed: difficultyLevel.radarSpeed,
        direction: Math.random() < 0.5 ? 1 : -1, // Random initial direction
        lastDirectionChange: Date.now(),
      })
    }

    console.log(`Created ${newRadarBeams.length} radar beams`)

    // Completely replace the existing beams
    setRadarBeams(newRadarBeams)

    // Immediately update the ref to ensure consistency
    radarBeamsRef.current = newRadarBeams
  }

  // Game loop
  const gameLoop = (timestamp: number) => {
    if (!gameAreaRef.current || isGameEndingRef.current) {
      animationRef.current = requestAnimationFrame(gameLoop)
      return
    }

    // Calculate delta time
    const deltaTime = timestamp - lastFrameTime.current
    lastFrameTime.current = timestamp
    frameCount.current++

    // Only run collision detection every other frame for performance
    collisionCheckRef.current = !collisionCheckRef.current

    const { width, height } = gameAreaRef.current.getBoundingClientRect()
    const centerX = width / 2
    const centerY = height / 2
    const radarRadius = Math.min(width, height) * 0.4 // 40% of the smaller dimension

    // Random chance for radar failure - check every 500ms
    const now = Date.now()
    if (
      now - lastRadarFailureAttempt.current > 500 && // Only check every 500ms
      Math.random() < RADAR_FAILURE_CHANCE * currentFlightLevelRef.current &&
      !radarFailureRef.current &&
      now - lastRadarFailureTime.current > RADAR_FAILURE_MIN_INTERVAL
    ) {
      console.log("Attempting to trigger radar failure")
      lastRadarFailureAttempt.current = now
      triggerRadarFailure()
    }

    // Add new vertical lines periodically - frequency based on difficulty
    if (timestamp - lastLineTime.current > difficultyLevel.lineFrequency) {
      // Create a new line
      const newLine: Line = {
        x: Math.random() * width,
        y: -50, // Start above the screen
        height: 50 + Math.random() * 150,
        speed: difficultyLevel.lineSpeed,
      }

      setLines((prev) => [...prev, newLine])
      lastLineTime.current = timestamp
    }

    // Add new radar targets periodically
    if (timestamp - lastTargetTime.current > difficultyLevel.targetFrequency) {
      const newTarget = createRadarTarget(centerX, centerY, radarRadius)
      setRadarTargets((prev) => [...prev, newTarget])
      lastTargetTime.current = timestamp
    }

    // Add new flying triangles periodically
    if (timestamp - lastTriangleTime.current > difficultyLevel.triangleFrequency) {
      const newTriangle = createFlyingTriangle(width, height)
      setFlyingTriangles((prev) => [...prev, newTriangle])
      lastTriangleTime.current = timestamp
    }

    // Rotate radar beams - each beam rotates independently
    setRadarBeams((prev) =>
      prev.map((beam) => {
        // Random chance to change direction
        const now = Date.now()
        const shouldChangeDirection =
          Math.random() < DIRECTION_CHANGE_CHANCE && now - beam.lastDirectionChange > DIRECTION_CHANGE_COOLDOWN

        const newDirection = shouldChangeDirection ? ((beam.direction * -1) as 1 | -1) : beam.direction
        const newLastDirectionChange = shouldChangeDirection ? now : beam.lastDirectionChange

        // Update both lines in the beam
        const newLines = [
          { angle: (beam.lines[0].angle + beam.speed * newDirection) % (Math.PI * 2) },
          { angle: (beam.lines[1].angle + beam.speed * newDirection) % (Math.PI * 2) },
        ] as [{ angle: number }, { angle: number }]

        return {
          ...beam,
          lines: newLines,
          speed: beam.speed,
          direction: newDirection,
          lastDirectionChange: newLastDirectionChange,
          failing: beam.failing, // Preserve failing state
        }
      }),
    )

    // Check if player is inside radar circle
    const distanceFromCenter = Math.sqrt(
      Math.pow(playerPositionRef.current.x - centerX, 2) + Math.pow(playerPositionRef.current.y - centerY, 2),
    )
    const playerIsInRadar = distanceFromCenter <= radarRadius
    setIsInRadar(playerIsInRadar)

    // Update time and score
    updateTimeAndScore(playerIsInRadar, deltaTime)

    // Move lines - speed based on difficulty
    setLines(
      (prev) =>
        prev
          .map((line) => ({
            ...line,
            y: line.y + line.speed, // Move down at line's speed
          }))
          .filter((line) => line.y < height + 50), // Remove lines that are off-screen
    )

    // Update radar targets (decrease time left)
    setRadarTargets(
      (prev) =>
        prev
          .map((target) => ({
            ...target,
            timeLeft: target.timeLeft - deltaTime, // Use actual delta time
          }))
          .filter((target) => target.timeLeft > 0 || target.collected), // Remove expired targets that weren't collected
    )

    // Move flying triangles
    setFlyingTriangles(
      (prev) =>
        prev
          .map((triangle) => {
            // Calculate new position based on direction and speed
            const newX = triangle.x + Math.cos(triangle.direction) * triangle.speed
            const newY = triangle.y + Math.sin(triangle.direction) * triangle.speed

            // Check if triangle is still on screen (with margin)
            const isOnScreen = newX > -50 && newX < width + 50 && newY > -50 && newY < height + 50

            return {
              ...triangle,
              x: newX,
              y: newY,
              active: triangle.active && isOnScreen,
            }
          })
          .filter((triangle) => triangle.active), // Remove inactive triangles
    )

    // Update points animations
    updatePointsAnimations(timestamp)

    // Force a re-render for animated elements
    if (timestamp % 100 < 16) {
      // Approx. every 100ms
      setRadarBeams((prev) => [...prev]) // Same array but forces render update
    }

    // Run collision detection every other frame
    if (collisionCheckRef.current) {
      // Check for target detection (runs more frequently than collection)
      checkTargetDetection()

      // Check for target collection
      checkTargetCollection()

      // Check for collisions with radar lines (now checks if player is between lines)
      if (checkRadarLineCollision(centerX, centerY, radarRadius)) {
        return
      }
    }

    // Run collision detection every frame for triangles to ensure we don't miss collisions
    checkTriangleCollision()

    // Run line hover check every frame
    checkFallingLineCollision()

    animationRef.current = requestAnimationFrame(gameLoop)
  }

  const { radarRadius, centerX, centerY } = calculateRadarElements()

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString()
  }

  // Flatten radar beams for rendering
  const flattenedRadarLines = radarBeams.flatMap((beam, beamIndex) => [
    { angle: beam.lines[0].angle, beamIndex, failing: beam.failing },
    { angle: beam.lines[1].angle, beamIndex, failing: beam.failing },
  ])

  // Calculate radar failure opacity for a specific beam
  const getBeamFailureOpacity = (beamIndex: number) => {
    if (!radarFailureEffect || radarFailureEffect.beamIndex !== beamIndex) return 1

    const elapsed = Date.now() - radarFailureEffect.time
    const progress = elapsed / radarFailureEffect.duration

    // Pulse effect for failing beam
    return 0.3 + Math.sin(progress * 20) * 0.2
  }

  return (
    <div
      ref={gameAreaRef}
      className="h-screen w-full bg-blue-600 relative overflow-hidden touch-none"
      style={{ minHeight: "500px" }}
    >
      {/* Stars (+ symbols) */}
      {stars.map((star, index) => (
        <div
          key={`star-${index}`}
          className="absolute text-white opacity-50 text-sm"
          style={{
            left: `${star.x}px`,
            top: `${star.y}px`,
          }}
        >
          +
        </div>
      ))}

      {/* Radar circle */}
      <div
        className={`absolute border border-white rounded-full ${isInRadar ? "opacity-90" : "opacity-70"}`}
        style={{
          left: `${centerX - radarRadius}px`,
          top: `${centerY - radarRadius}px`,
          width: `${radarRadius * 2}px`,
          height: `${radarRadius * 2}px`,
        }}
      />

      {/* Center circle */}
      <div
        className="absolute border border-white rounded-full"
        style={{
          left: `${centerX - 20}px`,
          top: `${centerY - 20}px`,
          width: "40px",
          height: "40px",
        }}
      />

      {/* Vertical lines through center */}
      <div
        className="absolute bg-white"
        style={{
          left: `${centerX}px`,
          top: `${centerY - 30}px`,
          width: "1px",
          height: "60px",
        }}
      />

      {/* Horizontal lines through center */}
      <div
        className="absolute bg-white"
        style={{
          left: `${centerX - 30}px`,
          top: `${centerY}px`,
          width: "60px",
          height: "1px",
        }}
      />

      {/* Radar lines with curved connections */}
      <svg className="absolute left-0 top-0 w-full h-full overflow-visible" style={{ zIndex: 5 }}>
        {/* Patterns for beam areas */}
        <defs>
          <pattern id="beamPattern" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="white" strokeWidth="1" strokeOpacity="0.15" />
          </pattern>
          <radialGradient id="beamGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
        </defs>

        {/* Beam area fills */}
        {radarBeams.map((beam, beamIndex) => {
          // Get the two angles for this beam
          const angle1 = beam.lines[0].angle
          const angle2 = beam.lines[1].angle

          // Normalize angles to [0, 2π)
          const normAngle1 = angle1 < 0 ? angle1 + Math.PI * 2 : angle1 % (Math.PI * 2)
          const normAngle2 = angle2 < 0 ? angle2 + Math.PI * 2 : angle2 % (Math.PI * 2)

          // Calculate the difference between angles
          let angleDiff = Math.abs(normAngle2 - normAngle1)
          if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff
          }

          // Determine which arc to draw (shorter one)
          const largeArcFlag = angleDiff > Math.PI ? 1 : 0
          const sweepFlag = normAngle1 < normAngle2 ? 1 : 0

          // Calculate points for the sector
          const x1 = centerX
          const y1 = centerY
          const x2 = centerX + Math.cos(normAngle1) * radarRadius
          const y2 = centerY + Math.sin(normAngle1) * radarRadius
          const x3 = centerX + Math.cos(normAngle2) * radarRadius
          const y3 = centerY + Math.sin(normAngle2) * radarRadius

          // Create SVG path for sector
          const path = `M ${x1},${y1} L ${x2},${y2} A ${radarRadius} ${radarRadius} 0 ${largeArcFlag} ${sweepFlag} ${x3},${y3} Z`

          // Determine opacity based on failure state
          const beamOpacity = beam.failing ? getBeamFailureOpacity(beamIndex) : 0.7

          return (
            <g key={`beam-area-${beamIndex}`}>
              {/* Beam danger area with pattern */}
              <path
                d={path}
                fill="url(#beamPattern)"
                opacity={beamOpacity}
                className={beam.failing ? "animate-pulse" : ""}
              />

              {/* Add subtle radial gradient for visual depth */}
              <path d={path} fill="url(#beamGradient)" opacity={beam.failing ? 0.1 : 0.3} />

              {/* Small animated dots in the danger area for visual effect */}
              {Array.from({ length: 3 }).map((_, i) => {
                // Calculate random positions within the sector
                const randomAngle = normAngle1 + angleDiff * Math.random()
                const randomDist = 20 + (radarRadius - 30) * Math.random()
                const dotX = centerX + Math.cos(randomAngle) * randomDist
                const dotY = centerY + Math.sin(randomAngle) * randomDist

                return (
                  <circle
                    key={`beam-dot-${beamIndex}-${i}`}
                    cx={dotX}
                    cy={dotY}
                    r="1.5"
                    fill="white"
                    opacity={beam.failing ? 0.1 : 0.3 + (Math.sin(Date.now() / 500 + i * 2) + 1) / 4}
                  />
                )
              })}
            </g>
          )
        })}

        {/* Curved arcs between radar lines */}
        {radarBeams.map((beam, beamIndex) => {
          // Get the two angles for this beam
          const angle1 = beam.lines[0].angle
          const angle2 = beam.lines[1].angle

          // Normalize angles to [0, 2π)
          const normAngle1 = angle1 < 0 ? angle1 + Math.PI * 2 : angle1 % (Math.PI * 2)
          const normAngle2 = angle2 < 0 ? angle2 + Math.PI * 2 : angle2 % (Math.PI * 2)

          // Calculate the difference between angles
          let angleDiff = Math.abs(normAngle2 - normAngle1)
          if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff
          }

          // Determine which arc to draw (shorter one)
          const largeArcFlag = angleDiff > Math.PI ? 1 : 0
          const sweepFlag = normAngle1 < normAngle2 ? 1 : 0

          // Calculate start and end points on the radar circle
          const x1 = centerX + Math.cos(normAngle1) * radarRadius
          const y1 = centerY + Math.sin(normAngle1) * radarRadius
          const x2 = centerX + Math.cos(normAngle2) * radarRadius
          const y2 = centerY + Math.sin(normAngle2) * radarRadius

          // Determine opacity based on failure state
          const arcOpacity = beam.failing ? getBeamFailureOpacity(beamIndex) * 0.6 : 0.6

          return (
            <path
              key={`radar-arc-${beamIndex}`}
              d={`M ${x1} ${y1} A ${radarRadius} ${radarRadius} 0 ${largeArcFlag} ${sweepFlag} ${x2} ${y2}`}
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeOpacity={arcOpacity}
              strokeDasharray="5,3"
              className={beam.failing ? "animate-pulse" : ""}
            />
          )
        })}

        {/* Straight radar lines */}
        {flattenedRadarLines.map((line, index) => {
          // Determine opacity based on failure state
          const lineOpacity = line.failing ? getBeamFailureOpacity(line.beamIndex) * 0.9 : 0.9

          return (
            <line
              key={`radar-line-${index}`}
              x1={centerX}
              y1={centerY}
              x2={centerX + Math.cos(line.angle) * radarRadius}
              y2={centerY + Math.sin(line.angle) * radarRadius}
              stroke="white"
              strokeWidth="1.5"
              strokeOpacity={lineOpacity}
              className={line.failing ? "animate-pulse" : ""}
            />
          )
        })}
      </svg>

      {/* Radar failure notification - clean white notification below level label */}
      {radarFailureEffect && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 text-white bg-blue-900/70 px-3 py-1 rounded z-20">
          <div className="text-sm font-mono">BEAM {radarFailureEffect.beamIndex + 1} FAILURE</div>
        </div>
      )}

      {/* Target detection indicator */}
      <AnimatePresence>
        {showTargetDetection && (
          <motion.div
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 0.5, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute border-2 border-green-400 rounded-full z-3"
            style={{
              left: `${showTargetDetection.x - TARGET_SIZE / 2 - 10}px`,
              top: `${showTargetDetection.y - TARGET_SIZE / 2 - 10}px`,
              width: `${TARGET_SIZE + 20}px`,
              height: `${TARGET_SIZE + 20}px`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Radar targets (stationary targets that appear on radar) */}
      {radarTargets.map((target) => (
        <div
          key={target.id}
          className={`absolute rounded-full transition-all duration-300 ${
            target.collected ? "bg-white opacity-30" : "border border-white"
          }`}
          style={{
            left: `${target.x - TARGET_SIZE / 2}px`,
            top: `${target.y - TARGET_SIZE / 2}px`,
            width: `${TARGET_SIZE}px`,
            height: `${TARGET_SIZE}px`,
            zIndex: 4,
          }}
        >
          {!target.collected && (
            <>
              {/* Target crosshair */}
              <div
                className="absolute bg-white"
                style={{
                  left: "50%",
                  top: "0",
                  width: "1px",
                  height: "100%",
                  transform: "translateX(-50%)",
                }}
              />
              <div
                className="absolute bg-white"
                style={{
                  left: "0",
                  top: "50%",
                  width: "100%",
                  height: "1px",
                  transform: "translateY(-50%)",
                }}
              />

              {/* Target timer indicator */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth="4"
                  strokeDasharray="301.6"
                  strokeDashoffset={301.6 * (1 - target.timeLeft / difficultyLevel.targetLifetime)}
                  transform="rotate(-90 50 50)"
                />
              </svg>
            </>
          )}
        </div>
      ))}

      {/* Target collection effect */}
      <AnimatePresence>
        {targetCollectionEffect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 2 }}
            exit={{ opacity: 0, scale: 3 }}
            transition={{ duration: 0.5 }}
            className="absolute rounded-full border-2 border-green-400 z-20"
            style={{
              left: `${targetCollectionEffect.x - TARGET_SIZE / 2}px`,
              top: `${targetCollectionEffect.y - TARGET_SIZE / 2}px`,
              width: `${TARGET_SIZE}px`,
              height: `${TARGET_SIZE}px`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Triangle collision effect */}
      <AnimatePresence>
        {triangleCollisionEffect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute rounded-full bg-red-500 z-30"
            style={{
              left: `${triangleCollisionEffect.x - 25}px`,
              top: `${triangleCollisionEffect.y - 25}px`,
              width: "50px",
              height: "50px",
            }}
          />
        )}
      </AnimatePresence>

      {/* Hit effect */}
      <AnimatePresence>
        {hitEffect && (
          <motion.div
            initial={{ opacity: 0.8, scale: 1 }}
            animate={{ opacity: 0, scale: 3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute rounded-full bg-red-500 z-30"
            style={{
              left: `${hitEffect.x - 30}px`,
              top: `${hitEffect.y - 30}px`,
              width: "60px",
              height: "60px",
            }}
          />
        )}
      </AnimatePresence>

      {/* Line penalty effect */}
      <AnimatePresence>
        {linePenaltyEffect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute text-white font-mono font-bold text-lg z-20"
            style={{
              left: `${linePenaltyEffect.x}px`,
              top: `${linePenaltyEffect.y}px`,
              transform: "translate(-50%, -50%)",
            }}
          >
            -10
          </motion.div>
        )}
      </AnimatePresence>

      {/* Points animations */}
      {pointsAnimations.map((animation) => (
        <motion.div
          key={animation.id}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -30 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="absolute text-white font-mono font-bold text-lg z-20"
          style={{
            left: `${animation.x}px`,
            top: `${animation.y}px`,
            transform: "translate(-50%, -50%)",
          }}
        >
          +{animation.points}
        </motion.div>
      ))}

      {/* Flying triangles - now with thick white outlines */}
      {flyingTriangles.map((triangle) => {
        // Calculate triangle points based on direction
        const angle = triangle.direction
        const size = triangle.size

        // Calculate equilateral triangle points (pointing in direction of travel)
        // Using 60 degree angles for equilateral triangle
        const point1X = triangle.x + Math.cos(angle) * size
        const point1Y = triangle.y + Math.sin(angle) * size
        const point2X = triangle.x + Math.cos(angle + (2 * Math.PI) / 3) * size
        const point2Y = triangle.y + Math.sin(angle + (2 * Math.PI) / 3) * size
        const point3X = triangle.x + Math.cos(angle + (4 * Math.PI) / 3) * size
        const point3Y = triangle.y + Math.sin(angle + (4 * Math.PI) / 3) * size

        const points = `${point1X},${point1Y} ${point2X},${point2Y} ${point3X},${point3Y}`

        return (
          <svg key={triangle.id} className="absolute left-0 top-0 w-full h-full overflow-visible" style={{ zIndex: 4 }}>
            <polygon points={points} fill="none" stroke="white" strokeWidth="2" />
          </svg>
        )
      })}

      {/* Player position indicator */}
      {!isGameEnding && (
        <div
          ref={playerRef}
          className={`absolute border-2 rounded-full ${
            isInvulnerable
              ? "border-red-400 animate-pulse"
              : radarFailureEffect
                ? "border-yellow-400"
                : isInRadar
                  ? "border-green-400"
                  : "border-white"
          }`}
          style={{
            left: `${playerPosition.x - PLAYER_RADIUS}px`,
            top: `${playerPosition.y - PLAYER_RADIUS}px`,
            width: `${PLAYER_RADIUS * 2}px`,
            height: `${PLAYER_RADIUS * 2}px`,
            zIndex: 10, // Ensure player is above other elements
          }}
        />
      )}

      {/* Vertical lines (obstacles) */}
      {lines.map((line, index) => (
        <div
          key={`line-${index}`}
          className="absolute w-0.5 bg-white"
          style={{
            left: `${line.x}px`,
            top: `${line.y}px`,
            height: `${line.height}px`,
          }}
        />
      ))}

      {/* Level up notification */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`absolute top-1/4 left-0 right-0 text-center z-20 text-${difficultyLevel.color}`}
          >
            <div className="inline-block bg-blue-800/80 px-6 py-3 rounded-lg">
              <div className="text-2xl font-bold">{difficultyLevel.name}</div>
              <div className="text-sm font-mono">
                RADAR BEAMS: {Math.min(2 + Math.floor(currentFlightLevel / 5), 4)}
              </div>
              <div className="text-sm">RADAR SPEED: {(difficultyLevel.radarSpeed * 100).toFixed(1)}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Current flight level indicator */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 text-white">
        <div className="bg-blue-800/50 px-3 py-1 rounded text-center">
          <div className="text-sm font-mono">FLIGHT LEVEL {currentFlightLevel}</div>
        </div>
      </div>

      {/* Radar failure notification - clean white notification below level label */}
      {radarFailureEffect && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 text-white bg-blue-900/70 px-3 py-1 rounded z-20">
          <div className="text-sm font-mono">BEAM {radarFailureEffect.beamIndex + 1} FAILURE</div>
        </div>
      )}

      {/* Time counter - top left with new style */}
      <div className="absolute top-4 left-4 text-white">
        <div className="relative">
          {/* Curved line */}
          <div className="absolute w-full h-6 -top-4 overflow-hidden">
            <div className="w-full h-12 border-t border-white/40 rounded-[50%]"></div>
          </div>

          {/* Time value */}
          <div className="text-3xl font-mono tracking-wider">{timeInRadar.toFixed(1)}</div>

          {/* Label */}
          <div className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mt-1">TIME</div>
        </div>
      </div>

      {/* Points counter - top right with new style */}
      <div className="absolute top-4 right-4 text-white">
        <div className="relative">
          {/* Curved line */}
          <div className="absolute w-full h-6 -top-4 overflow-hidden">
            <div className="w-full h-12 border-t border-white/40 rounded-[50%]"></div>
          </div>

          {/* Points value */}
          <div className="text-3xl font-mono tracking-wider text-white">{formatNumber(targetPoints)}</div>

          {/* Label */}
          <div className="text-xs font-mono text-white/60 uppercase tracking-wider text-center mt-1">POINTS</div>
        </div>
      </div>

      {/* Pause button - moved to bottom right */}
      <button
        onClick={onPause}
        className="absolute bottom-4 right-4 z-20 text-white bg-blue-800/70 p-3 rounded-full hover:bg-blue-700"
      >
        <Pause size={showTouchControls ? 28 : 24} />
      </button>

      {/* Virtual joystick for touch devices */}
      {showTouchControls && (
        <div
          ref={joystickRef}
          className={`absolute z-20 rounded-full border-2 ${isJoystickActive ? "border-green-400" : "border-white/50"}`}
          style={{
            left: `${touchJoystickPosition.x - 40}px`,
            top: `${touchJoystickPosition.y - 40}px`,
            width: "80px",
            height: "80px",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-xs">JOYSTICK</div>
          <div
            className={`absolute rounded-full bg-white/70 ${isJoystickActive ? "opacity-80" : "opacity-50"}`}
            style={{
              left: "30px",
              top: "30px",
              width: "20px",
              height: "20px",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      )}

      {/* Touch instructions */}
      {showTouchControls && (
        <div className="absolute bottom-24 left-0 right-0 text-center text-white/70 text-sm">
          <div className="bg-blue-800/50 inline-block px-3 py-1 rounded">Tap screen or use joystick to move</div>
        </div>
      )}
    </div>
  )
}
