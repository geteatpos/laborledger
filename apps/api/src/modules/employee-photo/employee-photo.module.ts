import { Module } from "@nestjs/common";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { GroupAccessService } from "../identity-access/group-access.service";
import { PrismaService } from "../identity-access/prisma.service";
import { EmployeePhotoStorageService } from "./employee-photo-storage.service";
import { EmployeePhotoService } from "./employee-photo.service";

@Module({
  providers: [
    PrismaService,
    CompanyScopeService,
    GroupAccessService,
    EmployeePhotoStorageService,
    EmployeePhotoService
  ],
  exports: [EmployeePhotoStorageService, EmployeePhotoService]
})
export class EmployeePhotoModule {}
