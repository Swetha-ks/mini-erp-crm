import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../config/prisma";

const createChallanSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
});

async function generateChallanNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.challan.count({
    where: { challanNumber: { startsWith: `CH-${year}-` } },
  });
  return `CH-${year}-${String(count + 1).padStart(4, "0")}`;
}

// Creates a DRAFT challan. No stock is touched yet.
export async function createChallan(req: Request, res: Response) {
  try {
    const data = createChallanSchema.parse(req.body);

    const customer = await prisma.customer.findUnique({ where: { id: data.customerId } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });

    const productIds = data.items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    if (products.length !== productIds.length) {
      return res.status(400).json({ error: "One or more products not found" });
    }

    const challanNumber = await generateChallanNumber();
    const totalQuantity = data.items.reduce((sum, i) => sum + i.quantity, 0);

    const challan = await prisma.challan.create({
      data: {
        challanNumber,
        customerId: data.customerId,
        totalQuantity,
        status: "DRAFT",
        createdById: req.user!.userId,
        items: {
          create: data.items.map((item) => {
            const product = products.find((p) => p.id === item.productId)!;
            return {
              productId: product.id,
              productNameSnapshot: product.name,
              skuSnapshot: product.sku,
              unitPriceSnapshot: product.unitPrice,
              quantity: item.quantity,
            };
          }),
        },
      },
      include: { items: true, customer: true },
    });

    res.status(201).json(challan);
  } catch (err: any) {
    if (err.name === "ZodError") return res.status(400).json({ error: "Invalid input", details: err.errors });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

// The critical function: confirms a draft, checks + deducts stock atomically.
export async function confirmChallan(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const result = await prisma.$transaction(async (tx) => {
      const challan = await tx.challan.findUnique({ where: { id }, include: { items: true } });
      if (!challan) throw new Error("NOT_FOUND");
      if (challan.status !== "DRAFT") throw new Error("NOT_DRAFT");

      // Check ALL items have enough stock BEFORE deducting any of them.
      for (const item of challan.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product || product.currentStock < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${item.productNameSnapshot}:${product?.currentStock ?? 0}`);
        }
      }

      // All checks passed — now actually deduct stock and log movements.
      for (const item of challan.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            movementType: "OUT",
            reason: `Challan ${challan.challanNumber} confirmed`,
            createdById: req.user!.userId,
          },
        });
      }

      return tx.challan.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: { items: true, customer: true },
      });
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Challan not found" });
    if (err.message === "NOT_DRAFT") return res.status(400).json({ error: "Only DRAFT challans can be confirmed" });
    if (err.message?.startsWith("INSUFFICIENT_STOCK")) {
      const [, name, available] = err.message.split(":");
      return res.status(400).json({ error: `Insufficient stock for "${name}": available ${available}` });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function listChallans(req: Request, res: Response) {
  try {
    const challans = await prisma.challan.findMany({
      include: { customer: true, items: true },
      orderBy: { createdAt: "desc" },
    });
    res.json(challans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

export async function getChallan(req: Request, res: Response) {
  try {
    const challan = await prisma.challan.findUnique({
      where: { id: req.params.id as string },
      include: { items: true, customer: true },
    });
    if (!challan) return res.status(404).json({ error: "Challan not found" });
    res.json(challan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}

// Cancels a challan. If it was CONFIRMED, restores the stock that was deducted.
export async function cancelChallan(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const result = await prisma.$transaction(async (tx) => {
      const challan = await tx.challan.findUnique({ where: { id }, include: { items: true } });
      if (!challan) throw new Error("NOT_FOUND");
      if (challan.status === "CANCELLED") throw new Error("ALREADY_CANCELLED");

      if (challan.status === "CONFIRMED") {
        for (const item of challan.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: { increment: item.quantity } },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              movementType: "IN",
              reason: `Challan ${challan.challanNumber} cancelled — stock restored`,
              createdById: req.user!.userId,
            },
          });
        }
      }

      return tx.challan.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: { items: true, customer: true },
      });
    });

    res.json(result);
  } catch (err: any) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Challan not found" });
    if (err.message === "ALREADY_CANCELLED") return res.status(400).json({ error: "Challan is already cancelled" });
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
}