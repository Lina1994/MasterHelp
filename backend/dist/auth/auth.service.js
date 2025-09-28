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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const bcrypt = require("bcrypt");
const user_entity_1 = require("../users/entities/user.entity");
let AuthService = class AuthService {
    constructor(usersRepository, jwtService) {
        this.usersRepository = usersRepository;
        this.jwtService = jwtService;
    }
    async register(registerDto) {
        const { username, email, password } = registerDto;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new user_entity_1.User();
        user.username = username;
        user.email = email;
        user.password = hashedPassword;
        try {
            await this.usersRepository.save(user);
            return { message: 'User registered successfully' };
        }
        catch (error) {
            if (error.code === '23505') {
                throw new common_1.UnauthorizedException('Username or email already exists');
            }
            throw error;
        }
    }
    async login(loginDto) {
        const { username, password } = loginDto;
        const user = await this.usersRepository.findOne({ where: { username } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new common_1.UnauthorizedException('Invalid credentials');
        }
        const payload = { username: user.username, sub: user.id };
        const access_token = this.jwtService.sign(payload);
        return { access_token };
    }
    async forgotPassword(email) {
        const user = await this.usersRepository.findOne({ where: { email } });
        if (!user) {
            return { message: 'If the email exists, a reset link has been sent.' };
        }
        const resetToken = this.jwtService.sign({ sub: user.id, email: user.email }, { expiresIn: '1h' });
        console.log(`Forgot password requested for: ${email}`);
        console.log(`Reset token (simulated email): ${resetToken}`);
        return { message: 'If the email exists, a reset link has been sent.' };
    }
    async resetPassword(token, newPassword) {
        try {
            const decoded = this.jwtService.verify(token);
            const user = await this.usersRepository.findOne({ where: { id: decoded.sub } });
            if (!user) {
                throw new common_1.NotFoundException('User not found');
            }
            if (user.email !== decoded.email) {
                throw new common_1.UnauthorizedException('Invalid token');
            }
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            user.password = hashedNewPassword;
            await this.usersRepository.save(user);
            return { message: 'Password has been reset successfully' };
        }
        catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new common_1.UnauthorizedException('Token has expired');
            }
            throw new common_1.UnauthorizedException('Invalid token');
        }
    }
    async changePassword(userId, currentPassword, newPassword) {
        const user = await this.usersRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isCurrentPasswordValid) {
            throw new common_1.UnauthorizedException('Current password is incorrect');
        }
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedNewPassword;
        await this.usersRepository.save(user);
        return { message: 'Password has been changed successfully' };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map