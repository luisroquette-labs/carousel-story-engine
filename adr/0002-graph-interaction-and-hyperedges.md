# ADR 0002: Graph interaction and hyperedge geometry

## Context

The graph report uses vis-network for node interactions and a canvas callback for hyperedges. The canvas context passed to `afterDrawing` is already transformed to network coordinates. Node order in a hyperedge is arbitrary, so tracing that order can self-intersect.

## Decision

Track the hovered node for click selection and use the event's node list as a second path. Compute a convex hull of node positions before drawing a hyperedge; expand it around the centroid. Degenerate groups remain a segment instead of a crossed region. Use positions directly without applying pan, zoom or device-pixel transforms again.

## Consequence

The region must remain stable as the network moves or scales. Generator changes need visual or geometry checks for nonconvex node order, collinear points and duplicate positions.
