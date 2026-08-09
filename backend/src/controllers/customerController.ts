import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";

const customerSchema = z.object({
  name: z.string().min(2),
  mobile: z.string().min(7),
  email: z.string().email().optional().nullable(),
  businessName: z.string().optional().nullable(),
  gstNumber: z.string().optional().nullable(),
  customerType: z.enum(["RETAIL", "WHOLESALE", "DISTRIBUTOR"]),
  address: z.string().optional().nullable(),
  status: z.enum(["LEAD", "ACTIVE", "INACTIVE"]).optional(),
  followUpDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function createCustomer(req: Request, res: Response) {
  try {
    const data = customerSchema.parse(req.body);
    const customer = await prisma.customer.create({
      data: { ...data, followUpDate: data.followUpDate ? new Date(data.followUpDate) : null },
    });
    res.status(201).json(customer);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid input", details: err.errors });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

// Now supports pagination (?page=1&pageSize=20) and search across more fields
export async function listCustomers(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, parseInt(req.query.pageSize as string) || 20);
    const q = (req.query.q as string) || "";
    const status = req.query.status as string | undefined;

    const where: any = {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { mobile: { contains: q, mode: "insensitive" } },
                { businessName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        status ? { status } : {},
      ],
    };

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({
      data: customers,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function getCustomer(req: Request, res: Response) {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.params.id as string },
      include: { followUps: { orderBy: { createdAt: "desc" } }, challans: true },
    });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function updateCustomer(req: Request, res: Response) {
  try {
    const data = customerSchema.partial().parse(req.body);
    const customer = await prisma.customer.update({
      where: { id: req.params.id as string },
      data: { ...data, followUpDate: data.followUpDate ? new Date(data.followUpDate) : undefined },
    });
    res.json(customer);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid input", details: err.errors });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function addFollowUp(req: Request, res: Response) {
  try {
    const { note } = z.object({ note: z.string().min(1) }).parse(req.body);
    const followUp = await prisma.followUpNote.create({
      data: { customerId: req.params.id as string, note, createdById: req.user!.userId },
    });
    res.status(201).json(followUp);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}