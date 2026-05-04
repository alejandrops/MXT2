// @ts-nocheck · pre-existing TS errors · scheduled for cleanup post-Prisma decision
// ═══════════════════════════════════════════════════════════════
//  Users queries · backoffice (B1)
// ═══════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export interface UserListRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string | null;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED";
  accountId: string | null;
  accountName: string | null;
  profileId: string;
  profileSystemKey: "SUPER_ADMIN" | "MAXTRACKER_ADMIN" | "CLIENT_ADMIN" | "OPERATOR";
  profileLabel: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserListParams {
  search?: string | null;
  accountId?: string | null;
  profileSystemKey?: string | null;
  status?: "ACTIVE" | "SUSPENDED" | null;
  page?: number;
  pageSize?: number;
  scopedAccountIds?: string[] | null;
}

export interface UserListResult {
  rows: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export async function listUsers(
  params: UserListParams = {},
): Promise<UserListResult> {
  const {
    search,
    accountId,
    profileSystemKey,
    status,
    page = 1,
    pageSize = 25,
    scopedAccountIds,
  } = params;

  // Tenant scope · si vacío, devolver vacío
  if (Array.isArray(scopedAccountIds) && scopedAccountIds.length === 0) {
    return { rows: [], total: 0, page, pageSize, pageCount: 1 };
  }

  const where: Prisma.UserWhereInput = {};
  if (Array.isArray(scopedAccountIds)) {
    // Solo usuarios de los accounts del scope · usuarios cross-account
    // (SA/MA con accountId=null) NO se ven cuando hay scope restringido
    where.accountId = { in: scopedAccountIds };
  }
  if (accountId) where.accountId = accountId;
  if (status) where.status = status;
  if (profileSystemKey) {
    where.profile = { systemKey: profileSystemKey as any };
  }
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName: { contains: search } },
      { email: { contains: search } },
      { documentNumber: { contains: search } },
    ];
  }

  const [total, items] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        account: { select: { name: true } },
        profile: { select: { systemKey: true, nameLabel: true } },
      },
    }),
  ]);

  const rows: UserListRow[] = items.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    documentNumber: u.documentNumber,
    phone: u.phone,
    status: u.status as "ACTIVE" | "SUSPENDED",
    accountId: u.accountId,
    accountName: u.account?.name ?? null,
    profileId: u.profileId,
    profileSystemKey: u.profile.systemKey as UserListRow["profileSystemKey"],
    profileLabel: u.profile.nameLabel,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));

  return {
    rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// ═══════════════════════════════════════════════════════════════
//  Counts (KPI strip)
// ═══════════════════════════════════════════════════════════════

export interface UserCounts {
  total: number;
  active: number;
  suspended: number;
  superAdmin: number;
  maxtrackerAdmin: number;
  clientAdmin: number;
  operator: number;
}

export async function getUserCounts(opts: {
  scopedAccountIds?: string[] | null;
} = {}): Promise<UserCounts> {
  if (
    Array.isArray(opts.scopedAccountIds) &&
    opts.scopedAccountIds.length === 0
  ) {
    return {
      total: 0,
      active: 0,
      suspended: 0,
      superAdmin: 0,
      maxtrackerAdmin: 0,
      clientAdmin: 0,
      operator: 0,
    };
  }

  const where: Prisma.UserWhereInput = Array.isArray(opts.scopedAccountIds)
    ? { accountId: { in: opts.scopedAccountIds } }
    : {};

  const [total, active, byProfile] = await Promise.all([
    db.user.count({ where }),
    db.user.count({ where: { ...where, status: "ACTIVE" } }),
    db.user.findMany({
      where,
      select: { profile: { select: { systemKey: true } } },
    }),
  ]);

  const byKey: Record<string, number> = {
    SUPER_ADMIN: 0,
    MAXTRACKER_ADMIN: 0,
    CLIENT_ADMIN: 0,
    OPERATOR: 0,
  };
  for (const u of byProfile) {
    const k = u.profile.systemKey;
    byKey[k] = (byKey[k] ?? 0) + 1;
  }

  return {
    total,
    active,
    suspended: total - active,
    superAdmin: byKey.SUPER_ADMIN ?? 0,
    maxtrackerAdmin: byKey.MAXTRACKER_ADMIN ?? 0,
    clientAdmin: byKey.CLIENT_ADMIN ?? 0,
    operator: byKey.OPERATOR ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Helpers para drawer
// ═══════════════════════════════════════════════════════════════

export async function getUserForEdit(
  userId: string,
  scopedAccountIds: string[] | null,
): Promise<{
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string | null;
  phone: string | null;
  status: "ACTIVE" | "SUSPENDED";
  accountId: string | null;
  accountName: string | null;
  profileId: string;
  profileSystemKey: string;
  profileLabel: string;
} | null> {
  if (Array.isArray(scopedAccountIds) && scopedAccountIds.length === 0) {
    return null;
  }
  const where: Prisma.UserWhereInput = { id: userId };
  if (Array.isArray(scopedAccountIds)) {
    where.accountId = { in: scopedAccountIds };
  }
  const u = await db.user.findFirst({
    where,
    include: {
      account: { select: { name: true } },
      profile: { select: { systemKey: true, nameLabel: true } },
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    documentNumber: u.documentNumber,
    phone: u.phone,
    status: u.status as "ACTIVE" | "SUSPENDED",
    accountId: u.accountId,
    accountName: u.account?.name ?? null,
    profileId: u.profileId,
    profileSystemKey: u.profile.systemKey,
    profileLabel: u.profile.nameLabel,
  };
}

/**
 * Lista de perfiles disponibles · usado por el selectbox del drawer.
 * Cada perfil incluye su systemKey para que el drawer aplique
 * reglas de UI (ej · CLIENT_ADMIN solo puede crear OPERATOR).
 */
export async function listProfilesForSelect(): Promise<
  { id: string; systemKey: string; nameLabel: string }[]
> {
  return db.profile.findMany({
    select: { id: true, systemKey: true, nameLabel: true },
    orderBy: { nameLabel: "asc" },
  });
}
