# mario — Super Mario 3D (Three.js)

Playable 3D platformer built with Three.js + Blender-generated Mario model.

**Play:** https://zeshanxviii.github.io/mario/ or run locally `python3 -m http.server 8000` then open `http://localhost:8000`.

## Controls
- **Desktop:** WASD/Arrows move (camera-relative), SPACE jump, SHIFT run, Q/E orbit, C camera, R restart, P pause, M mute
- **Mobile:** Left joystick move, RUN (hold) + JUMP, CAM strip / 1-finger drag to orbit, ⏸ pause. Best in landscape.

## Features
- Blender Mario (`assets/mario.glb` 920KB, 29 meshes) + procedural platforms/coins/goombas
- Physics: gravity, coyote-time + jump-buffer + variable jump, AABB collisions, max speed clamp
- 9 platforms, 16 coins, 4 goombas (stomp), water hazard, fog, shadows, particles

## Dev
```bash
git clone https://github.com/Zeshanxviii/mario.git
cd mario
python3 -m http.server 8000
```
No build step — static files via CDN `three@0.160.0`.

## Deploy (GitHub Pages)
Push to `main`, enable Pages → Source: main / root.
