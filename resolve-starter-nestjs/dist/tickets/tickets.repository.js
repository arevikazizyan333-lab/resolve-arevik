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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TicketsRepository = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const ticket_entity_1 = require("./ticket.entity");
let TicketsRepository = class TicketsRepository {
    constructor(repo) {
        this.repo = repo;
    }
    async findAll(filter = {}) {
        const where = {};
        if (filter.status)
            where.status = filter.status;
        if (filter.priority)
            where.priority = filter.priority;
        const tickets = await this.repo.find({ where, order: { createdAt: 'ASC' } });
        tickets.forEach((t) => this.sortComments(t));
        return tickets;
    }
    async findById(id) {
        const ticket = await this.repo.findOne({ where: { id } });
        if (ticket)
            this.sortComments(ticket);
        return ticket;
    }
    async save(ticket) {
        ticket.updatedAt = new Date().toISOString();
        const saved = await this.repo.save(ticket);
        this.sortComments(saved);
        return saved;
    }
    sortComments(ticket) {
        ticket.comments?.sort((a, b) => a.seq - b.seq);
    }
};
exports.TicketsRepository = TicketsRepository;
exports.TicketsRepository = TicketsRepository = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(ticket_entity_1.Ticket)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TicketsRepository);
//# sourceMappingURL=tickets.repository.js.map