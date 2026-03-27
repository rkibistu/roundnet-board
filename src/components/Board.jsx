import { Stage, Layer, Circle, Line, Arc } from 'react-konva';
import { useState, useEffect } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase';

// ⚡ Board dimensions
const WIDTH = Math.min(window.innerWidth - 20, 800);
const HEIGHT = WIDTH;
const CENTER = WIDTH / 2;

const RADIUS_NET = WIDTH * 0.05; // 5% of width
const RADIUS_NHZ = WIDTH * 0.125; // 12.5% of width
const RADIUS_SERVE = WIDTH * 0.325; // 32.5% of width
const PLAYER_RADIUS = WIDTH * 0.025; // 2.5% of width
const BALL_RADIUS = WIDTH * 0.0125; // 1.25% of width
const TRAJECTORY_LENGTH = WIDTH * 0.4375; // 43.75% of width

const INITIAL_PLAYERS = [
  { id: 1, x: CENTER, y: CENTER + RADIUS_SERVE, color: 'blue' },
  { id: 2, x: CENTER + RADIUS_SERVE, y: CENTER, color: 'blue' },
  { id: 3, x: CENTER, y: CENTER - RADIUS_SERVE, color: 'red' },
  { id: 4, x: CENTER - RADIUS_SERVE, y: CENTER, color: 'red' },
];

const INITIAL_BALL = { x: CENTER, y: CENTER, color: 'orange' };

export default function Board() {
  // 🏐 State for players and ball
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  const [ball, setBall] = useState(INITIAL_BALL);

  // Toggle trajectory visibility
  const [showTrajectories, setShowTrajectories] = useState(false);

  // Trajectories state
  const [trajectories, setTrajectories] = useState([]);
  const [insideNetSector, setInsideNetSector] = useState(null);

  const handleReset = () => {
    // Reset locally
    setPlayers(INITIAL_PLAYERS);
    setBall(INITIAL_BALL);
    calculateTrajectories(INITIAL_BALL);

    // Reset in Firebase (normalize to 0-1 range)
    const normalizedPlayers = INITIAL_PLAYERS.map((p) => ({
      ...p,
      x: p.x / WIDTH,
      y: p.y / HEIGHT,
    }));

    const normalizedBall = {
      x: INITIAL_BALL.x / WIDTH,
      y: INITIAL_BALL.y / HEIGHT,
      color: INITIAL_BALL.color,
    };

    set(ref(database, 'board/players'), normalizedPlayers);
    set(ref(database, 'board/ball'), normalizedBall);
  };

  // 🖊 Handle drag end for players
  const handlePlayerDrag = (e, id) => {
    const newPlayers = players.map((p) =>
      p.id === id ? { ...p, x: e.target.x(), y: e.target.y() } : p,
    );
    setPlayers(newPlayers);

    // Update Firebase
    const normalizedPlayers = newPlayers.map((p) => ({
      ...p,
      x: p.x / WIDTH,
      y: p.y / HEIGHT,
    }));
    set(ref(database, 'board/players'), normalizedPlayers);
  };

  // 🖊 Handle drag end for ball
  const handleBallDrag = (e) => {
    const newBall = { ...ball, x: e.target.x(), y: e.target.y() };
    setBall(newBall);
    calculateTrajectories(newBall);

    // Update Firebase
    const normalizedBall = {
      x: newBall.x / WIDTH,
      y: newBall.y / HEIGHT,
      color: newBall.color,
    };
    set(ref(database, 'board/ball'), normalizedBall);
  };

  // ⚡ Calculate trajectories and inside-net sector when ball moves
  const calculateTrajectories = (ballPosition) => {
    const { x: Bx, y: By } = ballPosition;
    const Cx = CENTER;
    const Cy = CENTER;
    const R = RADIUS_NET;

    const dx = Bx - Cx;
    const dy = By - Cy;
    const d = Math.sqrt(dx * dx + dy * dy);

    // Tangent trajectories
    let tangents = [];
    if (d > R) {
      const theta = Math.atan2(dy, dx);
      const alpha = Math.asin(R / d);
      const angles = [theta + alpha, theta - alpha];

      tangents = angles.map((angle) => ({
        x1: Bx,
        y1: By,
        x2: Bx - TRAJECTORY_LENGTH * Math.cos(angle),
        y2: By - TRAJECTORY_LENGTH * Math.sin(angle),
      }));
    }

    // Inside-net sector
    let sector = null;
    if (d < 1) {
      // Ball is at the center → full 360° sector
      sector = {
        x: Bx,
        y: By,
        innerRadius: 0,
        outerRadius: TRAJECTORY_LENGTH,
        rotation: 0,
        angle: 360,
        fill: 'rgba(255,165,0,0.2)',
      };
    } else if (d <= R) {
      // Ball somewhere inside net → limited sector
      const theta = Math.atan2(dy, dx);

      let alpha = Math.acos(Math.min(d / R, 1)); // safe
      alpha = Math.max(alpha, Math.PI / 4); // minimum 45°
      alpha *= 1.7; // scale factor

      const deg = (rad) => (rad * 180) / Math.PI;

      sector = {
        x: Bx,
        y: By,
        innerRadius: 0,
        outerRadius: TRAJECTORY_LENGTH,
        rotation: deg(theta - alpha) + 180,
        angle: deg(2 * alpha),
        fill: 'rgba(255,165,0,0.2)',
      };
    }

    setTrajectories(tangents);
    setInsideNetSector(sector);
  };

  // ⚡ Initial calculation
  useEffect(() => {
    calculateTrajectories(ball);
  }, []);

  useEffect(() => {
    // Listen for players
    const playersRef = ref(database, 'board/players');
    onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const scaledPlayers = data.map((p) => ({
          ...p,
          x: p.x * WIDTH,
          y: p.y * HEIGHT,
        }));
        setPlayers(scaledPlayers);
      }
    });

    // Listen for ball
    const ballRef = ref(database, 'board/ball');
    onValue(ballRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const scaledBall = { ...data, x: data.x * WIDTH, y: data.y * HEIGHT };
        setBall(scaledBall);
        calculateTrajectories(scaledBall);
      }
    });
  }, []);

  return (
    <div style={{ textAlign: 'center' }}>
      {/* Toggle button */}
      <button
        onClick={() => setShowTrajectories(!showTrajectories)}
        style={{ margin: '10px', padding: '5px 10px', fontSize: '16px' }}
      >
        {showTrajectories ? 'Hide Trajectories' : 'Show Trajectories'}
      </button>

      {/* Reset button */}
      <button
        onClick={handleReset}
        style={{ margin: '10px', padding: '5px 10px', fontSize: '16px' }}
      >
        Reset Board
      </button>

      {/* Stage */}
      <Stage width={WIDTH} height={HEIGHT} style={{ border: '1px solid #ccc' }}>
        <Layer>
          {/* Field */}
          <Circle x={CENTER} y={CENTER} radius={RADIUS_NET} stroke="black" strokeWidth={3} />
          <Circle x={CENTER} y={CENTER} radius={RADIUS_NHZ} stroke="red" dash={[10, 5]} />
          <Circle x={CENTER} y={CENTER} radius={RADIUS_SERVE} stroke="green" />

          {/* Players */}
          {players.map((p) => (
            <Circle
              key={p.id}
              x={p.x}
              y={p.y}
              radius={PLAYER_RADIUS}
              fill={p.color}
              draggable
              onDragEnd={(e) => handlePlayerDrag(e, p.id)}
            />
          ))}

          {/* Ball */}
          <Circle
            x={ball.x}
            y={ball.y}
            radius={BALL_RADIUS}
            fill={ball.color}
            draggable
            onDragEnd={handleBallDrag}
          />

          {/* Trajectories */}
          {showTrajectories &&
            trajectories.map((t, idx) => (
              <Line
                key={idx}
                points={[t.x1, t.y1, t.x2, t.y2]}
                stroke="orange"
                strokeWidth={2}
                dash={[5, 5]}
                listening={false}
              />
            ))}

          {/* Inside-net sector */}
          {showTrajectories && insideNetSector && <Arc {...insideNetSector} listening={false} />}
        </Layer>
      </Stage>
    </div>
  );
}
