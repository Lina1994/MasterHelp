import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common'; // 1. Importar ParseIntPipe
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
}