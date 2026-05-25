# Location Box Fit

A warehouse shelf and pallet box-fitting visualiser built with React, TypeScript, Vite, Tailwind CSS, React Three Fiber, Three.js, and Drei.

Location Box Fit helps you answer a practical warehouse question:

> Given this location size and this box size, what is the best way to rotate and stack the boxes so I get the maximum capacity?

The app calculates the best orientation, shows the fitted boxes inside a 3D wireframe location, and labels the dimensions so the user can understand how to physically place the box.

## Features

- Create, select, and delete saved storage locations.
- Locations are persisted in `localStorage`.
- Enter location dimensions in centimeters, including decimal values.
- Enter box dimensions in centimeters, including decimal values.
- Enter units per box to calculate total stored units.
- Automatically tests all 6 box orientations.
- Selects the orientation with the highest capacity.
- Uses loaded volume as a tie-breaker when capacities match.
- Centers the fitted stack across the shelf/pallet footprint.
- Displays a 3D wireframe of the full location volume.
- Displays yellow fitted boxes using real fitted dimensions.
- Shows unused location space when boxes cannot occupy the full volume.
- Adds dimension callouts for both the location and the fitted reference box.
- Supports pallet visuals when the location name starts with `pallet`.
- Responsive dashboard layout for desktop and mobile.

## How The Fit Calculation Works

The box can be rotated, so the app checks all possible orientations:

```ts
width, depth, height
width, height, depth
depth, width, height
depth, height, width
height, width, depth
height, depth, width
```

For each orientation, it calculates:

```ts
boxesAcrossWidth = Math.floor(locationWidth / orientedBoxWidth)
boxesAcrossDepth = Math.floor(locationDepth / orientedBoxDepth)
boxesAcrossHeight = Math.floor(locationHeight / orientedBoxHeight)
totalCapacity = boxesAcrossWidth * boxesAcrossDepth * boxesAcrossHeight
```

The orientation with the highest `totalCapacity` wins.

If two orientations fit the same number of boxes, the app chooses the one that uses more physical volume.

## Pallet Mode

If a location name starts with `pallet`, for example:

```txt
Pallet A
pallet 120x100
```

the 3D viewport draws a pallet underneath the location wireframe.

The location dimensions still start from the top of the pallet. The pallet is visual only and does not change the fit calculation.

## Units

All dimensions are centimeters:

- Location width/depth/height: `cm`
- Box width/depth/height: `cm`
- Volume values: `cm3`

Decimals are supported for location and box dimensions, for example:

```txt
45.5
120.25
59.8
```

On mobile, each dimension field includes a `.` button so decimal values can be entered even if the keyboard does not show a decimal key.

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run lint checks:

```bash
npm run lint
```

## Project Structure

```txt
src/
  components/
    BoxForm.tsx
    BoxMesh.tsx
    LocationForm.tsx
    LocationSelector.tsx
    ResultsPanel.tsx
    ShelfMesh.tsx
    ThreeDViewer.tsx
  hooks/
    useLocalStorage.ts
  types/
    index.ts
  utils/
    fitCalculator.ts
  App.tsx
  main.tsx
  styles.css
```

## Tech Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- Three.js
- React Three Fiber
- Drei
- LocalStorage

## Notes

The 3D view is a placement visualiser, not a physics simulation. It shows the selected best-fit orientation, the full location wireframe, and the boxes that fit using the calculated orientation.

If the box dimensions do not divide evenly into the location dimensions, the remaining empty space stays visible inside the wireframe. That is expected: partial boxes are not counted.

## License

No license has been specified yet.
