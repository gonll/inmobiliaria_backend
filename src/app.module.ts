import { Module } from '@nestjs/common';
import { PrismaModule } from './infrastructure/db/prisma.module';
import { TenantsModule } from './modules/tenants/tenants.module';

@Module({
  imports: [PrismaModule, TenantsModule],
})
export class AppModule {}

