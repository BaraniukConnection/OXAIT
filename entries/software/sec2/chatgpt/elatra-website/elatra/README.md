# Elatra — E-Alpha

An offline product showcase based on the supplied phone and logo references.

## Open locally

Unzip the folder, then double-click **index.html**. Keep the assets and vendor folders beside it. No install, build step, internet connection or account is required. Use a recent browser with WebGL enabled.

If your browser restricts local pages, open a terminal in this folder and run:

    python3 -m http.server 8080

On Windows, you can use `py -m http.server 8080` instead. Then visit http://localhost:8080 .

## Explore

- Scroll to rotate the phone, separate its modules and assemble an upgraded configuration.
- In the final scene, choose Everyday, Creator or Performance. Drag the phone horizontally to rotate it.
- Select a module row to read about it and open its 3D configuration.
- Open the original design study for the complete supplied reference.
- Use Reduce motion for discrete scene changes. The system reduced-motion preference is also respected.

## Files

- index.html — page and content
- style.css — responsive visual design
- app.js — procedural Three.js model, scroll sequence and interactions
- assets/ — original user-supplied phone and logo references
- vendor/three.min.js — locally bundled Three.js 0.160.1 (MIT)

This is a design concept, not a product ordering website. The 3D model is a procedural interpretation of the supplied image, not manufacturer CAD. Module descriptions follow the supplied concept; there are no live services, analytics, forms or purchases.
