"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.newId = newId;
const crypto_1 = require("crypto");
function newId(prefix) {
    return `${prefix}_${(0, crypto_1.randomUUID)().slice(0, 8)}`;
}
//# sourceMappingURL=ids.js.map