import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';
import { join } from 'path';

async function bootstrap() {
  // Asegurar que el directorio de datos para SQLite exista
  const dataDir = join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Directorio de datos creado en: ${dataDir}`);
  }

  const app = await NestFactory.create(AppModule);

  // Configuración de CORS para desarrollo
  app.enableCors({
    origin: true, // Permitir cualquier origen en desarrollo
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // ValidationPipe Global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Interceptor Global para la Serialización (excluir campos sensibles)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Configuración de Swagger (OpenAPI)
  const config = new DocumentBuilder()
    .setTitle('MasterHelp API')
    .setDescription('Documentación de la API para la aplicación MasterHelp')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000, '0.0.0.0'); // Escuchar en todas las interfaces de red
  console.log(`Application is running on: ${await app.getUrl()}`);
  console.log(`Swagger UI is running on: ${await app.getUrl()}/api`);
}
bootstrap();