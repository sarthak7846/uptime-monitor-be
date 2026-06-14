import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserService } from './user.service';
import { UserDto } from './dto/user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('all')
  async findAll() {
    const users = await this.userService.findAll();
    return users;
  }

  @Post()
  async createUser(@Body() userDto: UserDto) {
    const res = await this.userService.createUser(userDto);
    return res;
  }

  @Patch(':id')
  async updateUser(@Param('id') userId: string, @Body() updateUserDto: UpdateUserDto) {
    try {
      const res = await this.userService.updateUser(userId, updateUserDto);
      return res;
    } catch (error) {
      console.log('Unable to update user', error);
    }
  }

  @Delete(':id')
  async deleteUser(@Param('id') userId: string) {
    const res = await this.userService.deleteUser(userId);
    return res;
  }
}
