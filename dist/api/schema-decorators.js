"use strict";
/**
 * No-op decorators used as statically readable schema annotations.
 *
 * `embabel-build-manifest` reads these decorator calls from the TypeScript AST and writes
 * their metadata into `dist/manifest.json`. JavaScript still emits decorator calls, so the
 * compiled realm keeps these tiny local implementations available at runtime as well.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Node = Node;
exports.Id = Id;
exports.Property = Property;
exports.Relationship = Relationship;
exports.VirtualJoin = VirtualJoin;
exports.Retrieval = Retrieval;
function Node(_spec = {}) {
    return () => undefined;
}
function Id() {
    return () => undefined;
}
function Property(_spec) {
    return () => undefined;
}
function Relationship(_spec) {
    return () => undefined;
}
function VirtualJoin(_spec) {
    return () => undefined;
}
function Retrieval(_spec) {
    return () => undefined;
}
