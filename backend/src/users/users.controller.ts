import { Controller, Get, Param, ParseIntPipe, Delete, UseGuards, Request, HttpCode } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  // 2. Aplicar el pipe y cambiar el tipo a number
  findOne(@Param('id', ParseIntPipe) id: number) { 
    // 3. Ya no se necesita la conversión manual con '+'
    return this.usersService.findOne(id);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async deleteMe(@Request() req) {
    await this.usersService.deleteById(req.user.userId);
  }
}