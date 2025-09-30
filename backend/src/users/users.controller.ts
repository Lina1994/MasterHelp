import { Controller, Get, Param, ParseIntPipe, Delete, UseGuards, Request, HttpCode, Patch, Body } from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto';
  @Patch('me/preferences')
  @UseGuards(JwtAuthGuard)
  async updatePreferences(@Request() req, @Body() body: { language?: string; theme?: string }) {
    // Solo actualiza idioma y tema
    return this.usersService.updatePreferences(req.user.userId, body.language, body.theme);
  }
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}


  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@Request() req) {
    // req.user.userId viene del JWT
    return this.usersService.findOne(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteMe(@Request() req) {
    await this.usersService.deleteById(req.user.userId);
  }
}