# ADR 0001: Neighbor links in the graph report

## Context

The generated graph report renders node labels and identifiers from documents and scraped URLs into `innerHTML`. An identifier can contain a double quote. An earlier inline `onclick` interpolation broke links and allowed a stored event-handler injection in the local report (Graphify #1838).

## Decision

Escape the identifier when placing it in `data-nid`, and use one click listener on `document` to read the attribute and focus the node. Keep the listener above the dynamic `#neighbors-list` subtree so rebuilding that subtree does not remove the handler.

## Consequence

The graph generator must preserve escaping for every untrusted value interpolated into markup. Changes to link rendering need a malicious-identifier regression check. This ADR records the decision visible in the generated `graphify-out/graph.html`; the producer of that artifact is Graphify.
