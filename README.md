# ALAMIN APEX RIDE — 3D Edition

A mobile-first 3D endless motorcycle traffic-racing game built with Three.js. The project is designed for GitHub Pages and includes ALAMIN's supplied portrait and character-reference image.

## What is included

- Real-time 3D scene with a chase camera and a turntable-style garage view.
- Procedurally modeled sport motorcycle with fairings, tank, seat, front/rear wheels, rims, brake details, forks, exhaust, lights, mirrors, and ALAMIN marks.
- Articulated rider made from a named bone hierarchy and smooth, overlapping body meshes; includes a forward riding pose and subtle riding/lean animation.
- 3D traffic cars with shaped cabin/body volumes, wheels, windows, lights, mirrors, and bumpers.
- Three selectable route moods: Coastal, Alpine, and Midnight.
- Mobile touch steering, nitro, brake, keyboard controls, pause/resume, collision detection, score, coins, best score, and local save data.
- Garage paint choices, player profile, supplied portrait, and ALAMIN identity UI.

## Important character/model note

The in-game rider is a procedural, bone-driven articulated 3D character. It is not a scanned or photogrammetry-quality digital double, and its 3D face is a stylized approximation. ALAMIN's actual supplied portrait is used in the menu and profile so the game clearly carries the creator's identity. The rider's body parts are attached to named bones and animated procedurally; it is not a motion-captured, single-surface skinned character exported from Blender/Mixamo.

The motorcycle and traffic vehicles are custom procedural Three.js meshes, not imported commercial motorcycle/car models. They are coherent game-ready stylized models, rather than manufacturer-accurate CAD replicas. This avoids the previous distorted face-on-sphere and cardboard-box placeholder approach, but does not claim photorealistic asset quality.

## Run locally

This project uses Three.js 0.170.0 from jsDelivr, with an Unpkg fallback. An internet connection is required to load the 3D engine.

Because browsers restrict JavaScript modules on `file://`, run it through a local web server:

### Python

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser from the project folder.

### Node (optional)

```bash
npx serve .
```

## Publish on GitHub Pages

1. Extract the ZIP.
2. Open the `ALAMIN_APEX_RIDE_3D` folder.
3. Upload **the contents of this folder** (not the containing folder) to the root of your GitHub repository. Keep `index.html`, `src/`, and `assets/` together.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select branch `main` and folder `/ (root)`, then Save.
7. Open the published Pages URL after deployment completes.

## Controls

### Mobile

- `‹` / `›`: steer between lanes.
- `NITRO`: accelerate temporarily.
- `BRAKE`: slow down.
- `Ⅱ`: pause.
- In Garage, drag on the 3D view to rotate the motorcycle.

### Desktop

- `A` / `D` or `←` / `→`: steer.
- `Space`: nitro.
- `↓`: brake.
- `Esc`: pause/resume.
- In Garage, drag to rotate the motorcycle.

## Project layout

```text
ALAMIN_APEX_RIDE_3D/
├── index.html
├── README.md
├── CREDITS.md
├── src/
│   └── main.js
└── assets/
    ├── alamin_portrait.png
    ├── alamin_character_reference.png
    └── alamin_face_reference.png
```

## Verification performed

- JavaScript syntax check (`node --check src/main.js`) passed.
- File paths and included image assets were checked when packaging.
- A live WebGL browser run was not available in the build container because it could not reach public CDNs. The game therefore still needs a visual play-test after the project is opened on GitHub Pages or another internet-connected web server.
