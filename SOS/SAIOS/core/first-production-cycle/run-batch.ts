#!/usr/bin/env tsx
/**
 * Canonical batch CLI — Agent #209 / #213.
 * Production entry delegates to ProductionController (do not call BatchRunner directly).
 *
 * Usage:
 *   npm run aios:batch:run
 *   npm run aios:batch:run -- --size 3 --mock
 */
import "./run-controller.js";
