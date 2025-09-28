import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { join } from 'path';

// Define la ruta para el archivo de la base de datos SQLite
// Puedes cambiar 'dm_app.db' por el nombre que desees
const databasePath = join(__dirname, '..', '..', 'data', 'dm_app.db');

// Asegúrate de que el directorio 'data' exista o créalo
import { promises as fsPromises } from 'fs';
import { dirname } from 'path';

const ensureDirectoryExists = async (filePath: string) => {
  const dir = dirname(filePath);
  try {
    await fsPromises.access(dir);
  } catch {
    await fsPromises.mkdir(dir, { recursive: true });
  }
};

// Llama a la función para asegurar el directorio (opcional, se puede hacer al iniciar la app)
ensureDirectoryExists(databasePath).catch(console.error);

export const typeOrmConfig: TypeOrmModuleOptions = {
  type: 'sqlite', // Cambia a 'sqlite'
  database: databasePath, // Ruta al archivo de la base de datos
  entities: [User], // Tus entidades TypeORM
  synchronize: true, // Cuidado en producción, usar migraciones
  logging: false,
  // No se necesitan host, port, username, password para SQLite
};