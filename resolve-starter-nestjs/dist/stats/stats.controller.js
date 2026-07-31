"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsController = void 0;
const common_1 = require("@nestjs/common");
const tickets_repository_1 = require("../tickets/tickets.repository");
let StatsController = class StatsController {
    constructor(tickets) {
        this.tickets = tickets;
    }
    async stats() {
        const all = await this.tickets.findAll();
        const byStatus = {};
        const byPriority = {};
        for (const t of all) {
            byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
            byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;
        }
        const resolved = all.filter((t) => t.resolvedAt !== null);
        const avgResolutionMinutes = resolved.length
            ? Math.round(resolved.reduce((sum, t) => sum +
                (new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime()) /
                    60000, 0) / resolved.length)
            : null;
        return {
            total: all.length,
            byStatus,
            byPriority,
            avgResolutionMinutes,
        };
    }
};
exports.StatsController = StatsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], StatsController.prototype, "stats", null);
exports.StatsController = StatsController = __decorate([
    (0, common_1.Controller)('stats'),
    __metadata("design:paramtypes", [tickets_repository_1.TicketsRepository])
], StatsController);
//# sourceMappingURL=stats.controller.js.map