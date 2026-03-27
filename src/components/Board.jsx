import { Stage, Layer, Circle, Line, Arc } from 'react-konva';
import { useState, useEffect } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { database } from '../firebase';

// ⚡ Board dimensions
const WIDTH = Math.min(window.innerWidth - 20, 800);
const HEIGHT = 800;
const CENTER = WIDTH / 2;

// ⚡ Radius constants
const RADIUS_NET = 40;
const RADIUS_NHZ = 100;
const RADIUS_SERVE = 260;

// ⚡ Other constants
const PLAYER_RADIUS = 20;
const BALL_RADIUS = 10;
const TRAJECTORY_LENGTH = 350; // how long each line is

export default function Board() {
  // 🏐 State for players and ball
  const [players, setPlayers] = useState([
    { id: 1, x: CENTER, y: CENTER + RADIUS_SERVE, color: 'blue' },
    { id: 2, x: CENTER + RADIUS_SERVE, y: CENTER, color: 'blue' },
    { id: 3, x: CENTER, y: CENTER - RADIUS_SERVE, color: 'red' },
    { id: 4, x: CENTER - RADIUS_SERVE, y: CENTER, color: 'red' },
  ]);

  const [ball, setBall] = useState({ x: CENTER, y: CENTER, color: 'orange' });

  // Toggle trajectory visibility
  const [showTrajectories, setShowTrajectories] = useState(false);

  // Trajectories state
  const [trajectories, setTrajectories] = useState([]);
  const [insideNetSector, setInsideNetSector] = useState(null);

  // 🖊 Handle drag end for players
  const handlePlayerDrag = (e, id) => {
    const newPlayers = players.map((p) =>
      p.id === id ? { ...p, x: e.target.x(), y: e.target.y() } : p,
    );
    setPlayers(newPlayers);

    // Update Firebase
    set(ref(database, 'board/players'), newPlayers);
  };

  // 🖊 Handle drag end for ball
  const handleBallDrag = (e) => {
    const newBall = { ...ball, x: e.target.x(), y: e.target.y() };
    setBall(newBall);
    calculateTrajectories(newBall);

    // Update Firebase
    set(ref(database, 'board/ball'), newBall);
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
      if (data) setPlayers(data);
    });

    // Listen for ball
    const ballRef = ref(database, 'board/ball');
    onValue(ballRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setBall(data);
        calculateTrajectories(data);
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
