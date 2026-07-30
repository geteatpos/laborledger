import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException
} from "@nestjs/common";
import * as argon2 from "argon2";
import type { Employee, PrismaClient } from "@prisma/client";

const PIN_PATTERN = /^\d{6}$/u;

export type FieldEmployeeAuth = {
  companyId: string;
  pin?: string;
  employeeId?: string;
};

export async function resolveEmployeeById(
  prisma: PrismaClient,
  companyId: string,
  employeeId: string
): Promise<Employee> {
  const id = employeeId?.trim() ?? "";
  if (!id) {
    throw new BadRequestException("Employee is required.");
  }

  const employee = await prisma.employee.findFirst({
    where: {
      id,
      companyId,
      archivedAt: null
    }
  });

  if (!employee) {
    throw new NotFoundException("Employee not found for this company.");
  }

  return employee;
}

export async function resolveEmployeeByPin(
  prisma: PrismaClient,
  companyId: string,
  pin: string
): Promise<Employee> {
  if (!PIN_PATTERN.test(pin ?? "")) {
    throw new BadRequestException("Employee PIN must be exactly 6 digits.");
  }

  const credentials = await prisma.employeePinCredential.findMany({
    where: {
      companyId,
      revokedAt: null,
      employee: {
        archivedAt: null
      }
    },
    include: {
      employee: true
    }
  });

  for (const credential of credentials) {
    const matches = await argon2.verify(credential.pinHash, pin);
    if (matches) {
      if (credential.employee.companyId !== companyId) {
        throw new ForbiddenException("Employee does not belong to this company.");
      }

      return credential.employee;
    }
  }

  throw new UnauthorizedException("PIN is invalid for this company.");
}

/** Prefer explicit employeeId (mobile Bearer session); otherwise authenticate via PIN (kiosk/field PWA). */
export async function resolveFieldEmployee(
  prisma: PrismaClient,
  input: FieldEmployeeAuth
): Promise<Employee> {
  const companyId = input.companyId?.trim() ?? "";
  if (!companyId) {
    throw new BadRequestException("Company is required.");
  }

  const employeeId = input.employeeId?.trim() ?? "";
  if (employeeId) {
    return resolveEmployeeById(prisma, companyId, employeeId);
  }

  return resolveEmployeeByPin(prisma, companyId, input.pin ?? "");
}
