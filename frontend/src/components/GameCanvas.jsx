import { useEffect, useRef, useState } from 'react';

const COLORS = {
  crashed: '#e63946',
  flying: '#e63946',
  waiting: '#3498db',
};

function getMultColor(mult) {
  if (mult < 2) return '#e63946';
  if (mult < 5) return '#f39c12';
  if (mult < 10) return '#2ecc71';
  return '#9b59b6';
}

function MultBadge({ value }) {
  let cls = 'low';
  if (value >= 10) cls = 'moon';
  else if (value >= 5) cls = 'high';
  else if (value >= 2) cls = 'mid';
  return <span className={`mult-badge ${cls}`}>{value.toFixed(2)}x</span>;
}

export default function GameCanvas({ gameState }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const planeRef = useRef({ x: 0, y: 0 });
  const trailRef = useRef([]);
  const shakeRef = useRef(0);

  const { status, current_multiplier: mult = 1.0, countdown = 0 } = gameState || {};

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let frame = 0;

    function draw() {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#0d1117');
      bg.addColorStop(1, '#0a0e16');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      // Grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }

      if (status === 'waiting') {
        // Waiting screen
        drawWaiting(ctx, W, H, countdown, frame);
      } else if (status === 'flying') {
        drawFlight(ctx, W, H, mult, frame);
      } else if (status === 'crashed') {
        drawCrashed(ctx, W, H, mult, frame);
      }

      frame++;
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [status, mult, countdown]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

      {/* Multiplier overlay */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center', pointerEvents: 'none',
        animation: status === 'crashed' ? 'shake 0.4s ease' : 'none'
      }}>
        {status === 'flying' && (
          <div style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(48px, 8vw, 80px)',
            color: getMultColor(mult),
            textShadow: `0 0 30px ${getMultColor(mult)}88`,
            animation: 'glow 2s ease-in-out infinite',
            letterSpacing: 2,
          }}>
            {mult.toFixed(2)}x
          </div>
        )}
        {status === 'crashed' && (
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 900 }}>
            <div style={{ fontSize: 'clamp(16px, 3vw, 22px)', color: '#e63946', marginBottom: 4, opacity: 0.8 }}>
              FLEW AWAY
            </div>
            <div style={{
              fontSize: 'clamp(48px, 8vw, 80px)',
              color: '#e63946',
              textShadow: '0 0 30px #e6394688',
            }}>
              {mult.toFixed(2)}x
            </div>
          </div>
        )}
        {status === 'waiting' && (
          <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700 }}>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
              Next round in
            </div>
            <div style={{
              fontSize: 'clamp(40px, 7vw, 64px)',
              color: '#3498db',
              textShadow: '0 0 20px #3498db88',
              animation: 'countdown 0.5s ease',
            }}>
              {countdown}s
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
              Place your bets!
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function drawFlight(ctx, W, H, mult, frame) {
  // Progress along curve: 0 at start, increases with multiplier
  const progress = Math.min((mult - 1) / 19, 1); // normalize

  const startX = 60;
  const startY = H - 60;
  const endX = W - 80;
  const endY = 80;

  // Current plane position along curve
  const t = Math.min(progress * 1.05, 0.95);
  const cpX = startX + (endX - startX) * 0.1;
  const cpY = startY - (startY - endY) * 0.6;

  const px = (1-t)*(1-t)*startX + 2*(1-t)*t*cpX + t*t*endX;
  const py = (1-t)*(1-t)*startY + 2*(1-t)*t*cpY + t*t*endY;

  // Trail
  const grad = ctx.createLinearGradient(startX, startY, px, py);
  grad.addColorStop(0, 'rgba(230,57,70,0)');
  grad.addColorStop(0.5, 'rgba(230,57,70,0.4)');
  grad.addColorStop(1, 'rgba(230,57,70,0.8)');

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(cpX, cpY, px, py);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glow under curve
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.quadraticCurveTo(cpX, cpY, px, py);
  ctx.lineTo(px, startY);
  ctx.lineTo(startX, startY);
  const fillGrad = ctx.createLinearGradient(0, py, 0, startY);
  fillGrad.addColorStop(0, 'rgba(230,57,70,0.12)');
  fillGrad.addColorStop(1, 'rgba(230,57,70,0)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Plane angle
  const dx = 2*(1-t)*(cpX-startX) + 2*t*(endX-cpX);
  const dy = 2*(1-t)*(cpY-startY) + 2*t*(endY-cpY);
  const angle = Math.atan2(dy, dx);

  // Turbulence
  const turb = Math.sin(frame * 0.15) * 2.5 + Math.cos(frame * 0.23) * 1.5;

  drawPlane(ctx, px, py + turb, angle);
}

function drawPlane(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Plane body
  ctx.fillStyle = '#ff4d6d';
  ctx.shadowColor = '#ff4d6d';
  ctx.shadowBlur = 20;

  // Fuselage
  ctx.beginPath();
  ctx.ellipse(0, 0, 28, 9, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.lineTo(42, 0);
  ctx.lineTo(28, -5);
  ctx.closePath();
  ctx.fill();

  // Wings
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(-5, -28);
  ctx.lineTo(-20, -28);
  ctx.lineTo(-22, -8);
  ctx.closePath();
  ctx.fillStyle = '#e63946';
  ctx.fill();

  // Tail
  ctx.beginPath();
  ctx.moveTo(-22, -4);
  ctx.lineTo(-30, -16);
  ctx.lineTo(-26, -4);
  ctx.closePath();
  ctx.fillStyle = '#c1121f';
  ctx.fill();

  // Engine exhaust flame
  ctx.shadowBlur = 0;
  const flame = ctx.createRadialGradient(-32, 0, 0, -32, 0, 18);
  flame.addColorStop(0, 'rgba(255,200,50,0.9)');
  flame.addColorStop(0.4, 'rgba(255,100,20,0.6)');
  flame.addColorStop(1, 'rgba(255,50,20,0)');
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.ellipse(-36, 0, 18, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawWaiting(ctx, W, H, countdown, frame) {
  // Animated idle plane
  const px = W * 0.25 + Math.sin(frame * 0.05) * 8;
  const py = H * 0.6 + Math.cos(frame * 0.04) * 6;

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 30; i++) {
    const sx = ((i * 137 + frame * 0.2) % W);
    const sy = ((i * 97) % H);
    const r = Math.sin(frame * 0.1 + i) * 0.5 + 1;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawPlane(ctx, px, py, -0.15 + Math.sin(frame * 0.03) * 0.05);
}

function drawCrashed(ctx, W, H, mult, frame) {
  // Explosion particles
  if (frame < 30) {
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2 + frame * 0.1;
      const r = frame * 3;
      const px = W * 0.7 + Math.cos(angle) * r;
      const py = H * 0.3 + Math.sin(angle) * r;
      const alpha = Math.max(0, 1 - frame / 30);
      ctx.fillStyle = `rgba(230,57,70,${alpha * 0.8})`;
      ctx.beginPath();
      ctx.arc(px, py, 4 - frame * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}